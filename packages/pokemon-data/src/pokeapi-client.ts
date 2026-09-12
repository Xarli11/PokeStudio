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
  /** Always present — even a species with no evolution belongs to a (single-node) chain. */
  evolution_chain: { url: string };
}

export interface PokeApiPokemonType {
  slot: number;
  type: PokeApiNamedResource;
}

export interface PokeApiPokemonStat {
  base_stat: number;
  stat: PokeApiNamedResource;
}

export interface PokeApiPokemonAbility {
  ability: PokeApiNamedResource;
  is_hidden: boolean;
  slot: number;
}

export interface PokeApiPokemonMoveVersionGroupDetail {
  level_learned_at: number;
  version_group: PokeApiNamedResource;
  move_learn_method: PokeApiNamedResource;
  order: number | null;
}

export interface PokeApiPokemonMove {
  move: PokeApiNamedResource;
  version_group_details: PokeApiPokemonMoveVersionGroupDetail[];
}

export interface PokeApiPokemon {
  id: number;
  name: string;
  types: PokeApiPokemonType[];
  stats: PokeApiPokemonStat[];
  forms: PokeApiNamedResource[];
  abilities: PokeApiPokemonAbility[];
  moves: PokeApiPokemonMove[];
}

export interface PokeApiEffectEntry {
  effect: string;
  short_effect: string;
  language: PokeApiNamedResource;
}

export interface PokeApiAbility {
  id: number;
  name: string;
  names: PokeApiLocalizedName[];
  effect_entries: PokeApiEffectEntry[];
}

/** One alternative condition set for one evolution edge (an evolution can have several — e.g. Feebas). */
export interface PokeApiEvolutionDetail {
  trigger: PokeApiNamedResource;
  item: PokeApiNamedResource | null;
  held_item: PokeApiNamedResource | null;
  min_level: number | null;
  min_happiness: number | null;
  min_beauty: number | null;
  min_affection: number | null;
  time_of_day: string;
  known_move: PokeApiNamedResource | null;
  known_move_type: PokeApiNamedResource | null;
  location: PokeApiNamedResource | null;
  gender: number | null;
  trade_species: PokeApiNamedResource | null;
  party_species: PokeApiNamedResource | null;
  party_type: PokeApiNamedResource | null;
  relative_physical_stats: number | null;
  needs_overworld_rain: boolean;
  turn_upside_down: boolean;
}

export interface PokeApiEvolutionChainLink {
  species: PokeApiNamedResource;
  evolution_details: PokeApiEvolutionDetail[];
  evolves_to: PokeApiEvolutionChainLink[];
}

export interface PokeApiEvolutionChain {
  id: number;
  chain: PokeApiEvolutionChainLink;
}

/** PokéAPI move `meta` block — always present upstream; "none"/"damage" etc. are real sentinel values. */
export interface PokeApiMoveMeta {
  ailment: PokeApiNamedResource;
  category: PokeApiNamedResource;
  min_hits: number | null;
  max_hits: number | null;
  min_turns: number | null;
  max_turns: number | null;
  drain: number;
  healing: number;
  crit_rate: number;
  ailment_chance: number;
  flinch_chance: number;
  stat_chance: number;
}

/** One (machine resource, version group) pair a move appears as a TM/HM/TR in — resolved further via `fetchMachine`. */
export interface PokeApiMoveMachineRef {
  machine: { url: string };
  version_group: PokeApiNamedResource;
}

export interface PokeApiMove {
  id: number;
  name: string;
  names: PokeApiLocalizedName[];
  accuracy: number | null;
  effect_chance: number | null;
  pp: number;
  priority: number;
  power: number | null;
  damage_class: PokeApiNamedResource;
  effect_entries: PokeApiEffectEntry[];
  generation: PokeApiNamedResource;
  /** Deliberately optional here even though PokéAPI reliably includes it — a handful of historical/special moves may lack it; normalize.ts fails that one move loudly rather than inventing values. */
  meta?: PokeApiMoveMeta | undefined;
  target: PokeApiNamedResource;
  type: PokeApiNamedResource;
  machines: PokeApiMoveMachineRef[];
}

export interface PokeApiVersionGroup {
  id: number;
  name: string;
  /** PokéAPI's own chronological ordering — lets PokeStudio pick "the latest version group" without hardcoding a slug. */
  order: number;
  generation: PokeApiNamedResource;
}

export interface PokeApiMoveLearnMethod {
  id: number;
  name: string;
}

export interface PokeApiMachine {
  id: number;
  item: PokeApiNamedResource;
  move: PokeApiNamedResource;
  version_group: PokeApiNamedResource;
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
  fetchAbility: (url: string) => Promise<PokeApiAbility>;
  fetchEvolutionChain: (url: string) => Promise<PokeApiEvolutionChain>;
  fetchMoveRefs: () => Promise<PokeApiNamedResource[]>;
  fetchMove: (idOrUrl: number | string) => Promise<PokeApiMove>;
  fetchVersionGroupRefs: () => Promise<PokeApiNamedResource[]>;
  fetchVersionGroup: (url: string) => Promise<PokeApiVersionGroup>;
  fetchMoveLearnMethodRefs: () => Promise<PokeApiNamedResource[]>;
  fetchMoveLearnMethod: (url: string) => Promise<PokeApiMoveLearnMethod>;
  fetchMachine: (url: string) => Promise<PokeApiMachine>;
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
    fetchAbility: (url) => fetchJson(url),
    fetchEvolutionChain: (url) => fetchJson(url),
    async fetchMoveRefs() {
      // 937 moves live upstream (Phase 1C.2 audit) — one page covers all.
      const page = await fetchJson<{ results: PokeApiNamedResource[] }>(
        `${POKEAPI_BASE_URL}/move?limit=2000`,
      );
      return page.results;
    },
    fetchMove: (idOrUrl) => fetchJson(toUrl(idOrUrl, 'move')),
    async fetchVersionGroupRefs() {
      // 32 version groups live upstream — one page covers all.
      const page = await fetchJson<{ results: PokeApiNamedResource[] }>(
        `${POKEAPI_BASE_URL}/version-group?limit=100`,
      );
      return page.results;
    },
    fetchVersionGroup: (url) => fetchJson(url),
    async fetchMoveLearnMethodRefs() {
      // 12 learn methods live upstream — one page covers all.
      const page = await fetchJson<{ results: PokeApiNamedResource[] }>(
        `${POKEAPI_BASE_URL}/move-learn-method?limit=100`,
      );
      return page.results;
    },
    fetchMoveLearnMethod: (url) => fetchJson(url),
    fetchMachine: (url) => fetchJson(url),
    requestCount: () => requestCount,
  };
}
