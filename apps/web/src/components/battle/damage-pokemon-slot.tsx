'use client';

import { useEffect, useState } from 'react';

import type { SpeciesSearchAlias, SpeciesSearchItem } from '@pokestudio/database';
import { formatMessage, type Locale } from '@pokestudio/i18n';
import type { PokemonType } from '@pokestudio/pokemon-data';
import { pokemonTypeColorVar } from '@pokestudio/ui';

import { CompareAddInput } from '@/components/pokemon/compare-add-input';
import { PokemonArtSlot } from '@/components/pokemon/art-slot';
import { PokemonTypeBadge } from '@/components/pokemon/type-badge';
import { getPokemonSprite } from '@/lib/pokemon-sprite';
import { resolveRosterVisualIdentity } from '@/lib/roster-visual-identity';
import { buttonClass, cardClass } from '@/lib/ui-classes';

/**
 * ~120px at `lg`, ~128px at `xl`+ — below `lg`, unchanged from the original
 * fixed 6rem/96px. Trimmed down from an earlier ~128/~144px pass (visual
 * review: large forms like Mega Charizard Y read as too dominant for the
 * card); still noticeably larger than the pre-review 96px baseline.
 */
const ART_SIZE_CLASS = 'h-24 w-24 lg:h-[7.5rem] lg:w-[7.5rem] xl:h-32 xl:w-32';

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
  artworkTrailing = false,
}: {
  locale: Locale;
  label: string;
  searchIndex: { items: SpeciesSearchItem[]; aliases: SpeciesSearchAlias[] };
  typeLabels: Record<PokemonType, string>;
  selectedFormSlug: string | null;
  onSelect: (formSlug: string) => void;
  labels: DamagePokemonSlotLabels;
  /**
   * Visually reverses the compact card's two children (text/info, then
   * artwork last) at `lg:` and up, via `flex-row-reverse` — never a
   * `transform`, never a DOM-order change (visual review: attacker on the
   * stage's left should have its artwork facing the Move column on its
   * right, "text/info | artwork"). Below `lg`, always the plain default
   * order (artwork first), matching the stacked/mobile layout.
   */
  artworkTrailing?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(!selectedFormSlug);
  const [spriteFailed, setSpriteFailed] = useState(false);

  // `selectedFormSlug` can be set from outside this component's own picker
  // (Fase M3.2's Build import sets `attackerFormSlug` directly, after this
  // component has already mounted) — `handleAdd` below only closes the
  // picker for a selection made *through* it, so an externally-driven
  // selection needs its own path to the same result: whenever a real slug
  // arrives, show the identity view rather than leaving the search box open
  // under it.
  useEffect(() => {
    if (selectedFormSlug) setPickerOpen(false);
  }, [selectedFormSlug]);

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
  // The exact same production sprite family Explore already uses
  // (PokéAPI's own `'modern'` set, via `getPokemonSprite()`) — not a
  // different visual source. What used to be missing wasn't a different
  // sprite family, it was the exact-form *id*: `getPokemonSprite()`
  // resolves through `identity.pokeapiPokemonId` now (the upstream
  // `pokemon` resource id, distinct from the National Dex number every
  // form of one species shares), so a non-default form like Mega
  // Charizard Y gets its own real sprite instead of falling back to the
  // monogram. One identity/sprite path for manual selection, Build import
  // and Explore seeding alike — they all resolve through this one
  // component regardless of source.
  const spriteUrl = identity
    ? getPokemonSprite({
        formSlug: identity.formSlug,
        speciesSlug: identity.speciesSlug,
        nationalDexNumber: identity.nationalDexNumber,
        isDefaultForm: identity.isDefaultForm,
        pokeapiPokemonId: identity.pokeapiPokemonId,
      })
    : undefined;

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
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
            widthClassName="w-full max-w-sm"
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
        // Subtle visual grouping (visual review — the compact summary used
        // to float in open space): `cardClass()` reuses the same
        // surface/border/radius every other PokeStudio card already uses,
        // plus a barely-there type-tinted border (never a saturated
        // type-colored panel) so each side reads as its own distinct area.
        //
        // Explicit `w-full` here (visual review round 2 — attacker/
        // defender cards rendered different widths): this card used to sit
        // inside an external `max-w-*`-capped wrapper, shrink-to-fit under
        // `items-end`/`items-start` on the column. `DamageAdvancedPanel`
        // right below it is unconditionally `w-full` of that same column,
        // so the two could only match by coincidence. This card is now
        // `w-full` too — same parent, same explicit rule, byte-identical
        // width to Advanced, on both sides, regardless of name length or
        // badge count. The info column gets `flex-1` (fixed artwork area,
        // flexible info area) so the pairing fills the card edge-to-edge
        // instead of leaving dead space now that the card itself is wide.
        <div
          className={cardClass(
            `flex w-full items-center gap-3 p-3 sm:p-4 ${artworkTrailing ? 'lg:flex-row-reverse' : ''}`,
          )}
          style={{
            borderColor: `color-mix(in srgb, var(${pokemonTypeColorVar[identity.types[0]!]}) 20%, var(--ps-color-border-subtle))`,
          }}
        >
          <PokemonArtSlot
            initial={displayName.charAt(0)}
            types={identity.types}
            variant="hero"
            sizeClassName={ART_SIZE_CLASS}
            spriteUrl={spriteFailed ? undefined : spriteUrl}
            onSpriteError={() => setSpriteFailed(true)}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {/* No `truncate` (visual review — "Mega-Chariz..." inside a card
                with real width to spare): the info column is already
                `min-w-0`, so a normal-length name like "Mega Charizard Y"
                or a regional form's name simply wraps onto a second line
                instead of being cut. The full name is always in the DOM
                either way — this only changes what's visually clipped, not
                the accessible name. */}
            <span className="text-lg font-bold text-foreground">{displayName}</span>
            <span className="flex flex-wrap gap-1">
              {identity.types.map((type) => (
                <PokemonTypeBadge key={type} type={type} label={typeLabels[type]} />
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
