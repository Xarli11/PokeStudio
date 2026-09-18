import type { MoveSummary } from '@pokelab/database';
import type { Locale } from '@pokelab/i18n';
import type { DamageClass, PokemonType } from '@pokelab/pokemon-data';

import { normalizeText } from './pokemon-search';

/**
 * Build's move picker search (Milestone 2 Stage 2B polish — "Move Picker
 * v2"). Operates purely on an already-loaded legal move list (the set
 * editor's own `legalMoves`, already filtered to the selected form +
 * version group) — no new fetch, no global 900+-move dataset. Deliberately
 * separate from `pokemon-search.ts`'s locale-first 6-tier species ranking:
 * moves need a simpler 3-tier scheme (task: "1. exact, 2. startsWith, 3.
 * contains"), reusing only the shared `normalizeText` helper.
 */

export interface MoveFilters {
  type?: PokemonType | undefined;
  damageClass?: DamageClass | undefined;
}

export function moveDisplayName(move: MoveSummary, locale: Locale): string {
  return locale === 'es' ? (move.nameEs ?? move.nameEn) : move.nameEn;
}

// Rank tiers (lower wins): 1/2/3 = name exact/startsWith/contains, 4/5/6 =
// the same three tiers against the type/damage-class label instead (task:
// "search by type, damage class" — ranked below any name match, since a
// name match is the more specific, more likely-intentional result).
const NAME_EXACT = 1;
const META_EXACT = 4;

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

/**
 * The best rank a move achieves against a normalized text query — name
 * first (localized and source/English, task: "search by localized move
 * name, English/source move name"), falling back to its type/damage-class
 * label only if no name field matched. Power is deliberately never checked
 * here (task: "display metadata, not search priority").
 */
function matchRank(
  move: MoveSummary,
  query: string,
  locale: Locale,
  typeLabel: string,
  damageClassLabel: string,
): number | undefined {
  const nameFields = [normalizeText(moveDisplayName(move, locale)), normalizeText(move.nameEn)];
  const nameRank = bestTextRank(nameFields, query);
  if (nameRank !== undefined) return nameRank + NAME_EXACT; // 1,2,3

  const metaFields = [normalizeText(typeLabel), normalizeText(damageClassLabel)];
  const metaRank = bestTextRank(metaFields, query);
  if (metaRank !== undefined) return metaRank + META_EXACT; // 4,5,6

  return undefined;
}

/**
 * Filters (Type/Damage class) narrow the candidate set first, then a
 * non-empty query ranks/filters what's left; an empty query returns every
 * (filter-narrowed) move alphabetically — the picker's default "browse
 * everything" view for a small learnset, and a genuinely usable one for a
 * large one once combined with the filters (task's Mew scenario).
 * Deterministic tie-break inside equal rank tiers: localized name, then slug
 * (never insertion order, which would depend on the learnset's own row order).
 */
export function searchMoves(
  moves: readonly MoveSummary[],
  rawQuery: string,
  locale: Locale,
  typeLabels: Record<PokemonType, string>,
  damageClassLabels: Record<DamageClass, string>,
  filters: MoveFilters = {},
): MoveSummary[] {
  let candidates = moves;
  if (filters.type !== undefined) {
    const type = filters.type;
    candidates = candidates.filter((move) => move.type === type);
  }
  if (filters.damageClass !== undefined) {
    const damageClass = filters.damageClass;
    candidates = candidates.filter((move) => move.damageClass === damageClass);
  }

  const query = normalizeText(rawQuery);

  function tieBreak(a: MoveSummary, b: MoveSummary): number {
    const nameCompare = moveDisplayName(a, locale).localeCompare(moveDisplayName(b, locale));
    return nameCompare !== 0 ? nameCompare : a.slug.localeCompare(b.slug);
  }

  if (!query) {
    return [...candidates].sort(tieBreak);
  }

  const ranked = candidates
    .map((move) => ({
      move,
      rank: matchRank(
        move,
        query,
        locale,
        typeLabels[move.type],
        damageClassLabels[move.damageClass],
      ),
    }))
    .filter((entry): entry is { move: MoveSummary; rank: number } => entry.rank !== undefined);

  ranked.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : tieBreak(a.move, b.move)));
  return ranked.map((entry) => entry.move);
}
