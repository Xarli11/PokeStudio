import type { Item } from '@pokestudio/database';
import type { Locale } from '@pokestudio/i18n';

import { normalizeText } from './pokemon-search';

/**
 * Held-item search (Fase M3.1C) — Build's own `SetEditor` still offers
 * items through a bare `<select>` over the whole ~175-row dataset (audited
 * directly against `set-editor.tsx` before writing this), which the task is
 * explicit is bad UX at that size for a competitive tool. Mirrors
 * `move-search.ts`'s 3-tier "exact / startsWith / contains" ranking against
 * the localized + English name, the same shared `normalizeText` helper —
 * no new search engine (task §8).
 */

export function itemDisplayName(item: Item, locale: Locale): string {
  return locale === 'es' ? (item.nameEs ?? item.nameEn) : item.nameEn;
}

function bestTextRank(fields: readonly string[], query: string): number | undefined {
  let best: number | undefined;
  for (const field of fields) {
    let rank: number | undefined;
    if (field === query) rank = 0;
    else if (field.startsWith(query)) rank = 1;
    else if (field.includes(query)) rank = 2;
    if (rank !== undefined && (best === undefined || rank < best)) best = rank;
  }
  return best;
}

/** An empty query returns every item alphabetically — the picker's default "browse everything" view, same convention as `searchMoves`. */
export function searchItems(items: readonly Item[], rawQuery: string, locale: Locale): Item[] {
  const query = normalizeText(rawQuery);

  function tieBreak(a: Item, b: Item): number {
    const nameCompare = itemDisplayName(a, locale).localeCompare(itemDisplayName(b, locale));
    return nameCompare !== 0 ? nameCompare : a.slug.localeCompare(b.slug);
  }

  if (!query) return [...items].sort(tieBreak);

  const ranked = items
    .map((item) => ({
      item,
      rank: bestTextRank(
        [normalizeText(itemDisplayName(item, locale)), normalizeText(item.nameEn)],
        query,
      ),
    }))
    .filter((entry): entry is { item: Item; rank: number } => entry.rank !== undefined);

  ranked.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : tieBreak(a.item, b.item)));
  return ranked.map((entry) => entry.item);
}
