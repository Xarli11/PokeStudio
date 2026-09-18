/**
 * Build's central game/ruleset capability model (Milestone 2, final product
 * shape pass — reverses the earlier Scarlet/Violet-only restriction). Build
 * now exposes every historical game/version-group PokeLab has data for;
 * what changes per game is which mechanics apply, resolved here once and
 * consumed by the game selector, the Set Editor's conditional fields, and
 * team validity — never a scattered `if (versionGroupSlug === 'x')` check.
 *
 * Deliberately NOT a full historical battle-mechanics engine (task's
 * explicit restraint): this only models *whether a mechanic exists in this
 * game context*, never *whether a specific configuration is tournament
 * legal* for it. `fullyValidated` is the one honesty flag that matters for
 * team status — see `team-analysis.ts`'s `unsupportedRuleset` warning.
 */

export type BuildStatModel = 'modern' | 'legacy-gen1' | 'legacy-gen2' | 'special';

export type BuildSpecialRuleset = 'lets-go' | 'legends-arceus' | 'legends-za';

export interface BuildGameCapabilities {
  versionGroupSlug: string;
  generation: number;
  abilities: boolean;
  natures: boolean;
  heldItems: boolean;
  /** The Gen III+ EV/IV/nature stat formula `@pokelab/damage`'s `calculateStats` implements — false wherever that formula is known to be wrong for this game (Gen I/II's different DV/stat-experience systems, and every special-ruleset game's own non-standard investment system). */
  modernEvsIvs: boolean;
  tera: boolean;
  dynamax: boolean;
  megaEvolution: boolean;
  zMoves: boolean;
  specialRuleset: BuildSpecialRuleset | null;
  statModel: BuildStatModel;
  /**
   * Whether PokeLab's current engine can back a VALID status for this
   * game context at all. `false` doesn't mean "invalid" — it means the
   * engine has known gaps here (no legacy stat model, no special-ruleset
   * legality), so team status must never claim full validity regardless of
   * what the (incomplete) checks it does run find (task §18).
   */
  fullyValidated: boolean;
  /**
   * Whether Team Analysis' canonical modern 18-type chart
   * (`@pokelab/pokemon-data`'s `getTypeEffectiveness`) is historically
   * accurate for this game (manual review, final correction pass §4) — a
   * *separate* axis from `fullyValidated`: unsupported strategic analysis
   * never makes a Pokémon itself invalid, it only means Team Analysis
   * itself renders a restrained honest message instead of the modern
   * Defensive/Offensive breakdown. Fairy type (and the type chart settling
   * into its current, stable form) shipped in Generation VI — every earlier
   * generation's real type chart differs from the modern one PokeLab
   * only has one (modern) implementation of, so those contexts render
   * honestly unsupported rather than a chart that quietly gets some
   * matchups wrong (task: "do not claim more historical accuracy than we
   * actually have"). Independent of `specialRuleset`: Let's Go/Legends:
   * Arceus/Legends: Z-A all use the same modern-era type chart, so their
   * type analysis is still accurate even though other mechanics aren't.
   */
  teamAnalysisSupported: boolean;
}

/** Gen 9 Tera Type — Scarlet/Violet and its two DLC version groups. */
const TERA_VERSION_GROUPS = new Set(['scarlet-violet', 'the-teal-mask', 'the-indigo-disk']);

/** Dynamax existed only in Sword/Shield's own era — not BDSP, not Legends: Arceus, despite sharing Generation VIII. */
const DYNAMAX_VERSION_GROUPS = new Set(['sword-shield', 'the-isle-of-armor', 'the-crown-tundra']);

/** Mega Evolution: introduced X/Y, available through every Gen VI/VII game, removed starting Sword/Shield. */
const MEGA_EVOLUTION_VERSION_GROUPS = new Set([
  'x-y',
  'omega-ruby-alpha-sapphire',
  'sun-moon',
  'ultra-sun-ultra-moon',
]);

/** Z-Moves: Gen VII's own mechanic — not carried into Let's Go despite sharing the generation. */
const Z_MOVE_VERSION_GROUPS = new Set(['sun-moon', 'ultra-sun-ultra-moon']);

const LETS_GO_VERSION_GROUPS = new Set(['lets-go-pikachu-lets-go-eevee']);
const LEGENDS_ARCEUS_VERSION_GROUPS = new Set(['legends-arceus']);
/** An announced future game (task: "do not fabricate unsupported labels") — its actual mechanics aren't public/confirmed yet, so it's treated as its own unknown special ruleset rather than guessed at. */
const LEGENDS_ZA_VERSION_GROUPS = new Set(['legends-za']);

function specialRulesetFor(slug: string): BuildSpecialRuleset | null {
  if (LETS_GO_VERSION_GROUPS.has(slug)) return 'lets-go';
  if (LEGENDS_ARCEUS_VERSION_GROUPS.has(slug)) return 'legends-arceus';
  if (LEGENDS_ZA_VERSION_GROUPS.has(slug)) return 'legends-za';
  return null;
}

/**
 * Resolves a version group's Build capabilities. Takes the minimal shape
 * (`slug` + `generation`) that `VersionGroupSummary` already provides —
 * doesn't need the full row, so a raw `{ slug, generation }` literal works
 * fine in tests too.
 */
export function resolveBuildGameCapabilities(versionGroup: {
  slug: string;
  generation: number;
}): BuildGameCapabilities {
  const { slug, generation } = versionGroup;
  const specialRuleset = specialRulesetFor(slug);
  // Fairy type (Generation VI) is the last change that mattered to the
  // modern chart's own shape — see the field's own doc comment above.
  const teamAnalysisSupported = generation >= 6;

  const base = { versionGroupSlug: slug, generation, teamAnalysisSupported };

  // Special-ruleset games (Let's Go, Legends: Arceus, the announced Legends:
  // Z-A) each replace large parts of the standard mechanics/investment
  // system with their own — PokeLab doesn't model any of them yet, so
  // every mechanic flag stays honestly false rather than guessed at (task
  // §2/§3: "identifiable as special-rule contexts", never "pretend
  // unsupported validation is complete").
  if (specialRuleset) {
    return {
      ...base,
      abilities: false,
      natures: false,
      heldItems: false,
      modernEvsIvs: false,
      tera: false,
      dynamax: false,
      megaEvolution: false,
      zMoves: false,
      specialRuleset,
      statModel: 'special',
      fullyValidated: false,
    };
  }

  if (generation <= 1) {
    return {
      ...base,
      abilities: false,
      natures: false,
      heldItems: false,
      modernEvsIvs: false,
      tera: false,
      dynamax: false,
      megaEvolution: false,
      zMoves: false,
      specialRuleset: null,
      statModel: 'legacy-gen1',
      fullyValidated: false,
    };
  }

  if (generation === 2) {
    return {
      ...base,
      abilities: false,
      natures: false,
      heldItems: true,
      modernEvsIvs: false,
      tera: false,
      dynamax: false,
      megaEvolution: false,
      zMoves: false,
      specialRuleset: null,
      statModel: 'legacy-gen2',
      fullyValidated: false,
    };
  }

  // Generation III+ "standard" games: PokeLab's ability/nature/held-item
  // data and modern EV/IV/nature stat formula are all genuinely accurate
  // here — this is the one bucket Build could already validate (previously
  // restricted to Scarlet/Violet alone; now extended honestly to every
  // standard Gen III-IX game, since nothing about the engine was ever
  // Scarlet/Violet-specific).
  return {
    ...base,
    abilities: true,
    natures: true,
    heldItems: true,
    modernEvsIvs: true,
    tera: TERA_VERSION_GROUPS.has(slug),
    dynamax: DYNAMAX_VERSION_GROUPS.has(slug),
    megaEvolution: MEGA_EVOLUTION_VERSION_GROUPS.has(slug),
    zMoves: Z_MOVE_VERSION_GROUPS.has(slug),
    specialRuleset: null,
    statModel: 'modern',
    fullyValidated: true,
  };
}

/** Build's default game for a brand-new team — the current flagship modern-mechanics game, not merely "whatever the database returns first". */
export const DEFAULT_BUILD_VERSION_GROUP_SLUG = 'scarlet-violet';
