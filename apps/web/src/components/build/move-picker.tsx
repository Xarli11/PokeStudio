'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import type { MoveSummary } from '@pokestudio/database';
import type { Locale } from '@pokestudio/i18n';
import { ALL_POKEMON_TYPES } from '@pokestudio/pokemon-data';
import type { DamageClass, PokemonType } from '@pokestudio/pokemon-data';

import { SearchIcon } from '@/components/search-field-icons';
import { searchInputClass } from '@/lib/ui-classes';
import { moveDisplayName, searchMoves } from '@/lib/move-search';

import { PokemonTypeBadge } from '../pokemon/type-badge';

const DAMAGE_CLASSES: readonly DamageClass[] = ['physical', 'special', 'status'];

export interface MovePickerLabels {
  /** Used as both the combobox's accessible label and its placeholder — same convention as `CompareAddInput`. */
  searchLabel: string;
  noResultsLabel: string;
  typeFilterLabel: string;
  allTypesLabel: string;
  damageClassFilterLabel: string;
  allDamageClassesLabel: string;
  damageClassLabels: Record<DamageClass, string>;
  noPowerLabel: string;
  alreadySelectedLabel: string;
  cancelLabel: string;
}

/**
 * Build's move picker (Milestone 2 Stage 2B, "Move Picker v2") — a
 * searchable, filterable, keyboard-accessible combobox replacing the
 * native `<select>` that became unusable for large learnsets (Mew: 234
 * legal moves in Scarlet/Violet). Operates only on `moves`, the legal
 * learnset the set editor already computed for the selected form +
 * version group — no new fetch, no global move dataset.
 *
 * Deliberately not a modal: it replaces the 4-move grid in place (task:
 * "the move picker should feel like a natural Build tool, not a separate
 * feature"), using the set editor's own full width rather than being
 * trapped inside one narrow grid cell — same reasoning `FilledTeamSlot`'s
 * form-swap panel already established for the team slot strip.
 */
export function MovePicker({
  locale,
  moves,
  typeLabels,
  selectedMoveSlugs,
  labels,
  onSelect,
  onClose,
}: {
  locale: Locale;
  moves: readonly MoveSummary[];
  typeLabels: Record<PokemonType, string>;
  /** Moves already chosen in this Pokémon's *other* slots — disabled, not selectable again. */
  selectedMoveSlugs: readonly string[];
  labels: MovePickerLabels;
  onSelect: (moveSlug: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<PokemonType | ''>('');
  const [damageClassFilter, setDamageClassFilter] = useState<DamageClass | ''>('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(
    () =>
      searchMoves(moves, query, locale, typeLabels, labels.damageClassLabels, {
        type: typeFilter === '' ? undefined : typeFilter,
        damageClass: damageClassFilter === '' ? undefined : damageClassFilter,
      }),
    [moves, query, locale, typeLabels, labels.damageClassLabels, typeFilter, damageClassFilter],
  );

  function optionId(index: number): string {
    return `${listboxId}-option-${index}`;
  }

  function selectAt(index: number): void {
    const move = results[index];
    if (!move || selectedMoveSlugs.includes(move.slug)) return;
    onSelect(move.slug);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      if (results.length === 0) return;
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      if (results.length === 0) return;
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
    } else if (event.key === 'Enter') {
      if (activeIndex >= 0) {
        event.preventDefault();
        selectAt(activeIndex);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-brand p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-48">
          <SearchIcon />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            aria-autocomplete="list"
            aria-label={labels.searchLabel}
            type="text"
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder={labels.searchLabel}
            className={searchInputClass}
          />
        </div>

        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as PokemonType | '')}
          aria-label={labels.typeFilterLabel}
          className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-sm text-foreground"
        >
          <option value="">{labels.allTypesLabel}</option>
          {ALL_POKEMON_TYPES.map((type) => (
            <option key={type} value={type}>
              {typeLabels[type]}
            </option>
          ))}
        </select>

        <select
          value={damageClassFilter}
          onChange={(event) => setDamageClassFilter(event.target.value as DamageClass | '')}
          aria-label={labels.damageClassFilterLabel}
          className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-sm text-foreground"
        >
          <option value="">{labels.allDamageClassesLabel}</option>
          {DAMAGE_CLASSES.map((damageClass) => (
            <option key={damageClass} value={damageClass}>
              {labels.damageClassLabels[damageClass]}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onClose}
          aria-label={labels.cancelLabel}
          className="shrink-0 rounded-full border border-border-subtle bg-surface px-2 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          ×
        </button>
      </div>

      <ul
        id={listboxId}
        role="listbox"
        aria-label={labels.searchLabel}
        className="m-0 flex max-h-64 list-none flex-col gap-0.5 overflow-y-auto rounded-md border border-border-subtle bg-surface-raised p-1"
      >
        {results.length === 0 ? (
          <li className="px-2 py-1.5 text-sm text-muted">{labels.noResultsLabel}</li>
        ) : (
          results.map((move, index) => {
            const disabled = selectedMoveSlugs.includes(move.slug);
            const active = index === activeIndex;
            return (
              <li key={move.slug} role="presentation">
                <button
                  type="button"
                  id={optionId(index)}
                  role="option"
                  aria-selected={active}
                  aria-disabled={disabled}
                  disabled={disabled}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectAt(index)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-45 data-[active=true]:bg-surface-hover"
                  data-active={active}
                >
                  <span className="min-w-0 flex-1 truncate">{moveDisplayName(move, locale)}</span>
                  <PokemonTypeBadge type={move.type} label={typeLabels[move.type]} size="sm" />
                  <span className="hidden w-16 shrink-0 truncate text-xs text-muted sm:block">
                    {labels.damageClassLabels[move.damageClass]}
                  </span>
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted">
                    {move.power ?? labels.noPowerLabel}
                  </span>
                  {disabled ? <span className="sr-only">{labels.alreadySelectedLabel}</span> : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
