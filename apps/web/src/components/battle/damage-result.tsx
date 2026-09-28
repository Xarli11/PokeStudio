'use client';

import { useState } from 'react';

import type { AbilitySummary, Item } from '@pokestudio/database';
import type { DamageCalculationResult, DamageExplanationFactor } from '@pokestudio/damage';
import { formatMessage, type Locale } from '@pokestudio/i18n';
import type { PokemonType } from '@pokestudio/pokemon-data';

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
  koHitWordSingular: string;
  koHitWordPlural: string;
  koNoDamage: string;
  /** The "Cómo se calcula" / "How this damage is calculated" disclosure trigger (task §7 — replaces the old, often-empty `detailsLabel` control). */
  explanationLabel: string;
  debugDescriptionLabel: string;
  /** Reused as-is from the Advanced panel's own Tera summary (task §6) — never a second "Tera {type}" template. */
  teraSummaryTemplate: string;
  explanation: {
    typeEffectivenessLabel: string;
    typeEffectivenessValueTemplate: string;
    stabDescription: string;
    criticalDescription: string;
    multiHitLabel: string;
    multiHitValueTemplate: string;
    attackerItemDescription: string;
    attackerAbilityDescription: string;
    attackerTeraDescription: string;
    defenderItemDescription: string;
    defenderAbilityDescription: string;
    defenderTeraDescription: string;
  };
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

/**
 * KO copy built purely from `result.ko` (task §17) — never from Smogon's
 * own `koChanceText`, which doesn't exist in the v2 domain at all.
 *
 * Spanish spells out "KO garantizado en 2 golpes" instead of exposing
 * unexplained competitive shorthand ("2HKO") to a general audience (visual
 * review); English keeps the established "Guaranteed 2HKO" wording, so
 * `hitWord` is threaded through as a template var rather than a second
 * template set. `hitsToKo` is never 0, so the singular/plural check only
 * needs to distinguish exactly 1 hit from everything else.
 */
function koSummary(
  result: DamageCalculationResult,
  locale: Locale,
  labels: DamageResultLabels,
): string | null {
  const { chance, hitsToKo } = result.ko;
  if (hitsToKo === undefined) return null;
  const hitWord = hitsToKo === 1 ? labels.koHitWordSingular : labels.koHitWordPlural;
  if (chance === 1) return formatMessage(labels.koGuaranteedTemplate, { hits: hitsToKo, hitWord });
  if (chance === undefined)
    return formatMessage(labels.koPossibleTemplate, { hits: hitsToKo, hitWord });
  return formatMessage(labels.koChanceTemplate, {
    chance: formatDecimal(locale, chance * 100, 1),
    hits: hitsToKo,
    hitWord,
  });
}

/**
 * A PokeStudio slug is never guaranteed to resolve against whatever
 * item/ability list happens to be loaded (Advanced's own data is fetched
 * lazily) — falls back to a readable rendering of the slug itself rather
 * than showing nothing or an upstream English name (task §5's
 * localization requirement is about never showing Smogon's raw name, not
 * about hiding a real fact just because its display name isn't loaded
 * yet).
 */
function fallbackSlugLabel(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function itemName(items: readonly Item[], slug: string, locale: Locale): string {
  const item = items.find((candidate) => candidate.slug === slug);
  if (!item) return fallbackSlugLabel(slug);
  return locale === 'es' ? (item.nameEs ?? item.nameEn) : item.nameEn;
}

function abilityName(abilities: readonly AbilitySummary[], slug: string, locale: Locale): string {
  const ability = abilities.find((candidate) => candidate.slug === slug);
  if (!ability) return fallbackSlugLabel(slug);
  return locale === 'es' ? (ability.nameEs ?? ability.nameEn) : ability.nameEn;
}

export interface DamageExplanationRow {
  key: string;
  primary: string;
  secondary?: string;
}

/**
 * The presentation context `@pokestudio/damage` itself never gets (task
 * §5/§10: no React/UI concepts, no database objects in the domain
 * package) — threaded from `DamageLab`'s own already-loaded reference
 * data instead of a second, parallel localization table.
 */
export interface DamageExplanationContext {
  attackerAbilities: readonly AbilitySummary[];
  defenderAbilities: readonly AbilitySummary[];
  items: readonly Item[];
  typeLabels: Record<PokemonType, string>;
}

/**
 * Turns one structured `DamageExplanationFactor` into a two-line row
 * (task §7's compact layout). Deterministic ordering is inherited
 * directly from `result.explanation` — never re-sorted here.
 */
function explanationRow(
  factor: DamageExplanationFactor,
  locale: Locale,
  labels: DamageResultLabels,
  context: DamageExplanationContext,
): DamageExplanationRow {
  switch (factor.kind) {
    case 'type-effectiveness':
      return {
        key: 'type-effectiveness',
        primary: labels.explanation.typeEffectivenessLabel,
        secondary: formatMessage(labels.explanation.typeEffectivenessValueTemplate, {
          multiplier: formatDecimal(locale, factor.multiplier, 2),
          tier: labels.effectiveness[factor.tier],
        }),
      };
    case 'stab':
      return {
        key: 'stab',
        primary: labels.stabLabel,
        secondary: labels.explanation.stabDescription,
      };
    case 'critical':
      return {
        key: 'critical',
        primary: labels.criticalLabel,
        secondary: labels.explanation.criticalDescription,
      };
    case 'multi-hit':
      return {
        key: 'multi-hit',
        primary: labels.explanation.multiHitLabel,
        secondary: formatMessage(labels.explanation.multiHitValueTemplate, { count: factor.hits }),
      };
    case 'burn':
      return { key: 'burn', primary: labels.modifiers.burned };
    case 'attacker-item':
      return {
        key: 'attacker-item',
        primary: itemName(context.items, factor.slug, locale),
        secondary: labels.explanation.attackerItemDescription,
      };
    case 'attacker-ability':
      return {
        key: 'attacker-ability',
        primary: abilityName(context.attackerAbilities, factor.slug, locale),
        secondary: labels.explanation.attackerAbilityDescription,
      };
    case 'attacker-tera':
      return {
        key: 'attacker-tera',
        primary: formatMessage(labels.teraSummaryTemplate, {
          type: context.typeLabels[factor.teraType],
        }),
        secondary: labels.explanation.attackerTeraDescription,
      };
    case 'defender-item':
      return {
        key: 'defender-item',
        primary: itemName(context.items, factor.slug, locale),
        secondary: labels.explanation.defenderItemDescription,
      };
    case 'defender-ability':
      return {
        key: 'defender-ability',
        primary: abilityName(context.defenderAbilities, factor.slug, locale),
        secondary: labels.explanation.defenderAbilityDescription,
      };
    case 'defender-tera':
      return {
        key: 'defender-tera',
        primary: formatMessage(labels.teraSummaryTemplate, {
          type: context.typeLabels[factor.teraType],
        }),
        secondary: labels.explanation.defenderTeraDescription,
      };
    case 'weather':
      return { key: 'weather', primary: labels.modifiers.weather[factor.weather] };
    case 'terrain':
      return { key: 'terrain', primary: labels.modifiers.terrain[factor.terrain] };
    case 'reflect':
      return { key: 'reflect', primary: labels.modifiers.reflect };
    case 'light-screen':
      return { key: 'light-screen', primary: labels.modifiers.lightScreen };
    case 'aurora-veil':
      return { key: 'aurora-veil', primary: labels.modifiers.auroraVeil };
    case 'helping-hand':
      return { key: 'helping-hand', primary: labels.modifiers.helpingHand };
    case 'friend-guard':
      return { key: 'friend-guard', primary: labels.modifiers.friendGuard };
    case 'battery':
      return { key: 'battery', primary: labels.modifiers.battery };
    case 'power-spot':
      return { key: 'power-spot', primary: labels.modifiers.powerSpot };
    case 'ruin-ability':
      return { key: 'ruin-ability', primary: labels.modifiers.ruinAbility[factor.ability] };
    case 'protected':
      return { key: 'protected', primary: labels.modifiers.protected };
    case 'defender-dynamax':
      return { key: 'defender-dynamax', primary: labels.modifiers.defenderDynamaxed };
  }
}

/**
 * The structured result display (task §15/§16 of the earlier phase, now
 * extended by the explanation-trace roadmap item) — built entirely from
 * `DamageCalculationResult`'s typed fields, never from `debugDescription`
 * (kept only inside the collapsed disclosure, clearly labeled as a debug
 * trace, never the primary representation — task §10).
 */
export function DamageResult({
  result,
  locale,
  labels,
  attackerAbilities = [],
  defenderAbilities = [],
  items = [],
  typeLabels,
}: {
  result: DamageCalculationResult;
  locale: Locale;
  labels: DamageResultLabels;
  attackerAbilities?: readonly AbilitySummary[];
  defenderAbilities?: readonly AbilitySummary[];
  items?: readonly Item[];
  typeLabels: Record<PokemonType, string>;
}) {
  const [explanationOpen, setExplanationOpen] = useState(false);
  const ko = koSummary(result, locale, labels);

  const explanationContext: DamageExplanationContext = {
    attackerAbilities,
    defenderAbilities,
    items,
    typeLabels,
  };
  const explanationRows = result.explanation.map((factor) =>
    explanationRow(factor, locale, labels, explanationContext),
  );

  // Real production trace, never parsed/derived text (task §10) — dev-only,
  // shown below the structured explanation, clearly separated from it.
  const showDebugTrace = process.env.NODE_ENV !== 'production' && Boolean(result.debugDescription);

  // The explanation is available for every real damaging calculation (task
  // §8: type effectiveness, including neutral ×1, is always present), so
  // this is effectively always true — kept as an explicit check rather than
  // an assumption, and it's what still gates the debug trace's visibility
  // in the rare case `result.explanation` were ever empty.
  const hasExplanation = explanationRows.length > 0 || showDebugTrace;

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

      {hasExplanation ? (
        <div className="w-full max-w-xs text-left">
          <button
            type="button"
            onClick={() => setExplanationOpen((open) => !open)}
            aria-expanded={explanationOpen}
            className="text-xs font-semibold text-brand hover:underline"
          >
            {labels.explanationLabel} {explanationOpen ? '▲' : '▾'}
          </button>
          {explanationOpen ? (
            <div className="mt-2 flex flex-col gap-2">
              {explanationRows.length > 0 ? (
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-xs">
                  {explanationRows.map((row) => (
                    <li key={row.key} className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-foreground">{row.primary}</span>
                      {row.secondary ? (
                        <span className="text-right text-muted">{row.secondary}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {showDebugTrace ? (
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
