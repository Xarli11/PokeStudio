import { beforeEach, describe, expect, it, vi } from 'vitest';

const battleServer = vi.fn();
vi.mock('@/lib/battle/server-client', () => ({
  battleServer: (...args: unknown[]) => battleServer(...args),
}));

import {
  createFork,
  createSandboxBattle,
  loadDecisionView,
  importTeamText,
  loadEvents,
  loadPerspectiveState,
  loadReplay,
  loadSideView,
  submitSandboxCommand,
} from './actions';

const ID = '9f9626b1-d5a9-41d2-b136-1b2c3d4e5f60';
const TEAM = { members: [{ species: 'garchomp', ability: 'rough-skin', moves: ['earthquake'] }] };

beforeEach(() => {
  battleServer.mockReset();
  battleServer.mockResolvedValue({ ok: true, data: {} });
});

describe('sandbox server actions', () => {
  it('creates a battle with fixed player names (user text never goes to the server as a name)', async () => {
    await createSandboxBattle({ formatId: 'sv-ou', p1Team: TEAM, p2Team: TEAM });
    expect(battleServer).toHaveBeenCalledWith('POST', '/v1/battles', {
      formatId: 'sv-ou',
      sides: {
        p1: { displayName: 'Player 1', team: TEAM },
        p2: { displayName: 'Player 2', team: TEAM },
      },
    });
  });

  it.each(['', 'SV OU', 'sv_ou', '../x', 'a'.repeat(60), 12, null])(
    'rejects the format id %j without calling the server',
    async (formatId) => {
      const result = await createSandboxBattle({
        formatId: formatId as never,
        p1Team: TEAM,
        p2Team: TEAM,
      });
      expect(result).toEqual({ ok: false, error: { code: 'INVALID_CONFIG' } });
      expect(battleServer).not.toHaveBeenCalled();
    },
  );

  it('only reads player and spectator perspectives — there is no omniscient read', async () => {
    for (const perspective of ['omniscient', 'everyone', '', undefined]) {
      expect(await loadPerspectiveState(ID, perspective as never)).toEqual({
        ok: false,
        error: { code: 'INVALID_CONFIG' },
      });
      expect(await loadEvents(ID, perspective as never)).toEqual({
        ok: false,
        error: { code: 'INVALID_CONFIG' },
      });
    }
    expect(battleServer).not.toHaveBeenCalled();
    await loadPerspectiveState(ID, 'spectator');
    expect(battleServer).toHaveBeenCalledWith('GET', `/v1/battles/${ID}/state/spectator`);
  });

  it.each(['', 'not-an-id', '../../x', `${ID}/../${ID}`, 42])(
    'rejects the battle id %j',
    async (id) => {
      for (const result of [
        await loadSideView(id as never, 'p1'),
        await submitSandboxCommand(id as never, 'p1', { kind: 'team-order', order: [0] }),
        await loadReplay(id as never),
      ]) {
        expect(result).toEqual({ ok: false, error: { code: 'INVALID_CONFIG' } });
      }
      expect(battleServer).not.toHaveBeenCalled();
    },
  );

  it('rejects an invalid side or command', async () => {
    expect(
      (await submitSandboxCommand(ID, 'p3' as never, { kind: 'team-order', order: [0] })).ok,
    ).toBe(false);
    expect((await submitSandboxCommand(ID, 'p1', null as never)).ok).toBe(false);
    expect((await loadSideView(ID, 'spectator' as never)).ok).toBe(false);
    expect((await loadEvents(ID, 'p1', -1)).ok).toBe(false);
    expect((await loadEvents(ID, 'p1', 1.5)).ok).toBe(false);
    expect(battleServer).not.toHaveBeenCalled();
  });

  it('forwards commands, events and imports to the right routes', async () => {
    await submitSandboxCommand(ID, 'p2', { kind: 'team-order', order: [1, 0] });
    expect(battleServer).toHaveBeenLastCalledWith('POST', `/v1/battles/${ID}/commands/p2`, {
      kind: 'team-order',
      order: [1, 0],
    });
    await loadEvents(ID, 'p1', 7);
    expect(battleServer).toHaveBeenLastCalledWith('GET', `/v1/battles/${ID}/events/p1?afterSeq=7`);
    await importTeamText('Garchomp');
    expect(battleServer).toHaveBeenLastCalledWith('POST', '/v1/teams/import', { text: 'Garchomp' });
    await loadReplay(ID);
    expect(battleServer).toHaveBeenLastCalledWith('GET', `/v1/battles/${ID}/replay`);
  });

  it('a finished battle has no choices: the state alone is the side view', async () => {
    battleServer.mockImplementation(async (_method: string, path: string) =>
      path.includes('/choices/')
        ? { ok: false, error: { code: 'BATTLE_FINISHED' } }
        : { ok: true, data: { status: 'finished' } },
    );
    expect(await loadSideView(ID, 'p1')).toEqual({
      ok: true,
      data: { state: { status: 'finished' }, choices: { kind: 'wait', side: 'p1' } },
    });
  });

  it('surfaces other server errors from a side view', async () => {
    battleServer.mockResolvedValue({ ok: false, error: { code: 'BATTLE_NOT_FOUND' } });
    expect(await loadSideView(ID, 'p1')).toEqual({
      ok: false,
      error: { code: 'BATTLE_NOT_FOUND' },
    });
  });
});

describe('fork actions', () => {
  const command = { kind: 'actions', actions: [] } as never;

  it('forwards a valid fork and decision read', async () => {
    await createFork(ID, { atDecision: 2, side: 'p1', command });
    expect(battleServer).toHaveBeenCalledWith('POST', `/v1/battles/${ID}/forks`, {
      atDecision: 2,
      side: 'p1',
      command,
    });
    await loadDecisionView(ID, 2, 'p2');
    expect(battleServer).toHaveBeenCalledWith('GET', `/v1/battles/${ID}/decisions/2/p2`);
  });

  it('rejects bad ids, decisions and sides without calling the server', async () => {
    for (const result of await Promise.all([
      createFork('nope', { atDecision: 1, side: 'p1', command }),
      createFork(ID, { atDecision: -1, side: 'p1', command }),
      createFork(ID, { atDecision: 1.5, side: 'p1', command }),
      createFork(ID, { atDecision: 1, side: 'omniscient' as never, command }),
      loadDecisionView(ID, 1, 'spectator' as never),
      loadDecisionView(ID, Number.NaN, 'p1'),
    ])) {
      expect(result).toEqual({ ok: false, error: { code: 'INVALID_CONFIG' } });
    }
    expect(battleServer).not.toHaveBeenCalled();
  });
});
