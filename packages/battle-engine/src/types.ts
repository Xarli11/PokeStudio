/**
 * PokeStudio battle-domain public types (docs/architecture/BATTLE_ENGINE.md, ADR-0015).
 *
 * Everything here is PokeStudio's own domain model. No Pokémon Showdown type, raw request, raw
 * protocol line or packed team string appears in this file or crosses the package boundary.
 * All config/command/state/event shapes are plain JSON-serializable data.
 */

import type { BattleFormatCategory, BattleFormatFamily, BattleFormatId } from './formats';

// ── Identity ────────────────────────────────────────────────────────────────

/** Battle side. Doubles-capable ids can be added later without reshaping any other type. */
export type BattleSideId = 'p1' | 'p2';

export type BattleGameType = 'singles' | 'doubles';

/** Who is looking. Always explicit — there is no default perspective. */
export type BattlePerspective = BattleSideId | 'spectator' | 'omniscient';

/** An active slot on a side. `position` is 0-based (always 0 in Singles). */
export interface BattleSlotRef {
  side: BattleSideId;
  position: number;
}

/**
 * Stable Pokémon identity. `teamIndex` is ALWAYS the index of the Pokémon in the original
 * `BattleTeamInput.members` — it survives team-preview reordering, switches, faints, and
 * duplicated species/sets.
 */
export interface BattlePokemonRef {
  side: BattleSideId;
  teamIndex: number;
}

/** Opaque RNG seed string in the form accepted by the installed simulator. Never an array. */
export type BattleSeed = string;

// ── Config / team input ─────────────────────────────────────────────────────

export interface BattleStatTable {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

/**
 * One team member. Names/ids (`species`, `ability`, `item`, `moves`, `nature`, `teraType`) are
 * "Showdown-resolvable canonical identifiers": the adapter resolves and validates them against the
 * installed simulator data, and rejects anything it cannot resolve as `INVALID_TEAM`.
 * `nickname` is display-only PokeStudio data and never reaches the simulator.
 * Every optional field, when omitted, takes the simulator's own default (gender is resolved from the
 * species; it is never turned into "genderless"). `'N'` means explicitly genderless.
 */
export interface BattleTeamMemberInput {
  species: string;
  nickname?: string;
  level?: number;
  gender?: 'M' | 'F' | 'N';
  shiny?: boolean;
  ability: string;
  item?: string;
  moves: readonly string[];
  nature?: string;
  teraType?: string;
  happiness?: number;
  /**
   * Effort values. In the Champions format family the simulator reads this table as Stat Points
   * (at most 32 per stat and 66 in total); the simulator's validator stays the authority.
   */
  evs?: Partial<BattleStatTable>;
  ivs?: Partial<BattleStatTable>;
}

/** Neutral team boundary: Build, tools, tests and (later) integration mappers produce this. */
export interface BattleTeamInput {
  members: readonly BattleTeamMemberInput[];
}

export interface BattleSideConfig {
  /** PokeStudio-side display name. Never sent to the simulator. */
  displayName: string;
  team: BattleTeamInput;
}

/** Public battle configuration. Team legality is always validated; there is no bypass flag. */
export interface BattleConfig {
  /**
   * A PokeStudio format id from the closed catalog (`BATTLE_FORMATS`). Raw simulator ids such as
   * "gen9ou" are rejected, as are catalogued formats that are not yet available.
   */
  formatId: BattleFormatId;
  sides: Record<BattleSideId, BattleSideConfig>;
  /** Omit for a random seed. The resolved seed is exposed on `BattleSession.info`. */
  seed?: BattleSeed;
}

/** Structured format identity: consumers never need to parse the id to learn any of this. */
export interface BattleFormatInfo {
  id: BattleFormatId;
  /** Display name from the simulator (English). Display only. */
  name: string;
  generation: number;
  gameType: BattleGameType;
  category: BattleFormatCategory;
  family: BattleFormatFamily;
}

/** Server-side info held by the session owner. NOT part of any player/spectator state. */
export interface BattleInfo {
  battleId: string;
  format: BattleFormatInfo;
  /** Resolved seed. Knowing it allows predicting rolls, so it is never put in a `BattleState`. */
  seed: BattleSeed;
  /** The simulator's own format id, for debugging and future replay internals. Server-side only. */
  engineFormatId: string;
}

// ── Lifecycle / results ─────────────────────────────────────────────────────

export type BattleStatus = 'awaiting-choices' | 'finished';

export type BattleRequestKind = 'team-preview' | 'move' | 'forced-switch' | 'wait';

export type BattleResult = { kind: 'win'; winner: BattleSideId } | { kind: 'tie' };

// ── State ───────────────────────────────────────────────────────────────────

export type BattleHp =
  { kind: 'exact'; current: number; max: number } | { kind: 'percent'; percent: number };

export type BattleMajorStatus = 'brn' | 'par' | 'slp' | 'frz' | 'psn' | 'tox';

export type BattleBoostId = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy' | 'evasion';

export interface BattleCondition {
  id: string;
  layers?: number;
}

export interface BattleMoveState {
  id: string;
  pp?: number;
  maxPp?: number;
  disabled?: boolean;
}

export interface BattlePokemonState {
  ref: BattlePokemonRef;
  species: string;
  nickname?: string;
  level: number;
  /** `'N'` = genderless species. */
  gender: 'M' | 'F' | 'N';
  hp: BattleHp;
  status: BattleMajorStatus | null;
  fainted: boolean;
  active: boolean;
  /** Present only while the Pokémon occupies an active slot. */
  slot?: BattleSlotRef;
  boosts: Partial<Record<BattleBoostId, number>>;
  /** Allow-listed, publicly visible volatile conditions only. */
  volatiles: string[];
  /** Own/omniscient only until revealed by the battle. */
  types?: string[];
  teraType?: string;
  terastallized?: string;
  /** Own/omniscient always; otherwise only once revealed. */
  ability?: string;
  item?: string | null;
  moves?: BattleMoveState[];
  /** What the viewing perspective actually knows. */
  revealed: { ability: boolean; item: boolean; moves: string[] };
}

export interface BattleSideState {
  id: BattleSideId;
  displayName: string;
  teamSize: number;
  pokemonLeft: number;
  /** One entry per active slot; `null` for an empty slot. */
  active: (BattlePokemonState | null)[];
  /** Own/omniscient: every Pokémon still in the battle. Otherwise only what has been revealed. */
  team: BattlePokemonState[];
  sideConditions: BattleCondition[];
}

export interface BattleFieldState {
  weather: BattleCondition | null;
  terrain: BattleCondition | null;
  pseudoWeather: BattleCondition[];
}

export interface BattleRequestSummary {
  kind: BattleRequestKind;
  /** True once this side has submitted its choice for the current decision. */
  submitted: boolean;
}

export interface BattleState {
  battleId: string;
  perspective: BattlePerspective;
  format: BattleFormatInfo;
  generation: number;
  gameType: BattleGameType;
  status: BattleStatus;
  turn: number;
  sides: Record<BattleSideId, BattleSideState>;
  field: BattleFieldState;
  /** Own side only for player perspectives; none for spectator; every side for omniscient. */
  requests: Partial<Record<BattleSideId, BattleRequestSummary>>;
  result: BattleResult | null;
  /** `seq` of the last event in this perspective's stream (0 if none). Pass it as `afterSeq` to read only newer events. */
  eventCursor: number;
}

// ── Legal choices vs submitted commands ─────────────────────────────────────

/** Future-proofing shapes. PR 1 only ever reports `terastallize`, and only when the request allows. */
export type BattleMoveModifier = 'terastallize' | 'mega' | 'zmove' | 'dynamax';

/** A move that may be chosen, with the parameter space for it. */
export interface BattleLegalMoveOption {
  kind: 'move';
  moveId: string;
  pp: number;
  /** `null` = no target choice is needed (Singles, self/field moves). */
  targets: BattleSlotRef[] | null;
  modifiers: BattleMoveModifier[];
}

export type BattleLegalOption =
  BattleLegalMoveOption | { kind: 'switch'; pokemon: BattlePokemonRef } | { kind: 'pass' };

export interface BattleSlotChoices {
  slot: BattleSlotRef;
  /** Pokémon currently in the slot (`null` if none). */
  pokemon: BattlePokemonRef | null;
  options: BattleLegalOption[];
}

export type BattleLegalChoices =
  | { kind: 'wait'; side: BattleSideId }
  | { kind: 'team-preview'; side: BattleSideId; pick: number; of: number }
  | { kind: 'move'; side: BattleSideId; slots: BattleSlotChoices[] }
  | {
      kind: 'forced-switch';
      side: BattleSideId;
      slots: BattleSlotChoices[];
      /**
       * Exactly this many slots must switch (the simulator requires min(slots needing a replacement,
       * benched Pokémon)); every other slot passes. Always 1 in Singles.
       */
      switchCount: number;
    };

/** One fully specified action for one slot. Distinct from `BattleLegalOption`. */
export type BattleCommandAction =
  | {
      kind: 'move';
      slot: BattleSlotRef;
      moveId: string;
      target?: BattleSlotRef;
      modifier?: BattleMoveModifier;
    }
  | { kind: 'switch'; slot: BattleSlotRef; pokemon: BattlePokemonRef }
  | { kind: 'pass'; slot: BattleSlotRef };

export type BattleCommand =
  /** Team-preview order as `teamIndex` values, first = lead. */
  | { kind: 'team-order'; order: readonly number[] }
  /** One action per active slot, in slot order. */
  | { kind: 'actions'; actions: readonly BattleCommandAction[] };

// ── Events ──────────────────────────────────────────────────────────────────

interface BattleEventBase {
  /**
   * Position in ONE perspective's event stream: contiguous, starting at 1. Streams are per
   * perspective (filtering can make them differ), so a `seq` is only meaningful with the
   * perspective that produced it.
   */
  seq: number;
  turn: number;
}

/** Minimal, perspective-filtered contract. Not the full structured battle trace. */
export type BattleEvent = BattleEventBase &
  (
    | { type: 'battle-started' }
    | { type: 'team-preview' }
    | { type: 'turn-started' }
    | { type: 'switched'; slot: BattleSlotRef; pokemon: BattlePokemonRef }
    | { type: 'move-used'; user: BattlePokemonRef; moveId: string; target?: BattlePokemonRef }
    | { type: 'hp-changed'; pokemon: BattlePokemonRef; hp: BattleHp }
    | { type: 'fainted'; pokemon: BattlePokemonRef }
    | { type: 'status-changed'; pokemon: BattlePokemonRef; status: BattleMajorStatus | null }
    | { type: 'stat-boosted'; pokemon: BattlePokemonRef; stat: BattleBoostId; delta: number }
    | {
        type: 'field-changed';
        field: 'weather' | 'terrain' | 'pseudo-weather' | 'side-condition';
        id: string;
        active: boolean;
        side?: BattleSideId;
      }
    | { type: 'battle-ended'; result: BattleResult }
  );

// ── Session ─────────────────────────────────────────────────────────────────

export interface BattleSubmitResult {
  /** True if this submission completed the decision and the engine resolved it. */
  resolved: boolean;
  /** State from the submitter's own perspective, after the call. */
  state: BattleState;
  /** Events produced by this call, from the submitter's own perspective. */
  events: readonly BattleEvent[];
}

/**
 * Narrow, perspective-locked capability for one side (the future agent/AI boundary).
 * Cannot reach `info.seed`, the omniscient perspective, the other side or any engine internals.
 */
export interface BattleSideHandle {
  readonly side: BattleSideId;
  getState(): BattleState;
  getLegalChoices(): BattleLegalChoices;
  submitChoice(command: BattleCommand): BattleSubmitResult;
  getEvents(afterSeq?: number): readonly BattleEvent[];
}

/** Authoritative, mutable, synchronous battle session. One owner at a time. */
export interface BattleSession {
  readonly info: BattleInfo;
  getState(perspective: BattlePerspective): BattleState;
  getLegalChoices(side: BattleSideId): BattleLegalChoices;
  submitChoice(side: BattleSideId, command: BattleCommand): BattleSubmitResult;
  /** Events with `seq > afterSeq` (exclusive; default 0 = all), in order, for that perspective. */
  getEvents(perspective: BattlePerspective, afterSeq?: number): readonly BattleEvent[];
  forSide(side: BattleSideId): BattleSideHandle;
}
