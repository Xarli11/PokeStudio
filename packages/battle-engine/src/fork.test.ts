import { describe, expect, it } from 'vitest';

import { BattleDomainError } from './errors';
import { forkBattle } from './fork';
import { restoreBattle } from './replay';
import { createBattle } from './session';
import { doublesTeam, legalOuTeam } from './test/fixtures';
import { firstChoice } from './test/helpers';
import type { BattleFormatId } from './formats';
import type {
  BattleCommand,
  BattleReplay,
  BattleSession,
  BattleSideId,
  BattleTeamInput,
} from './types';

const SEED = 'gen5,0001000200030004';
const CASES: [BattleFormatId, BattleTeamInput][] = [
  ['sv-ou', legalOuTeam],
  ['sv-doubles-ou', doublesTeam],
];

function playToEnd(formatId: BattleFormatId, team: BattleTeamInput): BattleSession {
  const session = createBattle({
    formatId,
    seed: SEED,
    sides: { p1: { displayName: 'A', team }, p2: { displayName: 'B', team } },
  });
  for (let i = 0; i < 500 && session.getState('spectator').status !== 'finished'; i++) {
    for (const side of ['p1', 'p2'] as const) {
      if (session.getState('spectator').status === 'finished') break;
      const command = firstChoice(session.getLegalChoices(side));
      if (command) session.submitChoice(side, command);
    }
  }
  return session;
}

/** The first move-turn decision, and a legal command for p1 there that differs from the original. */
function alternative(replay: BattleReplay) {
  const first = replay.commands.find(
    (entry) =>
      entry.side === 'p1' &&
      entry.command.kind === 'actions' &&
      entry.command.actions.some((action) => action.kind === 'move'),
  );
  if (!first) throw new Error('no move decision');
  const boundary = restoreBattle(replay, { atDecision: first.decision });
  const choices = boundary.getLegalChoices('p1');
  if (choices.kind !== 'move') throw new Error('expected a move decision');
  const original = JSON.stringify(first.command);
  // Every slot picks its LAST usable move: different from the first-move policy that played it.
  const command: BattleCommand = {
    kind: 'actions',
    actions: choices.slots.map(({ slot, options }) => {
      const moves = options.filter((option) => option.kind === 'move');
      const option = moves.at(-1);
      if (!option || option.kind !== 'move') return { kind: 'pass', slot };
      const target = option.targets?.[0];
      return { kind: 'move', slot, moveId: option.moveId, ...(target ? { target } : {}) };
    }),
  };
  expect(JSON.stringify(command)).not.toBe(original);
  return { decision: first.decision, command };
}

describe.each(CASES)('battle forks: %s', (formatId, team) => {
  const original = playToEnd(formatId, team);
  const replay = original.getReplay();
  const { decision, command } = alternative(replay);

  it('forks at a decision: the alternative diverges only after the boundary', () => {
    const fork = forkBattle(replay, { atDecision: decision, side: 'p1', command });
    expect(fork.atDecision).toBe(decision);
    expect(fork.reused).toEqual(['p2']);
    expect(fork.pending).toEqual([]);
    const before = original.getEvents('spectator');
    const after = fork.session.getEvents('spectator');
    const shared = before.findIndex(
      (event, index) => JSON.stringify(event) !== JSON.stringify(after[index]),
    );
    expect(shared).toBeGreaterThan(0); // history before the boundary is identical
    expect(after.length).toBeGreaterThan(shared);
    // The alternative recorded the replacement and the reused opponent command, not the original.
    const forked = fork.session.getReplay().commands.filter((entry) => entry.decision === decision);
    expect(forked.find((entry) => entry.side === 'p1')?.command).toEqual(command);
    expect(forked.find((entry) => entry.side === 'p2')?.command).toEqual(
      replay.commands.find((entry) => entry.decision === decision && entry.side === 'p2')?.command,
    );
  });

  it('is deterministic: the same fork twice gives the same events and state', () => {
    const a = forkBattle(replay, { atDecision: decision, side: 'p1', command });
    const b = forkBattle(replay, { atDecision: decision, side: 'p1', command });
    for (const perspective of ['p1', 'p2', 'spectator'] as const) {
      expect(a.session.getEvents(perspective)).toEqual(b.session.getEvents(perspective));
    }
  });

  it('never mutates the original replay or session, and the fork is independent', () => {
    const snapshot = structuredClone(replay);
    const eventsBefore = structuredClone(original.getEvents('omniscient'));
    const fork = forkBattle(replay, { atDecision: decision, side: 'p1', command });
    // keep playing the fork; the original must not notice
    for (let i = 0; i < 20 && fork.session.getState('spectator').status !== 'finished'; i++) {
      for (const side of ['p1', 'p2'] as const) {
        if (fork.session.getState('spectator').status === 'finished') break;
        const next = firstChoice(fork.session.getLegalChoices(side));
        if (next) fork.session.submitChoice(side, next);
      }
    }
    expect(replay).toEqual(snapshot);
    expect(original.getReplay()).toEqual(snapshot);
    expect(original.getEvents('omniscient')).toEqual(eventsBefore);
    expect(fork.session.info.battleId).not.toBe(original.info.battleId);
    // the fork's own replay restores by itself
    const own = fork.session.getReplay();
    expect(restoreBattle(own).getEvents('spectator')).toEqual(fork.session.getEvents('spectator'));
  });

  it('rejects a decision point that does not exist', () => {
    for (const atDecision of [-1, 1.5, 100_000]) {
      expect(() => forkBattle(replay, { atDecision, side: 'p1', command })).toThrowError(
        expect.objectContaining({ code: 'INVALID_REPLAY' }) as Error,
      );
    }
  });

  it('rejects an illegal replacement with the typed choice error', () => {
    const bogus: BattleCommand = {
      kind: 'actions',
      actions: [{ kind: 'move', slot: { side: 'p1', position: 0 }, moveId: 'notamove' }],
    };
    let error: unknown;
    try {
      forkBattle(replay, { atDecision: decision, side: 'p1', command: bogus });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(BattleDomainError);
    expect((error as BattleDomainError).code).toBe('ILLEGAL_CHOICE');
  });

  it('asks again when the opponent original is no longer legal', () => {
    const broken = structuredClone(replay);
    const entry = broken.commands.find((item) => item.decision === decision && item.side === 'p2');
    if (!entry) throw new Error('missing p2 command');
    entry.command = {
      kind: 'actions',
      actions: [{ kind: 'move', slot: { side: 'p2', position: 0 }, moveId: 'notamove' }],
    };
    const fork = forkBattle(broken, { atDecision: decision, side: 'p1', command });
    expect(fork.reused).toEqual([]);
    expect(fork.pending).toEqual(['p2' satisfies BattleSideId]);
    expect(fork.session.getLegalChoices('p2').kind).toBe('move');
  });
});
