import type { PokemonType } from '@pokelab/pokemon-data';
import { pokemonTypeColorVar } from '@pokelab/ui';

/**
 * A Pokémon type indicator. Color is a decorative accent only — the
 * localized label is always shown, so the indicator never relies on color
 * alone (docs/product/DESIGN_SYSTEM.md accessibility requirements).
 *
 * The type is chosen at runtime from data, so its color can't be a static
 * Tailwind class (`bg-type-grass` etc. don't exist as a fixed set in the
 * compiled output unless every one is statically written somewhere) — the
 * `color-mix()` wash/border stays inline, driven by the same
 * `--pl-type-*`/`--color-type-*` tokens Tailwind's own type-color utilities
 * are aliased from, so nothing here is a hardcoded hex value.
 *
 * `size="sm"` (Search UX v2) is the same badge, shrunk for compact contexts
 * like the Pokémon autocomplete row — it reuses this component rather than
 * duplicating the type-color styling.
 */
export function PokemonTypeBadge({
  type,
  label,
  size = 'md',
}: {
  type: PokemonType;
  label: string;
  size?: 'sm' | 'md';
}) {
  const colorVar = pokemonTypeColorVar[type];
  const isSmall = size === 'sm';

  return (
    <span
      className={`inline-flex items-center font-semibold text-foreground ${
        isSmall
          ? 'gap-1 rounded-full px-1.5 py-0.5 text-xs'
          : 'gap-1 rounded-full px-2 py-1 text-sm'
      }`}
      style={{
        border: `1px solid color-mix(in srgb, var(${colorVar}) 38%, var(--pl-color-border))`,
        background: `color-mix(in srgb, var(${colorVar}) 14%, var(--pl-color-bg-elevated))`,
      }}
    >
      <span
        aria-hidden="true"
        className={`shrink-0 rounded-full ${isSmall ? 'h-2 w-2' : 'h-2.5 w-2.5'}`}
        style={{ background: `var(${colorVar})` }}
      />
      {label}
    </span>
  );
}
