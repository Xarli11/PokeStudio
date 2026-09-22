'use client';

import { useState } from 'react';

import type { SpeciesSearchAlias, SpeciesSearchItem } from '@pokestudio/database';
import { formatMessage, type Locale } from '@pokestudio/i18n';
import type { PokemonType } from '@pokestudio/pokemon-data';

import { CompareAddInput } from '@/components/pokemon/compare-add-input';
import { PokemonArtSlot } from '@/components/pokemon/art-slot';
import { PokemonTypeBadge } from '@/components/pokemon/type-badge';
import { getPokemonSprite } from '@/lib/pokemon-sprite';
import { resolveRosterVisualIdentity } from '@/lib/roster-visual-identity';
import { buttonClass } from '@/lib/ui-classes';

export interface DamagePokemonSlotLabels {
  selectPokemonLabel: string;
  changeLabel: string;
  changePokemonTemplate: string;
  cancelLabel: string;
  multipleFormsMatchTemplate: string;
  ambiguousHint: string;
  noResultsLabel: string;
}

/**
 * One Pokémon slot (attacker or defender) in Damage Lab — reuses the exact
 * same search primitive Compare/Build already use (`CompareAddInput`, task
 * §8: "no escribas otro Pokémon search engine"), plus the exact same
 * optimistic-identity technique Team Builder's roster proved
 * (`resolveRosterVisualIdentity` — real name/types/sprite the instant a
 * form is picked, from the search index already in memory, no flash). Two
 * independent instances (attacker/defender) share this one component.
 */
export function DamagePokemonSlot({
  locale,
  label,
  searchIndex,
  typeLabels,
  selectedFormSlug,
  onSelect,
  labels,
}: {
  locale: Locale;
  label: string;
  searchIndex: { items: SpeciesSearchItem[]; aliases: SpeciesSearchAlias[] };
  typeLabels: Record<PokemonType, string>;
  selectedFormSlug: string | null;
  onSelect: (formSlug: string) => void;
  labels: DamagePokemonSlotLabels;
}) {
  const [pickerOpen, setPickerOpen] = useState(true);
  const [spriteFailed, setSpriteFailed] = useState(false);

  const identity = selectedFormSlug
    ? resolveRosterVisualIdentity(searchIndex, selectedFormSlug)
    : undefined;

  function handleAdd(formSlug: string): void {
    onSelect(formSlug);
    setPickerOpen(false);
    setSpriteFailed(false);
  }

  const showPicker = pickerOpen || !identity;
  const displayName = identity ? identity.displayName[locale] : '';
  const spriteUrl = identity
    ? getPokemonSprite({
        formSlug: identity.formSlug,
        speciesSlug: identity.speciesSlug,
        nationalDexNumber: identity.nationalDexNumber,
        isDefaultForm: identity.isDefaultForm,
      })
    : undefined;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
      {showPicker || !identity ? (
        <div className="flex items-center gap-2">
          <CompareAddInput
            locale={locale}
            searchIndex={searchIndex}
            typeLabels={typeLabels}
            onAdd={handleAdd}
            searchLabel={labels.selectPokemonLabel}
            searchPlaceholder={labels.selectPokemonLabel}
            multipleFormsMatchTemplate={labels.multipleFormsMatchTemplate}
            ambiguousHintLabel={labels.ambiguousHint}
            noResultsLabel={labels.noResultsLabel}
            widthClassName="w-full max-w-xs"
          />
          {identity ? (
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="shrink-0 rounded-full border border-border-subtle bg-surface px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              {labels.cancelLabel}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <PokemonArtSlot
            initial={displayName.charAt(0)}
            types={identity.types}
            variant="hero"
            spriteUrl={spriteFailed ? undefined : spriteUrl}
            onSpriteError={() => setSpriteFailed(true)}
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="truncate text-base font-bold text-foreground">{displayName}</span>
            <span className="flex flex-wrap gap-1">
              {identity.types.map((type) => (
                <PokemonTypeBadge key={type} type={type} label={typeLabels[type]} size="sm" />
              ))}
            </span>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              aria-label={formatMessage(labels.changePokemonTemplate, { name: displayName })}
              className={buttonClass('default', 'self-start px-2.5 py-1 text-xs')}
            >
              {labels.changeLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
