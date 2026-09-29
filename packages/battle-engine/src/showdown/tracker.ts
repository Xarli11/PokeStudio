import { Teams } from './simulator';

import type { BattleCondition, BattleSideId } from '../types';
import { parseDetails, parseIdent, toId, type ProtocolLine } from './protocol';

export interface KnownPokemon {
  species: string;
  level: number;
  gender: 'M' | 'F' | 'N';
  /** True once it has been in battle (team preview shows species only; nicknames appear on switch-in). */
  switchedIn: boolean;
  moves: Set<string>;
  item?: string;
  ability?: string;
  /** Public once revealed by Open Team Sheets (or by Terastallizing). */
  teraType?: string;
}

const key = (side: BattleSideId, teamIndex: number) => `${side}:${teamIndex}`;

/**
 * What ONE audience has legitimately been told. It is fed only with the protocol lines that
 * audience's channel contains, so for the opposing side it never learns more than the battle
 * revealed. It also folds the public field state (weather, terrain, hazards…), which is public
 * by construction.
 */
export class RevealedTracker {
  private readonly known = new Map<string, KnownPokemon>();
  private readonly pokeLines: Record<BattleSideId, number> = { p1: 0, p2: 0 };
  weather: string | null = null;
  terrain: string | null = null;
  readonly pseudoWeather = new Map<string, number>();
  readonly sideConditions: Record<BattleSideId, Map<string, number>> = {
    p1: new Map(),
    p2: new Map(),
  };

  get(side: BattleSideId, teamIndex: number): KnownPokemon | undefined {
    return this.known.get(key(side, teamIndex));
  }

  private entry(side: BattleSideId, teamIndex: number): KnownPokemon | undefined {
    return this.known.get(key(side, teamIndex));
  }

  private setDetails(side: BattleSideId, teamIndex: number, details: string, inBattle: boolean) {
    const parsed = parseDetails(details);
    const existing = this.entry(side, teamIndex);
    if (existing) {
      existing.species = parsed.species;
      existing.level = parsed.level;
      existing.gender = parsed.gender;
      existing.switchedIn ||= inBattle;
    } else {
      this.known.set(key(side, teamIndex), { ...parsed, switchedIn: inBattle, moves: new Set() });
    }
  }

  /** Reveals through `[from] item: X` / `[from] ability: X` tags on any line. */
  private observeSourceTag(line: ProtocolLine) {
    const from = line.tags['from'];
    if (!from) return;
    const owner = parseIdent(line.tags['of'] ?? line.args[0]);
    if (!owner) return;
    const target = this.entry(owner.side, owner.teamIndex);
    if (!target) return;
    const item = /^item: (.+)$/.exec(from);
    const ability = /^ability: (.+)$/.exec(from);
    if (item) target.item = item[1] as string;
    if (ability) target.ability = ability[1] as string;
  }

  observe(line: ProtocolLine) {
    const { command, args } = line;
    switch (command) {
      case 'poke': {
        // Team preview: `|poke|p2|Species, L50, F|` in original team order.
        const side = args[0] === 'p1' ? 'p1' : args[0] === 'p2' ? 'p2' : null;
        if (side && args[1]) this.setDetails(side, this.pokeLines[side]++, args[1], false);
        return;
      }
      case 'showteam': {
        // Open Team Sheets: a public line carrying each side's whole packed team in team order
        // (before any lead is chosen). It reveals species, level, gender, item, ability, all four
        // moves and the Tera type — never stats/EVs/IVs or the nickname (the sheet has no name).
        const side = args[0] === 'p1' ? 'p1' : args[0] === 'p2' ? 'p2' : null;
        // The packed team itself contains `|` separators, so it spans the remaining fields.
        const packed = args.slice(1).join('|');
        const team = side && packed ? Teams.unpack(packed) : null;
        if (side && team) {
          team.forEach((set, teamIndex) => {
            const gender = set.gender === 'M' || set.gender === 'F' ? `, ${set.gender}` : '';
            this.setDetails(
              side,
              teamIndex,
              `${set.species}, L${set.level ?? 100}${gender}`,
              false,
            );
            const known = this.entry(side, teamIndex);
            if (!known) return;
            for (const move of set.moves) known.moves.add(toId(move));
            if (set.item) known.item = set.item;
            if (set.ability) known.ability = set.ability;
            if (set.teraType) known.teraType = set.teraType;
          });
        }
        return;
      }
      case 'switch':
      case 'drag':
      case 'replace':
      case 'detailschange': {
        const ident = parseIdent(args[0]);
        if (ident && args[1]) this.setDetails(ident.side, ident.teamIndex, args[1], true);
        break;
      }
      case '-formechange': {
        const ident = parseIdent(args[0]);
        const known = ident && this.entry(ident.side, ident.teamIndex);
        if (known && args[1]) known.species = args[1];
        break;
      }
      case 'move': {
        const ident = parseIdent(args[0]);
        const known = ident && this.entry(ident.side, ident.teamIndex);
        const moveId = args[1] ? toId(args[1]) : '';
        // Moves called through another effect (`[from]`) or Struggle are not part of the set.
        if (known && moveId && moveId !== 'struggle' && !line.tags['from']) known.moves.add(moveId);
        break;
      }
      case '-item':
      case '-enditem': {
        const ident = parseIdent(args[0]);
        const known = ident && this.entry(ident.side, ident.teamIndex);
        if (known && args[1]) known.item = args[1];
        break;
      }
      case '-ability': {
        const ident = parseIdent(args[0]);
        const known = ident && this.entry(ident.side, ident.teamIndex);
        if (known && args[1] && !line.tags['from']) known.ability = args[1];
        break;
      }
      case '-activate': {
        const ident = parseIdent(args[0]);
        const known = ident && this.entry(ident.side, ident.teamIndex);
        const ability = args[1] ? /^ability: (.+)$/.exec(args[1]) : null;
        if (known && ability) known.ability = ability[1] as string;
        break;
      }
      case '-weather': {
        if (line.tags['upkeep'] !== undefined) break;
        this.weather = args[0] && args[0] !== 'none' ? toId(args[0]) : null;
        break;
      }
      case '-fieldstart':
      case '-fieldend': {
        const id = toId((args[0] ?? '').replace(/^move: /, ''));
        const start = command === '-fieldstart';
        if (id.endsWith('terrain')) this.terrain = start ? id : null;
        else if (start) this.pseudoWeather.set(id, 1);
        else this.pseudoWeather.delete(id);
        break;
      }
      case '-sidestart':
      case '-sideend': {
        const ident = /^p([12])/.exec(args[0] ?? '');
        if (!ident) break;
        const side: BattleSideId = ident[1] === '1' ? 'p1' : 'p2';
        const id = toId((args[1] ?? '').replace(/^move: /, ''));
        const conditions = this.sideConditions[side];
        if (command === '-sidestart') conditions.set(id, (conditions.get(id) ?? 0) + 1);
        else conditions.delete(id);
        break;
      }
      default:
        break;
    }
    this.observeSourceTag(line);
  }

  conditions(map: ReadonlyMap<string, number>): BattleCondition[] {
    return [...map].map(([id, layers]) => (layers > 1 ? { id, layers } : { id }));
  }
}
