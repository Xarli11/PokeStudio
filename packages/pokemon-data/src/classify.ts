import type { FormCategory } from './types';

/**
 * Form classification, centralized (Phase 1B §5): every rule here is driven
 * by PokéAPI's own structural signals — never a per-species `if name === ...`.
 * The one deliberately curated list is `REGION_LABELS`, documented below.
 */

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function assertValidSlug(slug: string, context: string): void {
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`Invalid slug "${slug}" (${context}): expected lowercase kebab-case`);
  }
}

/**
 * Region markers PokéAPI appends to a variety's name for a regional form
 * (e.g. "wooper-paldea", "meowth-alola"). Proper nouns are identical in
 * English and Spanish, so one label serves both. This is the one
 * intentionally centralized exception list this pipeline has — extend it
 * (not per-species conditionals) if a future generation adds a new region.
 */
export const REGION_LABELS: Readonly<Record<string, string>> = {
  alola: 'Alola',
  galar: 'Galar',
  hisui: 'Hisui',
  paldea: 'Paldea',
};

export function detectRegionLabel(pokemonName: string): string | undefined {
  for (const [suffix, label] of Object.entries(REGION_LABELS)) {
    if (pokemonName.endsWith(`-${suffix}`)) return label;
  }
  return undefined;
}

/**
 * Most `pokemon` entries have exactly one `pokemon-form`. Cosmetic-heavy
 * species (Unown, Vivillon, Alcremie, ...) have many, and PokéAPI's
 * per-form `is_default` is true on *all* of them there — it means "this
 * form entry itself needs no special trigger," not "this is the canonical
 * one." So: the form whose own name exactly matches the parent pokemon's
 * name is the canonical one when it exists.
 *
 * When no form's name matches (every form is decorated, e.g. Xerneas'
 * "xerneas-active"/"xerneas-neutral" — neither is plain "xerneas"), fall
 * back to `is_default` *only if exactly one form claims it* — reliable for
 * a genuine two-state species like Xerneas (only "neutral" is
 * `is_default: true`), unreliable for cosmetic groups like Vivillon (every
 * form claims `is_default: true`). If that's ambiguous too, use API array
 * order as the last resort.
 */
export function pickPrimaryForm<F extends { name: string; is_default: boolean }>(
  forms: readonly F[],
  pokemonName: string,
): F {
  if (forms.length === 0) throw new Error(`Pokémon "${pokemonName}" has no forms`);
  const exactNameMatch = forms.find((form) => form.name === pokemonName);
  if (exactNameMatch) return exactNameMatch;
  const defaultFlagged = forms.filter((form) => form.is_default);
  if (defaultFlagged.length === 1) return defaultFlagged[0]!;
  return forms[0]!;
}

export function classifyForm(params: {
  isDefaultVariety: boolean;
  isPrimaryForm: boolean;
  isMega: boolean;
  isBattleOnly: boolean;
  regionLabel: string | undefined;
  /**
   * True when this variety's types or base stats differ from the species'
   * default variety (e.g. Rotom-Heat vs. Rotom, Indeedee-female vs.
   * Indeedee-male). PokéAPI doesn't flag these with `is_mega`/
   * `is_battle_only` — they're obtainable outside battle — but they are
   * mechanically relevant, unlike a same-stats cosmetic reskin, so they
   * belong in `battle` rather than `cosmetic`.
   */
  mechanicallyDifferentFromDefault: boolean;
}): FormCategory {
  // is_battle_only covers Mega, Gigantamax, Primal and Ultra Burst uniformly
  // — a PokéAPI-native signal, checked first since it's the most specific.
  if (params.isMega || params.isBattleOnly) return 'battle';
  if (params.regionLabel) return 'regional';
  if (params.isDefaultVariety && params.isPrimaryForm) return 'default';
  if (params.mechanicallyDifferentFromDefault) return 'battle';
  // Everything else (cosmetic pattern/letter/flavor sub-forms, which by
  // construction share their parent variety's types/stats) falls back here.
  return 'cosmetic';
}
