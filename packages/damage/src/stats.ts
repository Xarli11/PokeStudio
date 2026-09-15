import type { BaseStatKey, BaseStats } from '@pokestudio/pokemon-data';

/**
 * Exact derived-stat calculation (Milestone 2, Stage 2.0) — the real
 * Generation III+ formulas, implemented directly rather than routed through
 * `@smogon/calc` (this file's sibling `index.ts`): that wrapper resolves a
 * Pokémon's base stats from its own bundled species dex by name, which
 * isn't a reliable match for PokeStudio's own ingested `base_stats` per
 * form/slug — the formula itself is fixed, public and unambiguous, so
 * reimplementing it directly here avoids that integration risk. Team
 * Builder v1's set editor is the first caller; a future Damage Calculator/
 * Battle Lab can reuse this module too (ADR-0004 "own the mechanics
 * boundary").
 */

export type StatKey = keyof BaseStats;

export type StatSpread = Record<StatKey, number>;

/** A nature's stat modifiers, in the same kebab-case vocabulary `NormalizedNature`/the `nature` table store — both undefined together means a neutral nature. */
export interface NatureModifiers {
  increasedStat?: BaseStatKey | undefined;
  decreasedStat?: BaseStatKey | undefined;
}

const CAMEL_TO_KEBAB_STAT: Record<Exclude<StatKey, 'hp'>, BaseStatKey> = {
  attack: 'attack',
  defense: 'defense',
  specialAttack: 'special-attack',
  specialDefense: 'special-defense',
  speed: 'speed',
};

/** 1.1 if `nature` raises this stat, 0.9 if it lowers this stat, 1 otherwise (including every neutral nature, and always for HP — natures never modify HP). */
export function natureMultiplierFor(stat: StatKey, nature: NatureModifiers): 1 | 1.1 | 0.9 {
  if (stat === 'hp') return 1;
  const kebabStat = CAMEL_TO_KEBAB_STAT[stat];
  if (nature.increasedStat === kebabStat) return 1.1;
  if (nature.decreasedStat === kebabStat) return 0.9;
  return 1;
}

/**
 * HP's own formula — structurally different from every other stat (no
 * nature term, and a flat `+ level + 10` rather than `+ 5`).
 * `floor(((2*base + iv + floor(ev/4)) * level) / 100) + level + 10`.
 */
export function calculateHpStat(params: {
  base: number;
  iv: number;
  ev: number;
  level: number;
}): number {
  const inner = 2 * params.base + params.iv + Math.floor(params.ev / 4);
  return Math.floor((inner * params.level) / 100) + params.level + 10;
}

/**
 * The shared non-HP formula (Attack/Defense/Sp. Atk/Sp. Def/Speed):
 * `floor((floor(((2*base + iv + floor(ev/4)) * level) / 100) + 5) * natureMultiplier)`.
 */
export function calculateOtherStat(params: {
  base: number;
  iv: number;
  ev: number;
  level: number;
  natureMultiplier: 1 | 1.1 | 0.9;
}): number {
  const inner = 2 * params.base + params.iv + Math.floor(params.ev / 4);
  const beforeNature = Math.floor((inner * params.level) / 100) + 5;
  return Math.floor(beforeNature * params.natureMultiplier);
}

export interface CalculateStatsInput {
  baseStats: BaseStats;
  ivs: StatSpread;
  evs: StatSpread;
  level: number;
  nature: NatureModifiers;
  /**
   * Shedinja's HP is always exactly 1, regardless of base/IV/EV/level — a
   * real, documented game-mechanics exception (Shedinja's base HP stat, 1,
   * is deliberately excluded from the normal formula by the games
   * themselves), not an approximation. Every other stat still uses the
   * normal formula. Defaults to false; callers key this off the selected
   * species/form slug, not detected here (this module has no species
   * identity of its own).
   */
  isShedinja?: boolean;
}

/** All 6 derived stats for one Pokémon at one level/EV/IV/nature spread. */
export function calculateStats(input: CalculateStatsInput): StatSpread {
  const hp = input.isShedinja
    ? 1
    : calculateHpStat({
        base: input.baseStats.hp,
        iv: input.ivs.hp,
        ev: input.evs.hp,
        level: input.level,
      });

  const otherStat = (stat: Exclude<StatKey, 'hp'>): number =>
    calculateOtherStat({
      base: input.baseStats[stat],
      iv: input.ivs[stat],
      ev: input.evs[stat],
      level: input.level,
      natureMultiplier: natureMultiplierFor(stat, input.nature),
    });

  return {
    hp,
    attack: otherStat('attack'),
    defense: otherStat('defense'),
    specialAttack: otherStat('specialAttack'),
    specialDefense: otherStat('specialDefense'),
    speed: otherStat('speed'),
  };
}
