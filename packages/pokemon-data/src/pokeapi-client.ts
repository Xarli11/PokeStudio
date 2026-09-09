import type { RawCache } from './cache';

/**
 * Thin fetch layer for the PokéAPI endpoints ingestion needs.
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
  name: string;
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
  id: number;
  name: string;
  /** Short English-only descriptor, e.g. `"meadow"`, `""` for an undecorated default form. */
  form_name: string;
  is_default: boolean;
  is_battle_only: boolean;
  is_mega: boolean;
  /** Full species+form display name — reliably present only for some languages/forms. */
  names: PokeApiLocalizedName[];
  /** A per-form descriptor (semantics vary: full name for some form groups, a bare region/variant word for others — see `normalize.ts`). */
  form_names: PokeApiLocalizedName[];
}

export interface PokeApiClient {
  fetchSpeciesRefs: () => Promise<PokeApiNamedResource[]>;
  fetchPokemonSpecies: (idOrUrl: number | string) => Promise<PokeApiPokemonSpecies>;
  fetchPokemon: (idOrUrl: number | string) => Promise<PokeApiPokemon>;
  fetchPokemonForm: (url: string) => Promise<PokeApiPokemonForm>;
  requestCount: () => number;
}

function toUrl(idOrUrl: number | string, resource: string): string {
  return typeof idOrUrl === 'string' && idOrUrl.startsWith('http')
    ? idOrUrl
    : `${POKEAPI_BASE_URL}/${resource}/${idOrUrl}`;
}

/**
 * Builds a client that fetches through `cache` when given (falling back to
 * the network only on a cache miss) and counts real network requests made —
 * used for the ingestion performance report (Phase 1B §17).
 */
export function createPokeApiClient(options: { cache?: RawCache | undefined } = {}): PokeApiClient {
  let requestCount = 0;

  async function fetchJson<T>(url: string): Promise<T> {
    const cached = await options.cache?.get(url);
    if (cached !== undefined) return cached as T;

    requestCount++;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'PokeStudio-ingestion/0.2 (+https://pokestudio.app)' },
    });
    if (!response.ok) {
      throw new Error(`Fetch failed for ${url}: ${response.status} ${response.statusText}`);
    }
    const json = (await response.json()) as T;
    await options.cache?.set(url, json);
    return json;
  }

  return {
    async fetchSpeciesRefs() {
      const page = await fetchJson<{ results: PokeApiNamedResource[] }>(
        `${POKEAPI_BASE_URL}/pokemon-species?limit=100000`,
      );
      return page.results;
    },
    fetchPokemonSpecies: (idOrUrl) => fetchJson(toUrl(idOrUrl, 'pokemon-species')),
    fetchPokemon: (idOrUrl) => fetchJson(toUrl(idOrUrl, 'pokemon')),
    fetchPokemonForm: (url) => fetchJson(url),
    requestCount: () => requestCount,
  };
}
