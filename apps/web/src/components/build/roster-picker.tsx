'use client';

import type { SpeciesSearchAlias, SpeciesSearchItem } from '@pokestudio/database';
import { formatMessage, type Locale } from '@pokestudio/i18n';
import type { PokemonType } from '@pokestudio/pokemon-data';

import { CompareAddInput } from '@/components/pokemon/compare-add-input';

export interface RosterPickerLabels {
  addPokemonHeader: string;
  addPokemonSlot: string;
  changeFormTemplate: string;
  cancelChangeForm: string;
  multipleFormsMatchTemplate: string;
  ambiguousHint: string;
  noResultsLabel: string;
}

export type RosterPickerTarget =
  { kind: 'add' } | { kind: 'swap'; memberId: string; memberName: string };

/**
 * The roster's one shared Pokémon/form picker (Milestone 2, Build manual
 * review). Previously each empty/swapping slot embedded its own search box,
 * crushed to that slot's ~10rem width — result rows clipped names and form
 * context. This is the *same* search primitive (`CompareAddInput`, which
 * already wraps the whole-Pokédex search engine — not duplicated), just
 * mounted once at the roster's own full width instead of nested inside a
 * narrow tile, so its `max-w-md` result panel finally has room to render
 * Dex number, name, form context and type badges without clipping.
 *
 * The outer panel itself stays *compact* (manual review v2, §2): a plain
 * full-width container looked like a huge empty box next to the small
 * search field. `sm:max-w-2xl` caps it to a popover-sized ~672px on desktop
 * (mobile keeps the full width, since there's no room to spare there) —
 * width only, no fixed/large reserved height, so it never pushes Team
 * Analysis far down the page.
 *
 * Manual review v3: even after that width fix, an empty query still showed
 * a large empty box *below* the search field. Root cause —
 * `CompareAddInput`'s default sizing classes (`flex-1 basis-56`) are tuned
 * for Compare's flex-ROW usage, where `basis-56` sets a sane minimum
 * *width*; this component's own wrapper is a flex-COLUMN, so the exact same
 * `flex-basis` instead set a ~224px minimum *height* on the search field
 * for no visible reason. `widthClassName="w-full max-w-md"` opts this
 * (column) usage out of that row-specific sizing — same width cap as
 * before, zero forced height. No fixed/min-height was added anywhere here;
 * the panel's height is purely content-driven.
 */
export function RosterPicker({
  locale,
  target,
  searchIndex,
  typeLabels,
  labels,
  onSelect,
  onClose,
}: {
  locale: Locale;
  target: RosterPickerTarget;
  searchIndex: { items: SpeciesSearchItem[]; aliases: SpeciesSearchAlias[] };
  typeLabels: Record<PokemonType, string>;
  labels: RosterPickerLabels;
  onSelect: (formSlug: string) => void;
  onClose: () => void;
}) {
  const headerText =
    target.kind === 'add'
      ? labels.addPokemonHeader
      : formatMessage(labels.changeFormTemplate, { name: target.memberName });

  return (
    <div
      className="flex w-full flex-col gap-3 rounded-lg border border-dashed border-brand p-3 sm:max-w-2xl"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{headerText}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.cancelChangeForm}
          className="shrink-0 rounded-full border border-border-subtle bg-surface px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          {labels.cancelChangeForm} ×
        </button>
      </div>
      <CompareAddInput
        locale={locale}
        searchIndex={searchIndex}
        typeLabels={typeLabels}
        onAdd={onSelect}
        searchLabel={labels.addPokemonSlot}
        searchPlaceholder={labels.addPokemonSlot}
        multipleFormsMatchTemplate={labels.multipleFormsMatchTemplate}
        ambiguousHintLabel={labels.ambiguousHint}
        noResultsLabel={labels.noResultsLabel}
        widthClassName="w-full max-w-md"
      />
    </div>
  );
}
