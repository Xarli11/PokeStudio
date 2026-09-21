import { describe, expect, it } from 'vitest';

import {
  calculateHpStat,
  calculateOtherStat,
  calculateStats,
  natureMultiplierFor,
  type CalculateStatsInput,
  type NatureModifiers,
  type StatKey,
  type StatSpread,
} from '@pokestudio/damage/stats';

/**
 * `@pokestudio/damage/stats` is the public boundary bundle-sensitive callers
 * (Team Builder's `SetEditor`) import instead of the package root, so it
 * never pulls in `@smogon/calc` (Fase 2B.3b). Imports by package specifier,
 * not a relative path, to prove the `exports` subpath itself resolves —
 * `stats.test.ts` already covers the formulas exhaustively via the
 * internal `./stats` module.
 */
describe('@pokestudio/damage/stats (public subpath entrypoint)', () => {
  it('resolves calculateStats and its formula helpers from the subpath', () => {
    expect(typeof calculateStats).toBe('function');
    expect(typeof calculateHpStat).toBe('function');
    expect(typeof calculateOtherStat).toBe('function');
    expect(typeof natureMultiplierFor).toBe('function');
  });

  it('produces the exact same result through the subpath as the formula itself (regression anchor, pinned in stats.test.ts)', () => {
    const baseStats = {
      hp: 100,
      attack: 100,
      defense: 100,
      specialAttack: 100,
      specialDefense: 100,
      speed: 100,
    };
    const input: CalculateStatsInput = {
      baseStats,
      ivs: { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
      evs: { hp: 252, attack: 252, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
      level: 100,
      nature: { increasedStat: 'attack', decreasedStat: 'special-attack' },
    };
    const result: StatSpread = calculateStats(input);

    expect(result.hp).toBe(404);
    expect(result.attack).toBe(328);
    expect(result.defense).toBe(236);
    expect(result.specialAttack).toBe(212);
  });

  it('type-only exports (StatKey, NatureModifiers) are usable at the subpath', () => {
    const stat: StatKey = 'speed';
    const nature: NatureModifiers = { increasedStat: 'speed' };
    expect(natureMultiplierFor(stat, nature)).toBe(1.1);
  });
});
