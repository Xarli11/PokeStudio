import type {
  BattleBoostId,
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
    ? Omit<E, 'seq' | 'turn'>
    : never
  : never;

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
      const body = this.toEvent(line);
      if (body)
        this.events.push({ ...body, seq: this.events.length + 1, turn: this.turn } as BattleEvent);
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
        return hp ? { type: 'hp-changed', pokemon: refOf(ident), hp } : null;
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
