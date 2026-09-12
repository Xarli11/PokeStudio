import type { BaseStats } from '@pokestudio/pokemon-data';

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
 * shown as text (`<dd>`), the bar is a decorative supplement — never the
 * only way to read the value.
 */
export function PokemonStatBars({
  stats,
  labels,
}: {
  stats: BaseStats;
  labels: Record<(typeof STAT_KEYS)[number], string>;
}) {
  return (
    <dl className="m-0 grid gap-2">
      {STAT_KEYS.map((key) => (
        <div
          key={key}
          className="grid grid-cols-[minmax(4.5rem,5.5rem)_2.25rem_1fr] items-center gap-3"
        >
          <dt className="text-sm text-muted">{labels[key]}</dt>
          <dd className="m-0 text-right text-sm font-bold tabular-nums">{stats[key]}</dd>
          <div
            aria-hidden="true"
            className="h-[0.4375rem] overflow-hidden rounded-full border border-border-subtle bg-surface-raised"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand/75 to-brand transition-[width] duration-200 ease-ps"
              style={{ width: `${Math.min(100, (stats[key] / MAX_DISPLAY_STAT) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </dl>
  );
}
