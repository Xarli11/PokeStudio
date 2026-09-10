import type { PokemonType } from '@pokestudio/pokemon-data';
import { pokemonTypeColorVar } from '@pokestudio/ui';

/**
 * A Pokémon type indicator. Color is a decorative accent only — the
 * localized label is always shown, so the indicator never relies on color
 * alone (DESIGN_SYSTEM.md accessibility requirements).
 */
export function PokemonTypeBadge({ type, label }: { type: PokemonType; label: string }) {
  const colorVar = pokemonTypeColorVar[type];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--ps-space-1)',
        padding: '0.25rem var(--ps-space-2)',
        borderRadius: 'var(--ps-radius-pill)',
        fontSize: 'var(--ps-font-size-sm)',
        fontWeight: 600,
        color: 'var(--ps-color-text)',
        border: `1px solid color-mix(in srgb, var(${colorVar}) 38%, var(--ps-color-border))`,
        background: `color-mix(in srgb, var(${colorVar}) 14%, var(--ps-color-bg-elevated))`,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '0.625rem',
          height: '0.625rem',
          borderRadius: 'var(--ps-radius-pill)',
          background: `var(${colorVar})`,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
