import type { SpeciesSearchAlias, SpeciesSearchItem } from '@pokestudio/database';
import type { Locale } from '@pokestudio/i18n';
import { generationForNationalDexNumber } from '@pokestudio/pokemon-data';
import type { PokemonType } from '@pokestudio/pokemon-data';

/**
 * Whole-Pokédex client-side search (Phase 1C.3 §3/§4, Search UX v2) — pure
 * and testable, mirroring `moves-explorer.ts`'s "derive everything from one
 * already-fetched payload" shape. Species-oriented (task §6): a form-name
 * match (e.g. "Alolan Meowth") resolves to its owning species via
 * `aliases`, never to a separate result — the index never gains one entry
 * per form.
 */

/**
 * Case/whitespace/accent-insensitive. Accent-insensitivity matters for
 * Spanish queries (Search UX v2 §1) — a query typed without accents must
 * still match an accented source name, and vice versa. Exported for reuse by
 * `move-search.ts` (Build's move picker, Milestone 2 Stage 2B polish) —
 * same normalization rule, no reason to duplicate the diacritic regex.
 */
export function normalizeText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITIC_MARKS, '');
}

/** Unicode combining diacritical marks (U+0300-U+036F) — stripped after NFD decomposition so accents fall away without touching the base letter. */
const DIACRITIC_MARKS = /[̀-ͯ]/g;

/** A search query, classified once so filtering doesn't re-parse it per item. */
export type ParsedPokemonQuery =
  { kind: 'empty' } | { kind: 'dexNumber'; value: number } | { kind: 'text'; value: string };

/**
 * Accepts "Bulbasaur", "bulbasaur", "25", "025", "#25", "#025" — a leading
 * "#" and/or leading zeros never change the match (task §3's explicit
 * examples). Whitespace is trimmed and internal runs collapsed so stray
 * spaces never cause a false empty/no-match result.
 */
export function parsePokemonQuery(raw: string): ParsedPokemonQuery {
  const trimmed = normalizeText(raw);
  if (!trimmed) return { kind: 'empty' };

  const withoutHash = trimmed.startsWith('#') ? trimmed.slice(1).trim() : trimmed;
  if (withoutHash.length > 0 && /^\d+$/.test(withoutHash)) {
    return { kind: 'dexNumber', value: Number.parseInt(withoutHash, 10) };
  }
  return { kind: 'text', value: trimmed };
}

/**
 * Deterministic match tiers (Search UX v2 §1) — a lower number always
 * outranks a higher one. Dex-number matches are handled separately by
 * `parsePokemonQuery` and never mix with these. Locale-first, not
 * name-vs-alias-first: a natural phrase in the viewer's own language (their
 * own species name *or* a form alias) always outranks the English/source
 * name, so "meowth de alola" isn't buried under every English form name
 * that happens to start with "m".
 */
const LOCALE_EXACT = 2;
const SOURCE_EXACT = 3;
const LOCALE_STARTS_WITH = 4;
const SOURCE_STARTS_WITH = 5;
const LOCALE_CONTAINS = 6;
const SOURCE_CONTAINS = 7;

/**
 * Order-independent, per-word substring match: every whitespace-separated
 * query token must be a substring of *some* candidate token. This is what
 * lets natural phrasing that drops or reorders a word — "meowth alola",
 * "alola meowth" — still resolve to "Meowth de Alola" (Search UX v2 §1),
 * where a whole-string `.includes()` categorically cannot (there is no
 * contiguous run of characters shared between "meowth alola" and "meowth de
 * alola"). Deliberately not fuzzy: every token must still be an exact
 * substring of some candidate word, just not a substring of the whole
 * phrase in that exact order.
 */
function tokensContain(candidateNormalized: string, queryNormalized: string): boolean {
  const candidateTokens = candidateNormalized.split(' ');
  const queryTokens = queryNormalized.split(' ');
  return queryTokens.every((queryToken) =>
    candidateTokens.some((candidateToken) => candidateToken.includes(queryToken)),
  );
}

/**
 * The best match tier a localized name (a species' own name, or one form
 * alias) achieves against a normalized text query, checking the viewer's
 * locale before the English/source name at every tier (task §1's
 * ranking). When `locale` is `'en'`, the locale and source fields are the
 * same string, so the source-tier checks simply never add a match the
 * locale tier didn't already find — no special-casing needed.
 */
function localizedMatchRank(
  name: { en: string; es: string },
  query: string,
  locale: Locale,
): number | undefined {
  const localeField = normalizeText(locale === 'es' ? name.es : name.en);
  const sourceField = normalizeText(name.en);

  if (localeField === query) return LOCALE_EXACT;
  if (sourceField === query) return SOURCE_EXACT;
  if (localeField.startsWith(query)) return LOCALE_STARTS_WITH;
  if (sourceField.startsWith(query)) return SOURCE_STARTS_WITH;
  if (tokensContain(localeField, query)) return LOCALE_CONTAINS;
  if (tokensContain(sourceField, query)) return SOURCE_CONTAINS;
  return undefined;
}

/**
 * How a species matched because of its non-default forms, when the species'
 * own name did *not* win the match. `'single'` — exactly one form alias is
 * responsible, so that form's own name/types can be shown honestly.
 * `'ambiguous'` — two or more of the species' aliases matched at the same
 * best rank (e.g. "meowth de" prefixes both "Meowth de Alola" and "Meowth
 * de Galar" equally) — picking one of them to display would be arbitrary,
 * so the caller must represent the ambiguity instead (Search UX v2 §3).
 */
export type SpeciesFormMatch =
  | { kind: 'single'; alias: SpeciesSearchAlias }
  | { kind: 'ambiguous'; aliases: SpeciesSearchAlias[] };

/**
 * One matched species — `formMatch` present only when the best match came
 * from non-default form name(s) (e.g. "Alolan Meowth") rather than the
 * species' own name. Shared by the full-grid filter and the autocomplete
 * panel (Search UX v2 §2/§3): a result that exists *because* a form alias
 * matched must say so and show that form's own types, never silently
 * substitute the default form's — showing "Normal" on a card that matched
 * because of an Alolan (Dark-type) form is actively misleading, and picking
 * one arbitrary form when several matched equally is just as misleading.
 */
export interface SpeciesSearchMatch {
  item: SpeciesSearchItem;
  formMatch?: SpeciesFormMatch;
}

interface RankedSpeciesMatch extends SpeciesSearchMatch {
  rank: number;
}

function sortAliasesByLocalizedName(
  aliasList: readonly SpeciesSearchAlias[],
  locale: Locale,
): SpeciesSearchAlias[] {
  return [...aliasList].sort((a, b) => {
    const aName = locale === 'es' ? a.name.es : a.name.en;
    const bName = locale === 'es' ? b.name.es : b.name.en;
    return aName.localeCompare(bName);
  });
}

/**
 * Every species whose own name matches (in the viewer's locale or the
 * English/source name), or whose non-default form name (alias) matches,
 * ranked per `localizedMatchRank` — deduplicated to one entry per species.
 * `query` is already the normalized text-kind value (dex-number queries are
 * handled separately by both callers, since a dex number can't match an
 * alias). When several of a species' aliases tie for the best rank, that's
 * surfaced as an `'ambiguous'` `formMatch` rather than silently keeping
 * whichever alias happened to be seen first.
 */
function matchSpecies(
  items: readonly SpeciesSearchItem[],
  aliases: readonly SpeciesSearchAlias[],
  query: string,
  locale: Locale,
): RankedSpeciesMatch[] {
  const aliasHitsBySlug = new Map<string, { rank: number; alias: SpeciesSearchAlias }[]>();
  for (const alias of aliases) {
    const rank = localizedMatchRank(alias.name, query, locale);
    if (rank === undefined) continue;
    const hits = aliasHitsBySlug.get(alias.speciesSlug) ?? [];
    hits.push({ rank, alias });
    aliasHitsBySlug.set(alias.speciesSlug, hits);
  }

  const ranked: RankedSpeciesMatch[] = [];
  for (const item of items) {
    const nameRank = localizedMatchRank(item.name, query, locale);
    const aliasHits = aliasHitsBySlug.get(item.slug);
    const bestAliasRank =
      aliasHits === undefined ? undefined : Math.min(...aliasHits.map((hit) => hit.rank));

    if (nameRank !== undefined && (bestAliasRank === undefined || nameRank <= bestAliasRank)) {
      ranked.push({ item, rank: nameRank });
      continue;
    }
    if (bestAliasRank === undefined) continue;

    const tiedAliases = aliasHits!
      .filter((hit) => hit.rank === bestAliasRank)
      .map((hit) => hit.alias);
    const formMatch: SpeciesFormMatch =
      tiedAliases.length === 1
        ? { kind: 'single', alias: tiedAliases[0]! }
        : { kind: 'ambiguous', aliases: sortAliasesByLocalizedName(tiedAliases, locale) };
    ranked.push({ item, rank: bestAliasRank, formMatch });
  }
  return ranked;
}

function toSpeciesSearchMatch({ item, formMatch }: RankedSpeciesMatch): SpeciesSearchMatch {
  return formMatch ? { item, formMatch } : { item };
}

/**
 * Every species whose own name/dex number matches in the viewer's locale or
 * the English/source name, plus every species with a matching *form* name
 * (alias, same locale-or-source rule) — deduplicated to one entry per
 * species, ordered by national Dex number like the default index (task
 * §6/§5). Each result carries `formMatch` when it exists because of a
 * non-default form match (Search UX v2 §2/§3), so the grid card can show
 * that form's own types instead of the default form's — or, when several of
 * the species' forms matched equally, an honest "ambiguous" state instead of
 * one arbitrarily chosen form.
 */
export function filterSpeciesSearchIndex(
  items: readonly SpeciesSearchItem[],
  aliases: readonly SpeciesSearchAlias[],
  rawQuery: string,
  locale: Locale,
): SpeciesSearchMatch[] {
  const query = parsePokemonQuery(rawQuery);
  if (query.kind === 'empty') return [];

  if (query.kind === 'dexNumber') {
    return items
      .filter((item) => item.nationalDexNumber === query.value)
      .sort((a, b) => a.nationalDexNumber - b.nationalDexNumber)
      .map((item) => ({ item }));
  }

  return matchSpecies(items, aliases, query.value, locale)
    .sort((a, b) => a.item.nationalDexNumber - b.item.nationalDexNumber)
    .map(toSpeciesSearchMatch);
}

/** National Dex number is a product identifier, not translatable prose (CLAUDE.md brand-cleanup pass) — always "#NNN", independent of locale. Duplicated intentionally from the two page components rather than shared: a one-line, locale-independent formatter isn't worth a cross-module dependency. */
export function dexNumberLabel(n: number): string {
  return `#${String(n).padStart(3, '0')}`;
}

export function speciesDisplayName(item: SpeciesSearchItem, locale: Locale): string {
  return locale === 'es' ? item.name.es : item.name.en;
}

/** Autocomplete suggestion panel size (task §4 "around 6-8"). */
export const MAX_POKEMON_SUGGESTIONS = 8;

/** One autocomplete suggestion — same shape as a grid match (`SpeciesSearchMatch`), kept as its own name at the call sites that mean "suggestion row" rather than "grid card". */
export type PokemonSuggestion = SpeciesSearchMatch;

/**
 * Ranked, capped autocomplete suggestions (task §4/§5, locale-first ranking
 * per Search UX v2 §1) — a small slice of `filterSpeciesSearchIndex`'s same
 * whole-Pokédex dataset, so no extra fetch/index is needed for the
 * dropdown. `formMatch` is only attached when an alias match beats (or is
 * the only) name match, so a species whose own name matches the query never
 * shows a spurious form-context line (e.g. searching "meowth" doesn't
 * caption Meowth with "Alolan Meowth").
 */
export function getPokemonSuggestions(
  items: readonly SpeciesSearchItem[],
  aliases: readonly SpeciesSearchAlias[],
  rawQuery: string,
  locale: Locale,
  limit: number = MAX_POKEMON_SUGGESTIONS,
): PokemonSuggestion[] {
  const query = parsePokemonQuery(rawQuery);
  if (query.kind === 'empty') return [];

  if (query.kind === 'dexNumber') {
    return items
      .filter((item) => item.nationalDexNumber === query.value)
      .sort((a, b) => a.nationalDexNumber - b.nationalDexNumber)
      .slice(0, limit)
      .map((item) => ({ item }));
  }

  return matchSpecies(items, aliases, query.value, locale)
    .sort((a, b) =>
      a.rank !== b.rank ? a.rank - b.rank : a.item.nationalDexNumber - b.item.nationalDexNumber,
    )
    .slice(0, limit)
    .map(toSpeciesSearchMatch);
}

/**
 * Explore Pro filters/sort (Milestone 2, Stage 2A) — composes on top of
 * search, never replaces it: a caller passes `filterSpeciesSearchIndex`'s
 * own output through here (or, with an empty query, the whole unfiltered
 * item set) so "char" + Fire + sort Speed desc behaves predictably (task
 * §7 "filters/search/sort should compose correctly").
 */
export type PokemonSortKey =
  | 'dexNumber'
  | 'name'
  | 'bst'
  | 'hp'
  | 'attack'
  | 'defense'
  | 'specialAttack'
  | 'specialDefense'
  | 'speed';
export type SortDirection = 'asc' | 'desc';

export interface PokemonIndexFilters {
  type?: PokemonType | undefined;
  generation?: number | undefined;
  sortBy?: PokemonSortKey | undefined;
  sortDirection?: SortDirection | undefined;
}

function baseStatTotal(item: SpeciesSearchItem): number {
  const s = item.baseStats;
  return s.hp + s.attack + s.defense + s.specialAttack + s.specialDefense + s.speed;
}

function sortValue(
  item: SpeciesSearchItem,
  sortBy: PokemonSortKey,
  locale: Locale,
): number | string {
  switch (sortBy) {
    case 'dexNumber':
      return item.nationalDexNumber;
    case 'name':
      return speciesDisplayName(item, locale);
    case 'bst':
      return baseStatTotal(item);
    default:
      return item.baseStats[sortBy];
  }
}

/**
 * Applies the mandatory Type/Generation filters and optional sort on top of
 * an already search-matched (or unfiltered) set. Generation is derived from
 * the national Dex number (no stored column — see
 * `packages/pokemon-data/src/species-generation.ts`), not part of
 * `SpeciesSearchMatch` itself.
 */
export function applyPokemonIndexFilters(
  matches: readonly SpeciesSearchMatch[],
  filters: PokemonIndexFilters,
  locale: Locale,
): SpeciesSearchMatch[] {
  let result: SpeciesSearchMatch[] = [...matches];

  if (filters.type !== undefined) {
    const type = filters.type;
    result = result.filter((match) => match.item.types.includes(type));
  }

  if (filters.generation !== undefined) {
    const generation = filters.generation;
    result = result.filter(
      (match) => generationForNationalDexNumber(match.item.nationalDexNumber) === generation,
    );
  }

  if (filters.sortBy !== undefined) {
    const sortBy = filters.sortBy;
    const direction = filters.sortDirection === 'desc' ? -1 : 1;
    result = [...result].sort((a, b) => {
      const aValue = sortValue(a.item, sortBy, locale);
      const bValue = sortValue(b.item, sortBy, locale);
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction * aValue.localeCompare(bValue);
      }
      // Tie-break by Dex number so equal-stat species still order
      // deterministically instead of depending on sort-algorithm stability
      // across engines (task §7 "predictably").
      const primary = direction * ((aValue as number) - (bValue as number));
      return primary !== 0 ? primary : a.item.nationalDexNumber - b.item.nationalDexNumber;
    });
  }

  return result;
}
