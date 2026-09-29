import { describe, expect, it } from 'vitest';

import { BattleDomainError } from './errors';
import { newBattle, startTurnOne } from './test/helpers';

describe('BattleSideHandle (the future agent boundary)', () => {
  it('exposes exactly the side-scoped API and nothing else', () => {
    const handle = newBattle().forSide('p1');
    expect(Object.keys(handle).sort()).toEqual([
      'getEvents',
      'getLegalChoices',
      'getState',
      'side',
      'submitChoice',
    ]);
    expect(Object.isFrozen(handle)).toBe(true);
    for (const forbidden of ['info', 'seed', 'battle', 'getState_omniscient', 'forSide']) {
      expect(forbidden in handle).toBe(false);
    }
  });

  it('always reports its own perspective; the omniscient view cannot be requested through it', () => {
    const session = newBattle();
    const handle = session.forSide('p2');
    expect(handle.getState().perspective).toBe('p2');
    // Extra arguments are ignored: the perspective stays locked to the side.
    expect(
      (handle.getState as (perspective?: string) => { perspective: string })('omniscient')
        .perspective,
    ).toBe('p2');
    expect(Object.keys(handle.getState().requests)).toEqual(['p2']);
    expect(JSON.stringify(handle.getState())).not.toContain(session.info.seed);
  });

  it('runs the full loop with structured choices only: state → choices → submit → next state/events', () => {
    const session = newBattle();
    const [ash, gary] = [session.forSide('p1'), session.forSide('p2')];
    for (const agent of [ash, gary]) {
      const choices = agent.getLegalChoices();
      expect(choices).toMatchObject({ kind: 'team-preview' });
      const result = agent.submitChoice({ kind: 'team-order', order: [0, 1] });
      expect(result.state.perspective).toBe(agent.side);
    }
    const choices = ash.getLegalChoices();
    if (choices.kind !== 'move') throw new Error('expected a move request');
    const option = choices.slots[0]!.options[0]!;
    if (option.kind !== 'move') throw new Error('expected a move');
    // Choices are plain data: no strings that look like engine syntax.
    expect(JSON.stringify(choices)).not.toMatch(/\bmove \d|team \d|\|/);
    const first = ash.submitChoice({
      kind: 'actions',
      actions: [{ kind: 'move', slot: choices.slots[0]!.slot, moveId: option.moveId }],
    });
    expect(first.resolved).toBe(false);
    const other = gary.getLegalChoices();
    if (other.kind !== 'move') throw new Error('expected a move request');
    const theirs = other.slots[0]!.options[0]!;
    if (theirs.kind !== 'move') throw new Error('expected a move');
    const next = gary.submitChoice({
      kind: 'actions',
      actions: [{ kind: 'move', slot: other.slots[0]!.slot, moveId: theirs.moveId }],
    });
    expect(next.resolved).toBe(true);
    expect(next.events.length).toBeGreaterThan(0);
    expect(next.state.turn).toBe(2);
    // The first side reads what happened with its own cursor.
    expect(ash.getEvents(first.state.eventCursor).length).toBe(next.events.length);
  });

  it('cannot see hidden rival information', () => {
    const session = newBattle();
    startTurnOne(session);
    const state = session.forSide('p1').getState();
    const rival = state.sides.p2.active[0]!;
    expect(rival.moves).toBeUndefined();
    expect(rival.item).toBeUndefined();
    expect(rival.types).toBeUndefined();
    expect(rival.hp.kind).toBe('percent');
    expect(state.sides.p1.active[0]?.hp.kind).toBe('exact');
  });

  it('surfaces the same typed errors', () => {
    const handle = newBattle().forSide('p1');
    try {
      handle.submitChoice({ kind: 'actions', actions: [] });
      throw new Error('should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BattleDomainError);
      expect((error as BattleDomainError).code).toBe('ILLEGAL_CHOICE');
    }
  });
});
