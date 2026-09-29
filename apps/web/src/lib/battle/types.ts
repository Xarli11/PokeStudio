/**
 * Battle Sandbox types shared by the server actions and the client UI. Type-only imports from the
 * engine's pure-types subpath: the web bundle never loads the battle engine or the simulator.
 */
import type {
  BattleCommand,
  BattleEvent,
  BattleFormatInfo,
  BattleLegalChoices,
  BattleReplay,
  BattleSideId,
  BattleState,
  BattleSubmitResult,
  BattleTeamInput,
} from '@pokestudio/battle-engine/types';

export type {
  BattleCommand,
  BattleEvent,
  BattleFormatInfo,
  BattleLegalChoices,
  BattleReplay,
  BattleSideId,
  BattleState,
  BattleSubmitResult,
  BattleTeamInput,
};

/** Perspectives the UI may read. `omniscient` is not in this list on purpose. */
export type ReadablePerspective = 'p1' | 'p2' | 'spectator';

export interface BattleServerError {
  /** A typed engine/server code (`ILLEGAL_CHOICE`, `INVALID_TEAM`, `BATTLE_SERVER_UNAVAILABLE`…). */
  code: string;
  details?: unknown;
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: BattleServerError };

export interface CreatedBattle {
  battleId: string;
  format: BattleFormatInfo;
}

/** What one side needs to play: its own state and what it may do now. */
export interface SideView {
  state: BattleState;
  choices: BattleLegalChoices;
}

export interface BattleDisplayNames {
  moves: Record<string, string>;
  abilities: Record<string, string>;
  items: Record<string, string>;
  conditions: Record<string, string>;
}

/** The result of forking a finished battle: a new, separate battle plus what was reused. */
export interface CreatedFork {
  battleId: string;
  format: BattleFormatInfo;
  atDecision: number;
  /** Sides whose original command was applied again. */
  reused: BattleSideId[];
  /** Sides that still owe a command for the forked decision. */
  pending: BattleSideId[];
}
