/**
 * Localized display names for the classic evolution stones (Phase 1C.2b) —
 * a small, closed, extremely well-established set of official item names
 * that have been stable across every mainline Spanish localization since
 * Generation I/II. Unlike `version-group-label.ts`'s game titles, these
 * *are* genuinely translated (not proper nouns), which is exactly why this
 * table is deliberately narrow: only items whose official Spanish name is
 * confidently known belong here — anything else (held items like King's
 * Rock, region-specific trade items, sweets) falls back to the existing
 * honest English-slug stand-in (`evolution-condition.ts`'s `humanizeSlug`)
 * rather than a guessed translation (CLAUDE.md §14 "no fake completeness"
 * applies to naming claims, not just mechanics).
 */
const EVOLUTION_STONE_NAMES_ES: Record<string, string> = {
  'water-stone': 'Piedra Agua',
  'thunder-stone': 'Piedra Trueno',
  'fire-stone': 'Piedra Fuego',
  'leaf-stone': 'Piedra Hoja',
  'moon-stone': 'Piedra Lunar',
  'sun-stone': 'Piedra Solar',
  'shiny-stone': 'Piedra Brillante',
  'dusk-stone': 'Piedra Noche',
  'dawn-stone': 'Piedra Alba',
  'ice-stone': 'Piedra Hielo',
};

export function localizedItemName(itemSlug: string, locale: 'en' | 'es'): string | undefined {
  if (locale === 'es') return EVOLUTION_STONE_NAMES_ES[itemSlug];
  return undefined;
}
