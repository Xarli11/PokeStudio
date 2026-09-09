/**
 * Data-ingestion architecture skeleton (Phase 0 spike, ROADMAP.md).
 *
 * Fetches a handful of species from PokéAPI, normalizes them into the
 * PokeStudio schema, validates invariants and writes a versioned,
 * provenance-tagged JSON artifact.
 *
 * This is a one-time/offline script, not a runtime dependency — the web app
 * never calls PokéAPI on a normal page request (CLAUDE.md §10).
 *
 * Run with: pnpm --filter @pokestudio/pokemon-data ingest:spike
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NormalizedSpecies, PokemonType, ProvenancedDataset } from '../src/types';
import { validateSpeciesDataset } from '../src/validate';

const SOURCE_BASE_URL = 'https://pokeapi.co/api/v2';
const SPIKE_SPECIES_IDS = [1, 6, 130]; // Bulbasaur, Charizard, Gyarados

interface PokeApiStat {
  base_stat: number;
  stat: { name: string };
}

interface PokeApiPokemon {
  id: number;
  types: { type: { name: string } }[];
  stats: PokeApiStat[];
}

interface PokeApiName {
  name: string;
  language: { name: string };
}

interface PokeApiSpecies {
  names: PokeApiName[];
  generation: { url: string };
}

function statFrom(stats: PokeApiStat[], name: string): number {
  const stat = stats.find((entry) => entry.stat.name === name);
  if (!stat) throw new Error(`Missing stat "${name}"`);
  return stat.base_stat;
}

function localizedName(names: PokeApiName[], language: string): string {
  const match = names.find((entry) => entry.language.name === language);
  if (!match) throw new Error(`Missing "${language}" localized name`);
  return match.name;
}

function generationNumberFromUrl(url: string): number {
  // e.g. https://pokeapi.co/api/v2/generation/1/ -> 1
  const match = /\/generation\/(\d+)\//.exec(url);
  if (!match?.[1]) throw new Error(`Could not parse generation from ${url}`);
  return Number.parseInt(match[1], 10);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

async function fetchSpecies(id: number): Promise<NormalizedSpecies> {
  const [pokemon, species] = await Promise.all([
    fetchJson<PokeApiPokemon>(`${SOURCE_BASE_URL}/pokemon/${id}`),
    fetchJson<PokeApiSpecies>(`${SOURCE_BASE_URL}/pokemon-species/${id}`),
  ]);

  return {
    id: `pokestudio-species-${pokemon.id}`,
    nationalDexNumber: pokemon.id,
    name: {
      en: localizedName(species.names, 'en'),
      es: localizedName(species.names, 'es'),
    },
    types: pokemon.types.map((entry) => entry.type.name as PokemonType),
    baseStats: {
      hp: statFrom(pokemon.stats, 'hp'),
      attack: statFrom(pokemon.stats, 'attack'),
      defense: statFrom(pokemon.stats, 'defense'),
      specialAttack: statFrom(pokemon.stats, 'special-attack'),
      specialDefense: statFrom(pokemon.stats, 'special-defense'),
      speed: statFrom(pokemon.stats, 'speed'),
    },
    introducedInGeneration: generationNumberFromUrl(species.generation.url),
  };
}

async function main() {
  const records = await Promise.all(SPIKE_SPECIES_IDS.map(fetchSpecies));

  const dataset: ProvenancedDataset<NormalizedSpecies> = {
    provenance: {
      sourceId: 'pokeapi',
      sourceUrl: SOURCE_BASE_URL,
      license: 'BSD-3-Clause (PokéAPI data license)',
      fetchedAt: new Date().toISOString(),
      importerVersion: '0.1.0-spike',
    },
    records,
  };

  const issues = validateSpeciesDataset(dataset);
  if (issues.length > 0) {
    console.error('Validation failed:', issues);
    process.exitCode = 1;
    return;
  }

  const outDir = path.join(fileURLToPath(new URL('.', import.meta.url)), '..', 'data');
  const outFile = path.join(outDir, 'spike-species.json');
  await writeFile(outFile, `${JSON.stringify(dataset, null, 2)}\n`, 'utf-8');
  console.warn(`Wrote ${records.length} validated species to ${outFile}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
