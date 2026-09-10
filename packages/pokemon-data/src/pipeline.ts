import { mapWithConcurrency } from './concurrency';
import {
  normalizeAbility,
  normalizeEvolutionChain,
  normalizeSpeciesGroup,
  type LocalizationNote,
  type RawSpeciesGroup,
  type RawVarietyGroup,
} from './normalize';
import type { PokeApiClient, PokeApiPokemon, PokeApiPokemonForm } from './pokeapi-client';
import type {
  NormalizedAbility,
  NormalizedEvolution,
  NormalizedForm,
  NormalizedFormAbility,
  NormalizedSpecies,
} from './types';

export interface FetchAndNormalizeResult {
  species: NormalizedSpecies[];
  forms: NormalizedForm[];
  abilities: NormalizedAbility[];
  formAbilities: NormalizedFormAbility[];
  evolutions: NormalizedEvolution[];
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

  // Abilities and evolution chains are each referenced by many
  // species/varieties (most abilities are shared across dozens of Pokémon;
  // every stage of a chain points at the same chain resource) — fetched once
  // per unique URL, not once per reference, same "flat, globally-bounded"
  // shape as the three phases above (Phase 1B §7 applies equally here).
  const abilityUrls = [
    ...new Set(pokemonDetails.flatMap((pokemon) => pokemon.abilities.map((a) => a.ability.url))),
  ];
  const abilityDetails = await mapWithConcurrency(abilityUrls, options.concurrency, (url) =>
    api.fetchAbility(url),
  );

  const evolutionChainUrls = [
    ...new Set(speciesDetails.map((species) => species.evolution_chain.url)),
  ];
  const evolutionChains = await mapWithConcurrency(evolutionChainUrls, options.concurrency, (url) =>
    api.fetchEvolutionChain(url),
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
  const formAbilities: NormalizedFormAbility[] = [];
  const localizationNotes: LocalizationNote[] = [];
  const normalizationFailures: { speciesName: string; error: string }[] = [];
  for (const group of rawGroups) {
    try {
      const normalized = normalizeSpeciesGroup(group, SOURCE_ID);
      species.push(normalized.species);
      forms.push(...normalized.forms);
      formAbilities.push(...normalized.formAbilities);
      localizationNotes.push(...normalized.localizationNotes);
    } catch (error) {
      normalizationFailures.push({
        speciesName: group.species.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const abilities: NormalizedAbility[] = [];
  for (const ability of abilityDetails) {
    try {
      abilities.push(normalizeAbility({ ability, sourceId: SOURCE_ID }));
    } catch (error) {
      normalizationFailures.push({
        speciesName: `ability:${ability.name}`,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const evolutions: NormalizedEvolution[] = evolutionChains.flatMap((chain) =>
    normalizeEvolutionChain({ chain, sourceId: SOURCE_ID }),
  );

  return {
    species,
    forms,
    abilities,
    formAbilities,
    evolutions,
    localizationNotes,
    normalizationFailures,
    varietyCount: varietyJobs.length,
    formJobCount: formJobs.length,
    fetchDurationMs,
  };
}
