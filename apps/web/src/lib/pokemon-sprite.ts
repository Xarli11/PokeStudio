import { generationForNationalDexNumber } from '@pokestudio/pokemon-data';

/**
 * Centralized Pokémon sprite/asset resolver (Milestone 2, final Build pass
 * §9-11; extended for the dev-only Sprite Lab, final visual review §11-§12).
 * No component ever concatenates a sprite URL itself — every call site goes
 * through this module, so the source/strategy can change without touching a
 * component.
 *
 * PROVISIONAL SOURCES, LOCAL/DEV ONLY (owner decisions — see
 * `docs/engineering/DATA_SOURCES.md` "Sprite source" entries for the full
 * record). Every source here is explicitly NOT a commercial/production
 * licensing clearance: Pokémon sprites remain Nintendo/Game Freak/The
 * Pokémon Company IP regardless of which permissively-licensed *code*
 * repository happens to host the image files.
 *
 * Three candidate strategies, evaluated side by side in the Sprite Lab
 * (`/[locale]/dev/sprites`, dev-only) rather than one resolver silently
 * picking per-species winners — task's own explicit warning: a roster where
 * Pikachu renders as a box icon, Mew as a battle sprite and Garchomp as
 * official artwork would look incoherent. A future production resolver
 * commits to exactly one strategy (or a documented, generation-based
 * fallback chain), never a per-Pokémon guess:
 *
 * - `'modern'` — PokéAPI's flat `sprites/pokemon/{dex}.png` set. Broadest
 *   current coverage (verified: every national Dex number 1-1025 resolves,
 *   including every Generation IX species), but default-form only.
 * - `'box'` — PokéSprite's Gen VIII-style box icons
 *   (`pokemon-gen8/regular/{formSlug}.png`). The owner's preferred visual
 *   direction, and real per-form coverage (regional forms, Rotom formes,
 *   etc. each have their own file) — but audited (2026-09-16, against this
 *   project's own species/form tables) to top out at national Dex 905:
 *   **zero Generation IX coverage**, and 172/1025 default forms missing
 *   even within that range (species whose "default" PokéAPI form slug
 *   itself carries a form suffix — e.g. `deoxys-normal`, `unown-a` — that
 *   PokéSprite names differently). Every gap surfaces as `'unavailable'`
 *   here, never a silently substituted image.
 * - `'showdown'` — Pokémon Showdown's static "gen5"-style battle sprites
 *   (`play.pokemonshowdown.com/sprites/gen5/{formSlug}.png`), added per
 *   owner request (final visual review, Showdown/Smogon audit). Audited
 *   (2026-09-16) against this project's own species/form tables: 927/1025
 *   default forms (~90%), including **85/120 Generation IX species** (~71%
 *   — notably better Gen IX coverage than `'box'`'s zero), and 170/200 in a
 *   sampled non-default-form check. Naming follows the same hyphenated
 *   convention as PokeStudio's own `formSlug` for most forms (`rotom-wash`,
 *   `meowth-alola`, `unown-a`), but not universally (`charizard-megax`, no
 *   hyphen before the X/Y suffix, unlike this project's `charizard-mega-x`)
 *   — the same category of naming-convention gap `'box'` already has, not
 *   fixed with a per-species alias table here either. **Rights status is
 *   more restrictive than the other three sources**: the animated version
 *   of these sprites is an explicitly community-authored project whose own
 *   stated terms (Smogon Forums, "XY Battle Sprite Animations" thread)
 *   include *"these sprites are not open source, because we do not have
 *   the rights to the characters depicted"* and *"any games that charge
 *   money will not be accepted"* — see `docs/engineering/DATA_SOURCES.md`
 *   for the full record. Static-only here (no `.gif` animation), matching
 *   this module's existing restraint against animated roster sprites.
 * - `'game-era'` — PokéAPI's own per-generation/per-game sprite sets
 *   (`sprites/pokemon/versions/{generation}/{game}/{dex}.png`), audited
 *   directly against GitHub for exactly which game folders actually exist
 *   (2026-09-16) — see `GAME_ERA_SPRITE_SOURCES` below. Several requested
 *   games (Sun/Moon, Sword/Shield, Black 2/White 2) have **no separate
 *   folder at all** and are deliberately left unmapped rather than silently
 *   pointed at a same-generation neighbor's assets. A species that debuted
 *   after the target game's own generation (using the same
 *   `generationForNationalDexNumber` ranges Build's species-availability
 *   validation already uses — never a second, duplicated table) is reported
 *   `'unavailable'` deterministically — e.g. Garchomp (Generation IV) in
 *   Red/Blue (Generation I) is never attempted, matching that this is
 *   already invalid domain state elsewhere in Build.
 *
 * None of these are verified against a live network check at resolve time —
 * every URL this module returns is a deterministic construction from
 * already-known facts (Dex number, generation ranges, audited folder
 * coverage). A caller/component still renders its own placeholder fallback
 * on an actual image load error (`<img onError>`), since even an audited
 * "should exist" URL can't be guaranteed without a real request.
 */

export type PokemonSpriteVariant = 'normal' | 'shiny';

/** Which sprite source a resolution actually used — 'unavailable' for a known gap (never a silently wrong image), distinct from the strategy the caller *requested*. */
export type SpriteSourceKind = 'box' | 'game-era' | 'modern' | 'showdown' | 'unavailable';

export type SpriteStrategy = 'box' | 'game-era' | 'modern' | 'showdown';

export interface PokemonSpriteRequest {
  formSlug: string;
  speciesSlug: string;
  nationalDexNumber: number;
  isDefaultForm: boolean;
  /**
   * The upstream PokéAPI `pokemon` (variety) resource id this exact form
   * belongs to (`packages/database`'s `pokeapiPokemonId` on every form
   * summary/comparable-form/search-item type) — the id `'modern'`'s own
   * sprite set is actually keyed by, and the one thing that lets it
   * distinguish a non-default form (a Mega Evolution, a regional form)
   * from its own base species, which otherwise shares its National Dex
   * number. `null`/omitted only for a row ingested before this field
   * existed — falls back to the dex-number lookup, but only for a default
   * form (never a non-default one, where that fallback would silently
   * point at the wrong Pokémon's sprite).
   */
  pokeapiPokemonId?: number | null;
  /** Which candidate strategy to resolve. Defaults to `'modern'` — today's production choice (task §14: keep current behavior until the owner picks a winner). */
  strategy?: SpriteStrategy;
  /** Required (and only meaningful) for `'game-era'` — which game's own sprite set to use. */
  versionGroupSlug?: string;
  variant?: PokemonSpriteVariant;
}

export interface SpriteResolution {
  url: string | undefined;
  sourceKind: SpriteSourceKind;
}

const POKEAPI_SPRITES_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

/**
 * Resolves a sprite image URL, or `undefined` when this form has no known
 * mapping yet — callers always render their existing placeholder in that
 * case (task: "fallback must always work"), never an ugly broken image box.
 *
 * This is Build's current *production* sprite behavior (`'modern'`
 * strategy only) — kept as its own stable export, unchanged in shape or
 * behavior, so the roster (`team-slot.tsx`) is unaffected by the Sprite
 * Lab's broader `resolveSprite` added alongside it (task §14).
 */
export function getPokemonSprite(request: PokemonSpriteRequest): string | undefined {
  return resolveModernSprite(request).url;
}

function resolveModernSprite(request: PokemonSpriteRequest): SpriteResolution {
  // The exact-form id, when we have it — works for both default and
  // non-default forms alike (task: "exact form"). Only a default form
  // falls back to the National Dex number when the id is missing — that
  // fallback would silently resolve to the *base species'* sprite for a
  // non-default form (they share a dex number), which is exactly the bug
  // this field exists to fix, so it's deliberately not offered there.
  const id =
    request.pokeapiPokemonId ?? (request.isDefaultForm ? request.nationalDexNumber : undefined);
  if (id === undefined || !Number.isInteger(id) || id <= 0) {
    return { url: undefined, sourceKind: 'unavailable' };
  }
  const variantSegment = request.variant === 'shiny' ? 'shiny/' : '';
  return {
    url: `${POKEAPI_SPRITES_BASE}/${variantSegment}${id}.png`,
    sourceKind: 'modern',
  };
}

/**
 * Verified 2026-09-16 against `raw.githubusercontent.com/msikma/pokesprite`
 * `data/pokemon.json` (905 keyed entries, National Dex 001-905 — Generation
 * IX simply has no entries at all, not partial ones) and the repo's own git
 * tree (`pokemon-gen8/regular/*.png`, 1352 files, one per species/form
 * slug). This is the one non-per-species fact this module encodes about
 * PokéSprite's coverage; everything else is discovered honestly via
 * `<img onError>` in the Lab, never guessed here.
 */
export const POKESPRITE_MAX_DEX = 905;
const POKESPRITE_BASE =
  'https://raw.githubusercontent.com/msikma/pokesprite/master/pokemon-gen8/regular';

function resolveBoxSprite(request: PokemonSpriteRequest): SpriteResolution {
  if (request.nationalDexNumber > POKESPRITE_MAX_DEX) {
    return { url: undefined, sourceKind: 'unavailable' };
  }
  // Real per-form coverage (unlike `'modern'`) — PokéSprite files a
  // separate icon per form slug (`rotom-wash.png`, `meowth-alola.png`),
  // so this deliberately does NOT gate on `isDefaultForm`.
  return { url: `${POKESPRITE_BASE}/${request.formSlug}.png`, sourceKind: 'box' };
}

const SHOWDOWN_SPRITES_BASE = 'https://play.pokemonshowdown.com/sprites';

/**
 * Static "gen5"-style sprite, by exact `formSlug` — no pre-computed
 * coverage cutoff exists here (unlike `'box'`'s hard Generation IX wall):
 * the audit found scattered ~10% gaps across every generation, mostly
 * naming-convention mismatches, not a clean boundary. Every gap is
 * discovered honestly via `<img onError>` in the Lab, same as the other
 * strategies' own residual gaps.
 */
function resolveShowdownSprite(request: PokemonSpriteRequest): SpriteResolution {
  return { url: `${SHOWDOWN_SPRITES_BASE}/gen5/${request.formSlug}.png`, sourceKind: 'showdown' };
}

/**
 * Verified 2026-09-16 directly against `github.com/PokeAPI/sprites`'
 * `sprites/pokemon/versions/` tree — only the games listed here have their
 * own folder at all. `maxSpeciesGeneration` is the highest species
 * generation that sprite set actually contains, which is NOT always the
 * game's own generation: Brilliant Diamond/Shining Pearl is a Generation
 * VIII game, but its own sprite folder's file count (545) closely matches
 * Platinum's (563) — evidence it's scoped to the Sinnoh Dex, not the full
 * national Dex, so it's recorded here as Generation IV coverage.
 */
export const GAME_ERA_SPRITE_SOURCES: Record<
  string,
  { path: string; maxSpeciesGeneration: number }
> = {
  'red-blue': { path: 'generation-i/red-blue', maxSpeciesGeneration: 1 },
  yellow: { path: 'generation-i/yellow', maxSpeciesGeneration: 1 },
  crystal: { path: 'generation-ii/crystal', maxSpeciesGeneration: 2 },
  // Our own version-group data models Gold and Silver as one combined
  // ("gold-silver") group; the sprites repo keeps them as two separate
  // folders with no combined one — "gold" is simply the representative
  // pick, not a claim that Silver's own box art matches it exactly.
  'gold-silver': { path: 'generation-ii/gold', maxSpeciesGeneration: 2 },
  'ruby-sapphire': { path: 'generation-iii/ruby-sapphire', maxSpeciesGeneration: 3 },
  emerald: { path: 'generation-iii/emerald', maxSpeciesGeneration: 3 },
  'firered-leafgreen': { path: 'generation-iii/firered-leafgreen', maxSpeciesGeneration: 3 },
  'diamond-pearl': { path: 'generation-iv/diamond-pearl', maxSpeciesGeneration: 4 },
  platinum: { path: 'generation-iv/platinum', maxSpeciesGeneration: 4 },
  'heartgold-soulsilver': { path: 'generation-iv/heartgold-soulsilver', maxSpeciesGeneration: 4 },
  'black-white': { path: 'generation-v/black-white', maxSpeciesGeneration: 5 },
  // No separate Black 2/White 2 folder exists upstream — deliberately
  // unmapped rather than silently reusing Black/White's assets under a
  // different game's label.
  'x-y': { path: 'generation-vi/x-y', maxSpeciesGeneration: 6 },
  'omega-ruby-alpha-sapphire': {
    path: 'generation-vi/omegaruby-alphasapphire',
    maxSpeciesGeneration: 6,
  },
  // No separate Sun/Moon folder exists upstream (only Ultra Sun/Ultra
  // Moon) — deliberately unmapped for the same reason.
  'ultra-sun-ultra-moon': {
    path: 'generation-vii/ultra-sun-ultra-moon',
    maxSpeciesGeneration: 7,
  },
  // No separate Sword/Shield folder exists upstream (only BDSP, itself
  // Sinnoh-Dex-scoped) — deliberately unmapped.
  'brilliant-diamond-shining-pearl': {
    path: 'generation-viii/brilliant-diamond-shining-pearl',
    maxSpeciesGeneration: 4,
  },
  'scarlet-violet': { path: 'generation-ix/scarlet-violet', maxSpeciesGeneration: 9 },
};

function resolveGameEraSprite(
  request: PokemonSpriteRequest,
  versionGroupSlug: string,
): SpriteResolution {
  if (!request.isDefaultForm) return { url: undefined, sourceKind: 'unavailable' };
  const source = GAME_ERA_SPRITE_SOURCES[versionGroupSlug];
  if (!source) return { url: undefined, sourceKind: 'unavailable' };

  const introducedGeneration = generationForNationalDexNumber(request.nationalDexNumber);
  // A species that debuted after this game's own generation is already
  // invalid Build domain state (`speciesUnavailableInGeneration`) — never
  // invent a sprite for it here either (task §12's own Garchomp/Red-Blue
  // example).
  if (introducedGeneration === undefined || introducedGeneration > source.maxSpeciesGeneration) {
    return { url: undefined, sourceKind: 'unavailable' };
  }

  return {
    url: `${POKEAPI_SPRITES_BASE}/versions/${source.path}/${request.nationalDexNumber}.png`,
    sourceKind: 'game-era',
  };
}

/** Every version group `'game-era'` currently has a real, audited sprite source for — lets the Lab's own game picker only offer choices that can resolve to something. */
export const GAME_ERA_SUPPORTED_VERSION_GROUPS = Object.keys(GAME_ERA_SPRITE_SOURCES);

/**
 * The Sprite Lab's own entry point — resolves any of the three candidate
 * strategies and reports which one actually produced a URL (`sourceKind`
 * is `'unavailable'`, never a mismatched strategy, whenever it can't).
 * Defaults to `'modern'` (today's production strategy) when `strategy` is
 * omitted, matching `getPokemonSprite`'s own behavior exactly.
 */
export function resolveSprite(request: PokemonSpriteRequest): SpriteResolution {
  const strategy = request.strategy ?? 'modern';
  if (strategy === 'box') return resolveBoxSprite(request);
  if (strategy === 'showdown') return resolveShowdownSprite(request);
  if (strategy === 'game-era') {
    return request.versionGroupSlug
      ? resolveGameEraSprite(request, request.versionGroupSlug)
      : { url: undefined, sourceKind: 'unavailable' };
  }
  return resolveModernSprite(request);
}
