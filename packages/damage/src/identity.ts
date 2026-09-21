import { ABILITIES, ITEMS, MOVES, NATURES, SPECIES, toID } from '@smogon/calc';

/**
 * PokeStudio slug -> `@smogon/calc` identity bridge (Fase M3.1A).
 *
 * PokeStudio's public API never accepts upstream English names — every
 * caller passes a PokeStudio slug (`formSlug`, `moveSlug`, `abilitySlug`,
 * `itemSlug`, `natureSlug`); this module is the only place that resolves
 * those against `@smogon/calc`'s own generation-indexed datasets
 * (`SPECIES`/`MOVES`/`ABILITIES`/`ITEMS`/`NATURES`, each keyed by display
 * name, `NATURES` flat/not generation-indexed).
 *
 * Base strategy: `toID()` — the same canonicalization Pokémon Showdown's
 * whole ecosystem uses (strips everything but lowercase alphanumerics) —
 * collapses PokeStudio's kebab-case slugs and Smogon's PascalCase/punctuated
 * display names to the same string for the overwhelming majority of real
 * PokeStudio data. Verified directly against the full local Pokédex (Pi
 * database, 1579 species/forms; see the PR description for the audit
 * command/output) before writing a single override — every override below
 * is a demonstrated mismatch, not a guess.
 */

const speciesIndexByGen: Map<string, string>[] = [];
for (let gen = 1; gen <= 9; gen++) {
  const genData = SPECIES[gen] ?? {};
  speciesIndexByGen[gen] = new Map(Object.keys(genData).map((name) => [toID(name), name]));
}

const moveIndexByGen: Map<string, string>[] = [];
for (let gen = 1; gen <= 9; gen++) {
  const genData = MOVES[gen] ?? {};
  moveIndexByGen[gen] = new Map(Object.keys(genData).map((name) => [toID(name), name]));
}

// ABILITIES/ITEMS are plain generation-indexed *arrays* of display-name
// strings (`string[][]`, per their own .d.ts), not name-keyed objects like
// SPECIES/MOVES — confirmed by inspecting the installed package directly
// (0.11.0).
const abilityIndexByGen: Map<string, string>[] = [];
for (let gen = 1; gen <= 9; gen++) {
  const genList = ABILITIES[gen] ?? [];
  abilityIndexByGen[gen] = new Map(genList.map((name) => [toID(name), name]));
}

const itemIndexByGen: Map<string, string>[] = [];
for (let gen = 1; gen <= 9; gen++) {
  const genList = ITEMS[gen] ?? [];
  itemIndexByGen[gen] = new Map(genList.map((name) => [toID(name), name]));
}

// NATURES is flat (natures don't vary by generation once they exist —
// Generation III+ only, gated separately by the caller via `generation`).
const natureIndex = new Map(Object.keys(NATURES).map((name) => [toID(name), name]));

/**
 * Forms whose PokeStudio slug does not directly `toID()`-match its real
 * `@smogon/calc` name, demonstrated by the full-dataset audit (not
 * intuition — see the PR description). Every entry here is a real,
 * mechanically-distinct form (different stats/types/abilities from its
 * species' bare default) where falling back to the bare species name
 * would silently compute the WRONG Pokémon's damage — the audit's single
 * most important finding. Keyed by the exact PokeStudio `formSlug`.
 */
const SPECIES_OVERRIDES: Record<string, string> = {
  'necrozma-dawn': 'Necrozma-Dawn-Wings',
  'necrozma-dusk': 'Necrozma-Dusk-Mane',
  'darmanitan-galar-standard': 'Darmanitan-Galar',
  'zygarde-10-power-construct': 'Zygarde-10%',
  'toxtricity-amped-gmax': 'Toxtricity-Gmax',
  'indeedee-female': 'Indeedee-F',
  'basculegion-female': 'Basculegion-F',
  'oinkologne-female': 'Oinkologne-F',
  'urshifu-single-strike-gmax': 'Urshifu-Gmax',
  'meowstic-female-mega': 'Meowstic-F-Mega',
  'meowstic-male-mega': 'Meowstic-M-Mega',
  'pikachu-starter': 'Pikachu-Partner',
  'tauros-paldea-aqua-breed': 'Tauros-Paldea-Aqua',
  'tauros-paldea-blaze-breed': 'Tauros-Paldea-Blaze',
  'tauros-paldea-combat-breed': 'Tauros-Paldea-Combat',
  'marowak-totem': 'Marowak-Alola-Totem',
  'raticate-totem-alola': 'Raticate-Alola-Totem',
  'mimikyu-totem-busted': 'Mimikyu-Busted-Totem',
  'ogerpon-cornerstone-mask': 'Ogerpon-Cornerstone',
  'ogerpon-hearthflame-mask': 'Ogerpon-Hearthflame',
  'ogerpon-wellspring-mask': 'Ogerpon-Wellspring',
  // Minior's 7 "Core" colors (blue/green/indigo/orange/red/violet/yellow,
  // category 'battle') are cosmetically distinct but mechanically identical
  // to Smogon's bare `Minior` entry, so they're left to the species-slug
  // fallback below. The 7 "Meteor" recolors (category 'cosmetic' — the
  // audit's proof that "cosmetic category" alone is NOT a safe signal for
  // the fallback) share Minior's *default* form's real stats
  // (Shields Down inactive, high Def/SpD) and must resolve to
  // `Minior-Meteor` specifically, not bare `Minior` (the Core state) —
  // falling back on category would silently use the wrong defense stats.
  'minior-red-meteor': 'Minior-Meteor',
  'minior-blue-meteor': 'Minior-Meteor',
  'minior-green-meteor': 'Minior-Meteor',
  'minior-indigo-meteor': 'Minior-Meteor',
  'minior-orange-meteor': 'Minior-Meteor',
  'minior-violet-meteor': 'Minior-Meteor',
  'minior-yellow-meteor': 'Minior-Meteor',
};

/**
 * Forms the audit confirmed have no `@smogon/calc` representation at all —
 * distinct from `SPECIES_OVERRIDES` in that no correct target name exists
 * to override *to*. Falling back to the bare species name here would be
 * silently wrong the same way an un-overridden mismatch would be, so these
 * fail loudly (`unsupported-form`) instead of ever reaching the
 * species-slug fallback.
 */
const UNSUPPORTED_FORM_SLUGS = new Set<string>([
  // Real in-game Active Xerneas exists, but @smogon/calc's data has no
  // separate stat entry for it in any generation — only bare `Xerneas`.
  'xerneas-active',
  // Let's Go's Partner Eevee has no distinct @smogon/calc entry, unlike
  // Partner Pikachu (`Pikachu-Partner`, overridden above) — an asymmetry
  // in the upstream data, not a PokeStudio naming problem.
  'eevee-starter',
]);

/** Lets a caller distinguish "known but not modeled by @smogon/calc" (this list) from a genuinely unrecognized slug — different UX (§10's error model). */
export function isKnownUnsupportedForm(formSlug: string): boolean {
  return UNSUPPORTED_FORM_SLUGS.has(formSlug);
}

function resolve(index: Map<string, string>, slug: string): string | undefined {
  return index.get(toID(slug));
}

/**
 * Resolves a PokeStudio form slug to its `@smogon/calc` species/form name
 * for one generation. Order: explicit unsupported list (fail loudly) ->
 * explicit override table -> direct `toID()` match against that
 * generation's real `SPECIES` -> species-slug fallback (safe for
 * cosmetic-only recolors and for a default form whose PokeStudio slug
 * carries a descriptive suffix PokéAPI adds but Smogon's bare name
 * doesn't, e.g. `unown-a` -> `Unown`, `deoxys-normal` -> `Deoxys` — both
 * demonstrated by the audit, not assumed).
 */
export function resolveSpeciesIdentity(
  formSlug: string,
  speciesSlug: string,
  generation: number,
): string | undefined {
  if (UNSUPPORTED_FORM_SLUGS.has(formSlug)) return undefined;

  const override = SPECIES_OVERRIDES[formSlug];
  if (override) {
    const gen = speciesIndexByGen[generation];
    return gen?.has(toID(override)) ? override : undefined;
  }

  const direct = resolve(speciesIndexByGen[generation] ?? new Map(), formSlug);
  if (direct) return direct;

  return resolve(speciesIndexByGen[generation] ?? new Map(), speciesSlug);
}

export function resolveMoveIdentity(moveSlug: string, generation: number): string | undefined {
  return resolve(moveIndexByGen[generation] ?? new Map(), moveSlug);
}

export function resolveAbilityIdentity(
  abilitySlug: string,
  generation: number,
): string | undefined {
  return resolve(abilityIndexByGen[generation] ?? new Map(), abilitySlug);
}

export function resolveItemIdentity(itemSlug: string, generation: number): string | undefined {
  return resolve(itemIndexByGen[generation] ?? new Map(), itemSlug);
}

export function resolveNatureIdentity(natureSlug: string): string | undefined {
  return resolve(natureIndex, natureSlug);
}
