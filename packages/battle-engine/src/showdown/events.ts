import type {
  BattleBoostId,
  BattleCause,
  BattleEvent,
  BattleHp,
  BattleMajorStatus,
  BattlePerspective,
  BattlePokemonRef,
  BattleResult,
  BattleSideId,
} from '../types';
import { parseHpText, parseIdent, parseLine, toId, type ParsedIdent } from './protocol';
import { RevealedTracker } from './tracker';

const STATUSES: readonly string[] = ['brn', 'par', 'slp', 'frz', 'psn', 'tox'];
const BOOSTS: readonly string[] = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];

/** Removes the `seq` key from a member of the event union without collapsing the union. */
type EventBody = BattleEvent extends infer E
  ? E extends unknown
    ? Omit<E, 'seq' | 'turn' | 'parentSeq' | 'cause'>
    : never
  : never;

/** `move: X` / `ability: X` / `item: X` → kind + id; anything else is a plain condition. */
function effectOf(text: string): { kind: BattleCause['kind']; id: string } {
  const match = /^(move|ability|item): (.+)$/.exec(text);
  return match
    ? { kind: match[1] as 'move' | 'ability' | 'item', id: toId(match[2] as string) }
    : { kind: 'condition', id: toId(text) };
}

/** The `[from] EFFECT` / `[of] SOURCE` tags of a line, as a cause. */
function causeOf(tags: Record<string, string>): BattleCause | undefined {
  const from = tags['from'];
  if (!from) return undefined;
  const source = parseIdent(tags['of']);
  return { ...effectOf(from), ...(source ? { source: refOf(source) } : {}) };
}

/** Events that begin an action; what follows them (until the next action) is their consequence. */
const ACTION_EVENTS = new Set(['move-used', 'switched', 'move-prevented']);

/** Structural events: they open or close a phase and are never the consequence of an action. */
const PARENTLESS_EVENTS = new Set([
  'battle-started',
  'team-preview',
  'turn-started',
  'battle-ended',
]);

const refOf = (ident: ParsedIdent): BattlePokemonRef => ({
  side: ident.side,
  teamIndex: ident.teamIndex,
});

/**
 * Turns one audience's protocol lines into minimal structured events and keeps that audience's
 * `RevealedTracker` up to date. One instance per perspective. Lines it does not understand are
 * dropped here — they never surface as public events.
 */
export class ChannelProcessor {
  readonly tracker = new RevealedTracker();
  readonly events: BattleEvent[] = [];
  private turn = 0;
  private started = false;
  /** `seq` of the action currently being resolved, for `parentSeq`. */
  private actionSeq: number | null = null;
  /** True while `actionSeq` is a switch-in ability effect rather than a move or switch. */
  private effectAnchor = false;
  /** Switch events since the last move/turn, by Pokémon, for linking switch-in abilities. */
  private readonly switchSeq = new Map<string, number>();

  constructor(
    private readonly perspective: BattlePerspective,
    /** Max HP lookup for exact-HP lines that omit it (`0 fnt`). Only consulted for exact views. */
    private readonly maxHpOf: (ref: BattlePokemonRef) => number | undefined,
    private readonly resultFromWinner: (winner: string) => BattleResult,
  ) {}

  get cursor(): number {
    return this.events.length;
  }

  feed(lines: readonly string[]) {
    for (const raw of lines) {
      const line = parseLine(raw);
      if (!line) continue;
      this.tracker.observe(line);
      // The simulator separates the action phase from the end-of-turn phase with an empty line
      // (and closes the turn with `|upkeep|`): residual effects belong to no action.
      if (line.command === '' || line.command === 'upkeep') this.resetAction();
      const body = this.toEvent(line);
      if (!body) continue;
      const seq = this.events.length + 1;
      const cause = causeOf(line.tags);
      const parentSeq = this.parentFor(body);
      this.events.push({
        ...body,
        seq,
        turn: this.turn,
        ...(parentSeq === undefined ? {} : { parentSeq }),
        ...(cause ? { cause } : {}),
      } as BattleEvent);
      this.advance(body, seq, parentSeq);
    }
  }

  private resetAction() {
    this.actionSeq = null;
    this.effectAnchor = false;
    this.switchSeq.clear();
  }

  private pokemonKey = (body: EventBody) =>
    'pokemon' in body && body.pokemon ? `${body.pokemon.side}:${body.pokemon.teamIndex}` : null;

  /**
   * The action an event happened under. Switch-in abilities are the one refinement: the simulator
   * lists every switch first and the abilities afterwards, so an ability effect is linked to its own
   * Pokémon's switch, and what it causes (Intimidate's drops, Defiant's answer) to that effect.
   */
  private parentFor(body: EventBody): number | undefined {
    if (ACTION_EVENTS.has(body.type) || PARENTLESS_EVENTS.has(body.type)) return undefined;
    if (body.type === 'effect-activated') {
      if (this.effectAnchor && this.actionSeq !== null) return this.actionSeq;
      const key = this.pokemonKey(body);
      const own = key ? this.switchSeq.get(key) : undefined;
      if (own !== undefined) return own;
    }
    return this.actionSeq ?? undefined;
  }

  private advance(body: EventBody, seq: number, parentSeq: number | undefined) {
    switch (body.type) {
      case 'switched':
        this.actionSeq = seq;
        this.effectAnchor = false;
        this.switchSeq.set(`${body.pokemon.side}:${body.pokemon.teamIndex}`, seq);
        return;
      case 'move-used':
      case 'move-prevented':
        this.actionSeq = seq;
        this.effectAnchor = false;
        this.switchSeq.clear();
        return;
      case 'turn-started':
        this.resetAction();
        return;
      case 'effect-activated': {
        // Only an effect that answers a switch-in (or another such effect) becomes an anchor.
        const key = this.pokemonKey(body);
        const answersSwitch =
          this.effectAnchor ||
          (key !== null && parentSeq !== undefined && parentSeq === this.switchSeq.get(key));
        if (answersSwitch) {
          this.actionSeq = seq;
          this.effectAnchor = true;
        }
        return;
      }
      default:
        return;
    }
  }

  private hp(ref: BattlePokemonRef, text: string | undefined): BattleHp | null {
    const parsed = text ? parseHpText(text) : null;
    if (!parsed) return null;
    const exact = this.perspective === 'omniscient' || this.perspective === ref.side;
    if (exact) {
      const max = parsed.max ?? this.maxHpOf(ref);
      return max === undefined ? null : { kind: 'exact', current: parsed.current, max };
    }
    if (parsed.max === undefined || parsed.max === 0) {
      return { kind: 'percent', percent: parsed.current === 0 ? 0 : 1 };
    }
    return { kind: 'percent', percent: Math.round((parsed.current * 100) / parsed.max) };
  }

  private toEvent(line: {
    command: string;
    args: string[];
    tags: Record<string, string>;
  }): EventBody | null {
    const { command, args, tags } = line;
    const ident = parseIdent(args[0]);
    switch (command) {
      case 'gametype':
        if (this.started) return null;
        this.started = true;
        return { type: 'battle-started' };
      case 'teampreview':
        return { type: 'team-preview' };
      case 'turn': {
        const turn = Number.parseInt(args[0] ?? '', 10);
        if (Number.isNaN(turn)) return null;
        this.turn = turn;
        return { type: 'turn-started' };
      }
      case 'switch':
      case 'drag': {
        if (!ident || ident.position === null) return null;
        return {
          type: 'switched',
          slot: { side: ident.side, position: ident.position },
          pokemon: refOf(ident),
          forced: command === 'drag',
        };
      }
      case 'swap': {
        const position = Number(args[1]);
        if (!ident || !Number.isInteger(position)) return null;
        return {
          type: 'position-swapped',
          pokemon: refOf(ident),
          slot: { side: ident.side, position },
        };
      }
      case 'move': {
        const moveId = args[1] ? toId(args[1]) : '';
        if (!ident || !moveId) return null;
        const target = parseIdent(args[2]);
        return target
          ? { type: 'move-used', user: refOf(ident), moveId, target: refOf(target) }
          : { type: 'move-used', user: refOf(ident), moveId };
      }
      case '-damage':
      case '-heal':
      case '-sethp': {
        if (!ident) return null;
        const hp = this.hp(refOf(ident), args[1]);
        const change = command === '-damage' ? 'damage' : command === '-heal' ? 'heal' : 'set';
        return hp ? { type: 'hp-changed', pokemon: refOf(ident), hp, change } : null;
      }
      case '-miss': {
        const target = parseIdent(args[1]);
        return ident && target
          ? { type: 'move-missed', user: refOf(ident), target: refOf(target) }
          : null;
      }
      case '-fail': {
        if (!ident) return null;
        const moveId = args[1] ? effectOf(args[1]).id : '';
        return moveId
          ? { type: 'move-failed', pokemon: refOf(ident), moveId }
          : { type: 'move-failed', pokemon: refOf(ident) };
      }
      case 'cant': {
        const reason = args[1] ? effectOf(args[1]).id : '';
        if (!ident || !reason) return null;
        const moveId = args[2] ? toId(args[2]) : '';
        return moveId
          ? { type: 'move-prevented', pokemon: refOf(ident), reason, moveId }
          : { type: 'move-prevented', pokemon: refOf(ident), reason };
      }
      case '-immune':
        return ident ? { type: 'immune', pokemon: refOf(ident) } : null;
      case '-crit':
        return ident ? { type: 'critical-hit', pokemon: refOf(ident) } : null;
      case '-supereffective':
      case '-resisted':
        return ident
          ? {
              type: 'effectiveness',
              pokemon: refOf(ident),
              result: command === '-supereffective' ? 'super-effective' : 'resisted',
            }
          : null;
      case '-start':
      case '-end': {
        const id = args[1] ? effectOf(args[1]).id : '';
        if (!ident || !id) return null;
        return {
          type: command === '-start' ? 'volatile-started' : 'volatile-ended',
          pokemon: refOf(ident),
          id,
        };
      }
      case '-activate':
      case '-ability':
      case '-block': {
        const raw = args[1];
        if (!ident || !raw) return null;
        const effect =
          command === '-ability' ? { kind: 'ability' as const, id: toId(raw) } : effectOf(raw);
        return effect.id ? { type: 'effect-activated', pokemon: refOf(ident), effect } : null;
      }
      case '-item':
      case '-enditem': {
        const item = args[1] ? toId(args[1]) : '';
        if (!ident || !item) return null;
        const from = tags['from'] ?? '';
        const change =
          command === '-item'
            ? 'gained'
            : from.startsWith('move:') && tags['eat'] === undefined
              ? 'removed'
              : 'consumed';
        return { type: 'item-changed', pokemon: refOf(ident), item, change };
      }
      case '-terastallize':
        return ident && args[1]
          ? { type: 'terastallized', pokemon: refOf(ident), teraType: args[1] }
          : null;
      case 'detailschange':
      case '-formechange': {
        const species = (args[1] ?? '').split(', ')[0] ?? '';
        return ident && species ? { type: 'forme-changed', pokemon: refOf(ident), species } : null;
      }
      case 'faint':
        return ident ? { type: 'fainted', pokemon: refOf(ident) } : null;
      case '-status': {
        const status = args[1];
        return ident && status && STATUSES.includes(status)
          ? { type: 'status-changed', pokemon: refOf(ident), status: status as BattleMajorStatus }
          : null;
      }
      case '-curestatus':
        return ident ? { type: 'status-changed', pokemon: refOf(ident), status: null } : null;
      case '-boost':
      case '-unboost': {
        const stat = args[1];
        const amount = Number(args[2]);
        if (!ident || !stat || !BOOSTS.includes(stat) || !Number.isFinite(amount)) return null;
        return {
          type: 'stat-boosted',
          pokemon: refOf(ident),
          stat: stat as BattleBoostId,
          delta: command === '-boost' ? amount : -amount,
        };
      }
      case '-weather': {
        if (tags['upkeep'] !== undefined) return null;
        const name = args[0] ?? 'none';
        return { type: 'field-changed', field: 'weather', id: toId(name), active: name !== 'none' };
      }
      case '-fieldstart':
      case '-fieldend': {
        const id = toId((args[0] ?? '').replace(/^move: /, ''));
        return {
          type: 'field-changed',
          field: id.endsWith('terrain') ? 'terrain' : 'pseudo-weather',
          id,
          active: command === '-fieldstart',
        };
      }
      case '-sidestart':
      case '-sideend': {
        const side = /^p([12])/.exec(args[0] ?? '');
        if (!side) return null;
        return {
          type: 'field-changed',
          field: 'side-condition',
          id: toId((args[1] ?? '').replace(/^move: /, '')),
          active: command === '-sidestart',
          side: (side[1] === '1' ? 'p1' : 'p2') as BattleSideId,
        };
      }
      case 'win':
        return { type: 'battle-ended', result: this.resultFromWinner(args[0] ?? '') };
      case 'tie':
        return { type: 'battle-ended', result: { kind: 'tie' } };
      default:
        return null;
    }
  }
}
