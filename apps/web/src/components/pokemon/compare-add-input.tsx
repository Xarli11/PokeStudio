'use client';

import { useId, useMemo, useRef, useState } from 'react';

import type { SpeciesSearchAlias, SpeciesSearchItem } from '@pokestudio/database';
import { formatMessage, type Locale } from '@pokestudio/i18n';
import type { PokemonType } from '@pokestudio/pokemon-data';

import { SearchIcon } from '@/components/search-field-icons';
import { searchInputClass } from '@/lib/ui-classes';
import {
  dexNumberLabel,
  getPokemonSuggestions,
  speciesDisplayName,
  type PokemonSuggestion,
} from '@/lib/pokemon-search';

import { PokemonTypeBadge } from './type-badge';

/**
 * Compare's own "add a Pokémon" combobox (Milestone 2, Stage 2A) — reuses
 * the same whole-Pokédex search engine as `PokemonExplorer`
 * (`getPokemonSuggestions`), but on select *adds a form to the comparison*
 * instead of navigating. An ambiguous form-alias match (e.g. "meowth de")
 * can't be resolved to one specific form, so it's surfaced as a hint to
 * type more rather than silently guessing one.
 */

/**
 * Compare mounts this inside a `flex flex-wrap items-center` ROW (the input
 * needs to grow horizontally, `basis-56` a sane minimum before wrapping) —
 * this is that shape, unchanged. A different parent direction needs a
 * different `widthClassName` (see `RosterPicker`'s manual-review v3 fix
 * below): the exact same classes inside a `flex-col` parent turn
 * `basis-56`'s flex-basis into an unwanted ~224px *height*, not a width,
 * since flex-basis sizes along whichever axis is the container's main axis.
 */
const ROW_WIDTH_CLASS = 'max-w-md flex-1 basis-56';

export function CompareAddInput({
  locale,
  searchIndex,
  typeLabels,
  onAdd,
  disabled,
  searchLabel,
  searchPlaceholder,
  multipleFormsMatchTemplate,
  ambiguousHintLabel,
  noResultsLabel,
  widthClassName = ROW_WIDTH_CLASS,
}: {
  locale: Locale;
  searchIndex: { items: SpeciesSearchItem[]; aliases: SpeciesSearchAlias[] };
  typeLabels: Record<PokemonType, string>;
  onAdd: (formSlug: string) => void;
  disabled?: boolean;
  searchLabel: string;
  searchPlaceholder: string;
  multipleFormsMatchTemplate: string;
  ambiguousHintLabel: string;
  /** "No Pokémon match your search." — a compact one-line state, never a reserved empty area. */
  noResultsLabel: string;
  /** Overrides the root's width/flex-sizing classes for a parent that isn't a flex row — see `ROW_WIDTH_CLASS`'s own comment. */
  widthClassName?: string;
}) {
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
  const isSearching = query.trim().length > 0;
  const hasResults = suggestions.length > 0;
  const panelOpen = isOpen && isSearching && hasResults;
  const showNoResults = isOpen && isSearching && !hasResults;

  function optionId(index: number): string {
    return `${listboxId}-option-${index}`;
  }

  function closePanel(): void {
    setIsOpen(false);
    setActiveIndex(-1);
  }

  /** Single-form match adds that form; an ambiguous match adds nothing (the row explains why). */
  function selectSuggestion(suggestion: PokemonSuggestion): void {
    if (suggestion.formMatch?.kind === 'ambiguous') return;
    const formSlug =
      suggestion.formMatch?.kind === 'single'
        ? suggestion.formMatch.alias.formSlug
        : suggestion.item.formSlug;
    onAdd(formSlug);
    setQuery('');
    closePanel();
    inputRef.current?.focus();
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
        selectSuggestion(highlighted);
      }
    } else if (event.key === 'Escape') {
      if (isOpen) {
        event.preventDefault();
        closePanel();
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${widthClassName}`}
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
          closePanel();
        }
      }}
    >
      <label htmlFor={`${listboxId}-input`} className="sr-only">
        {searchLabel}
      </label>
      <div className="relative">
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
          disabled={disabled}
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
      </div>

      {panelOpen ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={searchLabel}
          className="absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto rounded-md border border-border-subtle bg-surface-raised shadow-sm"
        >
          {suggestions.map((suggestion, index) => {
            const { item, formMatch } = suggestion;
            const isAmbiguous = formMatch?.kind === 'ambiguous';
            const displayTypes = formMatch?.kind === 'single' ? formMatch.alias.types : item.types;
            const contextLabel = isAmbiguous
              ? ambiguousHintLabel
              : formMatch?.kind === 'single'
                ? locale === 'es'
                  ? formMatch.alias.name.es
                  : formMatch.alias.name.en
                : undefined;
            const active = index === activeIndex;

            return (
              <li key={item.slug} role="presentation">
                <button
                  type="button"
                  id={optionId(index)}
                  role="option"
                  aria-selected={active}
                  aria-disabled={isAmbiguous}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectSuggestion(suggestion)}
                  className="flex w-full min-w-0 items-center gap-3 px-3 py-2 text-left text-sm text-inherit data-[active=true]:bg-surface-hover"
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
                      <span className="block truncate text-xs text-muted">
                        {formMatch?.kind === 'ambiguous'
                          ? `${formatMessage(multipleFormsMatchTemplate, { count: formMatch.aliases.length })} — ${contextLabel}`
                          : contextLabel}
                      </span>
                    ) : null}
                  </span>
                  {!isAmbiguous ? (
                    <span className="flex shrink-0 gap-1">
                      {displayTypes.slice(0, 2).map((type) => (
                        <PokemonTypeBadge
                          key={type}
                          type={type}
                          label={typeLabels[type]}
                          size="sm"
                        />
                      ))}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {showNoResults ? (
        <p className="m-0 mt-1.5 text-sm text-muted" role="status">
          {noResultsLabel}
        </p>
      ) : null}
    </div>
  );
}
