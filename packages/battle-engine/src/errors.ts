import type { BattleSideId, BattleSlotRef } from './types';

export type BattleErrorCode =
  | 'INVALID_CONFIG'
  | 'UNSUPPORTED_FORMAT'
  | 'INVALID_TEAM'
  | 'INVALID_SIDE'
  | 'NOT_ACCEPTING_CHOICE'
  | 'CHOICE_ALREADY_SUBMITTED'
  | 'ILLEGAL_CHOICE'
  | 'BATTLE_FINISHED'
  | 'ENGINE_ERROR';

export type BattleIllegalChoiceReason =
  | 'wrong-request-kind'
  | 'wrong-action-count'
  | 'invalid-slot'
  | 'invalid-team-order'
  | 'unknown-move'
  | 'move-disabled'
  | 'invalid-target'
  | 'invalid-modifier'
  | 'switch-unavailable'
  | 'duplicate-switch'
  | 'pass-unavailable'
  /** A forced replacement was required but the command did not provide enough switches. */
  | 'switch-required'
  /** The engine reported the choice unavailable after the request changed (hidden trapping/disable). */
  | 'choice-unavailable';

export interface BattleErrorDetailsByCode {
  INVALID_CONFIG: { issues: readonly string[] };
  UNSUPPORTED_FORMAT: {
    /** The value the caller passed. */
    formatId: string;
    /**
     * - `not-in-catalog`: not a PokeStudio catalog id (this includes raw simulator ids).
     * - `blocked-by-vgc-runtime`: catalogued, but needs VGC-specific runtime support that does not exist yet.
     *   (The Doubles runtime itself exists; this blocker is specific to VGC rules.)
     * - `engine-unsupported`: test-only path: a simulator format the engine cannot run.
     */
    reason: 'not-in-catalog' | 'blocked-by-vgc-runtime' | 'engine-unsupported';
  };
  /** `problems` are display/debug text only. Never parse them. */
  INVALID_TEAM: { side: BattleSideId; problems: readonly string[] };
  INVALID_SIDE: { received: string };
  NOT_ACCEPTING_CHOICE: { side: BattleSideId };
  CHOICE_ALREADY_SUBMITTED: { side: BattleSideId };
  ILLEGAL_CHOICE: {
    side: BattleSideId;
    reason: BattleIllegalChoiceReason;
    slot?: BattleSlotRef;
  };
  BATTLE_FINISHED: Record<string, never>;
  /** An engine invariant was broken (adapter bug or simulator failure). See `cause`. */
  ENGINE_ERROR: { operation: string };
}

/**
 * The only error type this package throws on purpose. Branch on `code` (and typed `details`);
 * never on `message`, which is human text and not a contract.
 */
export class BattleDomainError<C extends BattleErrorCode = BattleErrorCode> extends Error {
  readonly code: C;
  readonly details: BattleErrorDetailsByCode[C];

  constructor(code: C, details: BattleErrorDetailsByCode[C], message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'BattleDomainError';
    this.code = code;
    this.details = details;
  }
}

export function isBattleDomainError<C extends BattleErrorCode>(
  error: unknown,
  code: C,
): error is BattleDomainError<C> {
  return error instanceof BattleDomainError && error.code === code;
}

/** Internal convenience for building a typed error. */
export function battleError<C extends BattleErrorCode>(
  code: C,
  details: BattleErrorDetailsByCode[C],
  message: string,
  cause?: unknown,
): BattleDomainError<C> {
  return new BattleDomainError(code, details, message, cause);
}
