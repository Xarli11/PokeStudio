import { describe, expect, it } from 'vitest';

import { BattleDomainError } from './errors';
import type { BattleErrorCode, BattleIllegalChoiceReason } from './errors';
import { createBattle, createBattleForTests } from './session';
import { DOUBLES_CUSTOM_FORMAT, doublesTeam, frail } from './test/fixtures';
import { firstChoice, playToEnd } from './test/helpers';
import type {
  BattleCommand,
  BattleLegalChoices,
  BattleLegalMoveOption,
  BattleSession,
  BattleSideId,
  BattleSlotChoices,
  BattleTeamInput,
} from './types';

const SEED = 'gen5,0001000200030004';

const doublesBattle = (over: { p1?: BattleTeamInput; p2?: BattleTeamInput; seed?: string } = {}) =>
  createBattle({
    formatId: 'sv-doubles-ou',
    seed: over.seed ?? SEED,
    sides: {
      p1: { displayName: 'Ash', team: over.p1 ?? doublesTeam },
      p2: { displayName: 'Gary', team: over.p2 ?? doublesTeam },
    },
  });

const order = (...teamIndexes: number[]): BattleCommand => ({
  kind: 'team-order',
  order: teamIndexes,
});
const slotOf = (side: BattleSideId, position: number) => ({ side, position });

/** Starts turn 1 with the given leads for each side. */
function start(session: BattleSession, p1 = [0, 1, 2, 3, 4, 5], p2 = [0, 1, 2, 3, 4, 5]) {
  session.submitChoice('p1', order(...p1));
  session.submitChoice('p2', order(...p2));
  return session;
}

function moveSlots(choices: BattleLegalChoices): BattleSlotChoices[] {
  if (choices.kind !== 'move') throw new Error(`expected a move request, got ${choices.kind}`);
  return choices.slots;
}
const movesOf = (slot: BattleSlotChoices) =>
  slot.options.filter((o): o is BattleLegalMoveOption => o.kind === 'move');
const moveOf = (slot: BattleSlotChoices, moveId: string) =>
  movesOf(slot).find((m) => m.moveId === moveId)!;

function expectError(
  run: () => unknown,
  code: BattleErrorCode,
  reason?: BattleIllegalChoiceReason,
) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(BattleDomainError);
    expect((error as BattleDomainError).code).toBe(code);
    if (reason) expect((error as BattleDomainError).details).toMatchObject({ reason });
    return;
  }
  throw new Error(`expected ${code}`);
}

describe('Doubles: sv-doubles-ou', () => {
  it('is creatable through the public API and exposes two active slots per side', () => {
    const session = doublesBattle();
    expect(session.getState('p1').format).toMatchObject({
      id: 'sv-doubles-ou',
      gameType: 'doubles',
      category: 'smogon-doubles',
    });
    start(session);
    const state = session.getState('p1');
    expect(state.gameType).toBe('doubles');
    for (const side of ['p1', 'p2'] as const) {
      expect(state.sides[side].active).toHaveLength(2);
      expect(state.sides[side].active.map((p) => p?.slot)).toEqual([
        slotOf(side, 0),
        slotOf(side, 1),
      ]);
      expect(state.sides[side].active.map((p) => p?.ref.teamIndex)).toEqual([0, 1]);
    }
    expect(state.turn).toBe(1);
  });

  it('team preview leads follow the requested order and refs stay stable', () => {
    const session = start(doublesBattle(), [3, 2, 0, 1, 4, 5], [5, 4, 3, 2, 1, 0]);
    const state = session.getState('omniscient');
    expect(state.sides.p1.active.map((p) => p?.ref.teamIndex)).toEqual([3, 2]);
    expect(state.sides.p2.active.map((p) => p?.ref.teamIndex)).toEqual([5, 4]);
    expect(state.sides.p1.active.map((p) => p?.species)).toEqual(['Incineroar', 'Kingambit']);
  });
});

describe('Doubles: legal choices mirror the simulator request', () => {
  it('lists one entry per active slot with the bench as switch options', () => {
    const session = start(doublesBattle());
    const slots = moveSlots(session.getLegalChoices('p1'));
    expect(slots.map((s) => s.slot)).toEqual([slotOf('p1', 0), slotOf('p1', 1)]);
    for (const slot of slots) {
      const switches = slot.options.flatMap((o) =>
        o.kind === 'switch' ? [o.pokemon.teamIndex] : [],
      );
      expect(switches).toEqual([2, 3, 4, 5]);
      expect(slot.options.some((o) => o.kind === 'pass')).toBe(false);
    }
  });

  it('offers targets exactly where the simulator lets you choose one', () => {
    // Leads: Garchomp (0) + Rotom-Wash (1).
    const slots = moveSlots(start(doublesBattle()).getLegalChoices('p1'));
    const [garchomp, rotom] = slots as [BattleSlotChoices, BattleSlotChoices];
    // allAdjacent (Earthquake), allAdjacentFoes (Rock Slide), self (Protect): no target choice.
    expect(moveOf(garchomp, 'earthquake').targets).toBeNull();
    expect(moveOf(garchomp, 'rockslide').targets).toBeNull();
    expect(moveOf(garchomp, 'protect').targets).toBeNull();
    // normal (Dragon Claw): both foes and the ally, never itself.
    expect(moveOf(garchomp, 'dragonclaw').targets).toEqual([
      slotOf('p2', 0),
      slotOf('p2', 1),
      slotOf('p1', 1),
    ]);
    // adjacentAlly (Helping Hand): the ally only.
    expect(moveOf(rotom, 'helpinghand').targets).toEqual([slotOf('p1', 0)]);
    // normal from the other slot: the ally is the *other* slot.
    expect(moveOf(rotom, 'hydropump').targets).toEqual([
      slotOf('p2', 0),
      slotOf('p2', 1),
      slotOf('p1', 0),
    ]);
  });

  it("'any' moves (Brave Bird) can target every other active slot", () => {
    const session = start(doublesBattle(), [4, 0, 1, 2, 3, 5]);
    const [corviknight] = moveSlots(session.getLegalChoices('p1')) as [BattleSlotChoices];
    expect(moveOf(corviknight, 'bravebird').targets).toEqual([
      slotOf('p2', 0),
      slotOf('p2', 1),
      slotOf('p1', 1),
    ]);
  });
});

describe('Doubles: commands are validated whole, per slot', () => {
  const move = (
    slot: number,
    moveId: string,
    target?: { side: BattleSideId; position: number },
  ): BattleCommand extends infer C ? C : never =>
    ({ kind: 'move', slot: slotOf('p1', slot), moveId, ...(target ? { target } : {}) }) as never;
  const actions = (...list: unknown[]): BattleCommand => ({
    kind: 'actions',
    actions: list as never,
  });

  it('accepts a full two-action command with foe, ally and no-target moves', () => {
    const session = start(doublesBattle());
    const result = session.submitChoice(
      'p1',
      actions(move(0, 'dragonclaw', slotOf('p1', 1)), move(1, 'helpinghand', slotOf('p1', 0))),
    );
    expect(result.resolved).toBe(false);
    expect(result.state.requests.p1).toEqual({ kind: 'move', submitted: true });
    const done = session.submitChoice(
      'p2',
      actions(
        { kind: 'move', slot: slotOf('p2', 0), moveId: 'earthquake' },
        { kind: 'move', slot: slotOf('p2', 1), moveId: 'hydropump', target: slotOf('p1', 0) },
      ),
    );
    expect(done.resolved).toBe(true);
    expect(done.events.filter((e) => e.type === 'move-used').length).toBeGreaterThanOrEqual(3);
  });

  it.each([
    [
      'a choosable-target move without a target',
      [move(0, 'dragonclaw'), move(1, 'hydropump', slotOf('p2', 0))],
      'invalid-target',
    ],
    [
      'a target on a spread move',
      [move(0, 'earthquake', slotOf('p2', 0)), move(1, 'hydropump', slotOf('p2', 0))],
      'invalid-target',
    ],
    [
      'a target on a self move',
      [move(0, 'protect', slotOf('p1', 0)), move(1, 'hydropump', slotOf('p2', 0))],
      'invalid-target',
    ],
    [
      'an ally-only move aimed at a foe',
      [move(0, 'earthquake'), move(1, 'helpinghand', slotOf('p2', 0))],
      'invalid-target',
    ],
    [
      'targeting yourself with a normal move',
      [move(0, 'dragonclaw', slotOf('p1', 0)), move(1, 'hydropump', slotOf('p2', 0))],
      'invalid-target',
    ],
    [
      'a move the slot does not have',
      [move(0, 'helpinghand', slotOf('p1', 1)), move(1, 'hydropump', slotOf('p2', 0))],
      'unknown-move',
    ],
    ['one action for two slots', [move(0, 'earthquake')], 'wrong-action-count'],
    [
      'actions in the wrong slot order',
      [move(1, 'hydropump', slotOf('p2', 0)), move(0, 'earthquake')],
      'invalid-slot',
    ],
    [
      'a pass for a live Pokémon',
      [move(0, 'earthquake'), { kind: 'pass', slot: slotOf('p1', 1) }],
      'pass-unavailable',
    ],
    [
      'the same Pokémon switched in twice',
      [
        { kind: 'switch', slot: slotOf('p1', 0), pokemon: { side: 'p1', teamIndex: 2 } },
        { kind: 'switch', slot: slotOf('p1', 1), pokemon: { side: 'p1', teamIndex: 2 } },
      ],
      'duplicate-switch',
    ],
    [
      'switching to a Pokémon that is already active',
      [
        { kind: 'switch', slot: slotOf('p1', 0), pokemon: { side: 'p1', teamIndex: 1 } },
        move(1, 'hydropump', slotOf('p2', 0)),
      ],
      'switch-unavailable',
    ],
  ] as const)('rejects %s', (_label, list, reason) => {
    const session = start(doublesBattle());
    expectError(() => session.submitChoice('p1', actions(...list)), 'ILLEGAL_CHOICE', reason);
    expect(session.getState('p1').requests.p1?.submitted).toBe(false); // nothing was consumed
  });

  it('accepts a switch in one slot combined with a move in the other', () => {
    const session = start(doublesBattle());
    session.submitChoice(
      'p1',
      actions(
        { kind: 'switch', slot: slotOf('p1', 0), pokemon: { side: 'p1', teamIndex: 4 } },
        move(1, 'hydropump', slotOf('p2', 1)),
      ),
    );
    session.submitChoice('p2', firstChoice(session.getLegalChoices('p2'))!);
    const state = session.getState('omniscient');
    expect(state.sides.p1.active.map((p) => p?.ref.teamIndex)).toEqual([4, 1]);
  });

  it('allows at most one Terastallization per side per turn', () => {
    const session = start(doublesBattle());
    expectError(
      () =>
        session.submitChoice(
          'p1',
          actions(
            { ...move(0, 'earthquake'), modifier: 'terastallize' },
            { ...move(1, 'hydropump', slotOf('p2', 0)), modifier: 'terastallize' },
          ),
        ),
      'ILLEGAL_CHOICE',
      'invalid-modifier',
    );
    const ok = session.submitChoice(
      'p1',
      actions(
        { ...move(0, 'earthquake'), modifier: 'terastallize' },
        move(1, 'hydropump', slotOf('p2', 0)),
      ),
    );
    expect(ok.resolved).toBe(false);
  });
});

describe('Doubles: full battle, events and determinism', () => {
  const play = (seed: string) => {
    const session = doublesBattle({ seed });
    const played = playToEnd(session, undefined, 800);
    return { session, played };
  };

  it('is played to finished with targets, switches and forced replacements', () => {
    const { session, played } = play(SEED);
    expect(session.getState('spectator').status).toBe('finished');
    expect(played.kinds.has('move') && played.kinds.has('forced-switch')).toBe(true);
    const events = session.getEvents('omniscient');
    const positions = new Set(
      events.flatMap((e) => (e.type === 'switched' ? [`${e.slot.side}${e.slot.position}`] : [])),
    );
    expect(positions).toEqual(new Set(['p10', 'p11', 'p20', 'p21']));
    const targeted = events.filter((e) => e.type === 'move-used' && e.target);
    expect(targeted.length).toBeGreaterThan(0);
    expect(events.at(-1)).toMatchObject({ type: 'battle-ended' });
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));
  });

  it('is deterministic for a seed', () => {
    const [a, b] = [play(SEED), play(SEED)];
    expect(b.session.getEvents('omniscient')).toEqual(a.session.getEvents('omniscient'));
    expect(b.session.getState('omniscient').result).toEqual(
      a.session.getState('omniscient').result,
    );
  });

  it('keeps every event ref consistent with the final state (stable identity across slots)', () => {
    const { session } = play('gen5,0009000200030004');
    const state = session.getState('omniscient');
    const lastHp = new Map<string, number>();
    for (const e of session.getEvents('omniscient')) {
      if (e.type === 'hp-changed' && e.hp.kind === 'exact') {
        lastHp.set(`${e.pokemon.side}${e.pokemon.teamIndex}`, e.hp.current);
      }
    }
    let checked = 0;
    for (const side of ['p1', 'p2'] as const) {
      for (const p of state.sides[side].team) {
        const seen = lastHp.get(`${side}${p.ref.teamIndex}`);
        if (seen === undefined) continue;
        expect(p.hp).toMatchObject({ current: seen });
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(4);
  });
});

describe('Doubles: simultaneous faints and forced replacements', () => {
  // Every Voltorb explodes: all four actives faint on turn 1.
  const boom = (bench: number): BattleTeamInput => ({
    members: [
      { species: 'Voltorb', ability: 'Soundproof', moves: ['Explosion'] },
      { species: 'Voltorb', ability: 'Soundproof', moves: ['Explosion'] },
      ...Array.from({ length: bench }, () => frail('Magikarp', 'Swift Swim', ['Splash'])),
    ],
  });
  const targets = (bench: number): BattleTeamInput => ({
    members: [
      frail('Magikarp', 'Swift Swim', ['Splash']),
      frail('Magikarp', 'Swift Swim', ['Splash']),
      ...Array.from({ length: bench }, () => frail('Magikarp', 'Swift Swim', ['Splash'])),
    ],
  });
  const explode = (side: BattleSideId): BattleCommand => ({
    kind: 'actions',
    actions: [0, 1].map((position) => ({
      kind: 'move' as const,
      slot: slotOf(side, position),
      moveId: 'explosion',
    })),
  });
  const splash = (side: BattleSideId): BattleCommand => ({
    kind: 'actions',
    actions: [0, 1].map((position) => ({
      kind: 'move' as const,
      slot: slotOf(side, position),
      moveId: 'splash',
    })),
  });

  function detonate(p1Bench: number, p2Bench: number) {
    const session = createBattleForTests({
      formatId: DOUBLES_CUSTOM_FORMAT,
      seed: SEED,
      sides: {
        p1: { displayName: 'A', team: boom(p1Bench) },
        p2: { displayName: 'B', team: targets(p2Bench) },
      },
    });
    const bothOrder = (n: number) => order(...Array.from({ length: n }, (_, i) => i));
    session.submitChoice('p1', bothOrder(2 + p1Bench));
    session.submitChoice('p2', bothOrder(2 + p2Bench));
    session.submitChoice('p1', explode('p1'));
    session.submitChoice('p2', splash('p2'));
    return session;
  }

  it('both slots faint together and both are replaced from a large enough bench', () => {
    const session = detonate(2, 2);
    for (const side of ['p1', 'p2'] as const) {
      const choices = session.getLegalChoices(side);
      expect(choices.kind).toBe('forced-switch');
      if (choices.kind !== 'forced-switch') continue;
      expect(choices.switchCount).toBe(2);
      expect(choices.slots).toHaveLength(2);
      for (const slot of choices.slots) {
        expect(slot.options.some((o) => o.kind === 'pass')).toBe(false);
        expect(slot.options.filter((o) => o.kind === 'switch')).toHaveLength(2);
      }
    }
    // Submitting both replacements (distinct Pokémon) resolves the decision.
    const p1 = firstChoice(session.getLegalChoices('p1'))!;
    const r1 = session.submitChoice('p1', p1);
    expect(r1.resolved).toBe(false);
    const r2 = session.submitChoice('p2', firstChoice(session.getLegalChoices('p2'))!);
    expect(r2.resolved).toBe(true);
    const state = session.getState('omniscient');
    expect(state.sides.p1.active.map((p) => p?.ref.teamIndex).sort()).toEqual([2, 3]);
    expect(state.sides.p1.active.every((p) => p && !p.fainted)).toBe(true);
  });

  it('with fewer replacements than empty slots, exactly that many switch and the rest pass', () => {
    const session = detonate(1, 2);
    const choices = session.getLegalChoices('p1');
    if (choices.kind !== 'forced-switch') throw new Error('expected forced-switch');
    expect(choices.switchCount).toBe(1);
    for (const slot of choices.slots) {
      expect(slot.options.some((o) => o.kind === 'pass')).toBe(true);
      expect(slot.options.filter((o) => o.kind === 'switch')).toHaveLength(1);
    }
    const bench = { side: 'p1' as const, teamIndex: 2 };
    // Two passes: the simulator would still be waiting for the replacement.
    expectError(
      () =>
        session.submitChoice('p1', {
          kind: 'actions',
          actions: [
            { kind: 'pass', slot: slotOf('p1', 0) },
            { kind: 'pass', slot: slotOf('p1', 1) },
          ],
        }),
      'ILLEGAL_CHOICE',
      'switch-required',
    );
    // Two switches to the same (only) Pokémon are a duplicate.
    expectError(
      () =>
        session.submitChoice('p1', {
          kind: 'actions',
          actions: [
            { kind: 'switch', slot: slotOf('p1', 0), pokemon: bench },
            { kind: 'switch', slot: slotOf('p1', 1), pokemon: bench },
          ],
        }),
      'ILLEGAL_CHOICE',
      'duplicate-switch',
    );
    // The replacement may go to either slot; the other passes.
    const ok = session.submitChoice('p1', {
      kind: 'actions',
      actions: [
        { kind: 'pass', slot: slotOf('p1', 0) },
        { kind: 'switch', slot: slotOf('p1', 1), pokemon: bench },
      ],
    });
    expect(ok.resolved).toBe(false);
    session.submitChoice('p2', firstChoice(session.getLegalChoices('p2'))!);
    const active = session.getState('omniscient').sides.p1.active;
    expect(active[1]?.ref).toEqual(bench);
    expect(active[0]?.fainted).toBe(true); // the unreplaced slot keeps its fainted Pokémon
  });

  it('a slot that cannot be replaced only offers pass on the following turn', () => {
    const session = detonate(1, 2);
    session.submitChoice('p1', {
      kind: 'actions',
      actions: [
        { kind: 'switch', slot: slotOf('p1', 0), pokemon: { side: 'p1', teamIndex: 2 } },
        { kind: 'pass', slot: slotOf('p1', 1) },
      ],
    });
    session.submitChoice('p2', firstChoice(session.getLegalChoices('p2'))!);
    const choices = session.getLegalChoices('p1');
    const slots = moveSlots(choices);
    expect(slots[0]!.options.some((o) => o.kind === 'move')).toBe(true);
    expect(slots[1]!.options).toEqual([{ kind: 'pass' }]);
    // A move for the fainted slot is rejected; the correct command resolves.
    expectError(
      () =>
        session.submitChoice('p1', {
          kind: 'actions',
          actions: [
            { kind: 'move', slot: slotOf('p1', 0), moveId: 'splash' },
            { kind: 'move', slot: slotOf('p1', 1), moveId: 'explosion' },
          ],
        }),
      'ILLEGAL_CHOICE',
    );
  });

  it('the side that does not need to replace anyone is told to wait', () => {
    const session = createBattleForTests({
      formatId: DOUBLES_CUSTOM_FORMAT,
      seed: SEED,
      sides: {
        p1: { displayName: 'A', team: boom(2) },
        p2: {
          displayName: 'B',
          team: {
            members: [
              { species: 'Blissey', ability: 'Natural Cure', moves: ['Splash'] },
              { species: 'Blissey', ability: 'Natural Cure', moves: ['Splash'] },
              frail('Magikarp', 'Swift Swim', ['Splash']),
            ],
          },
        },
      },
    });
    session.submitChoice('p1', order(0, 1, 2, 3));
    session.submitChoice('p2', order(0, 1, 2));
    session.submitChoice('p1', explode('p1'));
    session.submitChoice('p2', splash('p2'));
    expect(session.getLegalChoices('p1').kind).toBe('forced-switch');
    // Blissey survives Explosion, so p2 is not asked for anything.
    expect(session.getLegalChoices('p2').kind).toBe('wait');
    expectError(() => session.submitChoice('p2', splash('p2')), 'NOT_ACCEPTING_CHOICE');
  });
});

describe('Doubles: spread moves', () => {
  it('Earthquake needs no target and damages both foes and the grounded ally', () => {
    // p1 leads Garchomp + Kingambit; p2 leads Garchomp-free grounded targets (Kingambit + Incineroar).
    const session = start(doublesBattle(), [0, 2, 1, 3, 4, 5], [2, 3, 0, 1, 4, 5]);
    const before = session.getEvents('omniscient').length;
    session.submitChoice('p1', {
      kind: 'actions',
      actions: [
        { kind: 'move', slot: slotOf('p1', 0), moveId: 'earthquake' },
        { kind: 'move', slot: slotOf('p1', 1), moveId: 'ironhead', target: slotOf('p2', 1) },
      ],
    });
    session.submitChoice('p2', {
      kind: 'actions',
      actions: [
        { kind: 'move', slot: slotOf('p2', 0), moveId: 'ironhead', target: slotOf('p1', 1) },
        { kind: 'move', slot: slotOf('p2', 1), moveId: 'flareblitz', target: slotOf('p1', 0) },
      ],
    });
    const turn = session.getEvents('omniscient').slice(before);
    const damaged = new Set(
      turn.flatMap((e) =>
        e.type === 'hp-changed' && e.hp.kind === 'exact' && e.hp.current < 9999
          ? [`${e.pokemon.side}${e.pokemon.teamIndex}`]
          : [],
      ),
    );
    // Earthquake reached both foes and its own grounded ally (Kingambit, teamIndex 2).
    expect(damaged.has('p22')).toBe(true);
    expect(damaged.has('p23')).toBe(true);
    expect(damaged.has('p12')).toBe(true);
  });
});

describe('Doubles: visibility with two active Pokémon per side', () => {
  // Sentinels: strings that appear only in the rival's hidden data.
  const SENTINELS = [
    'blacksludge',
    'regenerator',
    'ragepowder',
    'spore',
    'sitrusberry',
    'flareblitz',
  ];
  const leaks = (text: string) => SENTINELS.filter((word) => text.toLowerCase().includes(word));
  const dump = (session: BattleSession, perspective: 'p1' | 'p2' | 'spectator' | 'omniscient') =>
    JSON.stringify([session.getState(perspective), session.getEvents(perspective)]);
  // p2 leads Incineroar (Intimidate) and Amoonguss (everything else hidden).
  const p2Leads = [3, 5, 0, 1, 2, 4];
  // p1's own team must not contain the sentinel strings, or its own view would legitimately show them.
  const p1Team: BattleTeamInput = { members: doublesTeam.members.slice(0, 3) };
  const begin = () => start(doublesBattle({ p1: p1Team }), [0, 1, 2], p2Leads);

  it("reveals an ability at that Pokémon's own switch-in and nothing about its partner", () => {
    const session = begin();
    for (const perspective of ['p1', 'spectator'] as const) {
      const [left, right] = session.getState(perspective).sides.p2.active;
      expect(left?.species).toBe('Incineroar');
      expect(left?.ability).toBe('intimidate');
      expect(left?.revealed).toEqual({ ability: true, item: false, moves: [] });
      expect(right?.species).toBe('Amoonguss');
      expect(right?.ability).toBeUndefined();
      expect(right?.revealed).toEqual({ ability: false, item: false, moves: [] });
      expect(leaks(dump(session, perspective))).toEqual([]);
    }
    expect(leaks(dump(session, 'p2')).length).toBeGreaterThan(3); // the owner sees its own
    expect(leaks(dump(session, 'omniscient')).length).toBeGreaterThan(3);
  });

  it("reveals moves per Pokémon: one slot acting does not reveal the other slot's moves", () => {
    const session = begin();
    session.submitChoice('p1', firstChoice(session.getLegalChoices('p1'))!);
    session.submitChoice('p2', {
      kind: 'actions',
      actions: [
        { kind: 'move', slot: slotOf('p2', 0), moveId: 'knockoff', target: slotOf('p1', 0) },
        {
          kind: 'move',
          slot: slotOf('p2', 1),
          moveId: 'clearsmog',
          target: slotOf('p1', 1),
        },
      ],
    });
    const [incineroar, amoonguss] = session.getState('p1').sides.p2.active;
    expect(incineroar?.revealed.moves).toEqual(['knockoff']);
    expect(amoonguss?.revealed.moves).toEqual(['clearsmog']);
    // Moves neither slot used stay hidden from everyone but the owner.
    for (const perspective of ['p1', 'spectator'] as const) {
      expect(leaks(dump(session, perspective))).not.toContain('spore');
      expect(leaks(dump(session, perspective))).not.toContain('ragepowder');
      expect(leaks(dump(session, perspective))).not.toContain('flareblitz');
    }
    expect(dump(session, 'p2')).toContain('ragepowder');
  });

  it('a Pokémon switched into either slot only becomes known when it enters', () => {
    const session = begin();
    // Benched p2 Pokémon (Garchomp, Rotom, Kingambit, Corviknight) are known from preview, not their sets.
    const before = session.getState('p1').sides.p2;
    expect(before.active.map((p) => p?.slot?.position)).toEqual([0, 1]);
    session.submitChoice('p1', firstChoice(session.getLegalChoices('p1'))!);
    session.submitChoice('p2', {
      kind: 'actions',
      actions: [
        { kind: 'move', slot: slotOf('p2', 0), moveId: 'partingshot', target: slotOf('p1', 0) },
        { kind: 'switch', slot: slotOf('p2', 1), pokemon: { side: 'p2', teamIndex: 4 } },
      ],
    });
    const after = session.getState('p1').sides.p2;
    const inSlot1 = after.active[1];
    expect(inSlot1?.ref.teamIndex).toBe(4);
    expect(inSlot1?.species).toBe('Corviknight');
    // Amoonguss left the field: still visible as known, with what it revealed, nothing more.
    expect(dump(session, 'spectator')).not.toContain('blacksludge');
    expect(dump(session, 'p1')).not.toContain('rockyhelmet');
    expect(session.getState('p1').sides.p1.active.every((p) => p?.hp.kind === 'exact')).toBe(true);
    expect(session.getState('p1').sides.p2.active.every((p) => p?.hp.kind === 'percent')).toBe(
      true,
    );
  });

  it('requests stay private per perspective in Doubles', () => {
    const session = start(doublesBattle());
    expect(Object.keys(session.getState('p1').requests)).toEqual(['p1']);
    expect(session.getState('spectator').requests).toEqual({});
    const handle = session.forSide('p2');
    expect(handle.getState().perspective).toBe('p2');
    expect(JSON.stringify(handle.getState())).not.toContain(session.info.seed);
  });
});
