import type { PokemonType } from './types';

/**
 * The canonical 18-type effectiveness chart (Milestone 2, Stage 2.0) —
 * static, deterministic game rules, not ingested data (unlike
 * species/moves/abilities, this never changes between PokéAPI ingestion
 * runs, so it doesn't belong in Postgres or the ingestion pipeline). Shared
 * by Explore Compare's matchup panel, Team Analysis' defensive/offensive
 * profile, and — later — the Damage Calculator/Battle Lab, so it lives here
 * next to `PokemonType` rather than being duplicated as frontend constants.
 *
 * Only the non-neutral cells are listed per attacking type; any
 * (attacking, defending) pair absent from its attacker's entry is neutral
 * (1×) — this keeps the table's ~90 real exceptions readable instead of
 * writing out all 324 (18×18) cells, most of which are 1×.
 */
const TYPE_CHART: Record<PokemonType, Partial<Record<PokemonType, 0 | 0.5 | 2>>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 2,
    bug: 2,
    rock: 0.5,
    dragon: 0.5,
    steel: 2,
  },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: {
    fire: 0.5,
    water: 2,
    grass: 0.5,
    poison: 0.5,
    ground: 2,
    flying: 0.5,
    bug: 0.5,
    rock: 2,
    dragon: 0.5,
    steel: 0.5,
  },
  ice: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 0.5,
    ground: 2,
    flying: 2,
    dragon: 2,
    steel: 0.5,
  },
  fighting: {
    normal: 2,
    ice: 2,
    poison: 0.5,
    flying: 0.5,
    psychic: 0.5,
    bug: 0.5,
    rock: 2,
    ghost: 0,
    dark: 2,
    steel: 2,
    fairy: 0.5,
  },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: {
    fire: 2,
    electric: 2,
    grass: 0.5,
    poison: 2,
    flying: 0,
    bug: 0.5,
    rock: 2,
    steel: 2,
  },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: {
    fire: 0.5,
    grass: 2,
    fighting: 0.5,
    poison: 0.5,
    flying: 0.5,
    psychic: 2,
    ghost: 0.5,
    dark: 2,
    steel: 0.5,
    fairy: 0.5,
  },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: {
    fire: 0.5,
    water: 0.5,
    electric: 0.5,
    ice: 2,
    rock: 2,
    steel: 0.5,
    fairy: 2,
  },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

/** One attacking type against one defending type — 1 (neutral) when the pair isn't a documented exception. */
export function getSingleTypeEffectiveness(
  attackingType: PokemonType,
  defendingType: PokemonType,
): 0 | 0.5 | 1 | 2 {
  return TYPE_CHART[attackingType][defendingType] ?? 1;
}

/**
 * The composed multiplier for an attacking type against a (possibly
 * dual-type) defending form — multiplies each single-type result together,
 * so a genuine 4× (e.g. Ice into Dragon/Flying) or 0.25× (e.g. Fighting
 * into Poison/Steel... in the direction that resists twice) falls out
 * naturally, and a single 0 (immunity) always zeroes the whole result
 * regardless of the other type, matching the real games' behavior.
 */
export function getTypeEffectiveness(
  attackingType: PokemonType,
  defendingTypes: readonly PokemonType[],
): 0 | 0.25 | 0.5 | 1 | 2 | 4 {
  const multiplier = defendingTypes.reduce<number>(
    (product, defendingType) => product * getSingleTypeEffectiveness(attackingType, defendingType),
    1,
  );
  return multiplier as 0 | 0.25 | 0.5 | 1 | 2 | 4;
}

/** All 18 types, in PokeStudio's canonical display order (matches `dictionary.types`/existing type-badge ordering conventions). */
export const ALL_POKEMON_TYPES: readonly PokemonType[] = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
];
