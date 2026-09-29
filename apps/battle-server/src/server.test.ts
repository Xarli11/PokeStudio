import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import type {
  BattleCommand,
  BattleConfig,
  BattleLegalChoices,
  BattleState,
  BattleTeamInput,
} from '@pokestudio/battle-engine';

import { createBattleServer, type BattleServerOptions } from './server';

const OU_TEAM: BattleTeamInput = {
  members: [
    {
      species: 'Gholdengo',
      ability: 'Good as Gold',
      item: 'Choice Scarf',
      nature: 'Timid',
      moves: ['Make It Rain', 'Shadow Ball', 'Trick', 'Focus Blast'],
      evs: { spa: 252, spe: 252, hp: 4 },
    },
    {
      species: 'Kingambit',
      ability: 'Defiant',
      item: 'Leftovers',
      nature: 'Adamant',
      moves: ['Kowtow Cleave', 'Sucker Punch', 'Swords Dance', 'Iron Head'],
      evs: { atk: 252, hp: 252, spd: 4 },
    },
  ],
};

const config = (over: Partial<BattleConfig> = {}): BattleConfig => ({
  formatId: 'sv-ou',
  seed: 'gen5,0001000200030004',
  sides: {
    p1: { displayName: 'Ash', team: OU_TEAM },
    p2: { displayName: 'Gary', team: OU_TEAM },
  },
  ...over,
});

const running: { close: () => Promise<void> }[] = [];

async function start(options: BattleServerOptions = {}) {
  const { server, store } = createBattleServer(options);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  running.push({
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  });
  const call = async (
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined
        ? {}
        : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    });
    const text = await response.text();
    return {
      status: response.status,
      // Test helper: response bodies are asserted field by field, so they are left loosely typed.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: text ? (JSON.parse(text) as any) : null,
      headers: response.headers,
    };
  };
  return { call, store, base };
}

afterEach(async () => {
  while (running.length) await running.pop()!.close();
});

const order = (...o: number[]): BattleCommand => ({ kind: 'team-order', order: o });
const attack = (side: 'p1' | 'p2', moveId: string): BattleCommand => ({
  kind: 'actions',
  actions: [{ kind: 'move', slot: { side, position: 0 }, moveId }],
});

describe('battle server: lifecycle over HTTP', () => {
  it('creates a battle and plays it with per-perspective reads', async () => {
    const { call } = await start();
    const created = await call('POST', '/v1/battles', config());
    expect(created.status).toBe(201);
    expect(created.body.format).toMatchObject({ id: 'sv-ou', gameType: 'singles' });
    const id = created.body.battleId as string;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    // The seed is never part of what a client receives.
    expect(JSON.stringify(created.body)).not.toContain('gen5,0001');

    for (const side of ['p1', 'p2'] as const) {
      const choices = (await call('GET', `/v1/battles/${id}/choices/${side}`))
        .body as BattleLegalChoices;
      expect(choices).toEqual({ kind: 'team-preview', side, pick: 2, of: 2 });
    }
    const first = await call('POST', `/v1/battles/${id}/commands/p1`, order(0, 1));
    expect(first.status).toBe(200);
    expect(first.body.resolved).toBe(false);
    expect(first.body.state.requests.p1).toEqual({ kind: 'team-preview', submitted: true });
    const second = await call('POST', `/v1/battles/${id}/commands/p2`, order(0, 1));
    expect(second.body.resolved).toBe(true);
    expect(second.body.state.turn).toBe(1);

    const p1 = (await call('GET', `/v1/battles/${id}/state/p1`)).body as BattleState;
    const spectator = (await call('GET', `/v1/battles/${id}/state/spectator`)).body as BattleState;
    expect(p1.perspective).toBe('p1');
    expect(p1.sides.p1.active[0]?.hp.kind).toBe('exact');
    expect(p1.sides.p2.active[0]?.hp.kind).toBe('percent');
    expect(spectator.requests).toEqual({});
    expect(p1.sides.p2.active[0]?.moves).toBeUndefined();
    const events = await call('GET', `/v1/battles/${id}/events/spectator?afterSeq=2`);
    expect(events.body.events.every((e: { seq: number }) => e.seq > 2)).toBe(true);
  });

  it('plays a full battle to the end and only then releases the replay', async () => {
    const { call } = await start();
    const id = (await call('POST', '/v1/battles', config())).body.battleId as string;
    const early = await call('GET', `/v1/battles/${id}/replay`);
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('BATTLE_NOT_FINISHED');

    await call('POST', `/v1/battles/${id}/commands/p1`, order(0, 1));
    await call('POST', `/v1/battles/${id}/commands/p2`, order(0, 1));
    for (let i = 0; i < 80; i++) {
      const status = (await call('GET', `/v1/battles/${id}/state/spectator`)).body as BattleState;
      if (status.status === 'finished') break;
      for (const side of ['p1', 'p2'] as const) {
        const choices = (await call('GET', `/v1/battles/${id}/choices/${side}`)).body;
        if (choices.error) continue; // finished mid-round
        if (choices.kind === 'wait') continue;
        const slot = choices.slots[0];
        const option =
          slot.options.find((o: { kind: string }) => o.kind === 'move') ?? slot.options[0];
        const action =
          option.kind === 'move'
            ? { kind: 'move', slot: slot.slot, moveId: option.moveId }
            : { kind: 'switch', slot: slot.slot, pokemon: option.pokemon };
        await call('POST', `/v1/battles/${id}/commands/${side}`, {
          kind: 'actions',
          actions: [action],
        });
      }
    }
    const done = (await call('GET', `/v1/battles/${id}/state/spectator`)).body as BattleState;
    expect(done.status).toBe('finished');
    const replay = await call('GET', `/v1/battles/${id}/replay`);
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ schemaVersion: 1, formatId: 'sv-ou' });
    expect(replay.body.commands.length).toBeGreaterThan(4);
    // A finished battle accepts nothing more.
    const late = await call('POST', `/v1/battles/${id}/commands/p1`, attack('p1', 'ironhead'));
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('BATTLE_FINISHED');
  });

  it('deletes a battle', async () => {
    const { call } = await start();
    const id = (await call('POST', '/v1/battles', config())).body.battleId as string;
    expect((await call('DELETE', `/v1/battles/${id}`)).status).toBe(200);
    expect((await call('GET', `/v1/battles/${id}/state/p1`)).status).toBe(404);
    expect((await call('DELETE', `/v1/battles/${id}`)).status).toBe(404);
  });
});

describe('battle server: hidden information', () => {
  it('never serves the omniscient perspective, on any route', async () => {
    const { call } = await start();
    const id = (await call('POST', '/v1/battles', config())).body.battleId as string;
    for (const path of [
      `/v1/battles/${id}/state/omniscient`,
      `/v1/battles/${id}/events/omniscient`,
      `/v1/battles/${id}/state/everyone`,
    ]) {
      const response = await call('GET', path);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('PERSPECTIVE_NOT_ALLOWED');
    }
  });

  it('a player perspective contains no rival secrets and no seed', async () => {
    const { call } = await start();
    const rival: BattleTeamInput = {
      members: [
        {
          species: 'Gholdengo',
          ability: 'Good as Gold',
          item: 'Focus Sash',
          nature: 'Timid',
          moves: ['Make It Rain', 'Nasty Plot', 'Trick', 'Focus Blast'],
          evs: { spa: 252, spe: 252, hp: 4 },
        },
      ],
    };
    const id = (
      await call(
        'POST',
        '/v1/battles',
        config({
          sides: {
            p1: { displayName: 'Ash', team: OU_TEAM },
            p2: { displayName: 'Gary', team: rival },
          },
        }),
      )
    ).body.battleId as string;
    for (const perspective of ['p1', 'spectator']) {
      const text = JSON.stringify(
        (await call('GET', `/v1/battles/${id}/state/${perspective}`)).body,
      );
      expect(text).not.toContain('gen5,0001');
      expect(text).not.toContain('"seed"');
      expect(text).not.toContain('focussash');
      expect(text).not.toContain('nastyplot');
    }
    const own = JSON.stringify((await call('GET', `/v1/battles/${id}/state/p2`)).body);
    expect(own).toContain('focussash'); // the owner sees its own
  });
});

describe('battle server: typed errors', () => {
  it('maps engine errors to statuses and codes without leaking messages or stacks', async () => {
    const { call } = await start();
    const id = (await call('POST', '/v1/battles', config())).body.battleId as string;
    const cases: [string, string, unknown, number, string][] = [
      ['POST', `/v1/battles/${id}/commands/p3`, order(0, 1), 400, 'INVALID_SIDE'],
      ['GET', `/v1/battles/${id}/choices/x`, undefined, 400, 'INVALID_SIDE'],
      ['POST', `/v1/battles/${id}/commands/p1`, order(0, 0), 422, 'ILLEGAL_CHOICE'],
      ['POST', `/v1/battles/${id}/commands/p1`, { kind: 'nope' }, 422, 'ILLEGAL_CHOICE'],
    ];
    for (const [method, path, body, status, code] of cases) {
      const response = await call(method, path, body);
      expect(response.status, `${method} ${path}`).toBe(status);
      expect(response.body.error.code).toBe(code);
      expect(JSON.stringify(response.body)).not.toMatch(/stack|at \w+ \(|node_modules/);
    }
    await call('POST', `/v1/battles/${id}/commands/p1`, order(0, 1));
    const again = await call('POST', `/v1/battles/${id}/commands/p1`, order(1, 0));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('CHOICE_ALREADY_SUBMITTED');
    await call('POST', `/v1/battles/${id}/commands/p2`, order(0, 1));
  });

  it('reports invalid teams and unsupported formats from the engine', async () => {
    const { call } = await start();
    const badTeam = await call(
      'POST',
      '/v1/battles',
      config({
        sides: {
          p1: { displayName: 'A', team: { members: [] } },
          p2: { displayName: 'B', team: OU_TEAM },
        },
      }),
    );
    expect(badTeam.status).toBe(422);
    expect(badTeam.body.error).toMatchObject({ code: 'INVALID_TEAM', details: { side: 'p1' } });
    const raw = await call('POST', '/v1/battles', config({ formatId: 'gen9ou' as never }));
    expect(raw.status).toBe(400);
    expect(raw.body.error).toMatchObject({
      code: 'UNSUPPORTED_FORMAT',
      details: { reason: 'not-in-catalog' },
    });
  });

  it('rejects bad requests before they reach the engine', async () => {
    const { call, base } = await start();
    expect((await call('POST', '/v1/battles', '{not json')).body.error.code).toBe('MALFORMED_JSON');
    const noType = await fetch(`${base}/v1/battles`, { method: 'POST', body: '{}' });
    expect(noType.status).toBe(415);
    const big = await call('POST', '/v1/battles', { pad: 'x'.repeat(600 * 1024) });
    expect(big.status).toBe(413);
    expect((await call('GET', '/v1/nothing')).status).toBe(404);
    expect((await call('GET', '/nope')).status).toBe(404);
    expect(
      (await call('GET', '/v1/battles/ffffffff-ffff-ffff-ffff-ffffffffffff/state/p1')).status,
    ).toBe(404);
  });
});

describe('battle server: access, lifetime and capacity', () => {
  it('requires the shared secret when one is configured (health stays open)', async () => {
    const { call } = await start({ secret: 's3cret' });
    expect((await call('GET', '/health')).status).toBe(200);
    expect((await call('POST', '/v1/battles', config())).status).toBe(401);
    expect(
      (await call('POST', '/v1/battles', config(), { authorization: 'Bearer nope' })).status,
    ).toBe(401);
    expect((await call('POST', '/v1/battles', config(), { authorization: 's3cret' })).status).toBe(
      401,
    );
    const ok = await call('POST', '/v1/battles', config(), { authorization: 'Bearer s3cret' });
    expect(ok.status).toBe(201);
  });

  it('expires idle sessions after the TTL and renews them on use', async () => {
    let now = 1_000_000;
    const { call, store } = await start({ ttlMs: 10_000, now: () => now });
    const id = (await call('POST', '/v1/battles', config())).body.battleId as string;
    now += 8_000;
    expect((await call('GET', `/v1/battles/${id}/state/p1`)).status).toBe(200); // renewed
    now += 8_000;
    expect((await call('GET', `/v1/battles/${id}/state/p1`)).status).toBe(200);
    now += 11_000;
    expect((await call('GET', `/v1/battles/${id}/state/p1`)).status).toBe(404);
    expect(store.size).toBe(0);
  });

  it('refuses new battles at capacity and frees room when one is deleted', async () => {
    const { call } = await start({ maxSessions: 2 });
    const a = (await call('POST', '/v1/battles', config())).body.battleId as string;
    await call('POST', '/v1/battles', config());
    const full = await call('POST', '/v1/battles', config());
    expect(full.status).toBe(503);
    expect(full.body.error.code).toBe('CAPACITY_REACHED');
    await call('DELETE', `/v1/battles/${a}`);
    expect((await call('POST', '/v1/battles', config())).status).toBe(201);
  });

  it('keeps sessions independent and never mixes their state', async () => {
    const { call } = await start();
    const a = (await call('POST', '/v1/battles', config())).body.battleId as string;
    const b = (await call('POST', '/v1/battles', config())).body.battleId as string;
    expect(a).not.toBe(b);
    await call('POST', `/v1/battles/${a}/commands/p1`, order(0, 1));
    const stateB = (await call('GET', `/v1/battles/${b}/state/p1`)).body as BattleState;
    expect(stateB.requests.p1?.submitted).toBe(false);
  });
});

describe('battle server: helpers', () => {
  it('serves display names for ids and imports pasted teams', async () => {
    const { call } = await start();
    const names = await call('GET', '/v1/names');
    expect(names.status).toBe(200);
    expect(names.body.moves.dragonclaw).toBe('Dragon Claw');
    expect(names.headers.get('cache-control')).toMatch(/max-age/);

    const imported = await call('POST', '/v1/teams/import', {
      text: 'Garchomp @ Life Orb\nAbility: Rough Skin\nEVs: 252 Atk\nJolly Nature\n- Earthquake\n',
    });
    expect(imported.status).toBe(200);
    expect(imported.body.team.members[0]).toMatchObject({ species: 'Garchomp', item: 'Life Orb' });
    const bad = await call('POST', '/v1/teams/import', { text: '' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_CONFIG');
  });

  it('reports its health and session count', async () => {
    const { call } = await start();
    await call('POST', '/v1/battles', config());
    expect((await call('GET', '/health')).body).toEqual({ ok: true, sessions: 1 });
  });
});

describe('battle server: forks', () => {
  type Call = Awaited<ReturnType<typeof start>>['call'];
  async function playToEnd(call: Call, id: string) {
    await call('POST', `/v1/battles/${id}/commands/p1`, order(0, 1));
    await call('POST', `/v1/battles/${id}/commands/p2`, order(0, 1));
    for (let i = 0; i < 80; i++) {
      for (const side of ['p1', 'p2'] as const) {
        const choices = (await call('GET', `/v1/battles/${id}/choices/${side}`)).body;
        if (choices.error || choices.kind === 'wait') continue;
        const slot = choices.slots[0];
        const option =
          slot.options.find((o: { kind: string }) => o.kind === 'move') ?? slot.options[0];
        const action =
          option.kind === 'move'
            ? { kind: 'move', slot: slot.slot, moveId: option.moveId }
            : { kind: 'switch', slot: slot.slot, pokemon: option.pokemon };
        await call('POST', `/v1/battles/${id}/commands/${side}`, {
          kind: 'actions',
          actions: [action],
        });
      }
      const state = (await call('GET', `/v1/battles/${id}/state/spectator`)).body as BattleState;
      if (state.status === 'finished') return;
    }
    throw new Error('battle did not finish');
  }

  it('forks only finished battles, into a separate readable session, leaving the original alone', async () => {
    const { call, store } = await start();
    const id = (await call('POST', '/v1/battles', config())).body.battleId as string;
    const early = await call('POST', `/v1/battles/${id}/forks`, {});
    expect(early.status).toBe(409);

    await playToEnd(call, id);
    const replay = (await call('GET', `/v1/battles/${id}/replay`)).body;
    const decision = replay.commands.find(
      (c: { side: string; command: { kind: string } }) =>
        c.side === 'p1' && c.command.kind === 'actions',
    ).decision as number;

    // Ask a restored copy what p1 may do there, through the fork route's own rules.
    const alt = {
      kind: 'actions',
      actions: [{ kind: 'move', slot: { side: 'p1', position: 0 }, moveId: 'shadowball' }],
    };
    const forked = await call('POST', `/v1/battles/${id}/forks`, {
      atDecision: decision,
      side: 'p1',
      command: alt,
    });
    expect(forked.status).toBe(201);
    expect(forked.body.battleId).not.toBe(id);
    expect(forked.body.reused).toEqual(['p2']);
    expect(forked.body.pending).toEqual([]);
    expect(store.size).toBe(2);
    const events = await call('GET', `/v1/battles/${forked.body.battleId}/events/spectator`);
    expect(events.status).toBe(200);
    // The boundary before that decision offers p1 its choices again.
    const boundary = await call('GET', `/v1/battles/${id}/decisions/${decision}/p1`);
    expect(boundary.status).toBe(200);
    expect(boundary.body.choices.kind).toBe('move');
    expect(boundary.body.state.requests.p1.submitted).not.toBe(true);
    expect((await call('GET', `/v1/battles/${id}/decisions/x/p1`)).body.error.code).toBe(
      'INVALID_DECISION',
    );
    expect((await call('GET', `/v1/battles/${id}/decisions/99999/p1`)).body.error.code).toBe(
      'INVALID_REPLAY',
    );
    // The fork is not finished, so it does not release its own replay or forks either.
    expect((await call('GET', `/v1/battles/${forked.body.battleId}/replay`)).status).toBe(409);
    // The original still has its full history.
    expect((await call('GET', `/v1/battles/${id}/replay`)).body).toEqual(replay);
  });

  it('rejects bad decision points, sides and illegal replacements', async () => {
    const { call } = await start();
    const id = (await call('POST', '/v1/battles', config())).body.battleId as string;
    await playToEnd(call, id);
    const alt = {
      kind: 'actions',
      actions: [{ kind: 'move', slot: { side: 'p1', position: 0 }, moveId: 'shadowball' }],
    };
    const bad = (body: unknown) => call('POST', `/v1/battles/${id}/forks`, body);
    expect((await bad({ atDecision: 'x', side: 'p1', command: alt })).body.error.code).toBe(
      'INVALID_DECISION',
    );
    expect((await bad({ atDecision: 1, side: 'omniscient', command: alt })).body.error.code).toBe(
      'INVALID_SIDE',
    );
    expect((await bad({ atDecision: 9999, side: 'p1', command: alt })).body.error.code).toBe(
      'INVALID_REPLAY',
    );
    const illegal = await bad({
      atDecision: 1,
      side: 'p1',
      command: {
        kind: 'actions',
        actions: [{ kind: 'move', slot: { side: 'p1', position: 0 }, moveId: 'notamove' }],
      },
    });
    expect(illegal.status).toBe(422);
    expect(illegal.body.error.code).toBe('ILLEGAL_CHOICE');
  });
});
