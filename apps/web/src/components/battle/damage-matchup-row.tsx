'use client';

import { useState } from 'react';

import { formatMessage, type Locale } from '@pokestudio/i18n';

import type { DamageLabCalculationResponse } from '@/app/[locale]/battle/damage/actions';
import { PokemonArtSlot } from '@/components/pokemon/art-slot';
import { formatDecimal } from '@/lib/number-format';
import { getPokemonSprite } from '@/lib/pokemon-sprite';
import type { RosterVisualIdentity } from '@/lib/roster-visual-identity';

import { koSummary, type DamageResultLabels } from './damage-result';

const SPRITE_SIZE_CLASS = 'h-12 w-12';

export interface DamageMatchupRowLabels {
  /** Reused verbatim from the main result's own labels (hp/percent templates, effectiveness, KO copy) — never a second copy of this copy. */
  result: DamageResultLabels;
  removeTemplate: string;
  errorLabel: string;
}

/**
 * One compact comparison row (Phase 3 roadmap: "matchup comparison
 * primitives") — deliberately NOT a second `DamageResult`: no Advanced, no
 * badges row, no explanation trace, just enough to scan a target quickly
 * (task §5). `identity` comes from the search index already in memory
 * (`resolveRosterVisualIdentity`) — no per-row fetch, matching the same
 * optimistic-identity technique `DamagePokemonSlot` already uses.
 *
 * `response` is `undefined` until the shared Calculate/Recalculate action
 * has actually run for this defender — this row then shows only identity,
 * exactly like the main defender slot shows only identity before the first
 * calculation.
 */
export function DamageMatchupRow({
  locale,
  formSlug,
  identity,
  response,
  stale,
  onRemove,
  labels,
}: {
  locale: Locale;
  formSlug: string;
  /** `undefined` when this form slug no longer resolves against the search index (task §8: still an isolated, removable row, never a crash). */
  identity: RosterVisualIdentity | undefined;
  response: DamageLabCalculationResponse | undefined;
  /** True when the inputs this row was last calculated for no longer match the current attacker/move/defender — dimmed, same treatment as the main result (task §6). */
  stale: boolean;
  onRemove: () => void;
  labels: DamageMatchupRowLabels;
}) {
  const [spriteFailed, setSpriteFailed] = useState(false);
  const displayName = identity ? identity.displayName[locale] : formSlug;
  const spriteUrl =
    identity && !spriteFailed
      ? getPokemonSprite({
          formSlug: identity.formSlug,
          speciesSlug: identity.speciesSlug,
          nationalDexNumber: identity.nationalDexNumber,
          isDefaultForm: identity.isDefaultForm,
          pokeapiPokemonId: identity.pokeapiPokemonId,
        })
      : undefined;

  return (
    <div
      className={`flex items-center gap-3 rounded-md border border-border-subtle bg-surface px-3 py-2 transition-opacity ${stale ? 'opacity-60' : ''}`}
    >
      <PokemonArtSlot
        initial={displayName.charAt(0)}
        types={identity?.types ?? []}
        variant="hero"
        sizeClassName={SPRITE_SIZE_CLASS}
        spriteUrl={spriteUrl}
        onSpriteError={() => setSpriteFailed(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-semibold text-foreground">{displayName}</span>

        {!identity || (response && !response.ok) ? (
          <span className="text-xs font-semibold text-danger">{labels.errorLabel}</span>
        ) : response?.ok ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="font-semibold text-foreground tabular-nums">
              {formatMessage(labels.result.hpRangeTemplate, {
                min: formatDecimal(locale, response.result.minDamage, 0),
                max: formatDecimal(locale, response.result.maxDamage, 0),
              })}
            </span>
            <span className="text-muted tabular-nums">
              {formatMessage(labels.result.percentRangeTemplate, {
                min: formatDecimal(locale, response.result.minPercent, 1),
                max: formatDecimal(locale, response.result.maxPercent, 1),
              })}
            </span>
            {response.result.effectiveness !== 'neutral' ? (
              <span className="font-semibold text-foreground">
                {labels.result.effectiveness[response.result.effectiveness]}
              </span>
            ) : null}
            {koSummary(response.result, locale, labels.result) ? (
              <span className="text-muted">
                {koSummary(response.result, locale, labels.result)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={formatMessage(labels.removeTemplate, { name: displayName })}
        className="shrink-0 rounded-full border border-border-subtle bg-surface px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        ×
      </button>
    </div>
  );
}
