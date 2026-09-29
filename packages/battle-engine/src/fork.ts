import { BattleDomainError } from './errors';
import { parseBattleReplay, restoreBattle } from './replay';
import type { BattleCommand, BattleSession, BattleSideId } from './types';

export interface ForkOptions {
  /** The 0-based decision boundary to fork from: the alternative starts just BEFORE it. */
  atDecision: number;
  /** The side whose command is replaced. */
  side: BattleSideId;
  /** The alternative command. Must be legal at the boundary, or the fork is rejected. */
  command: BattleCommand;
}

export interface BattleFork {
  /** A new, independent, live session: the original history up to the boundary plus the alternative. */
  session: BattleSession;
  atDecision: number;
  /** Sides whose ORIGINAL command was applied again (it was still legal). */
  reused: BattleSideId[];
  /** Sides that still owe a command for this decision (their original was missing or no longer legal). */
  pending: BattleSideId[];
}

const legalityFailures = new Set(['ILLEGAL_CHOICE', 'NOT_ACCEPTING_CHOICE']);

/**
 * Forks a battle at a decision: restores it to the boundary before `atDecision`, applies `command`
 * for `side`, then re-applies the other side's original command for that decision if it is still
 * legal. Nothing is recommended or evaluated; it only produces the alternative line.
 *
 * The replay is only read (it is copied first), so the original is never mutated and the fork is a
 * separate session with its own history. Throws `INVALID_REPLAY` (`decision-out-of-range` included)
 * for a bad replay or decision point and the session's own typed error for an illegal replacement.
 */
export function forkBattle(input: unknown, options: ForkOptions): BattleFork {
  const replay = parseBattleReplay(input);
  const session = restoreBattle(replay, { atDecision: options.atDecision });
  let resolved = session.submitChoice(options.side, options.command).resolved;

  const reused: BattleSideId[] = [];
  const original = replay.commands.filter(
    (entry) => entry.decision === options.atDecision && entry.side !== options.side,
  );
  for (const entry of original) {
    try {
      resolved = session.submitChoice(entry.side, entry.command).resolved || resolved;
      reused.push(entry.side);
    } catch (error) {
      if (!(error instanceof BattleDomainError) || !legalityFailures.has(error.code)) throw error;
    }
  }

  const pending: BattleSideId[] = [];
  // Once the decision resolved, open requests belong to the NEXT decision, not to this one.
  if (!resolved) {
    for (const side of ['p1', 'p2'] as const) {
      const asked = session.getLegalChoices(side).kind !== 'wait';
      if (asked && session.getState(side).requests[side]?.submitted !== true) pending.push(side);
    }
  }
  return { session, atDecision: options.atDecision, reused, pending };
}
