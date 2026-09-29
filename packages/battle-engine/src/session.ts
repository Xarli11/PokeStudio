import { randomUUID } from 'node:crypto';

import { battleError, BattleDomainError } from './errors';
import {
  analyzeRequest,
  commandToChoiceString,
  requestKindOf,
  toLegalChoices,
} from './showdown/choice';
import type { Decision, RequestView } from './showdown/choice';
import { createShowdownBattle, SIDE_IDS, SHOWDOWN_SIDE_NAME } from './showdown/create';
import type { ShowdownBattleBundle, ShowdownPokemon } from './showdown/create';
import { ChannelProcessor } from './showdown/events';
import { projectSide } from './showdown/project';
import type { ProjectionContext } from './showdown/project';
import { splitChannels } from './showdown/protocol';
import type {
  BattleCommand,
  BattleConfig,
  BattleEvent,
  BattleInfo,
  BattleLegalChoices,
  BattlePerspective,
  BattlePokemonRef,
  BattleRequestSummary,
  BattleResult,
  BattleSession,
  BattleSideHandle,
  BattleSideId,
  BattleState,
  BattleSubmitResult,
} from './types';

/** Singles-only runtime for now: exactly one active slot per side. */
const ACTIVE_PER_SIDE = 1;
const PERSPECTIVES: readonly BattlePerspective[] = ['p1', 'p2', 'spectator', 'omniscient'];

const isSideId = (value: unknown): value is BattleSideId => value === 'p1' || value === 'p2';
const isPerspective = (value: unknown): value is BattlePerspective =>
  typeof value === 'string' && (PERSPECTIVES as readonly string[]).includes(value);

/** @internal Exported for unit tests only; not re-exported from `index.ts`. */
export function resultFromWinner(winner: string): BattleResult {
  if (winner === SHOWDOWN_SIDE_NAME.p1) return { kind: 'win', winner: 'p1' };
  if (winner === SHOWDOWN_SIDE_NAME.p2) return { kind: 'win', winner: 'p2' };
  return { kind: 'tie' };
}

function isCommandShape(command: unknown): command is BattleCommand {
  if (typeof command !== 'object' || command === null) return false;
  const value = command as { kind?: unknown; order?: unknown; actions?: unknown };
  if (value.kind === 'team-order') return Array.isArray(value.order);
  if (value.kind !== 'actions' || !Array.isArray(value.actions)) return false;
  return value.actions.every(
    (action: unknown) =>
      typeof action === 'object' &&
      action !== null &&
      typeof (action as { slot?: unknown }).slot === 'object' &&
      (action as { slot?: unknown }).slot !== null,
  );
}

/** Simulator input logs for parity tests, kept off the session object so nothing can reach them at runtime. */
const inputLogAccessors = new WeakMap<BattleSession, () => readonly string[]>();

class ShowdownBattleSession implements BattleSession {
  readonly info: BattleInfo;
  readonly #pending: string[];
  readonly #battle: ShowdownBattleBundle['battle'];
  readonly #refs: ShowdownBattleBundle['refs'];
  readonly #pokemonByRef = new Map<string, ShowdownPokemon>();
  readonly #ctx: ProjectionContext;
  readonly #processors: Record<BattlePerspective, ChannelProcessor>;
  readonly #submitted: Record<BattleSideId, boolean> = { p1: false, p2: false };

  constructor(config: BattleConfig, bundle: ShowdownBattleBundle, pending: string[]) {
    this.#pending = pending;
    this.#battle = bundle.battle;
    this.#refs = bundle.refs;
    for (const [pokemon, ref] of bundle.refs)
      this.#pokemonByRef.set(`${ref.side}:${ref.teamIndex}`, pokemon);
    this.info = Object.freeze({
      battleId: randomUUID(),
      format: Object.freeze({ ...bundle.format }),
      seed: bundle.seed,
    });
    this.#ctx = {
      battle: this.#battle,
      refs: this.#refs,
      displayNames: { p1: config.sides.p1.displayName, p2: config.sides.p2.displayName },
      nicknames: {
        p1: config.sides.p1.team.members.map((member) => member.nickname),
        p2: config.sides.p2.team.members.map((member) => member.nickname),
      },
    };
    const maxHpOf = (ref: BattlePokemonRef) =>
      this.#pokemonByRef.get(`${ref.side}:${ref.teamIndex}`)?.maxhp;
    const processor = (perspective: BattlePerspective) =>
      new ChannelProcessor(perspective, maxHpOf, resultFromWinner);
    this.#processors = {
      p1: processor('p1'),
      p2: processor('p2'),
      spectator: processor('spectator'),
      omniscient: processor('omniscient'),
    };
    inputLogAccessors.set(this, () => [...bundle.battle.inputLog]);
    this.#flush();
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** Flushes the simulator's pending output into every perspective's event stream/tracker. */
  #flush() {
    this.#battle.sendUpdates();
    for (const chunk of this.#pending.splice(0)) {
      const channels = splitChannels(chunk);
      this.#processors.omniscient.feed(channels[-1]);
      this.#processors.spectator.feed(channels[0]);
      this.#processors.p1.feed(channels[1]);
      this.#processors.p2.feed(channels[2]);
    }
  }

  #assertSide(side: unknown): asserts side is BattleSideId {
    if (!isSideId(side)) {
      throw battleError(
        'INVALID_SIDE',
        { received: String(side) },
        `Unknown battle side "${String(side)}"`,
      );
    }
  }

  #assertPerspective(perspective: unknown): asserts perspective is BattlePerspective {
    if (!isPerspective(perspective)) {
      throw battleError(
        'INVALID_SIDE',
        { received: String(perspective) },
        `Unknown perspective "${String(perspective)}"`,
      );
    }
  }

  #assertNotFinished() {
    if (this.#battle.ended) throw battleError('BATTLE_FINISHED', {}, 'The battle has finished');
  }

  #decision(side: BattleSideId): Decision {
    const showdownSide = this.#battle.getSide(side);
    const refs = showdownSide.pokemon.map((pokemon) => {
      const ref = this.#refs.get(pokemon);
      if (!ref) throw new Error('Pokémon without a stable identity');
      return ref;
    });
    return analyzeRequest(
      showdownSide.activeRequest as RequestView | null,
      side,
      refs,
      ACTIVE_PER_SIDE,
    );
  }

  #requestSummary(side: BattleSideId): BattleRequestSummary {
    return {
      kind: requestKindOf(this.#battle.getSide(side).activeRequest as RequestView | null),
      submitted: this.#submitted[side],
    };
  }

  // ── public API ────────────────────────────────────────────────────────────

  getState(perspective: BattlePerspective): BattleState {
    this.#assertPerspective(perspective);
    const tracker = this.#processors[perspective].tracker;
    const finished = this.#battle.ended;
    const visibleSides: readonly BattleSideId[] =
      perspective === 'omniscient' ? SIDE_IDS : isSideId(perspective) ? [perspective] : [];
    const requests: BattleState['requests'] = {};
    if (!finished) for (const side of visibleSides) requests[side] = this.#requestSummary(side);
    return {
      battleId: this.info.battleId,
      perspective,
      format: { ...this.info.format },
      generation: this.info.format.generation,
      gameType: this.info.format.gameType,
      status: finished ? 'finished' : 'awaiting-choices',
      turn: this.#battle.turn,
      sides: {
        p1: projectSide(this.#ctx, 'p1', perspective, tracker),
        p2: projectSide(this.#ctx, 'p2', perspective, tracker),
      },
      field: {
        weather: tracker.weather ? { id: tracker.weather } : null,
        terrain: tracker.terrain ? { id: tracker.terrain } : null,
        pseudoWeather: tracker.conditions(tracker.pseudoWeather),
      },
      requests,
      result: finished ? resultFromWinner(this.#battle.winner ?? '') : null,
      eventCursor: this.#processors[perspective].cursor,
    };
  }

  getLegalChoices(side: BattleSideId): BattleLegalChoices {
    this.#assertSide(side);
    this.#assertNotFinished();
    return toLegalChoices(this.#decision(side));
  }

  submitChoice(side: BattleSideId, command: BattleCommand): BattleSubmitResult {
    this.#assertSide(side);
    this.#assertNotFinished();
    const decision = this.#decision(side);
    if (decision.kind === 'wait') {
      throw battleError(
        'NOT_ACCEPTING_CHOICE',
        { side },
        `${side} is not being asked for a choice`,
      );
    }
    if (this.#submitted[side]) {
      // Enforced here, independent of the simulator's own "Cancel Mod" replace-choice behavior.
      throw battleError(
        'CHOICE_ALREADY_SUBMITTED',
        { side },
        `${side} already submitted a choice for this decision`,
      );
    }
    if (!isCommandShape(command)) {
      throw battleError(
        'ILLEGAL_CHOICE',
        { side, reason: 'wrong-request-kind' },
        'Malformed command',
      );
    }
    const choice = commandToChoiceString(decision, command);

    const showdownSide = this.#battle.getSide(side);
    const requestBefore = showdownSide.activeRequest;
    const eventsBefore = this.#processors[side].cursor;
    let accepted: boolean;
    try {
      accepted = this.#battle.choose(side, choice);
      this.#flush();
    } catch (cause) {
      throw battleError(
        'ENGINE_ERROR',
        { operation: 'submitChoice' },
        'The engine failed while resolving',
        cause,
      );
    }
    if (!accepted) {
      // A choice we validated was rejected. If the engine also refreshed the request (hidden
      // trapping/disable information), the choice became unavailable; otherwise we broke an invariant.
      if ((showdownSide.activeRequest as { update?: boolean } | null)?.update === true) {
        throw battleError(
          'ILLEGAL_CHOICE',
          { side, reason: 'choice-unavailable' },
          'Choice became unavailable',
        );
      }
      throw battleError(
        'ENGINE_ERROR',
        { operation: 'submitChoice' },
        'The engine rejected a validated choice',
      );
    }

    // A committed decision replaces every request object (or ends the battle).
    const resolved = this.#battle.ended || showdownSide.activeRequest !== requestBefore;
    if (resolved) {
      this.#submitted.p1 = false;
      this.#submitted.p2 = false;
    } else {
      this.#submitted[side] = true;
    }
    return {
      resolved,
      state: this.getState(side),
      events: structuredClone(this.#processors[side].events.slice(eventsBefore)),
    };
  }

  getEvents(perspective: BattlePerspective, afterSeq = 0): readonly BattleEvent[] {
    this.#assertPerspective(perspective);
    if (!Number.isInteger(afterSeq) || afterSeq < 0) {
      throw battleError(
        'INVALID_CONFIG',
        { issues: ['afterSeq must be a non-negative integer'] },
        'Invalid afterSeq',
      );
    }
    return structuredClone(this.#processors[perspective].events.slice(afterSeq));
  }

  forSide(side: BattleSideId): BattleSideHandle {
    this.#assertSide(side);
    return Object.freeze({
      side,
      getState: () => this.getState(side),
      getLegalChoices: () => this.getLegalChoices(side),
      submitChoice: (command: BattleCommand) => this.submitChoice(side, command),
      getEvents: (afterSeq?: number) => this.getEvents(side, afterSeq),
    });
  }
}

/**
 * Creates an authoritative, ready-to-play battle. Synchronous. Throws `BattleDomainError` for
 * invalid config, unsupported format or invalid teams. Runtime target: Node, server-side.
 */
export function createBattle(config: BattleConfig): BattleSession {
  const pending: string[] = [];
  const bundle = createShowdownBattle(config, (type, data) => {
    if (type === 'update') pending.push(Array.isArray(data) ? data.join('\n') : data);
  });
  try {
    return new ShowdownBattleSession(config, bundle, pending);
  } catch (cause) {
    if (cause instanceof BattleDomainError) throw cause;
    throw battleError(
      'ENGINE_ERROR',
      { operation: 'create' },
      'Failed to initialize the battle',
      cause,
    );
  }
}

/** @internal Test-only accessor; deliberately not re-exported from `index.ts`. */
export function inputLogForTests(session: BattleSession): readonly string[] {
  const accessor = inputLogAccessors.get(session);
  if (!accessor) throw new Error('not a battle-engine session');
  return accessor();
}
