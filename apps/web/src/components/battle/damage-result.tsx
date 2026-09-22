'use client';

import { useState } from 'react';

import type { DamageCalculationResult } from '@pokestudio/damage';
import { formatMessage, type Locale } from '@pokestudio/i18n';

import { formatDecimal } from '@/lib/number-format';

export interface DamageResultLabels {
  hpRangeTemplate: string;
  percentRangeTemplate: string;
  effectiveness: {
    immune: string;
    'not-very-effective': string;
    neutral: string;
    'super-effective': string;
  };
  stabLabel: string;
  criticalLabel: string;
  koGuaranteedTemplate: string;
  koChanceTemplate: string;
  koPossibleTemplate: string;
  koNoDamage: string;
  detailsLabel: string;
  debugDescriptionLabel: string;
  modifiers: {
    hitsTemplate: string;
    burned: string;
    protected: string;
    defenderDynamaxed: string;
    weather: Record<
      'sand' | 'sun' | 'rain' | 'hail' | 'snow' | 'harsh-sunshine' | 'heavy-rain' | 'strong-winds',
      string
    >;
    terrain: Record<'electric' | 'grassy' | 'psychic' | 'misty', string>;
    reflect: string;
    lightScreen: string;
    auroraVeil: string;
    helpingHand: string;
    friendGuard: string;
    battery: string;
    powerSpot: string;
    ruinAbility: Record<'sword' | 'beads' | 'tablets' | 'vessel', string>;
  };
}

/** KO copy built purely from `result.ko` (task §17) — never from Smogon's own `koChanceText`, which doesn't exist in the v2 domain at all. */
function koSummary(
  result: DamageCalculationResult,
  locale: Locale,
  labels: DamageResultLabels,
): string | null {
  const { chance, hitsToKo } = result.ko;
  if (hitsToKo === undefined) return null;
  if (chance === 1) return formatMessage(labels.koGuaranteedTemplate, { hits: hitsToKo });
  if (chance === undefined) return formatMessage(labels.koPossibleTemplate, { hits: hitsToKo });
  return formatMessage(labels.koChanceTemplate, {
    chance: formatDecimal(locale, chance * 100, 1),
    hits: hitsToKo,
  });
}

/** Every modifier `DamageResultModifiers` can carry that's actually present — Simple Mode will only ever show a small subset of these (critical/hits), Advanced mode will populate the rest later without this component changing. */
function activeModifierLabels(
  result: DamageCalculationResult,
  labels: DamageResultLabels,
): string[] {
  const { modifiers } = result;
  const active: string[] = [];
  if (modifiers.hits && modifiers.hits > 1) {
    active.push(formatMessage(labels.modifiers.hitsTemplate, { count: modifiers.hits }));
  }
  if (modifiers.isBurned) active.push(labels.modifiers.burned);
  if (modifiers.isProtected) active.push(labels.modifiers.protected);
  if (modifiers.isDefenderDynamaxed) active.push(labels.modifiers.defenderDynamaxed);
  if (modifiers.weather) active.push(labels.modifiers.weather[modifiers.weather]);
  if (modifiers.terrain) active.push(labels.modifiers.terrain[modifiers.terrain]);
  if (modifiers.isReflect) active.push(labels.modifiers.reflect);
  if (modifiers.isLightScreen) active.push(labels.modifiers.lightScreen);
  if (modifiers.isAuroraVeil) active.push(labels.modifiers.auroraVeil);
  if (modifiers.isHelpingHand) active.push(labels.modifiers.helpingHand);
  if (modifiers.isFriendGuard) active.push(labels.modifiers.friendGuard);
  if (modifiers.isBattery) active.push(labels.modifiers.battery);
  if (modifiers.isPowerSpot) active.push(labels.modifiers.powerSpot);
  if (modifiers.ruinAbilityActive)
    active.push(labels.modifiers.ruinAbility[modifiers.ruinAbilityActive]);
  return active;
}

/**
 * The structured result display (task §15/§16) — built entirely from
 * `DamageCalculationResult`'s typed fields, never from `debugDescription`
 * (kept only inside the collapsed Details section, clearly labeled as a
 * debug trace, never the primary representation).
 */
export function DamageResult({
  result,
  locale,
  labels,
}: {
  result: DamageCalculationResult;
  locale: Locale;
  labels: DamageResultLabels;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const ko = koSummary(result, locale, labels);
  const modifierLabels = activeModifierLabels(result, labels);

  // Visual clamp only — the headline text below always shows the real
  // (possibly >100%) percent (task §20: "no clamping del dato").
  const minBarPercent = Math.min(100, Math.max(0, result.minPercent));
  const maxBarPercent = Math.min(100, Math.max(0, result.maxPercent));

  return (
    <div aria-live="polite" className="flex flex-col items-center gap-3 text-center">
      <p className="m-0 text-2xl font-bold text-foreground tabular-nums">
        {formatMessage(labels.hpRangeTemplate, {
          min: formatDecimal(locale, result.minDamage, 0),
          max: formatDecimal(locale, result.maxDamage, 0),
        })}
      </p>

      <div className="w-full max-w-xs">
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-raised">
          <div
            className="absolute inset-y-0 rounded-full bg-brand"
            style={{ left: `${minBarPercent}%`, right: `${100 - maxBarPercent}%` }}
          />
        </div>
        <p className="m-0 mt-1.5 text-sm font-semibold text-muted tabular-nums">
          {formatMessage(labels.percentRangeTemplate, {
            min: formatDecimal(locale, result.minPercent, 1),
            max: formatDecimal(locale, result.maxPercent, 1),
          })}
        </p>
      </div>

      {ko ? <p className="m-0 text-sm font-semibold text-foreground">{ko}</p> : null}

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {result.effectiveness !== 'neutral' ? (
          <span className="rounded-full border border-border-subtle bg-surface-raised px-2 py-0.5 text-xs font-semibold text-foreground">
            {labels.effectiveness[result.effectiveness]}
          </span>
        ) : null}
        {result.isSTAB ? (
          <span className="rounded-full border border-border-subtle bg-surface-raised px-2 py-0.5 text-xs font-semibold text-foreground">
            {labels.stabLabel}
          </span>
        ) : null}
        {result.modifiers.isCritical ? (
          <span className="rounded-full border border-border-subtle bg-surface-raised px-2 py-0.5 text-xs font-semibold text-foreground">
            {labels.criticalLabel}
          </span>
        ) : null}
      </div>

      {modifierLabels.length > 0 || result.debugDescription ? (
        <div className="w-full max-w-xs text-left">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            className="text-xs font-semibold text-brand hover:underline"
          >
            {labels.detailsLabel} {detailsOpen ? '▲' : '▾'}
          </button>
          {detailsOpen ? (
            <div className="mt-2 flex flex-col gap-2">
              {modifierLabels.length > 0 ? (
                <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-muted">
                  {modifierLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              ) : null}
              {process.env.NODE_ENV !== 'production' ? (
                <p className="m-0 text-[0.6875rem] text-muted italic">
                  {labels.debugDescriptionLabel}: {result.debugDescription}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
