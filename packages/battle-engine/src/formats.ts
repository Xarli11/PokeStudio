import type { BattleGameType } from './types';

/**
 * PokeStudio's explicit, closed catalog of supported battle formats (ADR-0016).
 *
 * Pure domain data: no Pokémon Showdown import and no Showdown ids. The mapping to simulator
 * format ids is an internal server-side detail (`showdown/formats.ts`). Rules, bans, legality, team
 * sizes, pick sizes and level adjustment stay owned by the simulator; this file only records what
 * PokeStudio itself decides — which formats are product formats, how they are grouped, and whether
 * the engine can run them yet. Nothing is discovered automatically: a simulator upgrade never adds a
 * format here, and never changes the current generation.
 */

/**
 * PokeStudio's current (priority) generation — an explicit product decision, not derived from the
 * simulator or the data. Generation 9 currently spans two families (Scarlet/Violet and Champions).
 * Moving to a new generation is a deliberate product change.
 *
 * ID STABILITY: a published `BattleFormatId` is permanent. It is never recycled, never changes
 * meaning and is never removed just because this constant moves. A new generation adds new ids;
 * how older ids are presented (selectable vs historical) is decided when persistence/replay need it,
 * and it must keep every published id resolvable.
 */
export const CURRENT_GENERATION = 9;

/** Stable public format identity. Consumers use these, never simulator ids. */
export type BattleFormatId =
  'sv-ou' | 'sv-ubers' | 'champions-bss-reg-mb' | 'champions-vgc-reg-mb' | 'sv-doubles-ou';

/**
 * - `smogon-tier`: Smogon Singles tiers.
 * - `smogon-doubles`: Smogon Doubles tiers (kept apart from Singles tiers on purpose).
 * - `battle-stadium-singles`: official-style Singles with a bring-N-of-6 rule.
 * - `vgc`: official Doubles circuit formats.
 */
export type BattleFormatCategory =
  'smogon-tier' | 'smogon-doubles' | 'battle-stadium-singles' | 'vgc';

/**
 * Which Generation 9 game family a format belongs to. Both are the same generation. This is the
 * battle engine's own vocabulary: it is deliberately not the Build/data `versionGroup` type, and no
 * equivalence with it is asserted here (Build integration comes later).
 */
export type BattleFormatFamily = 'scarlet-violet' | 'champions';

export type BattleFormatAvailability =
  | { readonly level: 'available' }
  /** Known and catalogued, but not executable yet. */
  /** Reserved for a format catalogued before the engine can run it; currently no entry uses it. */
  | { readonly level: 'blocked'; readonly blockedBy: 'engine-capability' };

export interface BattleFormatDescriptor {
  readonly id: BattleFormatId;
  /** The generation this format id belongs to. Fixed for the life of the id (see the stability rule). */
  readonly generation: number;
  readonly category: BattleFormatCategory;
  readonly family: BattleFormatFamily;
  readonly gameType: BattleGameType;
  readonly availability: BattleFormatAvailability;
}

const AVAILABLE: BattleFormatAvailability = Object.freeze({ level: 'available' });

/** Descriptors are frozen deeply (including `availability`), so consumers cannot mutate the catalog. */
const entry = (descriptor: BattleFormatDescriptor): BattleFormatDescriptor =>
  Object.freeze(descriptor);

/** The complete list of product formats. Anything not listed here is not a supported format. */
export const BATTLE_FORMATS: readonly BattleFormatDescriptor[] = Object.freeze([
  entry({
    id: 'sv-ou',
    generation: 9,
    category: 'smogon-tier',
    family: 'scarlet-violet',
    gameType: 'singles',
    availability: AVAILABLE,
  }),
  entry({
    id: 'sv-ubers',
    generation: 9,
    category: 'smogon-tier',
    family: 'scarlet-violet',
    gameType: 'singles',
    availability: AVAILABLE,
  }),
  entry({
    id: 'champions-bss-reg-mb',
    generation: 9,
    category: 'battle-stadium-singles',
    family: 'champions',
    gameType: 'singles',
    availability: AVAILABLE,
  }),
  entry({
    id: 'champions-vgc-reg-mb',
    generation: 9,
    category: 'vgc',
    family: 'champions',
    gameType: 'doubles',
    availability: AVAILABLE,
  }),
  entry({
    id: 'sv-doubles-ou',
    generation: 9,
    category: 'smogon-doubles',
    family: 'scarlet-violet',
    gameType: 'doubles',
    availability: AVAILABLE,
  }),
]);

/** Looks up a product format by its stable id. Returns undefined for anything else. */
export function findBattleFormat(id: unknown): BattleFormatDescriptor | undefined {
  return typeof id === 'string' ? BATTLE_FORMATS.find((format) => format.id === id) : undefined;
}
