/**
 * PokeStudio normalized Pokémon reference schema (Phase 1A, ADR-0010).
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
 * How a form relates to its species (ADR-0010). Only the categories the
 * current representative sample actually needs are implemented.
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

/** A normalized, provenance-tagged import batch — species and their forms together. */
export interface ExploreDataset {
  provenance: DataProvenance;
  species: NormalizedSpecies[];
  forms: NormalizedForm[];
}
