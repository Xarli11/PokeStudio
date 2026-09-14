'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import type { AbilityListItem } from '@pokestudio/database';
import { abilityEffectsEs, formatMessage, type Locale } from '@pokestudio/i18n';

import { ClearIcon, SearchIcon } from '@/components/search-field-icons';
import { filterAbilities } from '@/lib/ability-search';
import { interactiveCardClass, searchInputClass } from '@/lib/ui-classes';

export interface AbilityIndexExplorerProps {
  locale: Locale;
  /** The whole ability table (313 rows, ~12.5KB gzip measured) — small enough to ship whole and filter instantly client-side (task §9). */
  abilities: AbilityListItem[];
  searchLabel: string;
  searchPlaceholder: string;
  resultCountTemplate: string;
  noResultsLabel: string;
  clearSearchLabel: string;
}

/**
 * A short, locale-appropriate effect preview for the index card — same
 * fallback chain the Pokémon detail page's ability list already uses
 * (upstream Spanish, kept first in case PokéAPI ever publishes one →
 * PokeStudio-owned Spanish → English, honestly, never machine-translated).
 * Without this fallback every Spanish-locale card would show no preview at
 * all: PokéAPI has 0/313 abilities with an upstream Spanish effect.
 */
function effectPreview(ability: AbilityListItem, locale: Locale): string | undefined {
  if (locale === 'es') {
    return ability.effectEs ?? abilityEffectsEs[ability.slug] ?? ability.effectEn;
  }
  return ability.effectEn;
}

export function AbilityIndexExplorer({
  locale,
  abilities,
  searchLabel,
  searchPlaceholder,
  resultCountTemplate,
  noResultsLabel,
  clearSearchLabel,
}: AbilityIndexExplorerProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => filterAbilities(abilities, query), [abilities, query]);
  const isSearching = query.trim().length > 0;
  const visible = isSearching ? filtered : abilities;

  return (
    <div className="flex flex-col gap-6">
      <label className="flex max-w-md flex-col gap-1 text-xs text-muted">
        {searchLabel}
        <div className="relative mt-1">
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            className={searchInputClass}
          />
          {isSearching ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label={clearSearchLabel}
              className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <ClearIcon />
            </button>
          ) : null}
        </div>
      </label>

      {isSearching ? (
        <p className="m-0 text-xs text-muted" aria-live="polite">
          {formatMessage(resultCountTemplate, { count: visible.length, total: abilities.length })}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="m-0 text-sm text-muted">{noResultsLabel}</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((ability) => {
            const name = locale === 'es' ? (ability.nameEs ?? ability.nameEn) : ability.nameEn;
            const preview = effectPreview(ability, locale);
            return (
              <li key={ability.slug}>
                <Link
                  href={`/${locale}/abilities/${ability.slug}`}
                  className={interactiveCardClass('group flex flex-col gap-1.5 px-4 py-3')}
                >
                  <span className="font-semibold transition-colors duration-200 ease-ps group-hover:text-brand group-focus-visible:text-brand">
                    {name}
                  </span>
                  {preview ? (
                    <span className="line-clamp-2 text-xs text-muted">{preview}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
