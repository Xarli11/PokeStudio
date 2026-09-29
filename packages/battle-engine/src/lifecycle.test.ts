import { describe, expect, it } from 'vitest';

import { BattleDomainError } from './errors';
import { createBattleForTests, resultFromWinner } from './session';
import { ChannelProcessor } from './showdown/events';
import { CUSTOM_FORMAT, SEED, teamA, teamB } from './test/fixtures';
import { newBattle, playToEnd, startTurnOne } from './test/helpers';
import type { BattleCommand } from './types';

const attack = (side: 'p1' | 'p2', moveId: string): BattleCommand => ({
  kind: 'actions',
  actions: [{ kind: 'move', slot: { side, position: 0 }, moveId }],
});

describe('lifecycle', () => {
  it('waits for both sides, then resolves and advances the turn', () => {
    const session = newBattle();
    expect(session.getState('omniscient').requests).toEqual({
      p1: { kind: 'team-preview', submitted: false },
      p2: { kind: 'team-preview', submitted: false },
    });

    const first = session.submitChoice('p1', { kind: 'team-order', order: [0, 1] });
    expect(first.resolved).toBe(false);
    expect(session.getState('omniscient').requests).toEqual({
      p1: { kind: 'team-preview', submitted: true },
      p2: { kind: 'team-preview', submitted: false },
    });
    expect(session.getState('omniscient').turn).toBe(0);

    const second = session.submitChoice('p2', { kind: 'team-order', order: [0, 1] });
    expect(second.resolved).toBe(true);
    expect(session.getState('omniscient').turn).toBe(1);
    expect(session.getState('omniscient').requests.p1).toEqual({ kind: 'move', submitted: false });

    session.submitChoice('p1', attack('p1', 'protect'));
    session.submitChoice('p2', attack('p2', 'roost'));
    expect(session.getState('spectator').turn).toBe(2);
  });

  it("reports events for the submitter's perspective, monotonically", () => {
    const session = newBattle();
    startTurnOne(session);
    const before = session.getState('p1').eventCursor;
    session.submitChoice('p1', attack('p1', 'protect'));
    const result = session.submitChoice('p2', attack('p2', 'roost'));
    const seqs = result.events.map((event) => event.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(seqs[0]).toBeGreaterThan(before);
    expect(session.getEvents('p2', before).length).toBeGreaterThan(0);
    expect(session.getEvents('p2', result.state.eventCursor)).toEqual([]);
    expect(result.state.eventCursor).toBe(seqs.at(-1));
  });

  it('plays to a finish: faint, finished, winner by side id (not display name)', () => {
    const same = { displayName: 'Same Name' };
    const session = createBattleForTests({
      formatId: CUSTOM_FORMAT,
      seed: SEED,
      sides: { p1: { ...same, team: teamA }, p2: { ...same, team: teamB } },
    });
    playToEnd(session);
    const state = session.getState('spectator');
    expect(state.status).toBe('finished');
    expect(state.result).toMatchObject({ kind: 'win' });
    const winner = (state.result as { winner: string }).winner;
    expect(['p1', 'p2']).toContain(winner);
    const loser = winner === 'p1' ? 'p2' : 'p1';
    expect(state.sides[loser].pokemonLeft).toBe(0);
    expect(state.sides[winner as 'p1' | 'p2'].pokemonLeft).toBeGreaterThan(0);
    expect(state.requests).toEqual({});

    const types = session.getEvents('spectator').map((e) => e.type);
    expect(types).toContain('fainted');
    expect(types.at(-1)).toBe('battle-ended');
    expect(session.getEvents('spectator').at(-1)).toMatchObject({
      type: 'battle-ended',
      result: state.result,
    });
  });

  it('accepts no command and offers no choices after the battle finished', () => {
    const session = newBattle();
    playToEnd(session);
    for (const side of ['p1', 'p2'] as const) {
      expect(() => session.submitChoice(side, attack(side, 'earthquake'))).toThrowError(
        BattleDomainError,
      );
      try {
        session.submitChoice(side, attack(side, 'earthquake'));
      } catch (error) {
        expect((error as BattleDomainError).code).toBe('BATTLE_FINISHED');
      }
      try {
        session.getLegalChoices(side);
        throw new Error('should throw');
      } catch (error) {
        expect((error as BattleDomainError).code).toBe('BATTLE_FINISHED');
      }
    }
    // Reading state and events stays possible.
    expect(session.getState('omniscient').status).toBe('finished');
  });

  it('maps the engine winner name to a side id, and an empty winner to a tie', () => {
    expect(resultFromWinner('P1')).toEqual({ kind: 'win', winner: 'p1' });
    expect(resultFromWinner('P2')).toEqual({ kind: 'win', winner: 'p2' });
    expect(resultFromWinner('')).toEqual({ kind: 'tie' });
    expect(resultFromWinner('Ash')).toEqual({ kind: 'tie' });
  });

  it('uses the very same mapping for events: |win|P1/P2 by side name, |win| empty and |tie as ties', () => {
    const events = (line: string) => {
      const processor = new ChannelProcessor('spectator', () => undefined, resultFromWinner);
      processor.feed([line]);
      return processor.events.map((e) => (e.type === 'battle-ended' ? e.result : e));
    };
    expect(events('|win|P1')).toEqual([{ kind: 'win', winner: 'p1' }]);
    expect(events('|win|P2')).toEqual([{ kind: 'win', winner: 'p2' }]);
    expect(events('|tie')).toEqual([{ kind: 'tie' }]);
    // A display name can never be mistaken for a side: only the fixed engine names map to wins.
    expect(events('|win|Ash')).toEqual([{ kind: 'tie' }]);
  });
});
