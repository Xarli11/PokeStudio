export type {
  BaseStats,
  DamageClass,
  DataProvenance,
  FormCategory,
  LocalizedName,
  NormalizedAbility,
  NormalizedDataset,
  NormalizedEvolution,
  NormalizedForm,
  NormalizedFormAbility,
  NormalizedLearnMethod,
  NormalizedLearnsetEntry,
  NormalizedMachine,
  NormalizedMove,
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
  normalizeLearnMethod,
  normalizeMachine,
  normalizeMove,
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
export { createFileCache, createMemoryCache, type RawCache } from './cache';
export { createPokeApiClient, type PokeApiClient } from './pokeapi-client';
export { buildAuditReport, formatAuditReport, type AuditReport } from './audit';
export {
  persistDataset,
  type IngestClient,
  type IngestSchema,
  type PersistResult,
} from './persist';
