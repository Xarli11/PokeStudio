import { describe, expect, it } from 'vitest';

import { calculateDamage } from './index';

describe('calculateDamage (adapter spike over @smogon/calc)', () => {
  it('returns a plausible damage range and description for a known gen 9 matchup', () => {
    const result = calculateDamage({
      generation: 9,
      attacker: { species: 'Gyarados', item: 'Life Orb' },
      defender: { species: 'Charizard' },
      move: 'Waterfall',
    });

    expect(result.minDamage).toBeGreaterThan(0);
    expect(result.maxDamage).toBeGreaterThanOrEqual(result.minDamage);
    expect(result.description.length).toBeGreaterThan(0);
  });

  it('reports zero damage for an ineffective move', () => {
    const result = calculateDamage({
      generation: 9,
      attacker: { species: 'Gengar' },
      defender: { species: 'Snorlax' },
      move: 'Shadow Ball',
    });

    // Ghost moves do not affect Normal-type Pokémon.
    expect(result.minDamage).toBe(0);
    expect(result.maxDamage).toBe(0);
  });

  it('deals more damage with STAB than the identical move without it', () => {
    const shared = {
      generation: 9 as const,
      defender: { species: 'Snorlax' },
      move: 'Ember',
    };

    // Same move, same defender, same level/EVs/nature — only same-type attack
    // bonus differs (Charizard is Fire-type, Blastoise is not).
    const withStab = calculateDamage({ ...shared, attacker: { species: 'Charizard' } });
    const withoutStab = calculateDamage({ ...shared, attacker: { species: 'Blastoise' } });

    expect(withStab.maxDamage).toBeGreaterThan(withoutStab.maxDamage);
  });

  it('orders damage correctly across super-effective, neutral and resisted matchups', () => {
    const base = { generation: 9 as const, attacker: { species: 'Alakazam' }, move: 'Psychic' };

    // Psychic is super-effective vs. Fighting, neutral vs. Fire/Flying,
    // and resisted (Steel + Psychic-on-Psychic) vs. Steel/Psychic.
    const superEffective = calculateDamage({ ...base, defender: { species: 'Machamp' } });
    const neutral = calculateDamage({ ...base, defender: { species: 'Charizard' } });
    const resisted = calculateDamage({ ...base, defender: { species: 'Metagross' } });

    expect(superEffective.maxDamage).toBeGreaterThan(neutral.maxDamage);
    expect(neutral.maxDamage).toBeGreaterThan(resisted.maxDamage);
  });

  it('matches a pinned known-good calculation exactly (regression anchor)', () => {
    // Fully specified inputs (level/nature/EVs/IVs/item) so the result is
    // pinned, not just "greater than zero" — catches any accidental change
    // in how the adapter forwards inputs to or reads results from
    // @smogon/calc, independent of the upstream formula's own correctness.
    const result = calculateDamage({
      generation: 9,
      attacker: {
        species: 'Garchomp',
        level: 100,
        nature: 'Jolly',
        item: 'Choice Band',
        ability: 'Rough Skin',
        evs: { atk: 252 },
      },
      defender: {
        species: 'Ferrothorn',
        level: 100,
        nature: 'Relaxed',
        ability: 'Iron Barbs',
        evs: { hp: 252, def: 252 },
      },
      move: 'Earthquake',
    });

    // Ground is super-effective vs. Ferrothorn's Steel typing.
    expect(result.minDamage).toBeGreaterThan(0);
    expect(result).toMatchInlineSnapshot(`
      {
        "description": "252 Atk Choice Band Garchomp Earthquake vs. 252 HP / 252+ Def Ferrothorn: 145-172 (41.1 - 48.8%) -- guaranteed 3HKO",
        "koChanceText": "guaranteed 3HKO",
        "maxDamage": 172,
        "minDamage": 145,
      }
    `);
  });
});
