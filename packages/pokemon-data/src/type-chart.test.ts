import { describe, expect, it } from 'vitest';

import { ALL_POKEMON_TYPES, getSingleTypeEffectiveness, getTypeEffectiveness } from './type-chart';

describe('getSingleTypeEffectiveness', () => {
  it('returns 2 for a simple super-effective matchup (Fire vs Grass)', () => {
    expect(getSingleTypeEffectiveness('fire', 'grass')).toBe(2);
  });

  it('returns 0.5 for a simple resistance (Normal vs Rock)', () => {
    expect(getSingleTypeEffectiveness('normal', 'rock')).toBe(0.5);
  });

  it('returns 0 for a simple immunity (Normal vs Ghost)', () => {
    expect(getSingleTypeEffectiveness('normal', 'ghost')).toBe(0);
  });

  it('returns 0 for Electric vs Ground (Ground is immune to Electric)', () => {
    expect(getSingleTypeEffectiveness('electric', 'ground')).toBe(0);
  });

  it('returns 1 (neutral) for an undocumented pair', () => {
    expect(getSingleTypeEffectiveness('normal', 'fire')).toBe(1);
    expect(getSingleTypeEffectiveness('water', 'psychic')).toBe(1);
  });

  it('is not assumed symmetric — Fairy resists Dragon, but Dragon does not resist Fairy the same way', () => {
    // Dragon attacks vs Fairy: immune (Fairy resists Dragon completely).
    expect(getSingleTypeEffectiveness('dragon', 'fairy')).toBe(0);
    // Fairy attacks vs Dragon: super effective (the reverse direction).
    expect(getSingleTypeEffectiveness('fairy', 'dragon')).toBe(2);
  });

  it('every type has at least one attacking exception (chart is not accidentally empty)', () => {
    for (const type of ALL_POKEMON_TYPES) {
      const hasSomeException = ALL_POKEMON_TYPES.some(
        (defending) => getSingleTypeEffectiveness(type, defending) !== 1,
      );
      expect(hasSomeException).toBe(true);
    }
  });
});

describe('getTypeEffectiveness (dual-type composition)', () => {
  it('composes 2 x 2 = 4 for a real quad-weakness (Ice vs Dragonite: Dragon/Flying)', () => {
    expect(getTypeEffectiveness('ice', ['dragon', 'flying'])).toBe(4);
  });

  it('composes 0.5 x 0.5 = 0.25 for a real quad-resistance (Grass vs Charizard: Fire/Flying)', () => {
    expect(getTypeEffectiveness('grass', ['fire', 'flying'])).toBe(0.25);
  });

  it('composes 2 x 0.5 = 1 (one weakness cancels one resistance)', () => {
    // Fire vs Fire = 0.5, Fire vs Grass = 2 — order of the defending pair must not matter.
    expect(getTypeEffectiveness('fire', ['fire', 'grass'])).toBe(1);
    expect(getTypeEffectiveness('fire', ['grass', 'fire'])).toBe(1);
  });

  it('0 x anything = 0 (a single immunity zeroes the whole result, real example: Ground vs Gyarados Water/Flying)', () => {
    expect(getTypeEffectiveness('ground', ['water', 'flying'])).toBe(0);
  });

  it('returns the single-type result unchanged for a mono-type defender', () => {
    expect(getTypeEffectiveness('water', ['fire'])).toBe(2);
    expect(getTypeEffectiveness('water', ['grass'])).toBe(0.5);
  });

  it('returns 1 for an empty defending-types array (identity of multiplication)', () => {
    expect(getTypeEffectiveness('fire', [])).toBe(1);
  });
});

describe('ALL_POKEMON_TYPES', () => {
  it('has exactly 18 unique types', () => {
    expect(ALL_POKEMON_TYPES).toHaveLength(18);
    expect(new Set(ALL_POKEMON_TYPES).size).toBe(18);
  });
});
