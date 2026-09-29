import { battleError, BattleDomainError } from './errors';
import { findBattleFormat } from './formats';
import { createBattle } from './session';
import { SIMULATOR_VERSION } from './showdown/version';
import type {
  BattleCommand,
  BattleReplay,
  BattleReplayCommand,
  BattleResult,
  BattleSession,
  BattleSideId,
} from './types';

/** The replay schema this build reads and writes. */
export const BATTLE_REPLAY_SCHEMA_VERSION = 1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isSide = (value: unknown): value is BattleSideId => value === 'p1' || value === 'p2';
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

function malformed(issues: string[]): never {
  throw battleError(
    'INVALID_REPLAY',
    { reason: 'malformed', issues },
    `Malformed replay: ${issues.join('; ')}`,
  );
}

function isResult(value: unknown): value is BattleResult {
  if (!isRecord(value)) return false;
  return value['kind'] === 'tie' || (value['kind'] === 'win' && isSide(value['winner']));
}

function isCommand(value: unknown): value is BattleCommand {
  if (!isRecord(value)) return false;
  if (value['kind'] === 'team-order') {
    return Array.isArray(value['order']) && value['order'].every(isCount);
  }
  return (
    value['kind'] === 'actions' &&
    Array.isArray(value['actions']) &&
    value['actions'].every((action) => isRecord(action) && typeof action['kind'] === 'string')
  );
}

/**
 * Validates and returns a copy of a replay (an object or its JSON text). Rejects anything that is
 * not a well-formed replay of a schema this build supports, with a typed `INVALID_REPLAY`.
 * It checks structure only; whether the commands reproduce is decided by `restoreBattle`.
 */
export function parseBattleReplay(input: unknown): BattleReplay {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch (cause) {
      throw battleError(
        'INVALID_REPLAY',
        { reason: 'malformed-json' },
        'The replay is not valid JSON',
        cause,
      );
    }
  }
  if (!isRecord(value)) malformed(['replay must be an object']);
  if (value['schemaVersion'] !== BATTLE_REPLAY_SCHEMA_VERSION) {
    throw battleError(
      'INVALID_REPLAY',
      { reason: 'unsupported-version' },
      `Unsupported replay schema version ${String(value['schemaVersion'])}`,
    );
  }
  const issues: string[] = [];
  const engine = value['engine'];
  if (
    !isRecord(engine) ||
    engine['simulator'] !== 'pokemon-showdown' ||
    typeof engine['simulatorVersion'] !== 'string'
  ) {
    issues.push('engine must name the simulator and its version');
  }
  if (typeof value['formatId'] !== 'string') issues.push('formatId must be a string');
  if (typeof value['seed'] !== 'string') issues.push('seed must be a string');
  const sides = value['sides'];
  if (!isRecord(sides) || !isRecord(sides['p1']) || !isRecord(sides['p2'])) {
    issues.push('sides must contain p1 and p2');
  }
  if (value['result'] !== null && !isResult(value['result'])) issues.push('result is invalid');
  const commands = value['commands'];
  if (!Array.isArray(commands)) {
    issues.push('commands must be an array');
  } else {
    let previous = 0;
    commands.forEach((entry: unknown, index) => {
      if (
        !isRecord(entry) ||
        !isCount(entry['decision']) ||
        !isCount(entry['turn']) ||
        !isSide(entry['side']) ||
        !isCommand(entry['command'])
      ) {
        issues.push(`commands[${index}] is not a valid replay command`);
        return;
      }
      // Decisions are consecutive: each command is in the current decision or the next one.
      if (entry['decision'] < previous || entry['decision'] > previous + 1) {
        issues.push(`commands[${index}] has an out-of-order decision`);
      }
      previous = entry['decision'];
    });
  }
  if (issues.length > 0) malformed(issues);
  return structuredClone(value) as unknown as BattleReplay;
}

export interface RestoreOptions {
  /**
   * Restore the battle to the boundary just BEFORE this 0-based decision: every command of earlier
   * decisions is applied and none of this one. Omit to replay everything recorded.
   */
  atDecision?: number;
}

const rejected = (
  reason: 'invalid-config' | 'commands-rejected',
  cause: unknown,
  commandIndex?: number,
) =>
  battleError(
    'INVALID_REPLAY',
    commandIndex === undefined ? { reason } : { reason, commandIndex },
    `The replay does not reproduce: ${reason}`,
    cause,
  );

/**
 * Rebuilds a battle from a replay by re-creating it from its format, seed and teams and replaying
 * the recorded commands through the normal `submitChoice` path. The returned session is a real,
 * live `BattleSession` (further commands are accepted and recorded). Correctness over speed: it
 * always replays from the start.
 *
 * Throws `INVALID_REPLAY` for malformed/unsupported/incompatible replays, for commands the engine
 * rejects, for a final result that differs from the recorded one, and for a decision boundary that
 * does not exist.
 */
export function restoreBattle(input: unknown, options: RestoreOptions = {}): BattleSession {
  const replay = parseBattleReplay(input);
  if (replay.engine.simulatorVersion !== SIMULATOR_VERSION) {
    throw battleError(
      'INVALID_REPLAY',
      { reason: 'incompatible-engine' },
      `Replay was recorded with simulator ${replay.engine.simulatorVersion}, this build runs ${SIMULATOR_VERSION}`,
    );
  }
  const lastDecision = replay.commands.at(-1)?.decision ?? -1;
  const { atDecision } = options;
  if (
    atDecision !== undefined &&
    !(isCount(atDecision) && atDecision <= Math.max(lastDecision, 0))
  ) {
    throw battleError(
      'INVALID_REPLAY',
      { reason: 'decision-out-of-range' },
      `Decision ${String(atDecision)} does not exist in this replay`,
    );
  }
  if (!findBattleFormat(replay.formatId)) {
    throw battleError(
      'INVALID_REPLAY',
      { reason: 'invalid-config' },
      `Unknown format "${replay.formatId}"`,
    );
  }

  let session: BattleSession;
  try {
    session = createBattle({ formatId: replay.formatId, seed: replay.seed, sides: replay.sides });
  } catch (cause) {
    if (cause instanceof BattleDomainError && cause.code === 'ENGINE_ERROR') throw cause;
    throw rejected('invalid-config', cause);
  }

  const toApply: BattleReplayCommand[] =
    atDecision === undefined
      ? replay.commands
      : replay.commands.filter((entry) => entry.decision < atDecision);
  for (const [index, entry] of toApply.entries()) {
    try {
      session.submitChoice(entry.side, entry.command);
    } catch (cause) {
      throw rejected('commands-rejected', cause, index);
    }
  }

  if (atDecision === undefined && replay.result) {
    const state = session.getState('omniscient');
    const same =
      state.status === 'finished' &&
      state.result !== null &&
      state.result.kind === replay.result.kind &&
      (state.result.kind === 'tie' ||
        (replay.result.kind === 'win' && state.result.winner === replay.result.winner));
    if (!same) {
      throw battleError(
        'INVALID_REPLAY',
        { reason: 'result-mismatch' },
        'The replayed battle ended differently from the recording',
      );
    }
  }
  return session;
}
