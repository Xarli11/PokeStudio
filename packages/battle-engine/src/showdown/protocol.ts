import type { BattleSideId } from '../types';

/**
 * Raw simulator protocol handling. INTERNAL: nothing here is exported from the package.
 * Adapted from the Phase 0 spike's `parse-event.ts` (line splitting by command), extended with
 * `|split|` channel handling and identity parsing.
 * Protocol reference: sim/SIM-PROTOCOL.md of the installed pokemon-showdown.
 */

/** -1 = omniscient, 0 = spectator, 1/2 = player sides. Matches the simulator's channel ids. */
export type ChannelId = -1 | 0 | 1 | 2;
export const CHANNELS: readonly ChannelId[] = [-1, 0, 1, 2];

/**
 * Splits one `update` chunk into per-channel line lists. A `|split|pN` line is followed by a
 * secret line (for player N and omniscient) and a shared line (everyone else); an empty
 * line means "nothing for that audience". All other lines go to every channel.
 */
export function splitChannels(chunk: string): Record<ChannelId, string[]> {
  const out: Record<ChannelId, string[]> = { [-1]: [], 0: [], 1: [], 2: [] };
  const lines = chunk.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const split = /^\|split\|p([1-4])$/.exec(line);
    if (!split) {
      if (line === '') continue;
      for (const channel of CHANNELS) out[channel].push(line);
      continue;
    }
    const owner = Number(split[1]);
    const secret = lines[i + 1] ?? '';
    const shared = lines[i + 2] ?? '';
    i += 2;
    for (const channel of CHANNELS) {
      const text = channel === -1 || channel === owner ? secret : shared;
      if (text !== '') out[channel].push(text);
    }
  }
  return out;
}

/**
 * Adapter-assigned nickname tokens: the simulator only ever sees `m<teamIndex>` as a Pokémon name,
 * never user text, so a protocol identity resolves to a `teamIndex` unambiguously by construction
 * (duplicate species/sets/nicknames cannot collide) and user text cannot inject protocol.
 */
export const memberToken = (teamIndex: number) => `m${teamIndex}`;

export interface ParsedIdent {
  side: BattleSideId;
  /** Active slot index, or null when the identity refers to a non-active Pokémon. */
  position: number | null;
  teamIndex: number;
}

export function parseIdent(text: string | undefined): ParsedIdent | null {
  if (!text) return null;
  const match = /^p([12])([a-c])?: m(\d+)$/.exec(text);
  if (!match) return null;
  return {
    side: match[1] === '1' ? 'p1' : 'p2',
    position: match[2] ? (match[2].charCodeAt(0) - 'a'.charCodeAt(0)) % 3 : null,
    teamIndex: Number(match[3]),
  };
}

export interface ProtocolLine {
  command: string;
  args: string[];
  /** `[from] x`-style tags: key → value (e.g. `from` → `ability: Rough Skin`). */
  tags: Record<string, string>;
}

export function parseLine(line: string): ProtocolLine | null {
  if (!line.startsWith('|')) return null;
  const parts = line.split('|');
  const command = parts[1];
  if (command === undefined) return null;
  const args: string[] = [];
  const tags: Record<string, string> = {};
  for (const part of parts.slice(2)) {
    const tag = /^\[(\w+)\]\s?(.*)$/.exec(part);
    if (tag) tags[tag[1] as string] = tag[2] as string;
    else args.push(part);
  }
  return { command, args, tags };
}

/** "Dragonite, L50, F, shiny, tera:Fire" → structured details. */
export function parseDetails(details: string): {
  species: string;
  level: number;
  gender: 'M' | 'F' | 'N';
} {
  const [species = '', ...rest] = details.split(', ');
  let level = 100;
  let gender: 'M' | 'F' | 'N' = 'N';
  for (const part of rest) {
    const lvl = /^L(\d+)$/.exec(part);
    if (lvl) level = Number(lvl[1]);
    else if (part === 'M' || part === 'F') gender = part;
  }
  return { species, level, gender };
}

/** "63/100 par", "0 fnt", "323/323" → numbers (max omitted when the line has none). */
export function parseHpText(text: string): { current: number; max?: number } | null {
  const match = /^(\d+)(?:\/(\d+))?/.exec(text);
  if (!match) return null;
  const current = Number(match[1]);
  return match[2] === undefined ? { current } : { current, max: Number(match[2]) };
}

export const toId = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '');
