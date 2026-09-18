import type { BaseStats } from '@pokelab/pokemon-data';

import { STAT_TIER_BAR_CLASS, statTier } from '@/lib/stat-quality';

const STAT_KEYS = [
  'hp',
  'attack',
  'defense',
  'specialAttack',
  'specialDefense',
  'speed',
] as const satisfies readonly (keyof BaseStats)[];

/** Conventional base-stat display scale (Bulbasaur-era mainline games top out around here). */
const MAX_DISPLAY_STAT = 255;

/**
 * Base stats as a compact, accessible list: the exact number is always
 * shown as text (`<dd>`), and the bar's fill color now also communicates
 * quality (low/average/good/excellent — Phase 1C.2b, `stat-quality.ts`) as a
 * supplement, never the only way to read either the value or its quality —
 * a screen-reader-only tier word is attached via `aria-label` alongside the
 * number, and color is never the sole signal.
 */
export function PokemonStatBars({
  stats,
  labels,
  tierLabels,
}: {
  stats: BaseStats;
  labels: Record<(typeof STAT_KEYS)[number], string>;
  tierLabels: Record<'low' | 'average' | 'good' | 'excellent', string>;
}) {
  return (
    <dl className="m-0 grid gap-2">
      {STAT_KEYS.map((key) => {
        const tier = statTier(stats[key]);
        return (
          <div
            key={key}
            className="grid grid-cols-[minmax(4.5rem,5.5rem)_2.25rem_1fr] items-center gap-3"
          >
            <dt className="text-sm text-muted">{labels[key]}</dt>
            <dd className="m-0 text-right text-sm font-bold tabular-nums">
              {stats[key]}
              <span className="sr-only"> ({tierLabels[tier]})</span>
            </dd>
            <div
              aria-hidden="true"
              className="h-[0.4375rem] overflow-hidden rounded-full border border-border-subtle bg-surface-raised"
            >
              <div
                className={`h-full rounded-full ${STAT_TIER_BAR_CLASS[tier]} transition-[width] duration-200 ease-ps`}
                style={{ width: `${Math.min(100, (stats[key] / MAX_DISPLAY_STAT) * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </dl>
  );
}
