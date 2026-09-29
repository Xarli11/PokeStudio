import { describe, expect, it } from 'vitest';

import { newBattle, startTurnOne } from './test/helpers';
import type { BattleCommand, BattlePerspective } from './types';

const PERSPECTIVES: BattlePerspective[] = ['p1', 'p2', 'spectator', 'omniscient'];
const move = (side: 'p1' | 'p2', moveId: string): BattleCommand => ({
  kind: 'actions',
  actions: [{ kind: 'move', slot: { side, position: 0 }, moveId }],
});

describe('event sequencing: seq / afterSeq / eventCursor', () => {
  it('starts at seq 1 and is contiguous in every perspective', () => {
    const session = newBattle();
    startTurnOne(session);
    session.submitChoice('p1', move('p1', 'earthquake'));
    session.submitChoice('p2', move('p2', 'extremespeed'));
    for (const perspective of PERSPECTIVES) {
      const events = session.getEvents(perspective);
      expect(events.length).toBeGreaterThan(5);
      expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));
    }
  });

  it('eventCursor is the last seq of that perspective (0 before any event), and afterSeq is exclusive', () => {
    const session = newBattle();
    for (const perspective of PERSPECTIVES) {
      const events = session.getEvents(perspective);
      expect(session.getState(perspective).eventCursor).toBe(events.at(-1)?.seq ?? 0);
    }
    startTurnOne(session);
    for (const perspective of PERSPECTIVES) {
      const all = session.getEvents(perspective);
      const cursor = session.getState(perspective).eventCursor;
      expect(cursor).toBe(all.length);
      expect(session.getEvents(perspective, cursor)).toEqual([]); // nothing newer
      expect(session.getEvents(perspective, cursor - 1).map((e) => e.seq)).toEqual([cursor]);
      expect(session.getEvents(perspective, 0)).toEqual(all);
      expect(session.getEvents(perspective, 2).map((e) => e.seq)).toEqual(
        all.slice(2).map((e) => e.seq),
      );
      expect(session.getEvents(perspective, 10_000)).toEqual([]);
    }
  });

  it('a submit returns exactly the events in (cursor before, cursor after] for the submitter', () => {
    const session = newBattle();
    startTurnOne(session);
    const before = session.getState('p2').eventCursor;
    session.submitChoice('p1', move('p1', 'earthquake'));
    expect(session.getState('p2').eventCursor).toBe(before); // an unresolved submit adds nothing
    const result = session.submitChoice('p2', move('p2', 'extremespeed'));
    expect(result.resolved).toBe(true);
    expect(result.events.map((e) => e.seq)).toEqual(
      Array.from({ length: result.state.eventCursor - before }, (_, i) => before + 1 + i),
    );
    expect(result.events).toEqual(session.getEvents('p2', before));
  });

  it('the side that submitted first reads the resolution with its own cursor', () => {
    const session = newBattle();
    startTurnOne(session);
    const first = session.submitChoice('p1', move('p1', 'earthquake'));
    expect(first.events).toEqual([]);
    session.submitChoice('p2', move('p2', 'extremespeed'));
    const missed = session.getEvents('p1', first.state.eventCursor);
    expect(missed.some((e) => e.type === 'turn-started')).toBe(true);
    expect(session.getState('p1').eventCursor).toBe(missed.at(-1)?.seq);
  });

  it('rejects an invalid afterSeq', () => {
    const session = newBattle();
    for (const bad of [-1, 1.5, Number.NaN]) {
      expect(() => session.getEvents('p1', bad)).toThrowError(/afterSeq/);
    }
  });

  it('returns copies: mutating a result cannot corrupt the stream', () => {
    const session = newBattle();
    const events = session.getEvents('spectator') as unknown as { seq: number }[];
    events[0]!.seq = 999;
    expect(session.getEvents('spectator')[0]?.seq).toBe(1);
  });
});
