import { describe, expect, it } from 'vitest';

import { buildTurns } from './timeline';
import type { BattleEvent } from './types';

const ref = (side: 'p1' | 'p2', teamIndex = 0) => ({ side, teamIndex });
let seq = 0;
const ev = <T extends Record<string, unknown>>(
  turn: number,
  body: T,
  extra: Partial<BattleEvent> = {},
) => ({ seq: ++seq, turn, ...body, ...extra }) as unknown as BattleEvent;

function sample(): BattleEvent[] {
  seq = 0;
  const events: BattleEvent[] = [];
  events.push(ev(0, { type: 'battle-started' }));
  events.push(ev(0, { type: 'team-preview' }));
  const s1 = ev(0, {
    type: 'switched',
    slot: { side: 'p1', position: 0 },
    pokemon: ref('p1'),
    forced: false,
  });
  events.push(s1);
  events.push(ev(1, { type: 'turn-started' }));
  const move = ev(1, {
    type: 'move-used',
    user: ref('p1'),
    moveId: 'earthquake',
    target: ref('p2'),
  });
  events.push(move);
  events.push(
    ev(
      1,
      { type: 'effectiveness', pokemon: ref('p2'), result: 'super-effective' },
      { parentSeq: move.seq },
    ),
  );
  events.push(
    ev(
      1,
      {
        type: 'hp-changed',
        pokemon: ref('p2'),
        hp: { kind: 'percent', percent: 40 },
        change: 'damage',
      },
      { parentSeq: move.seq },
    ),
  );
  events.push(
    ev(
      1,
      {
        type: 'hp-changed',
        pokemon: ref('p2'),
        hp: { kind: 'percent', percent: 46 },
        change: 'heal',
      },
      { cause: { kind: 'item', id: 'leftovers' } },
    ),
  );
  events.push(ev(2, { type: 'turn-started' }));
  const second = ev(2, { type: 'move-used', user: ref('p2'), moveId: 'roost' });
  events.push(second);
  events.push(
    ev(
      2,
      {
        type: 'hp-changed',
        pokemon: ref('p2'),
        hp: { kind: 'percent', percent: 96 },
        change: 'heal',
      },
      { parentSeq: second.seq },
    ),
  );
  return events;
}

describe('buildTurns', () => {
  const turns = buildTurns(sample());

  it('groups events by turn, turn 0 first', () => {
    expect(turns.map((t) => t.turn)).toEqual([0, 1, 2]);
    expect(turns[0]!.markers.map((e) => e.type)).toEqual(['battle-started', 'team-preview']);
    expect(turns[0]!.actions.map((a) => a.action.type)).toEqual(['switched']);
  });

  it('attaches consequences to their action and leaves residual effects separate', () => {
    const turn = turns[1]!;
    expect(turn.actions).toHaveLength(1);
    expect(turn.actions[0]!.children.map((e) => e.type)).toEqual(['effectiveness', 'hp-changed']);
    expect(turn.residual.map((e) => e.type)).toEqual(['hp-changed']);
    expect(turn.markers.map((e) => e.type)).toEqual(['turn-started']);
  });

  it('derives HP before and after from the events, starting from full HP', () => {
    expect(turns[1]!.hp).toEqual([
      {
        pokemon: ref('p2'),
        before: { kind: 'percent', percent: 100 },
        after: { kind: 'percent', percent: 46 },
      },
    ]);
    // Turn 2 starts where turn 1 ended.
    expect(turns[2]!.hp[0]!.before).toEqual({ kind: 'percent', percent: 46 });
    expect(turns[2]!.hp[0]!.after).toEqual({ kind: 'percent', percent: 96 });
  });

  it("records each turn's sequence range", () => {
    expect(turns[1]!.firstSeq).toBeLessThan(turns[1]!.lastSeq);
    expect(turns[2]!.firstSeq).toBeGreaterThan(turns[1]!.lastSeq);
  });

  it('follows an effect that answers a switch back to its action', () => {
    seq = 0;
    const events: BattleEvent[] = [];
    const sw = ev(0, {
      type: 'switched',
      slot: { side: 'p1', position: 0 },
      pokemon: ref('p1'),
      forced: false,
    });
    events.push(sw);
    const effect = ev(
      0,
      {
        type: 'effect-activated',
        pokemon: ref('p1'),
        effect: { kind: 'ability', id: 'intimidate' },
      },
      { parentSeq: sw.seq },
    );
    events.push(effect);
    events.push(
      ev(
        0,
        { type: 'stat-boosted', pokemon: ref('p2'), stat: 'atk', delta: -1 },
        { parentSeq: effect.seq },
      ),
    );
    const [turn] = buildTurns(events);
    expect(turn!.actions).toHaveLength(1);
    expect(turn!.actions[0]!.children.map((e) => e.type)).toEqual([
      'effect-activated',
      'stat-boosted',
    ]);
    expect(turn!.residual).toEqual([]);
  });

  it('uses the exact maximum as "full" for exact-HP perspectives', () => {
    seq = 0;
    const events = [
      ev(1, { type: 'move-used', user: ref('p2'), moveId: 'x' }),
      ev(
        1,
        {
          type: 'hp-changed',
          pokemon: ref('p1'),
          hp: { kind: 'exact', current: 100, max: 300 },
          change: 'damage',
        },
        { parentSeq: 1 },
      ),
    ];
    expect(buildTurns(events)[0]!.hp[0]!.before).toEqual({ kind: 'exact', current: 300, max: 300 });
  });

  it('is empty for no events', () => {
    expect(buildTurns([])).toEqual([]);
  });
});
