/**
 * PokeStudio normalized Pokémon reference schema (spike subset).
 *
 * This is intentionally a small slice of the eventual data model
 * (CLAUDE.md §10, DATABASE.md) — enough to prove the ingestion pipeline
 * shape, not a production dataset.
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

export interface NormalizedSpecies {
  /** Stable PokeStudio identifier, independent of any upstream source id. */
  id: string;
  nationalDexNumber: number;
  name: LocalizedName;
  types: PokemonType[];
  baseStats: BaseStats;
  /** Earliest generation this species is documented for in this spike. */
  introducedInGeneration: number;
}

export interface DataProvenance {
  sourceId: string;
  sourceUrl: string;
  license: string;
  fetchedAt: string;
  importerVersion: string;
}

export interface ProvenancedDataset<T> {
  provenance: DataProvenance;
  records: T[];
}
