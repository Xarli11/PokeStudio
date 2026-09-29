import type { BattleEvent } from './types';

/**
 * Turns the structured trace into what the timeline and the Turn Inspector show. Pure and
 * deterministic: everything derives from the events (no text parsing, no LLM).
 */

type Hp = Extract<BattleEvent, { type: 'hp-changed' }>['hp'];
type Ref = { side: 'p1' | 'p2'; teamIndex: number };

export const refKey = (ref: Ref) => `${ref.side}:${ref.teamIndex}`;

/** An action (a move, a switch or a prevented move) and everything that happened under it. */
export interface TurnAction {
  action: BattleEvent;
  children: BattleEvent[];
}

export interface HpChange {
  pokemon: Ref;
  before: Hp;
  after: Hp;
}

export interface TurnSummary {
  turn: number;
  /** Structural events of this turn (turn/battle boundaries, team preview). */
  markers: BattleEvent[];
  actions: TurnAction[];
  /** Events under no action: end-of-turn effects such as weather, status damage and Leftovers. */
  residual: BattleEvent[];
  /** Per Pokémon: HP at the start of the turn and at its end (only those that changed). */
  hp: HpChange[];
  /** The sequence range of the turn in its perspective's stream. */
  firstSeq: number;
  lastSeq: number;
}

const ACTIONS = new Set(['move-used', 'switched', 'move-prevented']);
const MARKERS = new Set(['battle-started', 'team-preview', 'turn-started', 'battle-ended']);

/** A Pokémon starts every battle at full HP, so an unseen "before" is 100% (or its max). */
function fullHp(after: Hp): Hp {
  return after.kind === 'exact'
    ? { kind: 'exact', current: after.max, max: after.max }
    : { kind: 'percent', percent: 100 };
}

/** Groups a perspective's events into turns. Turn 0 holds the preview and the lead switches. */
export function buildTurns(events: readonly BattleEvent[]): TurnSummary[] {
  const byTurn = new Map<number, BattleEvent[]>();
  for (const event of events) {
    const list = byTurn.get(event.turn) ?? [];
    list.push(event);
    byTurn.set(event.turn, list);
  }
  const lastKnown = new Map<string, Hp>();
  const summaries: TurnSummary[] = [];

  for (const turn of [...byTurn.keys()].sort((a, b) => a - b)) {
    const list = byTurn.get(turn)!;
    const bySeq = new Map(list.map((e) => [e.seq, e]));
    const actions: TurnAction[] = [];
    const actionOf = new Map<number, TurnAction>();
    const markers: BattleEvent[] = [];
    const residual: BattleEvent[] = [];
    const firstHp = new Map<string, { before: Hp; after: Hp; pokemon: Ref }>();

    for (const event of list) {
      if (event.type === 'hp-changed') {
        const key = refKey(event.pokemon);
        const existing = firstHp.get(key);
        firstHp.set(key, {
          pokemon: event.pokemon,
          before: existing?.before ?? lastKnown.get(key) ?? fullHp(event.hp),
          after: event.hp,
        });
        lastKnown.set(key, event.hp);
      }
      if (ACTIONS.has(event.type)) {
        const entry: TurnAction = { action: event, children: [] };
        actions.push(entry);
        actionOf.set(event.seq, entry);
      } else if (MARKERS.has(event.type)) {
        markers.push(event);
      } else if (event.parentSeq !== undefined) {
        // A child of an action, or of an effect that answers a switch: attach to the root action.
        let parent = bySeq.get(event.parentSeq);
        while (parent && !actionOf.has(parent.seq) && parent.parentSeq !== undefined) {
          parent = bySeq.get(parent.parentSeq);
        }
        const entry = parent ? actionOf.get(parent.seq) : undefined;
        if (entry) entry.children.push(event);
        else residual.push(event);
      } else {
        residual.push(event);
      }
    }

    summaries.push({
      turn,
      markers,
      actions,
      residual,
      hp: [...firstHp.values()].filter(
        (entry) => JSON.stringify(entry.before) !== JSON.stringify(entry.after),
      ),
      firstSeq: list[0]!.seq,
      lastSeq: list.at(-1)!.seq,
    });
  }
  return summaries;
}
