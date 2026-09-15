/**
 * A species' generation of introduction, derived from its National Dex
 * number (Milestone 2, Stage 2A) — not a stored column. `species`/
 * `pokemon_form` don't carry a generation field (dropped when Phase 1A
 * split the flattened Phase 0 `species` spike table into `species` +
 * `pokemon_form`); the National Dex ranges per generation are fixed,
 * canonical, publicly documented game data that never changes once a
 * generation ships, so deriving it here avoids a schema/ingestion change
 * for a value that's already fully determined by data already stored.
 */
const GENERATION_DEX_RANGES: readonly { generation: number; maxDexNumber: number }[] = [
  { generation: 1, maxDexNumber: 151 },
  { generation: 2, maxDexNumber: 251 },
  { generation: 3, maxDexNumber: 386 },
  { generation: 4, maxDexNumber: 493 },
  { generation: 5, maxDexNumber: 649 },
  { generation: 6, maxDexNumber: 721 },
  { generation: 7, maxDexNumber: 809 },
  { generation: 8, maxDexNumber: 905 },
  { generation: 9, maxDexNumber: 1025 },
];

/** 1-9, or `undefined` for a dex number beyond the currently-known ranges (a future generation not yet added here). */
export function generationForNationalDexNumber(nationalDexNumber: number): number | undefined {
  return GENERATION_DEX_RANGES.find((range) => nationalDexNumber <= range.maxDexNumber)?.generation;
}

/** The highest generation this module currently knows about — lets a caller build a complete "all generations" filter list without hardcoding the count separately. */
export const LATEST_KNOWN_GENERATION =
  GENERATION_DEX_RANGES[GENERATION_DEX_RANGES.length - 1]!.generation;
