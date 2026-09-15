import { mapWithConcurrency } from './concurrency';
import {
  normalizeAbility,
  normalizeEvolutionChain,
  normalizeItem,
  normalizeLearnMethod,
  normalizeMachine,
  normalizeMove,
  normalizeNature,
  normalizeSpeciesGroup,
  normalizeVersionGroup,
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
  NormalizedItem,
  NormalizedLearnMethod,
  NormalizedLearnsetEntry,
  NormalizedMachine,
  NormalizedMove,
  NormalizedNature,
  NormalizedSpecies,
  NormalizedVersionGroup,
} from './types';

export interface FetchAndNormalizeResult {
  species: NormalizedSpecies[];
  forms: NormalizedForm[];
  abilities: NormalizedAbility[];
  formAbilities: NormalizedFormAbility[];
  evolutions: NormalizedEvolution[];
  moves: NormalizedMove[];
  versionGroups: NormalizedVersionGroup[];
  learnMethods: NormalizedLearnMethod[];
  learnsetEntries: NormalizedLearnsetEntry[];
  machines: NormalizedMachine[];
  natures: NormalizedNature[];
  items: NormalizedItem[];
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

  // Moves/version-groups/learn-methods are their own flat, globally-bounded-
  // concurrency phases too (Phase 1C.2) — same "fetch once, not once per
  // reference" shape as abilities/evolution chains above, just at the scale
  // of the whole move roster (~937) rather than per-species references.
  const moveRefs = await api.fetchMoveRefs();
  const allMoveDetails = await mapWithConcurrency(moveRefs, options.concurrency, (ref) =>
    api.fetchMove(ref.url),
  );

  // PokéAPI's non-standard "shadow" type exists only for a handful of moves
  // exclusive to Pokémon Colosseum/XD's Shadow Pokémon mechanic — a
  // battle-only overlay, never a real Pokémon type (no species/form ever has
  // it). PokeStudio's PokemonType domain deliberately doesn't model it
  // (mainline mechanics only, this phase) — excluded here explicitly, not
  // silently miscast into a real type, so the excluded set stays visible in
  // one place. Their learnset entries are dropped alongside below, rather
  // than left as orphans referencing a move that was never ingested.
  // None of these have a double-dash Z-Move-style name, so the raw PokéAPI
  // name already equals the (would-be) sanitized slug — no need to import
  // normalize.ts's private sanitizeMoveSlug just for this comparison.
  const excludedMoveSlugs = new Set(
    allMoveDetails.filter((move) => move.type.name === 'shadow').map((move) => move.name),
  );
  const moveDetails = allMoveDetails.filter((move) => !excludedMoveSlugs.has(move.name));

  const versionGroupRefs = await api.fetchVersionGroupRefs();
  const versionGroupDetails = await mapWithConcurrency(
    versionGroupRefs,
    options.concurrency,
    (ref) => api.fetchVersionGroup(ref.url),
  );

  const learnMethodRefs = await api.fetchMoveLearnMethodRefs();
  const learnMethodDetails = await mapWithConcurrency(learnMethodRefs, options.concurrency, (ref) =>
    api.fetchMoveLearnMethod(ref.url),
  );

  // Machine identity (TM/HM/TR): each move detail already embeds the
  // {machine url, version_group} pairs it appears as, so the only remaining
  // fetch is each *unique* referenced machine resource (to resolve its item
  // slug) — not the full live /machine list (2372), which would fetch many
  // machines no ingested move ever references.
  const machineUrls = [
    ...new Set(moveDetails.flatMap((move) => move.machines.map((m) => m.machine.url))),
  ];
  const machineDetails = await mapWithConcurrency(machineUrls, options.concurrency, (url) =>
    api.fetchMachine(url),
  );

  // Natures/held items (Milestone 2, Stage 2.0) — own flat, globally-bounded-
  // concurrency phases, same shape as version groups/learn methods above.
  // `fetchHoldableItemRefs` already returns only the ~175 "holdable" items,
  // not PokéAPI's full ~2223-item catalog (see that fetch's own comment).
  const natureRefs = await api.fetchNatureRefs();
  const natureDetails = await mapWithConcurrency(natureRefs, options.concurrency, (ref) =>
    api.fetchNature(ref.url),
  );

  const holdableItemRefs = await api.fetchHoldableItemRefs();
  const itemDetails = await mapWithConcurrency(holdableItemRefs, options.concurrency, (ref) =>
    api.fetchItem(ref.url),
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
  const learnsetEntries: NormalizedLearnsetEntry[] = [];
  const localizationNotes: LocalizationNote[] = [];
  const normalizationFailures: { speciesName: string; error: string }[] = [];
  for (const group of rawGroups) {
    try {
      const normalized = normalizeSpeciesGroup(group, SOURCE_ID);
      species.push(normalized.species);
      forms.push(...normalized.forms);
      formAbilities.push(...normalized.formAbilities);
      // Drop learnset entries for excluded (shadow-type) moves rather than
      // leaving them as validate.ts orphans referencing a move that was
      // never ingested — see excludedMoveSlugs above.
      learnsetEntries.push(
        ...normalized.formMoves.filter((entry) => !excludedMoveSlugs.has(entry.moveSlug)),
      );
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

  const moves: NormalizedMove[] = [];
  for (const move of moveDetails) {
    try {
      moves.push(normalizeMove({ move, sourceId: SOURCE_ID }));
    } catch (error) {
      normalizationFailures.push({
        speciesName: `move:${move.name}`,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const versionGroups: NormalizedVersionGroup[] = versionGroupDetails.map((versionGroup) =>
    normalizeVersionGroup({ versionGroup, sourceId: SOURCE_ID }),
  );

  const learnMethods: NormalizedLearnMethod[] = learnMethodDetails.map((method) =>
    normalizeLearnMethod({ method, sourceId: SOURCE_ID }),
  );

  const machines: NormalizedMachine[] = machineDetails.map((machine) =>
    normalizeMachine({ machine, sourceId: SOURCE_ID }),
  );

  const natures: NormalizedNature[] = [];
  for (const nature of natureDetails) {
    try {
      natures.push(normalizeNature({ nature, sourceId: SOURCE_ID }));
    } catch (error) {
      normalizationFailures.push({
        speciesName: `nature:${nature.name}`,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const items: NormalizedItem[] = [];
  for (const item of itemDetails) {
    try {
      items.push(normalizeItem({ item, sourceId: SOURCE_ID }));
    } catch (error) {
      normalizationFailures.push({
        speciesName: `item:${item.name}`,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    species,
    forms,
    abilities,
    formAbilities,
    evolutions,
    moves,
    versionGroups,
    learnMethods,
    learnsetEntries,
    machines,
    natures,
    items,
    localizationNotes,
    normalizationFailures,
    varietyCount: varietyJobs.length,
    formJobCount: formJobs.length,
    fetchDurationMs,
  };
}
