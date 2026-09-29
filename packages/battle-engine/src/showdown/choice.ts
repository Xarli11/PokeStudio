import { battleError, type BattleIllegalChoiceReason } from '../errors';
import type {
  BattleCommand,
  BattleLegalChoices,
  BattleLegalOption,
  BattleMoveModifier,
  BattlePokemonRef,
  BattleRequestKind,
  BattleSideId,
  BattleSlotRef,
} from '../types';

/**
 * Request → structured legal choices, and structured command → simulator choice string.
 * Pure: works on a minimal structural view of the simulator's request, so it is unit-testable
 * with plain fixtures (including multi-slot ones) and never touches a live battle.
 */

export interface RequestMoveView {
  id: string;
  pp?: number | undefined;
  target?: string | undefined;
  disabled?: boolean | string | undefined;
}

export interface RequestActiveView {
  moves: readonly RequestMoveView[];
  trapped?: boolean | undefined;
  canTerastallize?: string | undefined;
}

export interface RequestView {
  wait?: boolean | undefined;
  teamPreview?: boolean | undefined;
  maxChosenTeamSize?: number | undefined;
  forceSwitch?: readonly boolean[] | undefined;
  active?: readonly RequestActiveView[] | undefined;
  side: {
    pokemon: readonly { condition: string; active: boolean }[];
  };
}

interface MoveSpec {
  id: string;
  /** 1-based position in the request's move list (what the simulator's `move N` expects). */
  index: number;
  enabled: boolean;
  pp: number;
  targets: BattleSlotRef[] | null;
  modifiers: BattleMoveModifier[];
}

interface SlotSpec {
  slot: BattleSlotRef;
  pokemon: BattlePokemonRef | null;
  moves: MoveSpec[];
  switches: BattlePokemonRef[];
  canPass: boolean;
}

/** Everything needed both to describe legal choices and to validate/serialize a command. */
export interface Decision {
  kind: BattleRequestKind;
  side: BattleSideId;
  pick: number;
  of: number;
  slots: SlotSpec[];
  /** `refs[i]` = ref of the Pokémon at request position `i` (simulator numbering is position + 1). */
  refs: readonly BattlePokemonRef[];
}

const sameRef = (a: BattlePokemonRef, b: BattlePokemonRef) =>
  a.side === b.side && a.teamIndex === b.teamIndex;
const sameSlot = (a: BattleSlotRef, b: BattleSlotRef) =>
  a.side === b.side && a.position === b.position;

export function requestKindOf(request: RequestView | null): BattleRequestKind {
  if (!request || request.wait) return 'wait';
  if (request.teamPreview) return 'team-preview';
  if (request.forceSwitch) return 'forced-switch';
  return 'move';
}

function targetSlots(
  moveTarget: string | undefined,
  actor: BattleSlotRef,
  activePerSide: number,
): BattleSlotRef[] | null {
  // Singles: a single foe is auto-targeted, no choice exists.
  if (activePerSide <= 1) return null;
  const foe: BattleSideId = actor.side === 'p1' ? 'p2' : 'p1';
  const foes = Array.from({ length: activePerSide }, (_, position) => ({ side: foe, position }));
  const allies = Array.from({ length: activePerSide }, (_, position) => ({
    side: actor.side,
    position,
  })).filter((slot) => slot.position !== actor.position);
  switch (moveTarget) {
    case 'normal':
    case 'any':
      return [...foes, ...allies];
    case 'adjacentFoe':
      return foes;
    case 'adjacentAlly':
      return allies;
    case 'adjacentAllyOrSelf':
      return [{ side: actor.side, position: actor.position }, ...allies];
    default:
      return null;
  }
}

function isFainted(condition: string | undefined): boolean {
  return condition?.endsWith(' fnt') ?? false;
}

export function analyzeRequest(
  request: RequestView | null,
  side: BattleSideId,
  refs: readonly BattlePokemonRef[],
  activePerSide: number,
): Decision {
  const kind = requestKindOf(request);
  const base = { kind, side, pick: 0, of: refs.length, slots: [] as SlotSpec[], refs };
  if (!request || kind === 'wait') return base;
  if (kind === 'team-preview') {
    return { ...base, pick: request.maxChosenTeamSize ?? refs.length };
  }

  const bench = (): BattlePokemonRef[] =>
    request.side.pokemon.flatMap((pokemon, index) => {
      const ref = refs[index];
      return ref && !pokemon.active && !isFainted(pokemon.condition) ? [ref] : [];
    });

  const slots: SlotSpec[] = [];
  for (let position = 0; position < activePerSide; position++) {
    const slot: BattleSlotRef = { side, position };
    const pokemon = refs[position] ?? null;
    if (kind === 'forced-switch') {
      const mustSwitch = request.forceSwitch?.[position] === true;
      slots.push({
        slot,
        pokemon,
        moves: [],
        switches: mustSwitch ? bench() : [],
        canPass: !mustSwitch,
      });
      continue;
    }
    const active = request.active?.[position];
    const fainted = isFainted(request.side.pokemon[position]?.condition);
    if (!active || fainted) {
      slots.push({ slot, pokemon, moves: [], switches: [], canPass: true });
      continue;
    }
    const modifiers: BattleMoveModifier[] = active.canTerastallize ? ['terastallize'] : [];
    slots.push({
      slot,
      pokemon,
      moves: active.moves.map((move, i) => ({
        id: move.id,
        index: i + 1,
        enabled: !move.disabled && (move.pp === undefined || move.pp > 0),
        pp: move.pp ?? 0,
        targets: targetSlots(move.target, slot, activePerSide),
        modifiers,
      })),
      switches: active.trapped ? [] : bench(),
      canPass: false,
    });
  }
  return { ...base, slots };
}

export function toLegalChoices(decision: Decision): BattleLegalChoices {
  const { kind, side } = decision;
  if (kind === 'wait') return { kind: 'wait', side };
  if (kind === 'team-preview') {
    return { kind: 'team-preview', side, pick: decision.pick, of: decision.of };
  }
  return {
    kind,
    side,
    slots: decision.slots.map((spec) => {
      const options: BattleLegalOption[] = [
        ...spec.moves
          .filter((move) => move.enabled)
          .map((move): BattleLegalOption => ({
            kind: 'move',
            moveId: move.id,
            pp: move.pp,
            targets: move.targets,
            modifiers: [...move.modifiers],
          })),
        ...spec.switches.map((pokemon): BattleLegalOption => ({ kind: 'switch', pokemon })),
        ...(spec.canPass ? [{ kind: 'pass' } as const] : []),
      ];
      return { slot: spec.slot, pokemon: spec.pokemon, options };
    }),
  };
}

function illegal(
  side: BattleSideId,
  reason: BattleIllegalChoiceReason,
  slot?: BattleSlotRef,
): never {
  throw battleError(
    'ILLEGAL_CHOICE',
    slot ? { side, reason, slot } : { side, reason },
    `Illegal choice for ${side}: ${reason}`,
  );
}

/** Simulator target location: negative = ally side, positive = foe side, 1-based slot number. */
function targetLoc(actor: BattleSlotRef, target: BattleSlotRef): number {
  return (target.side === actor.side ? -1 : 1) * (target.position + 1);
}

/**
 * Validates the WHOLE command against the decision, then translates it to the simulator's choice
 * string. Every rejection is a typed `ILLEGAL_CHOICE` with a structured reason.
 */
export function commandToChoiceString(decision: Decision, command: BattleCommand): string {
  const { side } = decision;
  if (command.kind === 'team-order') {
    if (decision.kind !== 'team-preview') illegal(side, 'wrong-request-kind');
    const order = command.order;
    const seen = new Set<number>();
    const valid =
      order.length === decision.pick &&
      order.every((teamIndex) => {
        const known = decision.refs.some((ref) => ref.teamIndex === teamIndex);
        const fresh = !seen.has(teamIndex);
        seen.add(teamIndex);
        return Number.isInteger(teamIndex) && known && fresh;
      });
    if (!valid) illegal(side, 'invalid-team-order');
    return `team ${order.map((teamIndex) => decision.refs.findIndex((r) => r.teamIndex === teamIndex) + 1).join(', ')}`;
  }

  if (decision.kind !== 'move' && decision.kind !== 'forced-switch') {
    illegal(side, 'wrong-request-kind');
  }
  if (command.actions.length !== decision.slots.length) illegal(side, 'wrong-action-count');

  const switchedIn: BattlePokemonRef[] = [];
  let usedModifier = false;
  const parts = command.actions.map((action, i) => {
    const spec = decision.slots[i];
    if (!spec || !sameSlot(action.slot, spec.slot)) illegal(side, 'invalid-slot', action.slot);
    switch (action.kind) {
      case 'pass': {
        if (!spec.canPass) illegal(side, 'pass-unavailable', spec.slot);
        return 'pass';
      }
      case 'switch': {
        if (!spec.switches.some((ref) => sameRef(ref, action.pokemon))) {
          illegal(side, 'switch-unavailable', spec.slot);
        }
        if (switchedIn.some((ref) => sameRef(ref, action.pokemon))) {
          illegal(side, 'duplicate-switch', spec.slot);
        }
        switchedIn.push(action.pokemon);
        const position = decision.refs.findIndex((ref) => sameRef(ref, action.pokemon));
        return `switch ${position + 1}`;
      }
      case 'move': {
        if (decision.kind !== 'move') illegal(side, 'wrong-request-kind', spec.slot);
        const move = spec.moves.find((candidate) => candidate.id === action.moveId);
        if (!move) illegal(side, 'unknown-move', spec.slot);
        if (!move.enabled) illegal(side, 'move-disabled', spec.slot);
        let text = `move ${move.index}`;
        if (move.targets === null) {
          if (action.target) illegal(side, 'invalid-target', spec.slot);
        } else {
          const target = action.target;
          if (!target || !move.targets.some((candidate) => sameSlot(candidate, target))) {
            illegal(side, 'invalid-target', spec.slot);
          }
          text += ` ${targetLoc(spec.slot, target)}`;
        }
        if (action.modifier) {
          if (!move.modifiers.includes(action.modifier) || usedModifier) {
            illegal(side, 'invalid-modifier', spec.slot);
          }
          usedModifier = true;
          text += ` ${action.modifier}`;
        }
        return text;
      }
    }
  });
  return parts.join(', ');
}
