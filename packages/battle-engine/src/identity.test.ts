import { describe, expect, it } from 'vitest';

import { newBattle, startTurnOne } from './test/helpers';
import type {
  BattleCommand,
  BattleLegalChoices,
  BattlePokemonRef,
  BattleSession,
  BattleSideId,
  BattleTeamInput,
  BattleTeamMemberInput,
} from './types';

const clone: BattleTeamMemberInput = {
  species: 'Garchomp',
  nickname: 'Twin',
  ability: 'Rough Skin',
  item: 'Life Orb',
  gender: 'M',
  moves: ['Earthquake', 'Dragon Claw', 'Swords Dance', 'Protect'],
};

/** Members 0 and 1 are deliberately identical in every field, including the nickname. */
const twins: BattleTeamInput = {
  members: [
    { ...clone },
    { ...clone },
    {
      species: 'Rotom-Wash',
      ability: 'Levitate',
      moves: ['Hydro Pump', 'Volt Switch'],
      item: 'Leftovers',
    },
  ],
};

const attacker: BattleTeamInput = {
  members: [
    {
      species: 'Dragonite',
      ability: 'Multiscale',
      moves: ['Extreme Speed', 'Earthquake'],
      item: 'Heavy-Duty Boots',
    },
    {
      species: 'Gholdengo',
      ability: 'Good as Gold',
      moves: ['Shadow Ball', 'Make It Rain'],
      item: 'Leftovers',
    },
    {
      species: 'Kingambit',
      ability: 'Defiant',
      moves: ['Kowtow Cleave', 'Sucker Punch'],
      item: 'Leftovers',
    },
  ],
};

const same = (a: BattlePokemonRef, b: BattlePokemonRef) =>
  a.side === b.side && a.teamIndex === b.teamIndex;

/** p1 rotates through its bench every turn; p2 always attacks with its first move. */
function policy(
  side: BattleSideId,
  choices: BattleLegalChoices,
  turn: number,
): BattleCommand | null {
  if (choices.kind === 'wait') return null;
  if (choices.kind === 'team-preview') {
    return { kind: 'team-order', order: side === 'p1' ? [2, 1, 0] : [0, 1, 2] };
  }
  const slot = choices.slots[0]!;
  const switches = slot.options.filter((o) => o.kind === 'switch');
  const attack = slot.options.find((o) => o.kind === 'move');
  if (
    side === 'p1' &&
    switches.length > 0 &&
    (choices.kind === 'forced-switch' || turn % 2 === 0)
  ) {
    const pick = switches[turn % switches.length]!;
    if (pick.kind === 'switch') {
      return {
        kind: 'actions',
        actions: [{ kind: 'switch', slot: slot.slot, pokemon: pick.pokemon }],
      };
    }
  }
  if (choices.kind === 'forced-switch') {
    const pick = switches[0]!;
    if (pick.kind === 'switch') {
      return {
        kind: 'actions',
        actions: [{ kind: 'switch', slot: slot.slot, pokemon: pick.pokemon }],
      };
    }
  }
  if (attack?.kind !== 'move') throw new Error('no move');
  return { kind: 'actions', actions: [{ kind: 'move', slot: slot.slot, moveId: attack.moveId }] };
}

function play(session: BattleSession) {
  for (let i = 0; i < 60 && session.getState('spectator').status !== 'finished'; i++) {
    for (const side of ['p1', 'p2'] as const) {
      if (session.getState('spectator').status === 'finished') break;
      const command = policy(
        side,
        session.getLegalChoices(side),
        session.getState('spectator').turn,
      );
      if (command) session.submitChoice(side, command);
    }
  }
}

describe('stable Pokémon identity (teamIndex = original position in BattleTeamInput)', () => {
  it('keeps identical Pokémon apart through preview reorder, switches and faints', () => {
    const session = newBattle({ formatId: 'gen9customgame', p1: twins, p2: attacker });
    play(session);

    const state = session.getState('omniscient');
    const events = session.getEvents('omniscient');

    // Preview reorder: p1 asked for [2,1,0], so the lead must be the ORIGINAL member 2.
    const firstSwitch = events.find((e) => e.type === 'switched' && e.slot.side === 'p1');
    expect(firstSwitch).toMatchObject({ pokemon: { side: 'p1', teamIndex: 2 } });

    // Last known HP per ref, from events, must equal the state's HP for that same ref.
    const lastHp = new Map<string, number>();
    for (const event of events) {
      if (event.type === 'hp-changed' && event.hp.kind === 'exact') {
        lastHp.set(`${event.pokemon.side}:${event.pokemon.teamIndex}`, event.hp.current);
      }
    }
    let checked = 0;
    for (const side of ['p1', 'p2'] as const) {
      for (const pokemon of state.sides[side].team) {
        const seen = lastHp.get(`${side}:${pokemon.ref.teamIndex}`);
        if (seen === undefined) continue;
        expect(pokemon.hp).toEqual({ kind: 'exact', current: seen, max: expect.any(Number) });
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(2);

    // The twins are separate identities and both took part with different outcomes recorded.
    const twinRefs = state.sides.p1.team.filter((p) => p.ref.teamIndex < 2);
    expect(twinRefs.map((p) => p.ref.teamIndex)).toEqual([0, 1]);
    expect(twinRefs.every((p) => p.species === 'Garchomp' && p.nickname === 'Twin')).toBe(true);
    const switchedTwins = new Set(
      events.flatMap((e) =>
        e.type === 'switched' && e.pokemon.side === 'p1' ? [e.pokemon.teamIndex] : [],
      ),
    );
    expect(switchedTwins.has(0) && switchedTwins.has(1)).toBe(true);

    // Every faint event's ref is flagged fainted in the state, and nobody else is.
    const faintedRefs = new Set(
      events.flatMap((e) =>
        e.type === 'fainted' ? [`${e.pokemon.side}:${e.pokemon.teamIndex}`] : [],
      ),
    );
    for (const side of ['p1', 'p2'] as const) {
      for (const pokemon of state.sides[side].team) {
        expect(pokemon.fainted).toBe(faintedRefs.has(`${side}:${pokemon.ref.teamIndex}`));
      }
    }
    expect(faintedRefs.size).toBeGreaterThan(0);
  });

  it('a switch to teamIndex 1 activates member 1, never its identical twin 0', () => {
    const session = newBattle({ formatId: 'gen9customgame', p1: twins, p2: attacker });
    startTurnOne(session, [0, 1, 2], [0, 1, 2]);
    const choices = session.getLegalChoices('p1');
    if (choices.kind !== 'move') throw new Error('expected move');
    const bench = choices.slots[0]!.options.flatMap((o) =>
      o.kind === 'switch' ? [o.pokemon] : [],
    );
    expect(bench.some((ref) => same(ref, { side: 'p1', teamIndex: 0 }))).toBe(false); // active
    const to1 = bench.find((ref) => same(ref, { side: 'p1', teamIndex: 1 }))!;
    session.submitChoice('p1', {
      kind: 'actions',
      actions: [{ kind: 'switch', slot: { side: 'p1', position: 0 }, pokemon: to1 }],
    });
    session.submitChoice('p2', {
      kind: 'actions',
      actions: [{ kind: 'move', slot: { side: 'p2', position: 0 }, moveId: 'extremespeed' }],
    });
    const active = session.getState('omniscient').sides.p1.active[0]!;
    expect(active.ref).toEqual({ side: 'p1', teamIndex: 1 });
    // The damage landed on member 1, not on the identical member 0 that switched out.
    const hp = (i: number) =>
      session.getState('omniscient').sides.p1.team.find((p) => p.ref.teamIndex === i)!.hp;
    expect(hp(0)).toMatchObject({ current: expect.any(Number) });
    expect(hp(1)).not.toEqual(hp(0));
  });
});
