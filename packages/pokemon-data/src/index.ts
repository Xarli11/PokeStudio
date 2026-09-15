export type {
  BaseStatKey,
  BaseStats,
  DamageClass,
  DataProvenance,
  FormCategory,
  LocalizedName,
  MoveStat,
  NormalizedAbility,
  NormalizedDataset,
  NormalizedEvolution,
  NormalizedForm,
  NormalizedFormAbility,
  NormalizedItem,
  NormalizedLearnMethod,
  NormalizedLearnsetEntry,
  NormalizedMachine,
  NormalizedMove,
  NormalizedMoveStatChange,
  NormalizedNature,
  NormalizedSpecies,
  NormalizedVersionGroup,
  PokemonType,
  SourceRef,
} from './types';
export {
  normalizeAbility,
  normalizeEvolutionChain,
  normalizeFormAbilities,
  normalizeFormMoves,
  normalizeItem,
  normalizeLearnMethod,
  normalizeMachine,
  normalizeMove,
  normalizeNature,
  normalizeSpecies,
  normalizeSpeciesGroup,
  normalizeVersionGroup,
  parseGenerationSlug,
  resolveFormName,
  type FormNameSource,
  type LocalizationNote,
  type RawSpeciesGroup,
  type RawVarietyGroup,
} from './normalize';
export { ALL_POKEMON_TYPES, getSingleTypeEffectiveness, getTypeEffectiveness } from './type-chart';
export { LATEST_KNOWN_GENERATION, generationForNationalDexNumber } from './species-generation';
export {
  assertValidSlug,
  classifyForm,
  detectRegionLabel,
  pickPrimaryForm,
  REGION_LABELS,
} from './classify';
export { validateExploreDataset } from './validate';
export type { ValidationIssue } from './validate';
export { mapWithConcurrency } from './concurrency';

// Ingestion-only pieces (cache.ts uses node:fs/promises, pokeapi-client.ts
// does live fetches, persist.ts/audit.ts need a service-role Supabase
// client) are deliberately NOT re-exported here. This barrel is imported
// by client-bundled web code for pure domain types/values (e.g. the type
// chart) — pulling in Node-only modules through it breaks that bundle.
// Ingestion scripts import those directly from their source files instead
// (see scripts/ingest.ts, scripts/audit.ts).
