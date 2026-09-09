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
        gap: '0.375rem',
        padding: '0.25rem 0.625rem',
        borderRadius: '9999px',
        fontSize: '0.8125rem',
        fontWeight: 600,
        color: 'var(--ps-color-text)',
        border: '1px solid var(--ps-color-border)',
        background: 'var(--ps-color-bg-surface)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '0.625rem',
          height: '0.625rem',
          borderRadius: '9999px',
          background: `var(${colorVar})`,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
