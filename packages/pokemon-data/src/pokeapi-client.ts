/**
 * Thin fetch layer for the PokéAPI endpoints Phase 1A ingestion needs.
 *
 * This module only fetches and types the raw upstream shape — it does not
 * normalize anything into PokeStudio domain structures (see `normalize.ts`).
 * Keeping fetch and normalize separate lets normalization be unit-tested
 * against fixture JSON without a network call (ROADMAP.md/CLAUDE.md §10:
 * PokéAPI is an ingestion-time source, never a runtime dependency).
 */

export const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2';

export interface PokeApiNamedResource {
  name: string;
  url: string;
}

export interface PokeApiLocalizedName {
  name: string;
  language: PokeApiNamedResource;
}

export interface PokeApiPokemonSpecies {
  id: number;
  names: PokeApiLocalizedName[];
  varieties: { is_default: boolean; pokemon: PokeApiNamedResource }[];
}

export interface PokeApiPokemonType {
  slot: number;
  type: PokeApiNamedResource;
}

export interface PokeApiPokemonStat {
  base_stat: number;
  stat: PokeApiNamedResource;
}

export interface PokeApiPokemon {
  id: number;
  name: string;
  types: PokeApiPokemonType[];
  stats: PokeApiPokemonStat[];
  forms: PokeApiNamedResource[];
}

export interface PokeApiPokemonForm {
  /** Full species+form display name — reliably present only for some languages/forms. */
  names: PokeApiLocalizedName[];
  /** A per-form descriptor (semantics vary: full name for some form groups, a bare region/variant word for others — see `normalize.ts`). */
  form_names: PokeApiLocalizedName[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'PokeStudio-ingestion/0.1 (+https://pokestudio.app)' },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export function fetchPokemonSpecies(id: number): Promise<PokeApiPokemonSpecies> {
  return fetchJson(`${POKEAPI_BASE_URL}/pokemon-species/${id}`);
}

export function fetchPokemon(idOrName: number | string): Promise<PokeApiPokemon> {
  return fetchJson(`${POKEAPI_BASE_URL}/pokemon/${idOrName}`);
}

export function fetchPokemonForm(url: string): Promise<PokeApiPokemonForm> {
  return fetchJson(url);
}
