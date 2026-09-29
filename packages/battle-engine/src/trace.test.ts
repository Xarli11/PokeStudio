import { describe, expect, it } from 'vitest';

import { createBattle, createBattleForTests } from './session';
import { championsBssTeam, doublesTeam, legalOuTeam } from './test/fixtures';
import { playToEnd } from './test/helpers';
import type {
  BattleCommand,
  BattleEvent,
  BattlePerspective,
  BattleSession,
  BattleSideId,
  BattleTeamInput,
} from './types';

const SEED = 'gen5,0001000200030004';
const solo = (
  species: string,
  ability: string,
  moves: string[],
  item?: string,
): BattleTeamInput => ({ members: [{ species, ability, moves, ...(item ? { item } : {}) }] });

const custom = (
  p1: BattleTeamInput,
  p2: BattleTeamInput,
  seed = SEED,
  formatId = 'gen9customgame',
) =>
  createBattleForTests({
    formatId,
    seed,
    sides: { p1: { displayName: 'A', team: p1 }, p2: { displayName: 'B', team: p2 } },
  });

const move = (
  side: BattleSideId,
  moveId: string,
  extra: Record<string, unknown> = {},
  position = 0,
): BattleCommand =>
  ({
    kind: 'actions',
    actions: [{ kind: 'move', slot: { side, position }, moveId, ...extra }],
  }) as BattleCommand;

/** Team preview for one-Pokémon teams, then one turn of commands. */
function begin(session: BattleSession, size = 1) {
  const order = Array.from({ length: size }, (_, i) => i);
  session.submitChoice('p1', { kind: 'team-order', order });
  session.submitChoice('p2', { kind: 'team-order', order });
}
function turn(session: BattleSession, p1: BattleCommand, p2: BattleCommand) {
  session.submitChoice('p1', p1);
  session.submitChoice('p2', p2);
}
const types = (events: readonly BattleEvent[]) => events.map((e) => e.type);
const since = (session: BattleSession, from: number) => session.getEvents('omniscient', from);

describe('structured trace: causality (parentSeq / cause)', () => {
  const session = custom(
    solo(
      'Rotom-Wash',
      'Levitate',
      ['Hydro Pump', 'Substitute', 'Sunny Day', 'Stealth Rock'],
      'Leftovers',
    ),
    solo(
      'Garchomp',
      'Rough Skin',
      ['Dragon Claw', 'Earthquake', 'Swords Dance', 'Knock Off'],
      'Life Orb',
    ),
  );
  begin(session);
  const turns: BattleEvent[][] = [];
  for (const [a, b] of [
    ['hydropump', 'dragonclaw'],
    ['substitute', 'earthquake'],
    ['sunnyday', 'swordsdance'],
    ['stealthrock', 'knockoff'],
  ] as const) {
    const from = session.getEvents('omniscient').length;
    turn(session, move('p1', a), move('p2', b));
    turns.push([...since(session, from)]);
  }
  const all = session.getEvents('omniscient');
  const byType = (events: readonly BattleEvent[], type: BattleEvent['type']) =>
    events.filter((e) => e.type === type);

  it('links damage, effectiveness and item effects to the move that caused them', () => {
    const claw = turns[0]!.find((e) => e.type === 'move-used' && e.moveId === 'dragonclaw')!;
    const damage = turns[0]!.filter((e) => e.type === 'hp-changed' && e.parentSeq === claw.seq);
    expect(damage.length).toBeGreaterThanOrEqual(2); // the hit and the Life Orb recoil
    const recoil = damage.find((e) => e.cause?.kind === 'item')!;
    expect(recoil.cause).toEqual({ kind: 'item', id: 'lifeorb' });
    expect(recoil.type === 'hp-changed' && recoil.change).toBe('damage');
  });

  it('marks immunity with the ability that caused it, under the attacking move', () => {
    const quake = turns[1]!.find((e) => e.type === 'move-used' && e.moveId === 'earthquake')!;
    const immune = turns[1]!.find((e) => e.type === 'immune')!;
    expect(immune.parentSeq).toBe(quake.seq);
    expect(immune.cause).toEqual({ kind: 'ability', id: 'levitate' });
  });

  it('end-of-turn effects belong to no action (Leftovers heals have no parent)', () => {
    const heals = all.filter((e) => e.type === 'hp-changed' && e.cause?.id === 'leftovers');
    expect(heals.length).toBeGreaterThan(0);
    expect(
      heals.every(
        (e) => e.parentSeq === undefined && e.type === 'hp-changed' && e.change === 'heal',
      ),
    ).toBe(true);
    // ...and turn boundaries never have a parent either.
    expect(
      all.filter((e) => e.type === 'turn-started').every((e) => e.parentSeq === undefined),
    ).toBe(true);
  });

  it('models volatile conditions, boosts and field changes', () => {
    expect(byType(turns[1]!, 'volatile-started')).toMatchObject([{ id: 'substitute' }]);
    expect(byType(turns[2]!, 'stat-boosted')).toMatchObject([{ stat: 'atk', delta: 2 }]);
    expect(byType(turns[2]!, 'field-changed')).toMatchObject([
      { field: 'weather', id: 'sunnyday', active: true },
    ]);
    expect(byType(turns[3]!, 'field-changed')).toMatchObject([
      { field: 'side-condition', id: 'stealthrock', active: true, side: 'p2' },
    ]);
    // Knock Off breaks the substitute (volatile ends) under that move.
    const knock = turns[3]!.find((e) => e.type === 'move-used' && e.moveId === 'knockoff')!;
    const ended = turns[3]!.find((e) => e.type === 'volatile-ended')!;
    expect(ended).toMatchObject({ id: 'substitute', parentSeq: knock.seq });
  });

  it('every parentSeq points at an earlier action event of the same turn, in every perspective', () => {
    const battle = createBattle({
      formatId: 'sv-doubles-ou',
      seed: SEED,
      sides: {
        p1: { displayName: 'A', team: doublesTeam },
        p2: { displayName: 'B', team: doublesTeam },
      },
    });
    playToEnd(battle, undefined, 800);
    for (const perspective of ['p1', 'p2', 'spectator', 'omniscient'] as BattlePerspective[]) {
      const events = battle.getEvents(perspective);
      const bySeq = new Map(events.map((e) => [e.seq, e]));
      let checked = 0;
      for (const event of events) {
        if (event.cause?.source) expect(['p1', 'p2']).toContain(event.cause.source.side);
        if (event.parentSeq === undefined) continue;
        const parent = bySeq.get(event.parentSeq)!;
        expect(parent).toBeDefined();
        expect(['move-used', 'switched', 'move-prevented', 'effect-activated']).toContain(
          parent.type,
        );
        expect(parent.seq).toBeLessThan(event.seq);
        expect(parent.turn).toBe(event.turn);
        checked++;
      }
      expect(checked).toBeGreaterThan(20);
    }
  });
});

describe('structured trace: coverage', () => {
  it('a switch-in ability is an effect under the switch that triggered it', () => {
    const session = createBattle({
      formatId: 'sv-doubles-ou',
      seed: SEED,
      sides: {
        p1: { displayName: 'A', team: doublesTeam },
        p2: { displayName: 'B', team: doublesTeam },
      },
    });
    session.submitChoice('p1', { kind: 'team-order', order: [3, 0, 1, 2, 4, 5] }); // Incineroar leads
    session.submitChoice('p2', { kind: 'team-order', order: [0, 1, 2, 3, 4, 5] });
    const events = session.getEvents('p2');
    const incineroar = events.find(
      (e) => e.type === 'switched' && e.pokemon.side === 'p1' && e.pokemon.teamIndex === 3,
    )!;
    const ability = events.find((e) => e.type === 'effect-activated')!;
    // The simulator lists every switch before any ability, yet the ability is linked to ITS switch.
    expect(ability).toMatchObject({
      effect: { kind: 'ability', id: 'intimidate' },
      pokemon: { side: 'p1', teamIndex: 3 },
      parentSeq: incineroar.seq,
    });
    // ...and what it causes hangs off the effect, not off an unrelated switch.
    const boosts = events.filter((e) => e.type === 'stat-boosted' && e.parentSeq === ability.seq);
    expect(boosts.length).toBeGreaterThanOrEqual(1);
    expect(
      boosts.every((e) => e.type === 'stat-boosted' && e.delta === -1 && e.stat === 'atk'),
    ).toBe(true);
  });

  it('covers status, sleep, Tera, forme change, item removal, terrain and side conditions', () => {
    const sleep = custom(
      solo('Amoonguss', 'Regenerator', ['Spore', 'Protect']),
      solo('Blissey', 'Natural Cure', ['Soft-Boiled', 'Splash']),
    );
    begin(sleep);
    turn(sleep, move('p1', 'spore'), move('p2', 'softboiled'));
    turn(sleep, move('p1', 'protect'), move('p2', 'softboiled'));
    const sleepTypes = new Set(types(sleep.getEvents('omniscient')));
    expect(sleepTypes.has('status-changed')).toBe(true);
    expect(
      sleep.getEvents('omniscient').some((e) => e.type === 'move-prevented' && e.reason === 'slp'),
    ).toBe(true);

    const tera = custom(
      solo('Garchomp', 'Rough Skin', ['Earthquake']),
      solo('Blissey', 'Natural Cure', ['Splash']),
    );
    begin(tera);
    turn(tera, move('p1', 'earthquake', { modifier: 'terastallize' }), move('p2', 'splash'));
    expect(tera.getEvents('omniscient').find((e) => e.type === 'terastallized')).toMatchObject({
      teraType: 'Dragon',
    });

    const forme = custom(
      solo('Aegislash', 'Stance Change', ['Shadow Ball', "King's Shield"]),
      solo('Blissey', 'Natural Cure', ['Splash']),
    );
    begin(forme);
    turn(forme, move('p1', 'shadowball'), move('p2', 'splash'));
    expect(forme.getEvents('omniscient').find((e) => e.type === 'forme-changed')).toMatchObject({
      species: 'Aegislash-Blade',
    });

    const knock = custom(
      solo('Garchomp', 'Rough Skin', ['Knock Off']),
      solo('Blissey', 'Natural Cure', ['Splash'], 'Leftovers'),
    );
    begin(knock);
    turn(knock, move('p1', 'knockoff'), move('p2', 'splash'));
    expect(knock.getEvents('omniscient').find((e) => e.type === 'item-changed')).toMatchObject({
      item: 'leftovers',
      change: 'removed',
      pokemon: { side: 'p2' },
    });

    const field = custom(
      solo('Pikachu', 'Static', ['Electric Terrain', 'Reflect']),
      solo('Blissey', 'Natural Cure', ['Splash']),
    );
    begin(field);
    turn(field, move('p1', 'electricterrain'), move('p2', 'splash'));
    turn(field, move('p1', 'reflect'), move('p2', 'splash'));
    const fields = field.getEvents('omniscient').filter((e) => e.type === 'field-changed');
    expect(fields).toMatchObject([
      { field: 'terrain', id: 'electricterrain', active: true },
      { field: 'side-condition', id: 'reflect', active: true, side: 'p1' },
    ]);
  });

  it('models Ally Switch as a position swap in Doubles', () => {
    const session = custom(
      {
        members: [
          { species: 'Rotom-Wash', ability: 'Levitate', moves: ['Ally Switch'] },
          { species: 'Blissey', ability: 'Natural Cure', moves: ['Splash'] },
        ],
      },
      {
        members: [
          { species: 'Chansey', ability: 'Natural Cure', moves: ['Splash'] },
          { species: 'Blissey', ability: 'Natural Cure', moves: ['Splash'] },
        ],
      },
      SEED,
      'gen9doublescustomgame',
    );
    begin(session, 2);
    const both = (side: BattleSideId, first: string, second: string): BattleCommand => ({
      kind: 'actions',
      actions: [
        { kind: 'move', slot: { side, position: 0 }, moveId: first },
        { kind: 'move', slot: { side, position: 1 }, moveId: second },
      ],
    });
    turn(session, both('p1', 'allyswitch', 'splash'), both('p2', 'splash', 'splash'));
    const swap = session.getEvents('omniscient').find((e) => e.type === 'position-swapped');
    expect(swap).toBeDefined();
    expect(session.getState('omniscient').sides.p1.active.map((p) => p?.ref.teamIndex)).toEqual([
      1, 0,
    ]);
  });

  it('full battles across formats exercise the core trace vocabulary', () => {
    const seen = new Set<string>();
    for (const [formatId, team] of [
      ['sv-ou', legalOuTeam],
      ['sv-doubles-ou', doublesTeam],
      ['champions-bss-reg-mb', championsBssTeam],
    ] as const) {
      for (const seed of [
        'gen5,0001000200030004',
        'gen5,0009000200030004',
        'gen5,00ff000200030004',
      ]) {
        const session = createBattle({
          formatId,
          seed,
          sides: { p1: { displayName: 'A', team }, p2: { displayName: 'B', team } },
        });
        playToEnd(session, undefined, 800);
        for (const type of types(session.getEvents('omniscient'))) seen.add(type);
      }
    }
    for (const type of [
      'battle-started',
      'team-preview',
      'turn-started',
      'switched',
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
      'stat-boosted',
      'effect-activated',
      'item-changed',
      'battle-ended',
    ]) {
      expect(seen.has(type), type).toBe(true);
    }
  });
});

describe('structured trace: perspectives', () => {
  it('shows rival HP as a percentage and own HP exactly, in the same events', () => {
    const session = createBattle({
      formatId: 'sv-ou',
      seed: SEED,
      sides: {
        p1: { displayName: 'A', team: legalOuTeam },
        p2: { displayName: 'B', team: legalOuTeam },
      },
    });
    playToEnd(session, undefined, 600);
    const kinds = (perspective: BattlePerspective, side: BattleSideId) =>
      new Set(
        session
          .getEvents(perspective)
          .flatMap((e) => (e.type === 'hp-changed' && e.pokemon.side === side ? [e.hp.kind] : [])),
      );
    expect(kinds('p1', 'p1')).toEqual(new Set(['exact']));
    expect(kinds('p1', 'p2')).toEqual(new Set(['percent']));
    expect(kinds('p2', 'p2')).toEqual(new Set(['exact']));
    expect(kinds('spectator', 'p1')).toEqual(new Set(['percent']));
    expect(kinds('omniscient', 'p2')).toEqual(new Set(['exact']));
  });

  it('never carries raw protocol or engine identities in any trace field', () => {
    const session = createBattle({
      formatId: 'sv-doubles-ou',
      seed: SEED,
      sides: {
        p1: { displayName: 'A', team: doublesTeam },
        p2: { displayName: 'B', team: doublesTeam },
      },
    });
    playToEnd(session, undefined, 800);
    const strings: string[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === 'string') strings.push(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') Object.values(value).forEach(walk);
    };
    for (const perspective of ['p1', 'p2', 'spectator', 'omniscient'] as BattlePerspective[]) {
      walk(session.getEvents(perspective));
    }
    expect(strings.length).toBeGreaterThan(200);
    for (const text of strings) {
      expect(text).not.toMatch(/[|[\]]/);
      expect(text).not.toMatch(/^p[12][a-c]?: /);
    }
  });
});
