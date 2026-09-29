import { describe, expect, it } from 'vitest';

import { getDictionary } from '@pokestudio/i18n';

import { describeEvent, type EventCopyContext } from './event-copy';
import type { BattleEvent } from './types';

const ref = (side: 'p1' | 'p2' = 'p1', teamIndex = 0) => ({ side, teamIndex });
let n = 0;
const e = (body: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({ seq: ++n, turn: 3, ...body, ...extra }) as unknown as BattleEvent;

/** One event of every type the trace can produce. */
const EVENTS: BattleEvent[] = [
  e({ type: 'battle-started' }),
  e({ type: 'team-preview' }),
  e({ type: 'turn-started' }),
  e({ type: 'switched', slot: { side: 'p1', position: 0 }, pokemon: ref(), forced: false }),
  e({ type: 'switched', slot: { side: 'p1', position: 0 }, pokemon: ref(), forced: true }),
  e({ type: 'position-swapped', pokemon: ref(), slot: { side: 'p1', position: 1 } }),
  e({ type: 'move-used', user: ref(), moveId: 'dragonclaw' }),
  e({ type: 'move-used', user: ref(), moveId: 'dragonclaw', target: ref('p2') }),
  e({ type: 'move-missed', user: ref(), target: ref('p2') }),
  e({ type: 'move-failed', pokemon: ref() }),
  e({ type: 'move-failed', pokemon: ref(), moveId: 'sunnyday' }),
  e({ type: 'move-prevented', pokemon: ref(), reason: 'slp' }),
  e({ type: 'move-prevented', pokemon: ref(), reason: 'someotherreason' }),
  e({ type: 'immune', pokemon: ref('p2') }, { cause: { kind: 'ability', id: 'levitate' } }),
  e({ type: 'critical-hit', pokemon: ref('p2') }),
  e({ type: 'effectiveness', pokemon: ref('p2'), result: 'super-effective' }),
  e({ type: 'effectiveness', pokemon: ref('p2'), result: 'resisted' }),
  e(
    {
      type: 'hp-changed',
      pokemon: ref('p2'),
      hp: { kind: 'percent', percent: 40 },
      change: 'damage',
    },
    { cause: { kind: 'item', id: 'lifeorb' } },
  ),
  e({
    type: 'hp-changed',
    pokemon: ref(),
    hp: { kind: 'exact', current: 200, max: 300 },
    change: 'heal',
  }),
  e({
    type: 'hp-changed',
    pokemon: ref(),
    hp: { kind: 'exact', current: 1, max: 300 },
    change: 'set',
  }),
  e({ type: 'fainted', pokemon: ref('p2') }),
  e({ type: 'status-changed', pokemon: ref('p2'), status: 'brn' }),
  e({ type: 'status-changed', pokemon: ref('p2'), status: null }),
  e({ type: 'volatile-started', pokemon: ref(), id: 'substitute' }),
  e({ type: 'volatile-ended', pokemon: ref(), id: 'substitute' }),
  e({ type: 'stat-boosted', pokemon: ref(), stat: 'atk', delta: 2 }),
  e({ type: 'stat-boosted', pokemon: ref(), stat: 'spe', delta: -1 }),
  e({ type: 'effect-activated', pokemon: ref(), effect: { kind: 'ability', id: 'intimidate' } }),
  e({ type: 'effect-activated', pokemon: ref(), effect: { kind: 'item', id: 'focussash' } }),
  e({ type: 'effect-activated', pokemon: ref(), effect: { kind: 'move', id: 'protect' } }),
  e({ type: 'effect-activated', pokemon: ref(), effect: { kind: 'condition', id: 'confusion' } }),
  e({ type: 'item-changed', pokemon: ref(), item: 'lifeorb', change: 'gained' }),
  e({ type: 'item-changed', pokemon: ref(), item: 'sitrusberry', change: 'consumed' }),
  e({ type: 'item-changed', pokemon: ref(), item: 'leftovers', change: 'removed' }),
  e({ type: 'terastallized', pokemon: ref(), teraType: 'Fire' }),
  e({ type: 'forme-changed', pokemon: ref(), species: 'Aegislash-Blade' }),
  e({ type: 'field-changed', field: 'weather', id: 'sunnyday', active: true }),
  e({ type: 'field-changed', field: 'terrain', id: 'electricterrain', active: false }),
  e({
    type: 'field-changed',
    field: 'side-condition',
    id: 'stealthrock',
    active: true,
    side: 'p2',
  }),
  e({
    type: 'field-changed',
    field: 'side-condition',
    id: 'stealthrock',
    active: false,
    side: 'p2',
  }),
  e({ type: 'battle-ended', result: { kind: 'win', winner: 'p1' } }),
  e({ type: 'battle-ended', result: { kind: 'tie' } }),
];

const context = (locale: 'en' | 'es'): EventCopyContext => ({
  templates: getDictionary(locale).battle.sandbox.events,
  sideName: (side) => (side === 'p1' ? 'Player 1' : 'Player 2'),
  pokemonName: (r) => `Mon${r.teamIndex}(${r.side})`,
  moveName: (id) => `Move:${id}`,
  abilityName: (id) => `Ability:${id}`,
  itemName: (id) => `Item:${id}`,
  conditionName: (id) => `Cond:${id}`,
});

describe.each(['en', 'es'] as const)('event copy (%s)', (locale) => {
  const ctx = context(locale);

  it('describes every event type with a complete sentence (no unresolved placeholders)', () => {
    for (const event of EVENTS) {
      const text = describeEvent(event, ctx);
      expect(text, event.type).toBeTruthy();
      expect(text, event.type).not.toMatch(/[{}]/);
      expect(text, event.type).not.toMatch(/undefined|\[object/);
    }
  });

  it('covers every event type the engine defines', () => {
    const covered = new Set(EVENTS.map((event) => event.type));
    for (const type of [
      'battle-started',
      'team-preview',
      'turn-started',
      'switched',
      'position-swapped',
      'move-used',
      'move-missed',
      'move-failed',
      'move-prevented',
      'immune',
      'critical-hit',
      'effectiveness',
      'hp-changed',
      'fainted',
      'status-changed',
      'volatile-started',
      'volatile-ended',
      'stat-boosted',
      'effect-activated',
      'item-changed',
      'terastallized',
      'forme-changed',
      'field-changed',
      'battle-ended',
    ]) {
      expect(covered.has(type as BattleEvent['type']), type).toBe(true);
    }
  });

  it('fills names, targets, causes and numbers from the event fields', () => {
    const on = describeEvent(EVENTS[7]!, ctx)!;
    expect(on).toContain('Mon0(p1)');
    expect(on).toContain('Move:dragonclaw');
    expect(on).toContain('Mon0(p2)');
    const damage = describeEvent(EVENTS[17]!, ctx)!;
    expect(damage).toContain('40%');
    expect(damage).toContain('(Item:lifeorb)'); // the cause is shown
    expect(describeEvent(EVENTS[18]!, ctx)).toContain('200/300');
    expect(describeEvent(EVENTS[13]!, ctx)).toContain('(Ability:levitate)');
    expect(describeEvent(EVENTS[25]!, ctx)).toContain('2');
  });
});

describe('event copy is localized', () => {
  it("differs between locales and uses the locale's own words", () => {
    const en = describeEvent(EVENTS[6]!, context('en'))!;
    const es = describeEvent(EVENTS[6]!, context('es'))!;
    expect(en).not.toBe(es);
    expect(en).toMatch(/used/);
    expect(es).toMatch(/usó/);
  });

  it('EN and ES dictionaries define exactly the same event templates', () => {
    expect(Object.keys(getDictionary('es').battle.sandbox.events).sort()).toEqual(
      Object.keys(getDictionary('en').battle.sandbox.events).sort(),
    );
  });

  it('never invents text for unknown reasons: it falls back to the condition name', () => {
    const text = describeEvent(EVENTS[12]!, context('en'))!;
    expect(text).toContain('Cond:someotherreason');
  });
});
