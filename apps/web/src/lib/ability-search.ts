import type { AbilityListItem } from '@pokestudio/database';

/**
 * Whole-ability-index client-side search (Phase 1C.3 §9) — the 313-ability
 * dataset is small enough to ship whole (measured ~51KB JSON / ~12.5KB gzip),
 * so this mirrors `pokemon-search.ts`'s "filter an already-fetched array"
 * shape rather than a server round trip.
 */

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** English- or Spanish-name substring match, case/whitespace-insensitive. */
export function filterAbilities(
  items: readonly AbilityListItem[],
  rawQuery: string,
): AbilityListItem[] {
  const query = normalizeText(rawQuery);
  if (!query) return [];
  return items.filter(
    (item) =>
      normalizeText(item.nameEn).includes(query) ||
      (item.nameEs !== undefined && normalizeText(item.nameEs).includes(query)),
  );
}
