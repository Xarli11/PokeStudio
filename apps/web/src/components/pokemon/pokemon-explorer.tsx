'use client';

import { useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { SpeciesSearchAlias, SpeciesSearchItem } from '@pokestudio/database';
import { formatMessage, type Locale } from '@pokestudio/i18n';
import type { PokemonType } from '@pokestudio/pokemon-data';

import { ClearIcon, SearchIcon } from '@/components/search-field-icons';
import { buttonClass, searchInputClass } from '@/lib/ui-classes';
import {
  dexNumberLabel,
  filterSpeciesSearchIndex,
  getPokemonSuggestions,
  speciesDisplayName,
  type PokemonSuggestion,
  type SpeciesSearchMatch,
} from '@/lib/pokemon-search';

import { PokemonCard } from './card';
import { PokemonTypeBadge } from './type-badge';

export interface PokemonExplorerProps {
  locale: Locale;
  /** The whole Pokédex, for instant client-side search (task §3/§4 — measured ~19KB gzip at 1025 species). */
  searchIndex: { items: SpeciesSearchItem[]; aliases: SpeciesSearchAlias[] };
  /** The current server-rendered page — shown as-is whenever the search box is empty, so the base route stays exactly as indexable/paginated as before (task §17). */
  defaultView: { items: SpeciesSearchItem[]; page: number; totalPages: number };
  typeLabels: Record<PokemonType, string>;
  searchLabel: string;
  searchPlaceholder: string;
  searchHelperTitle: string;
  searchHelperExample: string;
  /** "{count} forms match" (Search UX v2 §3) — used only when several of a species' form aliases tie for the best match, instead of arbitrarily picking one to display. */
  multipleFormsMatchTemplate: string;
  resultCountTemplate: string;
  noResultsLabel: string;
  clearSearchLabel: string;
  pageLabelTemplate: string;
  previousPageLabel: string;
  nextPageLabel: string;
}

/**
 * Card props for one matched species (Search UX v2 §2/§3). When exactly one
 * form alias is responsible for the match, the card's secondary line is
 * that form's own localized name and its types replace the default form's.
 * When several of the species' aliases tied for the match, the card instead
 * says so ("N forms match") and keeps the species' own default types/art —
 * picking one of the tied forms to display would be arbitrary.
 */
function toCardProps(
  match: SpeciesSearchMatch,
  locale: Locale,
  typeLabels: Record<PokemonType, string>,
  multipleFormsMatchTemplate: string,
) {
  const { item, formMatch } = match;
  const matchContext =
    formMatch === undefined
      ? undefined
      : formMatch.kind === 'single'
        ? {
            label: locale === 'es' ? formMatch.alias.name.es : formMatch.alias.name.en,
            types: formMatch.alias.types.map((type) => ({ type, label: typeLabels[type] })),
          }
        : {
            label: formatMessage(multipleFormsMatchTemplate, { count: formMatch.aliases.length }),
          };

  return {
    href: `/${locale}/pokemon/${item.slug}`,
    name: speciesDisplayName(item, locale),
    dexNumberLabel: dexNumberLabel(item.nationalDexNumber),
    types: item.types.map((type) => ({ type, label: typeLabels[type] })),
    matchContext,
  };
}

/**
 * One autocomplete row (task §4) — Dex number, localized name, up to two
 * compact type badges, and (only when the best match came via form
 * alias(es), task §6/Search UX v2 §3) a muted second line: the matched
 * form's own localized name when exactly one alias is responsible, or a
 * compact "N forms match" line when several tied — never an arbitrarily
 * chosen one of them.
 */
function SuggestionRow({
  suggestion,
  locale,
  typeLabels,
  multipleFormsMatchTemplate,
  active,
  optionId,
  onHover,
  onSelect,
}: {
  suggestion: PokemonSuggestion;
  locale: Locale;
  typeLabels: Record<PokemonType, string>;
  multipleFormsMatchTemplate: string;
  active: boolean;
  optionId: string;
  onHover: () => void;
  onSelect: () => void;
}) {
  const { item, formMatch } = suggestion;
  // A single-form match shows *that form's* types (Search UX v2 §2) — the
  // default form's types would misrepresent why this row matched (e.g. an
  // Alolan-form match showing the species' default Normal type instead of
  // the Alolan form's Dark type). An ambiguous match keeps the species'
  // default types rather than implying one specific form (§3).
  const displayTypes = formMatch?.kind === 'single' ? formMatch.alias.types : item.types;
  const contextLabel =
    formMatch === undefined
      ? undefined
      : formMatch.kind === 'single'
        ? locale === 'es'
          ? formMatch.alias.name.es
          : formMatch.alias.name.en
        : formatMessage(multipleFormsMatchTemplate, { count: formMatch.aliases.length });

  return (
    <li role="presentation">
      <Link
        id={optionId}
        role="option"
        aria-selected={active}
        href={`/${locale}/pokemon/${item.slug}`}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={onHover}
        onClick={onSelect}
        className="flex min-w-0 items-center gap-3 px-3 py-2 text-sm no-underline text-inherit data-[active=true]:bg-surface-hover"
        data-active={active}
      >
        <span className="w-11 shrink-0 text-xs font-semibold tabular-nums text-muted">
          {dexNumberLabel(item.nationalDexNumber)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-foreground">
            {speciesDisplayName(item, locale)}
          </span>
          {contextLabel ? (
            <span className="block truncate text-xs text-muted">{contextLabel}</span>
          ) : null}
        </span>
        <span className="flex shrink-0 gap-1">
          {displayTypes.slice(0, 2).map((type) => (
            <PokemonTypeBadge key={type} type={type} label={typeLabels[type]} size="sm" />
          ))}
        </span>
      </Link>
    </li>
  );
}

/**
 * Whole-Pokédex search over the paginated index (Phase 1C.3, Search UX v2).
 * An accessible combobox sits above the grid: typing drives both an
 * autocomplete suggestion panel (task §4 — quick "jump to a Pokémon") *and*
 * the full-Pokédex grid filter underneath (task §2/§8) from the same query
 * and the same already-fetched dataset — no server round trip either way.
 * An empty search box renders exactly the server-provided page + pagination
 * nav (unchanged behavior); a non-empty query switches the grid to an
 * unpaginated view of every matching species.
 */
export function PokemonExplorer({
  locale,
  searchIndex,
  defaultView,
  typeLabels,
  searchLabel,
  searchPlaceholder,
  searchHelperTitle,
  searchHelperExample,
  multipleFormsMatchTemplate,
  resultCountTemplate,
  noResultsLabel,
  clearSearchLabel,
  pageLabelTemplate,
  previousPageLabel,
  nextPageLabel,
}: PokemonExplorerProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const suggestions = useMemo(
    () => getPokemonSuggestions(searchIndex.items, searchIndex.aliases, query, locale),
    [searchIndex, query, locale],
  );
  const results = useMemo(
    () => filterSpeciesSearchIndex(searchIndex.items, searchIndex.aliases, query, locale),
    [searchIndex, query, locale],
  );
  const isSearching = query.trim().length > 0;
  const showSuggestions = isOpen && isSearching && suggestions.length > 0;
  const showHelper = isOpen && !isSearching;
  const panelOpen = showSuggestions || showHelper;

  function optionId(index: number): string {
    return `${listboxId}-option-${index}`;
  }

  function closePanel(): void {
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
    } else if (event.key === 'Enter') {
      const highlighted = activeIndex >= 0 ? suggestions[activeIndex] : undefined;
      if (highlighted) {
        event.preventDefault();
        closePanel();
        router.push(`/${locale}/pokemon/${highlighted.item.slug}`);
      }
    } else if (event.key === 'Escape') {
      if (isOpen) {
        event.preventDefault();
        closePanel();
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        ref={containerRef}
        className="relative max-w-md"
        onBlur={(event) => {
          if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
            closePanel();
          }
        }}
      >
        <label htmlFor={`${listboxId}-input`} className="flex flex-col gap-1 text-xs text-muted">
          {searchLabel}
        </label>
        <div className="relative mt-1">
          <SearchIcon />
          <input
            ref={inputRef}
            id={`${listboxId}-input`}
            role="combobox"
            aria-expanded={panelOpen}
            aria-controls={panelOpen ? listboxId : undefined}
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            aria-autocomplete="list"
            type="text"
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            className={searchInputClass}
          />
          {isSearching ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                closePanel();
                inputRef.current?.focus();
              }}
              aria-label={clearSearchLabel}
              className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <ClearIcon />
            </button>
          ) : null}
        </div>

        {showSuggestions ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={searchLabel}
            className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-md border border-border-subtle bg-surface-raised shadow-sm"
          >
            {suggestions.map((suggestion, index) => (
              <SuggestionRow
                key={suggestion.item.slug}
                suggestion={suggestion}
                locale={locale}
                typeLabels={typeLabels}
                multipleFormsMatchTemplate={multipleFormsMatchTemplate}
                active={index === activeIndex}
                optionId={optionId(index)}
                onHover={() => setActiveIndex(index)}
                onSelect={closePanel}
              />
            ))}
          </ul>
        ) : null}

        {showHelper ? (
          <div
            id={listboxId}
            className="absolute z-20 mt-1.5 w-full rounded-md border border-border-subtle bg-surface-raised px-3 py-2.5 shadow-sm"
          >
            <p className="m-0 text-sm text-foreground">{searchHelperTitle}</p>
            <p className="m-0 mt-0.5 text-xs text-muted">{searchHelperExample}</p>
          </div>
        ) : null}
      </div>

      {isSearching ? (
        <>
          <p className="m-0 text-xs text-muted" aria-live="polite">
            {formatMessage(resultCountTemplate, {
              count: results.length,
              total: searchIndex.items.length,
            })}
          </p>
          {results.length === 0 ? (
            <p className="m-0 text-sm text-muted">{noResultsLabel}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {results.map((match) => (
                <PokemonCard
                  key={match.item.slug}
                  {...toCardProps(match, locale, typeLabels, multipleFormsMatchTemplate)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {defaultView.items.map((item) => (
              <PokemonCard
                key={item.slug}
                {...toCardProps({ item }, locale, typeLabels, multipleFormsMatchTemplate)}
              />
            ))}
          </div>

          <nav
            aria-label={formatMessage(pageLabelTemplate, {
              page: defaultView.page,
              totalPages: defaultView.totalPages,
            })}
            className="flex items-center justify-between gap-4"
          >
            {defaultView.page > 1 ? (
              <Link
                href={`/${locale}/pokemon?page=${defaultView.page - 1}`}
                className={buttonClass('default')}
              >
                ← {previousPageLabel}
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
            <span className="text-sm text-muted tabular-nums">
              {formatMessage(pageLabelTemplate, {
                page: defaultView.page,
                totalPages: defaultView.totalPages,
              })}
            </span>
            {defaultView.page < defaultView.totalPages ? (
              <Link
                href={`/${locale}/pokemon?page=${defaultView.page + 1}`}
                className={buttonClass('default')}
              >
                {nextPageLabel} →
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
          </nav>
        </>
      )}
    </div>
  );
}
