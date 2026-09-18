/**
 * PokeLab Brand 1.0 — official asset registry.
 *
 * These are Figma exports under `apps/web/public/brand/`; Figma is the
 * source of truth for their geometry/color. Never redraw, recolor or
 * otherwise regenerate them in code — this file only names their paths.
 *
 * `pokelab-symbol-light.svg` is intentionally still not registered here:
 * it's a genuine, transparent-background export (no baked-in canvas fill),
 * but its all-Emerald coloring doesn't disambiguate which of the two
 * Figma-named variants it is ("Logo – Emerald" vs "Logo – Emerald White") —
 * see docs/product/DESIGN_SYSTEM.md "Logo" section. Don't guess a mapping for it; confirm
 * with the design source first.
 */
export const brandAssets = {
  symbolPrimary: '/brand/pokelab-symbol-primary.svg',
  symbolOnDark: '/brand/pokelab-symbol-on-dark.svg',
  symbolMonoOnLight: '/brand/pokelab-symbol-mono-on-light.svg',
  symbolMonoOnDark: '/brand/pokelab-symbol-mono-on-dark.svg',
  wordmarkOnDark: '/brand/pokelab-wordmark-on-dark.svg',
  wordmarkOnLight: '/brand/pokelab-wordmark-on-light.svg',
  compactOnDark: '/brand/pokelab-lockup-compact-on-dark.svg',
  compactOnLight: '/brand/pokelab-lockup-compact-on-light.svg',
  favicon16: '/brand/pokelab-favicon-16.svg',
  favicon32: '/brand/pokelab-favicon-32.svg',
} as const;
