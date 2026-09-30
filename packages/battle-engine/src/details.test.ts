import { describe, expect, it } from 'vitest';

import { createBattle, createBattleForTests } from './session';
import { startTurnOne } from './test/helpers';
import { CUSTOM_FORMAT, SEED, championsBssTeam, legalOuTeam, teamB } from './test/fixtures';
import type {
  BattlePerspective,
  BattlePokemonState,
  BattleSession,
  BattleTeamInput,
} from './types';

const ou = (p1: BattleTeamInput = legalOuTeam, p2: BattleTeamInput = legalOuTeam) =>
  createBattle({
    formatId: 'sv-ou',
    seed: SEED,
    sides: { p1: { displayName: 'Ash', team: p1 }, p2: { displayName: 'Gary', team: p2 } },
  });

const begin = (session: BattleSession): BattleSession => {
  if (session.getLegalChoices('p1').kind === 'team-preview') startTurnOne(session, [0, 1], [0, 1]);
  return session;
};

const pokemonOf = (session: BattleSession, perspective: BattlePerspective, side: 'p1' | 'p2') =>
  session.getState(perspective).sides[side].team;

const PRIVATE_KEYS = ['privateDetails', 'nature', '"evs"', '"ivs"', '"stats"'];
const privateKeysIn = (pokemon: BattlePokemonState[]) =>
  PRIVATE_KEYS.filter((key) => JSON.stringify(pokemon).includes(key));

describe('private Pokémon details: simulator-normalized values', () => {
  it('projects nature, EVs, IVs and calculated stats exactly as the simulator computed them', () => {
    // Explicit Showdown numbers for Gholdengo, Timid, 4 HP / 252 SpA / 252 Spe, 31 IVs, level 100.
    const gholdengo = pokemonOf(ou(), 'p1', 'p1')[0]!;
    expect(gholdengo.privateDetails).toEqual({
      nature: 'Timid',
      evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      stats: { hp: 316, atk: 140, def: 226, spa: 365, spd: 218, spe: 293 },
    });
    // Max HP is calculated max HP; current HP is a separate field.
    expect(gholdengo.hp).toEqual({ kind: 'exact', current: 316, max: 316 });
  });

  it('projects the values the simulator actually uses when the team input omits them', () => {
    const session = createBattleForTests({
      formatId: CUSTOM_FORMAT,
      seed: SEED,
      sides: {
        p1: {
          displayName: 'A',
          team: {
            members: [{ species: 'Garchomp', ability: 'Rough Skin', moves: ['Earthquake'] }],
          },
        },
        p2: { displayName: 'B', team: teamB },
      },
    });
    const details = pokemonOf(session, 'p1', 'p1')[0]!.privateDetails!;
    // The simulator's own default for a custom game is a full 252 spread, not 0.
    expect(details.evs).toEqual({ hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252 });
    expect(details.ivs).toEqual({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });
    expect(details.nature).not.toBe('');
    // Garchomp L100, 252 EVs, 31 IVs, neutral nature.
    expect(details.stats).toEqual({ hp: 420, atk: 359, def: 289, spa: 259, spd: 269, spe: 303 });
  });

  it('does not change after damage or boosts (calculated stats are not battle-modified)', () => {
    const session = begin(ou());
    const before = pokemonOf(session, 'p1', 'p1')[0]!.privateDetails;
    session.submitChoice('p1', {
      kind: 'actions',
      actions: [{ kind: 'move', slot: { side: 'p1', position: 0 }, moveId: 'shadowball' }],
    });
    expect(pokemonOf(session, 'p1', 'p1')[0]!.privateDetails).toEqual(before);
  });

  it('Champions: EVs are Stat Points, stats follow the Champions formula, IVs are not projected', () => {
    const session = createBattle({
      formatId: 'champions-bss-reg-mb',
      seed: SEED,
      sides: {
        p1: { displayName: 'A', team: championsBssTeam },
        p2: { displayName: 'B', team: championsBssTeam },
      },
    });
    expect(session.getState('p1').format.family).toBe('champions');
    const garchomp = pokemonOf(session, 'p1', 'p1')[0]!.privateDetails!;
    expect(garchomp.nature).toBe('Jolly');
    expect(garchomp.evs).toEqual({ hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 });
    expect(garchomp.ivs).toBeUndefined();
    // HP 108+2+75, Atk 130+32+20 (Jolly is +Spe/-SpA), Spe (102+32+20)*1.1
    expect(garchomp.stats).toMatchObject({ hp: 185, atk: 182, spe: 169 });
  });
});

describe('private Pokémon details: perspective anti-leak', () => {
  const session = ou();
  const cases: [BattlePerspective, 'p1' | 'p2', boolean][] = [
    ['p1', 'p1', true],
    ['p1', 'p2', false],
    ['p2', 'p2', true],
    ['p2', 'p1', false],
    ['spectator', 'p1', false],
    ['spectator', 'p2', false],
    ['omniscient', 'p1', true],
    ['omniscient', 'p2', true],
  ];

  it.each(cases)('%s viewing %s: private details present = %s', (perspective, side, present) => {
    const state = session.getState(perspective).sides[side];
    const all = [...state.team, ...state.active.filter((p): p is BattlePokemonState => p !== null)];
    expect(all.length).toBeGreaterThan(0);
    for (const pokemon of all) expect(pokemon.privateDetails !== undefined).toBe(present);
    if (!present) expect(privateKeysIn(all)).toEqual([]);
  });

  it('stays hidden after the rival is revealed by play (switch-in, moves)', () => {
    const played = begin(ou());
    played.submitChoice('p1', {
      kind: 'actions',
      actions: [{ kind: 'move', slot: { side: 'p1', position: 0 }, moveId: 'shadowball' }],
    });
    played.submitChoice('p2', {
      kind: 'actions',
      actions: [{ kind: 'move', slot: { side: 'p2', position: 0 }, moveId: 'shadowball' }],
    });
    const rival = pokemonOf(played, 'p1', 'p2');
    expect(rival[0]!.moves).toBeDefined();
    expect(privateKeysIn(rival)).toEqual([]);
  });

  it('BattleState remains plain JSON', () => {
    const state = session.getState('p1');
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('private Pokémon details: Open Team Sheets (ADR-0017)', () => {
  const vgc = createBattle({
    formatId: 'champions-vgc-reg-mb',
    seed: SEED,
    sides: {
      p1: { displayName: 'A', team: championsBssTeam },
      p2: { displayName: 'B', team: championsBssTeam },
    },
  });

  it.each(['p1', 'spectator'] as const)('%s sees the sheet but no private details', (viewer) => {
    const rival = pokemonOf(vgc, viewer, 'p2');
    expect(rival).toHaveLength(6);
    for (const pokemon of rival) {
      expect(pokemon.species).toBeDefined();
      expect(pokemon.item).toBeDefined();
      expect(pokemon.ability).toBeDefined();
      expect(pokemon.moves?.length).toBe(4);
      expect(pokemon.privateDetails).toBeUndefined();
    }
    expect(privateKeysIn(rival)).toEqual([]);
    expect(JSON.stringify(rival)).not.toMatch(/Jolly|Adamant|Impish|Modest|Bold/);
  });

  it('the owner still sees their own private details', () => {
    expect(pokemonOf(vgc, 'p1', 'p1')[0]!.privateDetails?.nature).toBe('Jolly');
  });
});
