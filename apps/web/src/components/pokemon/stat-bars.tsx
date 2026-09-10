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
    <dl style={{ display: 'grid', gap: 'var(--ps-space-2)', margin: 0 }}>
      {STAT_KEYS.map((key) => (
        <div
          key={key}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(4.5rem, 5.5rem) 2.25rem 1fr',
            alignItems: 'center',
            gap: 'var(--ps-space-2)',
          }}
        >
          <dt style={{ color: 'var(--ps-color-text-muted)', fontSize: 'var(--ps-font-size-sm)' }}>
            {labels[key]}
          </dt>
          <dd
            style={{
              margin: 0,
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
              fontSize: 'var(--ps-font-size-sm)',
            }}
          >
            {stats[key]}
          </dd>
          <div
            aria-hidden="true"
            style={{
              height: '0.5rem',
              borderRadius: 'var(--ps-radius-pill)',
              background: 'var(--ps-color-bg-elevated)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, (stats[key] / MAX_DISPLAY_STAT) * 100)}%`,
                background: 'var(--ps-color-primary)',
                borderRadius: 'var(--ps-radius-pill)',
                transition: `width var(--ps-motion-base) var(--ps-motion-easing)`,
              }}
            />
          </div>
        </div>
      ))}
    </dl>
  );
}
