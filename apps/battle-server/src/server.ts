import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import {
  BattleDomainError,
  createBattle,
  getBattleDisplayNames,
  importTeamText,
} from '@pokestudio/battle-engine';
import type {
  BattleCommand,
  BattleConfig,
  BattlePerspective,
  BattleSession,
  BattleSideId,
} from '@pokestudio/battle-engine';

import { SessionStore } from './store';

export interface BattleServerOptions {
  /** Shared secret expected as `Authorization: Bearer <secret>`. Omit only for loopback use. */
  secret?: string | undefined;
  ttlMs?: number;
  maxSessions?: number;
  now?: () => number;
}

const MAX_BODY_BYTES = 512 * 1024;
const DEFAULT_TTL_MS = 60 * 60 * 1000;
const DEFAULT_MAX_SESSIONS = 500;
/** Perspectives a client may read. `omniscient` is deliberately not reachable over HTTP. */
const READABLE_PERSPECTIVES: readonly string[] = ['p1', 'p2', 'spectator'];

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details: unknown = {},
  ) {
    super(code);
  }
}

const STATUS_BY_ENGINE_CODE: Record<string, number> = {
  INVALID_CONFIG: 400,
  UNSUPPORTED_FORMAT: 400,
  INVALID_TEAM: 422,
  INVALID_SIDE: 400,
  ILLEGAL_CHOICE: 422,
  NOT_ACCEPTING_CHOICE: 409,
  CHOICE_ALREADY_SUBMITTED: 409,
  BATTLE_FINISHED: 409,
  INVALID_SERIES_STATE: 409,
  INVALID_REPLAY: 400,
};

function send(res: ServerResponse, status: number, body: unknown, cache = 'no-store') {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': cache,
  });
  res.end(text);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const type = req.headers['content-type'] ?? '';
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE');
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'MALFORMED_JSON');
  }
}

const isSide = (value: string | undefined): value is BattleSideId =>
  value === 'p1' || value === 'p2';

/**
 * The battle server: a thin HTTP layer over authoritative `BattleSession`s. Every read is scoped to
 * a player perspective or the spectator; nothing omniscient is ever served, and the replay (which
 * holds both teams and the seed) is only released once the battle has finished.
 */
export function createBattleServer(options: BattleServerOptions = {}) {
  const store = new SessionStore({
    ttlMs: options.ttlMs ?? DEFAULT_TTL_MS,
    maxSessions: options.maxSessions ?? DEFAULT_MAX_SESSIONS,
    ...(options.now ? { now: options.now } : {}),
  });

  const session = (id: string | undefined): BattleSession => {
    const found = id ? store.get(id) : undefined;
    if (!found) throw new HttpError(404, 'BATTLE_NOT_FOUND');
    return found;
  };

  const perspectiveOf = (value: string | undefined): BattlePerspective => {
    if (!value || !READABLE_PERSPECTIVES.includes(value)) {
      throw new HttpError(400, 'PERSPECTIVE_NOT_ALLOWED', { allowed: READABLE_PERSPECTIVES });
    }
    return value as BattlePerspective;
  };

  const sideOf = (value: string | undefined): BattleSideId => {
    if (!isSide(value)) throw new HttpError(400, 'INVALID_SIDE', { received: String(value) });
    return value;
  };

  async function route(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://battle-server');
    const parts = url.pathname.split('/').filter(Boolean);
    const method = req.method ?? 'GET';

    if (method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, sessions: store.size });
    }

    if (options.secret !== undefined) {
      const header = req.headers['authorization'] ?? '';
      const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
      if (!safeEqual(token, options.secret)) throw new HttpError(401, 'UNAUTHORIZED');
    }

    if (parts[0] !== 'v1') throw new HttpError(404, 'NOT_FOUND');

    // Static helpers.
    if (method === 'GET' && parts[1] === 'names' && parts.length === 2) {
      return send(res, 200, getBattleDisplayNames(), 'private, max-age=3600');
    }
    if (method === 'POST' && parts[1] === 'teams' && parts[2] === 'import' && parts.length === 3) {
      const body = (await readJson(req)) as { text?: unknown } | null;
      return send(res, 200, { team: importTeamText(body?.text) });
    }

    if (parts[1] !== 'battles') throw new HttpError(404, 'NOT_FOUND');

    if (method === 'POST' && parts.length === 2) {
      const config = (await readJson(req)) as BattleConfig;
      const created = createBattle(config);
      if (!store.add(created)) throw new HttpError(503, 'CAPACITY_REACHED');
      return send(res, 201, { battleId: created.info.battleId, format: created.info.format });
    }

    const id = parts[2];
    if (method === 'DELETE' && parts.length === 3) {
      if (!store.delete(id ?? '')) throw new HttpError(404, 'BATTLE_NOT_FOUND');
      return send(res, 200, { deleted: true });
    }

    const kind = parts[3];
    if (method === 'GET' && kind === 'state' && parts.length === 5) {
      return send(res, 200, session(id).getState(perspectiveOf(parts[4])));
    }
    if (method === 'GET' && kind === 'events' && parts.length === 5) {
      const afterRaw = url.searchParams.get('afterSeq');
      const after = afterRaw === null ? 0 : Number(afterRaw);
      return send(res, 200, { events: session(id).getEvents(perspectiveOf(parts[4]), after) });
    }
    if (method === 'GET' && kind === 'choices' && parts.length === 5) {
      return send(res, 200, session(id).getLegalChoices(sideOf(parts[4])));
    }
    if (method === 'POST' && kind === 'commands' && parts.length === 5) {
      const side = sideOf(parts[4]);
      const command = (await readJson(req)) as BattleCommand;
      return send(res, 200, session(id).submitChoice(side, command));
    }
    if (method === 'GET' && kind === 'replay' && parts.length === 4) {
      const found = session(id);
      if (found.getState('spectator').status !== 'finished') {
        throw new HttpError(409, 'BATTLE_NOT_FINISHED');
      }
      return send(res, 200, found.getReplay());
    }
    throw new HttpError(404, 'NOT_FOUND');
  }

  const server: Server = createServer((req, res) => {
    route(req, res).catch((error: unknown) => {
      if (res.headersSent) return;
      if (error instanceof HttpError) {
        return send(res, error.status, { error: { code: error.code, details: error.details } });
      }
      if (error instanceof BattleDomainError) {
        const status =
          error.code === 'ENGINE_ERROR' ? 500 : (STATUS_BY_ENGINE_CODE[error.code] ?? 400);
        // Engine failures never leak their cause or message.
        const body =
          error.code === 'ENGINE_ERROR'
            ? { error: { code: error.code, details: {} } }
            : { error: { code: error.code, details: error.details } };
        if (error.code === 'ENGINE_ERROR') console.error('battle engine error', error.details);
        return send(res, status, body);
      }
      console.error('unexpected error in battle server');
      return send(res, 500, { error: { code: 'INTERNAL_ERROR', details: {} } });
    });
  });

  const sweeper = setInterval(() => store.sweep(), 60_000);
  sweeper.unref();
  server.on('close', () => clearInterval(sweeper));

  return { server, store };
}
