'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import type { Item } from '@pokestudio/database';
import type { Locale } from '@pokestudio/i18n';

import { SearchIcon } from '@/components/search-field-icons';
import { itemDisplayName, searchItems } from '@/lib/item-search';
import { searchInputClass } from '@/lib/ui-classes';

export interface ItemPickerLabels {
  searchLabel: string;
  noResultsLabel: string;
  cancelLabel: string;
}

/**
 * A searchable, keyboard-accessible held-item combobox (Fase M3.1C) —
 * structurally `MovePicker`'s same combobox/listbox pattern, minus the
 * type/damage-class filters items don't have. Operates on whatever `items`
 * it's given (Damage Lab Advanced's own interaction-gated reference-data
 * fetch); no fetch of its own.
 */
export function ItemPicker({
  locale,
  items,
  labels,
  onSelect,
  onClose,
}: {
  locale: Locale;
  items: readonly Item[];
  labels: ItemPickerLabels;
  onSelect: (itemSlug: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => searchItems(items, query, locale), [items, query, locale]);

  function optionId(index: number): string {
    return `${listboxId}-option-${index}`;
  }

  function selectAt(index: number): void {
    const item = results[index];
    if (!item) return;
    onSelect(item.slug);
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
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
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
        className="m-0 flex max-h-56 list-none flex-col gap-0.5 overflow-y-auto rounded-md border border-border-subtle bg-surface-raised p-1"
      >
        {results.length === 0 ? (
          <li className="px-2 py-1.5 text-sm text-muted">{labels.noResultsLabel}</li>
        ) : (
          results.map((item, index) => {
            const active = index === activeIndex;
            return (
              <li key={item.slug} role="presentation">
                <button
                  type="button"
                  id={optionId(index)}
                  role="option"
                  aria-selected={active}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectAt(index)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-brand data-[active=true]:bg-surface-hover"
                  data-active={active}
                >
                  <span className="min-w-0 flex-1 truncate">{itemDisplayName(item, locale)}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
