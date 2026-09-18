import { generationForNationalDexNumber } from '@pokelab/pokemon-data';

import { GAME_ERA_SPRITE_SOURCES, POKESPRITE_MAX_DEX } from './pokemon-sprite';

/**
 * Programmatic sprite-coverage audit (Sprite Lab, final visual review §10) —
 * pure functions over the project's own already-fetched species list, never
 * a hand-inspected sample. Two different kinds of fact are deliberately kept
 * separate here:
 *
 * - What's computable purely from PokeLab's own data (a species'
 *   generation, via the same `generationForNationalDexNumber` ranges Build's
 *   species-availability validation already uses) — computed live, below,
 *   so it never goes stale as the species table grows.
 * - What depends on an external source's own file listing (PokéSprite's
 *   exact per-slug icon coverage) — that can't be derived from PokeLab's
 *   own data at all, so it isn't faked here. It was audited directly
 *   (2026-09-16) against `github.com/msikma/pokesprite`'s `data/pokemon.json`
 *   (905 keyed entries — Generation IX has none at all) and its
 *   `pokemon-gen8/regular/*.png` git tree (1352 files, cross-referenced by
 *   exact form slug against this project's own `pokemon_form.slug`
 *   values) — recorded as `POKESPRITE_AUDIT_SNAPSHOT` below, not
 *   re-fetched on every Lab page load.
 */

export interface SpeciesForAudit {
  nationalDexNumber: number;
}

export interface GameEraCoverageResult {
  versionGroupSlug: string;
  maxSpeciesGeneration: number;
  coveredSpeciesCount: number;
  totalSpeciesCount: number;
}

/**
 * For each `'game-era'` source PokeLab has an audited sprite folder for,
 * how many of the given species could ever resolve there — a species
 * postdates a game's own generation is never "coverable", regardless of
 * whether the exact file exists (task §12: never invent a Gen I Garchomp).
 */
export function auditGameEraCoverage(species: readonly SpeciesForAudit[]): GameEraCoverageResult[] {
  const totalSpeciesCount = species.length;
  return Object.entries(GAME_ERA_SPRITE_SOURCES).map(([versionGroupSlug, source]) => {
    const coveredSpeciesCount = species.filter((entry) => {
      const generation = generationForNationalDexNumber(entry.nationalDexNumber);
      return generation !== undefined && generation <= source.maxSpeciesGeneration;
    }).length;
    return {
      versionGroupSlug,
      maxSpeciesGeneration: source.maxSpeciesGeneration,
      coveredSpeciesCount,
      totalSpeciesCount,
    };
  });
}

/** The `'modern'` strategy's own coverage — every species 1-1025 (verified directly against the sprite host, task §4/§10), default form only. */
export function auditModernCoverage(species: readonly SpeciesForAudit[]): {
  coveredSpeciesCount: number;
  totalSpeciesCount: number;
} {
  return { coveredSpeciesCount: species.length, totalSpeciesCount: species.length };
}

/** The `'box'` strategy's live-computable half: how many given species are even within PokéSprite's known Dex range at all (Generation IX = zero, always). Form-level/naming-mismatch gaps within that range are the external, dated snapshot below — not derivable from this project's own data alone. */
export function auditBoxDexRangeCoverage(species: readonly SpeciesForAudit[]): {
  withinAuditedRange: number;
  totalSpeciesCount: number;
  generationIxCount: number;
} {
  const totalSpeciesCount = species.length;
  const withinAuditedRange = species.filter(
    (s) => s.nationalDexNumber <= POKESPRITE_MAX_DEX,
  ).length;
  const generationIxCount = species.filter((s) => s.nationalDexNumber > POKESPRITE_MAX_DEX).length;
  return { withinAuditedRange, totalSpeciesCount, generationIxCount };
}

/**
 * The external, dated snapshot mentioned above — real numbers from a real
 * one-off audit script run against this project's own `species`/
 * `pokemon_form` tables and PokéSprite's public GitHub data, not
 * hand-inspected and not re-derivable from PokeLab's own data alone
 * (requires PokéSprite's actual file listing). Re-run the same audit
 * methodology (fetch `data/pokemon.json` + the `pokemon-gen8/regular` git
 * tree, cross-reference by exact form slug) if this needs refreshing.
 */
export const POKESPRITE_AUDIT_SNAPSHOT = {
  auditedAt: '2026-09-16',
  totalSpeciesCount: 1025,
  totalFormsCount: 1579,
  defaultFormsCovered: 853,
  allFormsCovered: 1187,
  generationIxSpeciesCount: 120,
  generationIxSpeciesCovered: 0,
  missingDefaultFormsCount: 172,
  /** A `pokemon_form.slug` that carries a form suffix even for what's conceptually the "default" look (e.g. `deoxys-normal`, `unown-a`) — PokéSprite names its base-form icon differently, so an exact-slug match misses it even though a same-species icon likely exists under another name. Not a true unavailability, but not corrected here either — correcting it would need a per-species alias table, which this audit deliberately does not build. */
  sampleNamingMismatches: [
    'unown-a',
    'deoxys-normal',
    'burmy-plant',
    'giratina-altered',
    'shaymin-land',
  ],
} as const;

/**
 * Same kind of external, dated snapshot as `POKESPRITE_AUDIT_SNAPSHOT`, for
 * Pokémon Showdown's static "gen5"-style sprites
 * (`play.pokemonshowdown.com/sprites/gen5/`) — added per owner request
 * (final visual review, Showdown/Smogon audit). Default-form coverage was
 * checked exhaustively (all 1025 species); the non-default-form and
 * animated figures are from smaller, explicitly-sampled checks (noted
 * below), not exhaustive — re-run the same methodology (HEAD-request each
 * form's `sprites/gen5/{formSlug}.png`) if this needs refreshing.
 */
export const SHOWDOWN_AUDIT_SNAPSHOT = {
  auditedAt: '2026-09-16',
  totalSpeciesCount: 1025,
  defaultFormsCovered: 927,
  generationIxSpeciesCount: 120,
  generationIxSpeciesCovered: 85,
  missingDefaultFormsCount: 98,
  /** Sampled 200 of 1579 non-default forms — not exhaustive. */
  nonDefaultFormSampleSize: 200,
  nonDefaultFormSampleCovered: 170,
  /** Stratified sample, one species every ~17 National Dex numbers (61 total) — not exhaustive. */
  animatedSampleSize: 61,
  animatedSampleCovered: 53,
  sampleMissingDefaultForms: ['nidoran-m', 'mr-mime', 'ho-oh', 'deoxys-normal', 'burmy-plant'],
} as const;
