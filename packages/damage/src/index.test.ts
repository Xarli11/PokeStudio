import { describe, expect, it } from 'vitest';

import { calculateDamage, DamageInputError, type DamageCombatant } from './index';

/**
 * Every numeric expectation below is a pinned regression anchor computed
 * directly against the installed `@smogon/calc` (0.11.0) — not guessed, not
 * copied from a wiki. See the PR description for the exact script/output
 * used to derive them.
 *
 * Every test calls `calculateDamage`, the package's public API — never
 * `./identity.ts`'s resolvers directly, so this doubles as end-to-end proof
 * the identity bridge resolves real PokeStudio slugs correctly, not just
 * unit-level proof of the bridge in isolation.
 */

const ZERO_EVS = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
const MAX_IVS = {
  hp: 31,
  attack: 31,
  defense: 31,
  specialAttack: 31,
  specialDefense: 31,
  speed: 31,
};

function combatant(
  formSlug: string,
  speciesSlug: string,
  overrides: Partial<DamageCombatant> = {},
): DamageCombatant {
  return {
    formSlug,
    speciesSlug,
    level: 100,
    abilitySlug: null,
    itemSlug: null,
    natureSlug: null,
    evs: { ...ZERO_EVS },
    ivs: { ...MAX_IVS },
    ...overrides,
  };
}

describe('calculateDamage — pinned normal damage scenario', () => {
  const garchomp = combatant('garchomp', 'garchomp', {
    natureSlug: 'jolly',
    itemSlug: 'choice-band',
    evs: { ...ZERO_EVS, attack: 252 },
  });
  const ferrothorn = combatant('ferrothorn', 'ferrothorn', {
    natureSlug: 'relaxed',
    evs: { ...ZERO_EVS, hp: 252, defense: 252 },
  });

  it('produces the exact pinned 16-roll spread, range, defender HP and KO chance', () => {
    const result = calculateDamage({
      generation: 9,
      attacker: garchomp,
      defender: ferrothorn,
      moveSlug: 'earthquake',
    });

    expect(result.distribution).toEqual({
      kind: 'rolls',
      rolls: [145, 147, 150, 151, 153, 154, 156, 157, 159, 162, 163, 165, 166, 168, 169, 172],
    });
    expect(result.minDamage).toBe(145);
    expect(result.maxDamage).toBe(172);
    expect(result.defenderMaxHp).toBe(352);
    expect(result.minPercent).toBeCloseTo((145 / 352) * 100, 5);
    expect(result.maxPercent).toBeCloseTo((172 / 352) * 100, 5);
    expect(result.ko).toEqual({ chance: 1, hitsToKo: 3 });
    // Ground vs Grass/Steel: 0.5 * 2 = 1 — a real "cancels out to neutral"
    // matchup, not an arbitrary choice (verified against @smogon/calc's own
    // TYPE_CHART, not PokeStudio's modern-only chart — see effectiveness
    // tests below for the generation-*dependent* case).
    expect(result.effectiveness).toBe('neutral');
    expect(result.isSTAB).toBe(true); // Garchomp is Dragon/Ground, using Earthquake (Ground)
    expect(result.debugDescription.length).toBeGreaterThan(0); // debug-only, never asserted as the UI source of truth
  });

  it('a forced critical hit changes the distribution (isCritical input wired through)', () => {
    const result = calculateDamage({
      generation: 9,
      attacker: garchomp,
      defender: ferrothorn,
      moveSlug: 'earthquake',
      isCritical: true,
    });

    expect(result.distribution).toEqual({
      kind: 'rolls',
      rolls: [219, 220, 223, 226, 229, 231, 234, 237, 238, 241, 244, 247, 249, 252, 255, 258],
    });
    expect(result.modifiers.isCritical).toBe(true);
    expect(result.ko).toEqual({ chance: 1, hitsToKo: 2 });
  });

  it('item modifier: Choice Band measurably changes the damage range', () => {
    const withoutItem = calculateDamage({
      generation: 9,
      attacker: combatant('garchomp', 'garchomp', {
        natureSlug: 'jolly',
        evs: { ...ZERO_EVS, attack: 252 },
      }),
      defender: ferrothorn,
      moveSlug: 'earthquake',
    });

    expect(withoutItem.minDamage).toBe(97);
    expect(withoutItem.maxDamage).toBe(115);
  });

  it('nature/EV/IV effect: 0 EV and 0 IV noticeably lowers the range vs the 252 EV / 31 IV pinned case', () => {
    const weak = calculateDamage({
      generation: 9,
      attacker: combatant('garchomp', 'garchomp', {
        natureSlug: 'serious',
        evs: { ...ZERO_EVS },
        ivs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
      }),
      defender: ferrothorn,
      moveSlug: 'earthquake',
    });

    expect(weak.distribution).toEqual({
      kind: 'rolls',
      rolls: [73, 73, 75, 76, 76, 78, 78, 79, 79, 81, 82, 82, 84, 84, 85, 87],
    });
  });
});

describe('calculateDamage — ability modifier and the "no auto-selected ability" requirement', () => {
  // Thick Fat is purely defensive (halves Fire/Ice damage TAKEN) — put it on
  // the DEFENDER against a Fire move so it visibly changes the number,
  // unlike an attacker-side ability that happens not to affect that move.
  const charizard = combatant('charizard', 'charizard');
  const azumarill = (abilitySlug: string | null) =>
    combatant('azumarill', 'azumarill', { natureSlug: 'adamant', abilitySlug });

  it('abilitySlug: null produces the true no-ability-modifier result (63-74), not Azumarill’s real default ability', () => {
    const result = calculateDamage({
      generation: 9,
      attacker: charizard,
      defender: azumarill(null),
      moveSlug: 'flamethrower',
    });
    expect(result.minDamage).toBe(63);
    expect(result.maxDamage).toBe(74);
  });

  it('an explicit ability (Thick Fat) roughly halves the damage taken, proving the modifier is real', () => {
    const result = calculateDamage({
      generation: 9,
      attacker: charizard,
      defender: azumarill('thick-fat'),
      moveSlug: 'flamethrower',
    });
    expect(result.minDamage).toBe(31);
    expect(result.maxDamage).toBe(37);
  });

  it("compatibility anchor: @smogon/calc itself still defaults an omitted ability to the species' first ability — the exact upstream behavior that makes this adapter's explicit `'None'` handling necessary; a future @smogon/calc upgrade that changes this default should fail this test, not silently reintroduce task correction 0.D's bug", async () => {
    const { Generations, Pokemon } = await import('@smogon/calc');
    const gen9 = Generations.get(9);
    const omitted = new Pokemon(gen9, 'Azumarill', {});
    expect(omitted.ability).toBe('Thick Fat');
  });
});

describe('calculateDamage — effectiveness (generation-aware, from @smogon/calc’s own TYPE_CHART)', () => {
  it('super-effective: Psychic vs. pure Fighting', () => {
    const result = calculateDamage({
      generation: 9,
      attacker: combatant('alakazam', 'alakazam'),
      defender: combatant('machamp', 'machamp'),
      moveSlug: 'psychic',
    });
    expect(result.effectiveness).toBe('super-effective');
  });

  it('resisted: Psychic vs. Steel/Psychic (Metagross)', () => {
    const result = calculateDamage({
      generation: 9,
      attacker: combatant('alakazam', 'alakazam'),
      defender: combatant('metagross', 'metagross'),
      moveSlug: 'psychic',
    });
    expect(result.effectiveness).toBe('not-very-effective');
  });

  it('immunity: Ghost vs. pure Normal produces a structured zero-damage result, never an exception (task §8)', () => {
    const result = calculateDamage({
      generation: 9,
      attacker: combatant('gengar', 'gengar'),
      defender: combatant('snorlax', 'snorlax'),
      moveSlug: 'shadow-ball',
    });
    expect(result.effectiveness).toBe('immune');
    expect(result.distribution).toEqual({ kind: 'fixed', damage: 0 });
    expect(result.minDamage).toBe(0);
    expect(result.maxDamage).toBe(0);
    // Zero KO chance is an honest, real fact for an immune matchup — not
    // "fake" — but `hitsToKo` has no meaningful value here (never a fake 0).
    expect(result.ko.chance).toBe(0);
    expect(result.ko.hitsToKo).toBeUndefined();
  });

  it('historical effectiveness difference: Ghost vs. Steel was resisted (0.5x) through Generation V, and is neutral (1x) from Generation VI on — the SAME matchup, generation is the only variable, and this is NOT computed from PokeStudio’s modern-only type chart (task correction 0.A)', () => {
    const skarmory = combatant('skarmory', 'skarmory');
    const gengar = combatant('gengar', 'gengar');

    const gen4 = calculateDamage({
      generation: 4,
      attacker: gengar,
      defender: skarmory,
      moveSlug: 'shadow-ball',
    });
    const gen9 = calculateDamage({
      generation: 9,
      attacker: gengar,
      defender: skarmory,
      moveSlug: 'shadow-ball',
    });

    expect(gen4.effectiveness).toBe('not-very-effective');
    expect(gen4.minDamage).toBe(72);
    expect(gen4.maxDamage).toBe(86);

    expect(gen9.effectiveness).toBe('neutral');
    expect(gen9.minDamage).toBe(145);
    expect(gen9.maxDamage).toBe(172);
  });
});

describe('calculateDamage — fixed-damage and multi-hit representations (no flattening)', () => {
  it('a fixed-damage move (Seismic Toss) is represented as `{ kind: "fixed" }`, not a fabricated roll spread', () => {
    const result = calculateDamage({
      generation: 9,
      attacker: combatant('snorlax', 'snorlax'),
      defender: combatant('ferrothorn', 'ferrothorn', {
        natureSlug: 'relaxed',
        evs: { ...ZERO_EVS, hp: 252, defense: 252 },
      }),
      moveSlug: 'seismic-toss',
    });
    expect(result.distribution).toEqual({ kind: 'fixed', damage: 100 });
    expect(result.minDamage).toBe(100);
    expect(result.maxDamage).toBe(100);
  });

  it('a multi-hit move (Rock Blast) keeps one roll-array per hit — never flattened into one array', () => {
    const result = calculateDamage({
      generation: 9,
      attacker: combatant('kingler', 'kingler'),
      defender: combatant('ferrothorn', 'ferrothorn', {
        natureSlug: 'relaxed',
        evs: { ...ZERO_EVS, hp: 252, defense: 252 },
      }),
      moveSlug: 'rock-blast',
    });
    expect(result.distribution.kind).toBe('multi-hit');
    if (result.distribution.kind !== 'multi-hit') throw new Error('unreachable');
    expect(result.distribution.rollSets).toEqual([
      [7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8],
      [7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8],
      [7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8],
    ]);
    // range()/min/max still correctly sum across all hits — this is what a
    // caller that just wants "one number" should use instead of flattening
    // `rollSets` itself.
    expect(result.minDamage).toBe(21);
    expect(result.maxDamage).toBe(24);
    expect(result.modifiers.hits).toBe(3);
  });
});

describe('calculateDamage — identity bridge, exercised end-to-end (not via private helpers)', () => {
  it('slug punctuation case: Farfetch’d (PokeStudio slug "farfetchd", Smogon name has a curly apostrophe) resolves correctly', () => {
    const result = calculateDamage({
      generation: 9,
      attacker: combatant('farfetchd', 'farfetchd'),
      defender: combatant('snorlax', 'snorlax'),
      moveSlug: 'leaf-blade',
    });
    expect(result.minDamage).toBe(85);
    expect(result.maxDamage).toBe(100);
  });

  it('regional form: Meowth-Alola (Dark-type) resolves to its own form, not the species’ default (Normal-type) form', () => {
    const result = calculateDamage({
      generation: 9,
      attacker: combatant('meowth-alola', 'meowth'),
      defender: combatant('slowbro', 'slowbro'),
      moveSlug: 'crunch',
    });
    // Dark vs Water/Psychic: 1 * 2 = 2 — only correct if the resolved
    // attacker is really Dark-type Alolan Meowth, not Normal-type Meowth
    // (which would make Crunch neutral against a pure Psychic reading, or
    // simply not match this pinned range at all).
    expect(result.effectiveness).toBe('super-effective');
    expect(result.isSTAB).toBe(true);
    expect(result.minDamage).toBe(72);
    expect(result.maxDamage).toBe(86);
  });

  it('non-default form with semantic-name risk: Darmanitan-Galar-Standard resolves via the audit-demonstrated override (PokeStudio slug has a "-standard" suffix Smogon’s "Darmanitan-Galar" name doesn’t) — falling back to the species slug would silently use Kantonian Darmanitan’s Fire typing instead', () => {
    const result = calculateDamage({
      generation: 9,
      attacker: combatant('darmanitan-galar-standard', 'darmanitan'),
      defender: combatant('garchomp', 'garchomp'),
      moveSlug: 'icicle-crash',
    });
    // Ice vs Dragon/Ground: 2 * 2 = 4 — only true for Galarian (Ice-type)
    // Darmanitan; Kantonian (Fire-type) Darmanitan using an Ice move would
    // have no STAB and a completely different, much lower damage range.
    expect(result.effectiveness).toBe('super-effective');
    expect(result.minDamage).toBe(508);
    expect(result.maxDamage).toBe(604);
    expect(result.ko.chance).toBe(1);
    expect(result.ko.hitsToKo).toBe(1);
  });

  it('another semantic-name-risk override: Necrozma-Dawn-Wings (PokeStudio slug "necrozma-dawn" omits "-wings", which Smogon’s real name requires)', () => {
    const result = calculateDamage({
      generation: 9,
      attacker: combatant('necrozma-dawn', 'necrozma'),
      defender: combatant('snorlax', 'snorlax'),
      moveSlug: 'photon-geyser',
    });
    expect(result.minDamage).toBe(147);
    expect(result.maxDamage).toBe(174);
  });
});

describe('calculateDamage — input validation (mechanical/identity compatibility, not tournament legality)', () => {
  const validAttacker = combatant('garchomp', 'garchomp');
  const validDefender = combatant('ferrothorn', 'ferrothorn');

  it('rejects an out-of-range generation', () => {
    expect(() =>
      calculateDamage({
        generation: 10,
        attacker: validAttacker,
        defender: validDefender,
        moveSlug: 'earthquake',
      }),
    ).toThrowError(DamageInputError);
    try {
      calculateDamage({
        generation: 0,
        attacker: validAttacker,
        defender: validDefender,
        moveSlug: 'earthquake',
      });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DamageInputError);
      expect((error as DamageInputError).code).toBe('generation-out-of-range');
    }
  });

  it('rejects a form that does not exist', () => {
    try {
      calculateDamage({
        generation: 9,
        attacker: combatant('not-a-real-pokemon-xyz', 'not-a-real-pokemon-xyz'),
        defender: validDefender,
        moveSlug: 'earthquake',
      });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DamageInputError);
      expect((error as DamageInputError).code).toBe('unknown-form');
      expect((error as DamageInputError).side).toBe('attacker');
    }
  });

  it('rejects a move that does not exist', () => {
    try {
      calculateDamage({
        generation: 9,
        attacker: validAttacker,
        defender: validDefender,
        moveSlug: 'not-a-real-move-xyz',
      });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DamageInputError);
      expect((error as DamageInputError).code).toBe('unknown-move');
    }
  });

  it('rejects an ability that does not exist', () => {
    try {
      calculateDamage({
        generation: 9,
        attacker: combatant('garchomp', 'garchomp', { abilitySlug: 'not-a-real-ability-xyz' }),
        defender: validDefender,
        moveSlug: 'earthquake',
      });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DamageInputError);
      expect((error as DamageInputError).code).toBe('unknown-ability');
    }
  });

  it('rejects a nature in a generation that has no natures (natures are Generation III+ only)', () => {
    try {
      calculateDamage({
        generation: 1,
        // Charizard (unlike Garchomp) existed in Generation I — this must
        // fail on the nature, not on the species resolving for that gen.
        attacker: combatant('charizard', 'charizard', { natureSlug: 'jolly' }),
        defender: validDefender,
        moveSlug: 'earthquake',
      });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DamageInputError);
      expect((error as DamageInputError).code).toBe('natures-not-available-in-generation');
    }
  });

  it('rejects an out-of-range level', () => {
    try {
      calculateDamage({
        generation: 9,
        attacker: combatant('garchomp', 'garchomp', { level: 101 }),
        defender: validDefender,
        moveSlug: 'earthquake',
      });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DamageInputError);
      expect((error as DamageInputError).code).toBe('level-out-of-range');
    }
  });

  it('rejects an out-of-range EV', () => {
    try {
      calculateDamage({
        generation: 9,
        attacker: combatant('garchomp', 'garchomp', { evs: { ...ZERO_EVS, attack: 253 } }),
        defender: validDefender,
        moveSlug: 'earthquake',
      });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DamageInputError);
      expect((error as DamageInputError).code).toBe('ev-out-of-range');
    }
  });
});
