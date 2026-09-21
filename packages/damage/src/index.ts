import { Generations, Move, Pokemon, TYPE_CHART, calculate } from '@smogon/calc';

import type { PokemonType } from '@pokestudio/pokemon-data';

import { DamageInputError } from './errors';
import {
  isKnownUnsupportedForm,
  resolveAbilityIdentity,
  resolveItemIdentity,
  resolveMoveIdentity,
  resolveNatureIdentity,
  resolveSpeciesIdentity,
} from './identity';
import type { StatSpread } from './stats';

/**
 * PokeStudio damage-domain boundary (ADR-0004, Fase M3.1A).
 *
 * Application/UI code must call `calculateDamage` here, never `@smogon/calc`
 * directly, and must never construct a `@smogon/calc` `Pokemon`/`Move` with a
 * raw upstream English name — every identity below is a PokeStudio slug,
 * resolved against Smogon's data through `./identity.ts`.
 *
 * Replaces the earlier `calculateDamage` spike outright rather than keeping
 * a v1/v2 split: that spike had zero runtime callers anywhere in the
 * monorepo (confirmed by grep before this change — only its own tests used
 * it), and `@pokestudio/damage` is `"private": true`, so there is no
 * external consumer whose compatibility would justify carrying two APIs.
 */

export {
  calculateHpStat,
  calculateOtherStat,
  calculateStats,
  natureMultiplierFor,
  type CalculateStatsInput,
  type NatureModifiers,
  type StatKey,
  type StatSpread,
} from './stats';

export { DamageInputError, type DamageInputErrorCode } from './errors';

const MIN_LEVEL = 1;
const MAX_LEVEL = 100;
const MAX_EV_PER_STAT = 252;
const MAX_IV_PER_STAT = 31;
const MIN_GENERATION = 1;
const MAX_GENERATION = 9;
/** Natures were introduced in Generation III — no earlier generation has them at all. */
const MIN_NATURE_GENERATION = 3;

export type DamageStatus = 'burn' | 'paralysis' | 'sleep' | 'freeze' | 'poison' | 'badly-poisoned';

/**
 * One side of a damage calculation. Every identity field is a PokeStudio
 * slug — `speciesSlug` is required alongside `formSlug` because the
 * identity bridge's species-slug fallback (for a cosmetic-only recolor, or
 * a default form whose PokeStudio slug carries a descriptive suffix
 * Smogon's bare name doesn't) needs it; both are already present on
 * `ComparablePokemonForm`, so this costs callers nothing new to supply.
 */
export interface DamageCombatant {
  formSlug: string;
  speciesSlug: string;
  level: number;
  /**
   * `null` means no ability modifier is active — never silently defaults to
   * the form's first ability (task correction 0.D). `@smogon/calc` itself
   * defaults an omitted ability to the species' first ability internally
   * (verified against the installed package's source), so this adapter
   * passes the literal ability name `'None'` in that case, which matches no
   * real ability-specific check anywhere in the calculator.
   */
  abilitySlug: string | null;
  itemSlug: string | null;
  /** `null` -> a neutral nature (no stat increase/decrease), not "no nature" as a missing/invalid state. */
  natureSlug: string | null;
  evs: StatSpread;
  ivs: StatSpread;
  boosts?: Partial<Record<Exclude<StatKeyName, 'hp'>, number>>;
  status?: DamageStatus | null;
  /** `null`/omitted -> Tera inactive, matching task correction 0.D. */
  teraType?: PokemonType | null;
}

type StatKeyName = keyof StatSpread;

export interface DamageCalculationInput {
  /** 1-9. Mechanics-only — no `VersionGroupSummary`/`BuildGameCapabilities` dependency (task §11): the web layer resolves a version group down to a bare generation number before calling here. */
  generation: number;
  attacker: DamageCombatant;
  defender: DamageCombatant;
  moveSlug: string;
  isCritical?: boolean;
}

/**
 * `@smogon/calc`'s `Result.damage` is one of `number | number[] |
 * number[][]` depending on the move — a single fixed-damage number
 * (Seismic Toss, Dragon Rage — and, distinctly, a 0 for an immune/status
 * target, see `effectiveness`/§8), a 16-roll spread for a normal single-hit
 * move, or one roll-spread per hit for a multi-hit move (verified directly
 * against the installed package, not assumed). This union preserves that
 * distinction instead of flattening it — a caller that needs "just a
 * number" uses `minDamage`/`maxDamage` (computed via `Result.range()`,
 * which already sums correctly across multi-hit), not this field.
 */
export type DamageDistribution =
  | { kind: 'fixed'; damage: number }
  | { kind: 'rolls'; rolls: number[] }
  | { kind: 'multi-hit'; rollSets: number[][] };

export type DamageEffectiveness = 'immune' | 'not-very-effective' | 'neutral' | 'super-effective';

export interface DamageKoData {
  /** 0-1, undefined when not meaningfully computable (e.g. a status move, or an "possible NHKO" upstream couldn't resolve to a percentage). */
  chance: number | undefined;
  /** Undefined when there's no real KO data (immune, status move, 0 damage) — never a fake 0. */
  hitsToKo: number | undefined;
}

/**
 * Structured, localizable field/battle-state facts `@smogon/calc`'s own
 * `RawDesc` already exposes as typed fields (never parsed out of
 * `fullDesc()`'s English sentence) — mapped to PokeStudio's own semantic
 * vocabulary so the UI/i18n layer never has to touch an upstream English
 * string to render them. Only the concepts this phase's audit found
 * reliably present are mapped; `RawDesc` itself is never re-exported.
 */
export interface DamageResultModifiers {
  isCritical: boolean;
  isBurned: boolean;
  isProtected: boolean;
  weather:
    | 'sand'
    | 'sun'
    | 'rain'
    | 'hail'
    | 'snow'
    | 'harsh-sunshine'
    | 'heavy-rain'
    | 'strong-winds'
    | undefined;
  terrain: 'electric' | 'grassy' | 'psychic' | 'misty' | undefined;
  isReflect: boolean;
  isLightScreen: boolean;
  isAuroraVeil: boolean;
  isHelpingHand: boolean;
  isFriendGuard: boolean;
  isBattery: boolean;
  isPowerSpot: boolean;
  ruinAbilityActive: 'sword' | 'beads' | 'tablets' | 'vessel' | undefined;
  isDefenderDynamaxed: boolean;
  /** Number of hits this calculation assumed, only meaningful alongside a `'multi-hit'` distribution. */
  hits: number | undefined;
}

export interface DamageCalculationResult {
  distribution: DamageDistribution;
  minDamage: number;
  maxDamage: number;
  defenderMaxHp: number;
  minPercent: number;
  maxPercent: number;
  ko: DamageKoData;
  effectiveness: DamageEffectiveness;
  isSTAB: boolean;
  modifiers: DamageResultModifiers;
  /** Upstream's own English sentence — debug/audit only, never the primary UI representation (task §5/§9). */
  debugDescription: string;
}

const STAT_KEY_TO_SMOGON: Record<StatKeyName, string> = {
  hp: 'hp',
  attack: 'atk',
  defense: 'def',
  specialAttack: 'spa',
  specialDefense: 'spd',
  speed: 'spe',
};

const STATUS_TO_SMOGON: Record<DamageStatus, string> = {
  burn: 'brn',
  paralysis: 'par',
  sleep: 'slp',
  freeze: 'frz',
  poison: 'psn',
  'badly-poisoned': 'tox',
};

function toSmogonStatSpread(spread: StatSpread): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(spread) as StatKeyName[]) {
    out[STAT_KEY_TO_SMOGON[key]] = spread[key];
  }
  return out;
}

function toSmogonBoosts(
  boosts: Partial<Record<Exclude<StatKeyName, 'hp'>, number>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(boosts)) {
    if (value !== undefined) out[STAT_KEY_TO_SMOGON[key as Exclude<StatKeyName, 'hp'>]] = value;
  }
  return out;
}

function capitalizeType(type: PokemonType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function validateRange(
  value: number,
  min: number,
  max: number,
  code: 'level-out-of-range' | 'ev-out-of-range' | 'iv-out-of-range',
  side: 'attacker' | 'defender',
  field: string,
): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new DamageInputError(
      code,
      `${field} must be between ${min} and ${max} (got ${value}) for the ${side}`,
      side,
    );
  }
}

function validateStatSpread(
  spread: StatSpread,
  min: number,
  max: number,
  code: 'ev-out-of-range' | 'iv-out-of-range',
  side: 'attacker' | 'defender',
  label: string,
): void {
  for (const key of Object.keys(spread) as StatKeyName[]) {
    validateRange(spread[key], min, max, code, side, `${label}.${key}`);
  }
}

function resolveCombatantIdentity(
  combatant: DamageCombatant,
  generation: number,
  side: 'attacker' | 'defender',
): {
  species: string;
  ability: string;
  item: string | undefined;
  nature: string | undefined;
} {
  validateRange(combatant.level, MIN_LEVEL, MAX_LEVEL, 'level-out-of-range', side, 'level');
  validateStatSpread(combatant.evs, 0, MAX_EV_PER_STAT, 'ev-out-of-range', side, 'evs');
  validateStatSpread(combatant.ivs, 0, MAX_IV_PER_STAT, 'iv-out-of-range', side, 'ivs');

  const species = resolveSpeciesIdentity(combatant.formSlug, combatant.speciesSlug, generation);
  if (!species) {
    throw new DamageInputError(
      isKnownUnsupportedForm(combatant.formSlug) ? 'unsupported-form' : 'unknown-form',
      `Form "${combatant.formSlug}" is not resolvable against @smogon/calc for generation ${generation}`,
      side,
    );
  }

  // 'None' — not omitted — see DamageCombatant.abilitySlug's doc comment:
  // @smogon/calc defaults an omitted ability to the species' first ability.
  let ability = 'None';
  if (combatant.abilitySlug) {
    const resolved = resolveAbilityIdentity(combatant.abilitySlug, generation);
    if (!resolved) {
      throw new DamageInputError(
        'unknown-ability',
        `Ability "${combatant.abilitySlug}" is not resolvable for generation ${generation}`,
        side,
      );
    }
    ability = resolved;
  }

  let item: string | undefined;
  if (combatant.itemSlug) {
    const resolved = resolveItemIdentity(combatant.itemSlug, generation);
    if (!resolved) {
      throw new DamageInputError(
        'unknown-item',
        `Item "${combatant.itemSlug}" is not resolvable for generation ${generation}`,
        side,
      );
    }
    item = resolved;
  }

  let nature: string | undefined;
  if (combatant.natureSlug) {
    if (generation < MIN_NATURE_GENERATION) {
      throw new DamageInputError(
        'natures-not-available-in-generation',
        `Generation ${generation} has no natures`,
        side,
      );
    }
    const resolved = resolveNatureIdentity(combatant.natureSlug);
    if (!resolved) {
      throw new DamageInputError(
        'unknown-nature',
        `Nature "${combatant.natureSlug}" is not resolvable`,
        side,
      );
    }
    nature = resolved;
  }

  return { species, ability, item, nature };
}

function buildPokemon(
  gen: ReturnType<typeof Generations.get>,
  combatant: DamageCombatant,
  identity: {
    species: string;
    ability: string;
    item: string | undefined;
    nature: string | undefined;
  },
): InstanceType<typeof Pokemon> {
  // Built via conditional spreads, not `key: maybeUndefined` — this
  // package's `exactOptionalPropertyTypes` setting treats an explicit
  // `undefined` value differently from an absent key for every one of
  // these optional constructor options.
  return new Pokemon(gen, identity.species, {
    level: combatant.level,
    ability: identity.ability,
    evs: toSmogonStatSpread(combatant.evs),
    ivs: toSmogonStatSpread(combatant.ivs),
    ...(identity.item ? { item: identity.item } : {}),
    ...(identity.nature ? { nature: identity.nature } : {}),
    ...(combatant.boosts ? { boosts: toSmogonBoosts(combatant.boosts) } : {}),
    ...(combatant.status ? { status: STATUS_TO_SMOGON[combatant.status] as never } : {}),
    ...(combatant.teraType ? { teraType: capitalizeType(combatant.teraType) as never } : {}),
  });
}

function toDistribution(damage: number | number[] | number[][]): DamageDistribution {
  if (typeof damage === 'number') return { kind: 'fixed', damage };
  if (Array.isArray(damage[0])) return { kind: 'multi-hit', rollSets: damage as number[][] };
  return { kind: 'rolls', rolls: damage as number[] };
}

/** Generation-aware — deliberately `@smogon/calc`'s own `TYPE_CHART[gen]`, never PokeStudio's modern-only chart (task correction 0.A: that chart is wrong before Generation VI). */
function effectivenessMultiplier(
  generation: number,
  moveType: string,
  defenderTypes: readonly string[],
): number {
  const chart = (TYPE_CHART as Record<number, Record<string, Record<string, number>>>)[generation];
  return defenderTypes.reduce((mult, defType) => mult * (chart?.[moveType]?.[defType] ?? 1), 1);
}

function effectivenessTier(multiplier: number): DamageEffectiveness {
  if (multiplier === 0) return 'immune';
  if (multiplier < 1) return 'not-very-effective';
  if (multiplier > 1) return 'super-effective';
  return 'neutral';
}

const WEATHER_TO_SEMANTIC: Record<string, DamageResultModifiers['weather']> = {
  Sand: 'sand',
  Sun: 'sun',
  Rain: 'rain',
  Hail: 'hail',
  Snow: 'snow',
  'Harsh Sunshine': 'harsh-sunshine',
  'Heavy Rain': 'heavy-rain',
  'Strong Winds': 'strong-winds',
};

const TERRAIN_TO_SEMANTIC: Record<string, DamageResultModifiers['terrain']> = {
  Electric: 'electric',
  Grassy: 'grassy',
  Psychic: 'psychic',
  Misty: 'misty',
};

function toModifiers(rawDesc: Record<string, unknown>): DamageResultModifiers {
  const ruinAbilityActive = rawDesc.isSwordOfRuin
    ? 'sword'
    : rawDesc.isBeadsOfRuin
      ? 'beads'
      : rawDesc.isTabletsOfRuin
        ? 'tablets'
        : rawDesc.isVesselOfRuin
          ? 'vessel'
          : undefined;

  return {
    isCritical: Boolean(rawDesc.isCritical),
    isBurned: Boolean(rawDesc.isBurned),
    isProtected: Boolean(rawDesc.isProtected),
    weather: WEATHER_TO_SEMANTIC[rawDesc.weather as string],
    terrain: TERRAIN_TO_SEMANTIC[rawDesc.terrain as string],
    isReflect: Boolean(rawDesc.isReflect),
    isLightScreen: Boolean(rawDesc.isLightScreen),
    isAuroraVeil: Boolean(rawDesc.isAuroraVeil),
    isHelpingHand: Boolean(rawDesc.isHelpingHand),
    isFriendGuard: Boolean(rawDesc.isFriendGuard),
    isBattery: Boolean(rawDesc.isBattery),
    isPowerSpot: Boolean(rawDesc.isPowerSpot),
    ruinAbilityActive,
    isDefenderDynamaxed: Boolean(rawDesc.isDefenderDynamaxed),
    hits: typeof rawDesc.hits === 'number' ? rawDesc.hits : undefined,
  };
}

/**
 * PokeStudio's damage calculation — slugs in, structured/localizable data
 * out. Never accepts or returns raw `@smogon/calc` identities/objects.
 */
export function calculateDamage(input: DamageCalculationInput): DamageCalculationResult {
  if (
    !Number.isInteger(input.generation) ||
    input.generation < MIN_GENERATION ||
    input.generation > MAX_GENERATION
  ) {
    throw new DamageInputError(
      'generation-out-of-range',
      `generation must be an integer between ${MIN_GENERATION} and ${MAX_GENERATION} (got ${input.generation})`,
    );
  }

  const attackerIdentity = resolveCombatantIdentity(input.attacker, input.generation, 'attacker');
  const defenderIdentity = resolveCombatantIdentity(input.defender, input.generation, 'defender');

  const moveName = resolveMoveIdentity(input.moveSlug, input.generation);
  if (!moveName) {
    throw new DamageInputError(
      'unknown-move',
      `Move "${input.moveSlug}" is not resolvable for generation ${input.generation}`,
    );
  }

  const gen = Generations.get(input.generation as Parameters<typeof Generations.get>[0]);
  const attacker = buildPokemon(gen, input.attacker, attackerIdentity);
  const defender = buildPokemon(gen, input.defender, defenderIdentity);
  const move = new Move(gen, moveName, {
    isCrit: input.isCritical ?? false,
    species: attackerIdentity.species,
    // Best-effort: lets a dynamic-type move (Judgment/Weather Ball/Techno
    // Blast/Multi-Attack) resolve its real type from the attacker's own
    // ability/item where @smogon/calc's Move constructor supports it — not
    // verified reliable for every such move (Judgment's type didn't change
    // in manual testing against this package version), so this is "give it
    // what it needs to try," not a guarantee.
    ...(attackerIdentity.ability !== 'None' ? { ability: attackerIdentity.ability } : {}),
    ...(attackerIdentity.item ? { item: attackerIdentity.item } : {}),
  });

  const result = calculate(gen, attacker, defender, move);
  const [minDamage, maxDamage] = result.range();
  const defenderMaxHp = result.defender.maxHP();
  const ko = result.kochance(false);

  const multiplier = effectivenessMultiplier(
    input.generation,
    result.move.type,
    result.defender.types,
  );

  return {
    distribution: toDistribution(result.damage),
    minDamage,
    maxDamage,
    defenderMaxHp,
    minPercent: (minDamage / defenderMaxHp) * 100,
    maxPercent: (maxDamage / defenderMaxHp) * 100,
    ko: {
      chance: ko.chance,
      hitsToKo: ko.n > 0 ? ko.n : undefined,
    },
    effectiveness: effectivenessTier(multiplier),
    isSTAB: result.attacker.hasType(result.move.type),
    modifiers: toModifiers(result.rawDesc as unknown as Record<string, unknown>),
    debugDescription: result.fullDesc('%', false),
  };
}
