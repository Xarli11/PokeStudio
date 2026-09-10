/**
 * PokeStudio normalized Pokémon reference schema (ADR-0010).
 *
 * Deliberately small: species + form only, generation-scoped stat history and
 * game/format availability are deferred until a real feature needs them
 * (ADR-0010 "What Phase 1 actually builds").
 */

export type PokemonType =
  | 'normal'
  | 'fire'
  | 'water'
  | 'electric'
  | 'grass'
  | 'ice'
  | 'fighting'
  | 'poison'
  | 'ground'
  | 'flying'
  | 'psychic'
  | 'bug'
  | 'rock'
  | 'ghost'
  | 'dragon'
  | 'dark'
  | 'steel'
  | 'fairy';

/**
 * How a form relates to its species (ADR-0010, `classify.ts`).
 * `cosmetic` is also the fallback bucket for varieties that don't fit the
 * other three (e.g. gender-differentiated varieties) — see `classify.ts`.
 */
export type FormCategory = 'default' | 'regional' | 'battle' | 'cosmetic';

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface LocalizedName {
  en: string;
  es: string;
}

/**
 * Where one PokeStudio record came from. PokeStudio's own `slug`/id is the
 * primary key everywhere — this is provenance, never used to look records up
 * (ADR-0010 "canonical PokeStudio id/slug distinct from any external source id").
 */
export interface SourceRef {
  /** FK to `data_sources.source_id`, e.g. `"pokeapi"`. */
  sourceId: string;
  /** The id/slug this record has within that source, e.g. a PokéAPI pokemon id. */
  externalId: string;
}

/** The biological/canonical Pokémon species — dex number, evolution family, base identity. */
export interface NormalizedSpecies {
  /** Stable PokeStudio identity, independent of any upstream source id. */
  slug: string;
  nationalDexNumber: number;
  name: LocalizedName;
  source: SourceRef;
}

/**
 * A specific expression of a species. Types and base stats live here, not on
 * the species, because they can differ by form (ADR-0010) — proven by this
 * sample: Alolan/Galarian Meowth both have different types AND base stats
 * from Kantonian Meowth, despite sharing a species.
 */
export interface NormalizedForm {
  /** Stable PokeStudio identity, e.g. `"meowth-alola"`. */
  slug: string;
  /** FK by slug to the owning species. */
  speciesSlug: string;
  name: LocalizedName;
  isDefault: boolean;
  category: FormCategory;
  /** Ordered (primary type first); 1-2 entries. */
  types: PokemonType[];
  baseStats: BaseStats;
  source: SourceRef;
}

export interface DataProvenance {
  sourceId: string;
  sourceUrl: string;
  license: string;
  fetchedAt: string;
  importerVersion: string;
}

/**
 * A canonical ability, independent of any Pokémon (Phase 1C.1). Referenced
 * by `NormalizedFormAbility`, never duplicated per form. Spanish name/effect
 * are optional because PokéAPI doesn't reliably provide them for every
 * ability — never invented when absent (CLAUDE.md §14 "no fake completeness").
 */
export interface NormalizedAbility {
  /** Stable PokeStudio identity — PokéAPI's ability name is already kebab-case. */
  slug: string;
  nameEn: string;
  nameEs?: string | undefined;
  /** Concise effect text (PokéAPI `short_effect`, falling back to `effect`). */
  effectEn?: string | undefined;
  effectEs?: string | undefined;
  source: SourceRef;
}

/** Which ability belongs to which form, in which slot — the join PokeStudio owns (ADR-0010 decision #4). */
export interface NormalizedFormAbility {
  formSlug: string;
  abilitySlug: string;
  /** PokéAPI's 1-based ability slot (1-2 normal, 3 hidden by convention — `isHidden` is the authoritative signal, not the slot number). */
  slot: number;
  isHidden: boolean;
}

/**
 * One evolution edge (`fromSpeciesSlug -> toSpeciesSlug`) plus the condition(s)
 * that trigger it — a graph/edge model, not a fixed stage structure (see
 * docs/adr/0011-abilities-evolutions-schema.md). A species with no evolution
 * has zero edges referencing it; branching/multi-condition evolutions are
 * simply multiple edges sharing the same `fromSpeciesSlug` (branching) or the
 * same `(fromSpeciesSlug, toSpeciesSlug)` pair (alternate methods, e.g. Feebas).
 *
 * `fromSpeciesSlug` is undefined only for a chain's root node, which has no
 * incoming edge — that case never produces a row at all (see `normalizeEvolutionChain`).
 */
export interface NormalizedEvolution {
  /** PokéAPI's evolution-chain id — groups every edge belonging to the same family. */
  chainExternalId: string;
  fromSpeciesSlug: string;
  toSpeciesSlug: string;
  /** Free-form (PokéAPI's trigger list has grown across generations) — e.g. "level-up", "trade", "use-item", "shed". */
  trigger: string;
  minLevel?: number | undefined;
  itemSlug?: string | undefined;
  heldItemSlug?: string | undefined;
  minHappiness?: number | undefined;
  minBeauty?: number | undefined;
  minAffection?: number | undefined;
  timeOfDay?: 'day' | 'night' | undefined;
  knownMoveSlug?: string | undefined;
  knownMoveTypeSlug?: string | undefined;
  locationSlug?: string | undefined;
  /** PokéAPI's raw gender index: 1 = female, 2 = male. Absent = no gender requirement. */
  gender?: number | undefined;
  tradeSpeciesSlug?: string | undefined;
  partySpeciesSlug?: string | undefined;
  partyTypeSlug?: string | undefined;
  /** Tyrogue-style: -1 (attack < defense), 0 (equal), 1 (attack > defense). */
  relativePhysicalStats?: number | undefined;
  needsOverworldRain: boolean;
  turnUpsideDown: boolean;
  /** The complete raw PokéAPI evolution-details entry — preserves anything not modeled above (Phase 1C.1 §B6). */
  raw: Record<string, unknown>;
  source: SourceRef;
}

/** A normalized, provenance-tagged import batch — species and their forms together. */
export interface NormalizedDataset {
  provenance: DataProvenance;
  species: NormalizedSpecies[];
  forms: NormalizedForm[];
  abilities: NormalizedAbility[];
  formAbilities: NormalizedFormAbility[];
  evolutions: NormalizedEvolution[];
}
