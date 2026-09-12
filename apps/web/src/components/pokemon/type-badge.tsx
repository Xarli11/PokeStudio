import type { PokemonType } from '@pokestudio/pokemon-data';
import { pokemonTypeColorVar } from '@pokestudio/ui';

/**
 * A Pokémon type indicator. Color is a decorative accent only — the
 * localized label is always shown, so the indicator never relies on color
 * alone (DESIGN_SYSTEM.md accessibility requirements).
 *
 * The type is chosen at runtime from data, so its color can't be a static
 * Tailwind class (`bg-type-grass` etc. don't exist as a fixed set in the
 * compiled output unless every one is statically written somewhere) — the
 * `color-mix()` wash/border stays inline, driven by the same
 * `--ps-type-*`/`--color-type-*` tokens Tailwind's own type-color utilities
 * are aliased from, so nothing here is a hardcoded hex value.
 */
export function PokemonTypeBadge({ type, label }: { type: PokemonType; label: string }) {
  const colorVar = pokemonTypeColorVar[type];

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-foreground"
      style={{
        border: `1px solid color-mix(in srgb, var(${colorVar}) 38%, var(--ps-color-border))`,
        background: `color-mix(in srgb, var(${colorVar}) 14%, var(--ps-color-bg-elevated))`,
      }}
    >
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: `var(${colorVar})` }}
      />
      {label}
    </span>
  );
}
