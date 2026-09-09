import { mapWithConcurrency } from './concurrency';
import {
  normalizeSpeciesGroup,
  type LocalizationNote,
  type RawSpeciesGroup,
  type RawVarietyGroup,
} from './normalize';
import type { PokeApiClient, PokeApiPokemon, PokeApiPokemonForm } from './pokeapi-client';
import type { NormalizedForm, NormalizedSpecies } from './types';

export interface FetchAndNormalizeResult {
  species: NormalizedSpecies[];
  forms: NormalizedForm[];
  localizationNotes: LocalizationNote[];
  normalizationFailures: { speciesName: string; error: string }[];
  varietyCount: number;
  formJobCount: number;
  fetchDurationMs: number;
}

const SOURCE_ID = 'pokeapi';

/**
 * The shared fetch → reassemble → normalize pipeline used by both
 * `scripts/ingest.ts` (which then persists) and `scripts/audit.ts` (which
 * only reports) — kept in one place so the two never drift.
 *
 * Fetches happen in three flat, globally-bounded-concurrency phases
 * (species → varieties → forms) rather than nested per-species concurrency,
 * so the actual number of requests in flight never exceeds `concurrency`
 * regardless of how large a single species' form family is (Phase 1B §7).
 */
export async function fetchAndNormalize(
  api: PokeApiClient,
  options: { limit?: number | undefined; concurrency: number },
): Promise<FetchAndNormalizeResult> {
  const startedAt = Date.now();

  const allRefs = await api.fetchSpeciesRefs();
  const speciesRefs = options.limit ? allRefs.slice(0, options.limit) : allRefs;

  const speciesDetails = await mapWithConcurrency(speciesRefs, options.concurrency, (ref) =>
    api.fetchPokemonSpecies(ref.url),
  );

  const varietyJobs = speciesDetails.flatMap((species, speciesIndex) =>
    species.varieties.map((variety) => ({
      speciesIndex,
      isDefaultVariety: variety.is_default,
      pokemonUrl: variety.pokemon.url,
    })),
  );
  const pokemonDetails: PokeApiPokemon[] = await mapWithConcurrency(
    varietyJobs,
    options.concurrency,
    (job) => api.fetchPokemon(job.pokemonUrl),
  );

  const formJobs = pokemonDetails.flatMap((pokemon, varietyJobIndex) =>
    pokemon.forms.map((formRef) => ({ varietyJobIndex, formUrl: formRef.url })),
  );
  const formDetails: PokeApiPokemonForm[] = await mapWithConcurrency(
    formJobs,
    options.concurrency,
    (job) => api.fetchPokemonForm(job.formUrl),
  );

  const fetchDurationMs = Date.now() - startedAt;

  const formsByVarietyJobIndex = new Map<number, PokeApiPokemonForm[]>();
  formJobs.forEach((job, formIndex) => {
    const arr = formsByVarietyJobIndex.get(job.varietyJobIndex) ?? [];
    arr.push(formDetails[formIndex]!);
    formsByVarietyJobIndex.set(job.varietyJobIndex, arr);
  });

  const varietiesBySpeciesIndex = new Map<number, RawVarietyGroup[]>();
  varietyJobs.forEach((job, varietyJobIndex) => {
    const arr = varietiesBySpeciesIndex.get(job.speciesIndex) ?? [];
    arr.push({
      pokemon: pokemonDetails[varietyJobIndex]!,
      isDefaultVariety: job.isDefaultVariety,
      forms: formsByVarietyJobIndex.get(varietyJobIndex) ?? [],
    });
    varietiesBySpeciesIndex.set(job.speciesIndex, arr);
  });

  const rawGroups: RawSpeciesGroup[] = speciesDetails.map((species, speciesIndex) => ({
    species,
    varieties: varietiesBySpeciesIndex.get(speciesIndex) ?? [],
  }));

  const species: NormalizedSpecies[] = [];
  const forms: NormalizedForm[] = [];
  const localizationNotes: LocalizationNote[] = [];
  const normalizationFailures: { speciesName: string; error: string }[] = [];
  for (const group of rawGroups) {
    try {
      const normalized = normalizeSpeciesGroup(group, SOURCE_ID);
      species.push(normalized.species);
      forms.push(...normalized.forms);
      localizationNotes.push(...normalized.localizationNotes);
    } catch (error) {
      normalizationFailures.push({
        speciesName: group.species.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    species,
    forms,
    localizationNotes,
    normalizationFailures,
    varietyCount: varietyJobs.length,
    formJobCount: formJobs.length,
    fetchDurationMs,
  };
}
