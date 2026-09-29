import { Battle, Dex, PRNG, TeamValidator, Teams, type Pokemon } from 'pokemon-showdown';

import { battleError } from '../errors';
import { findBattleFormat, type BattleFormatDescriptor } from '../formats';
import type {
  BattleConfig,
  BattleFormatInfo,
  BattlePokemonRef,
  BattleSeed,
  BattleSideId,
  BattleStatTable,
  BattleTeamInput,
} from '../types';
import { openTeamSheetsOf, resolveExecutableFormat } from './formats';
import { memberToken } from './protocol';

export type ShowdownPokemon = Pokemon;
type ShowdownSet = NonNullable<Parameters<typeof Teams.pack>[0]>[number];
type ShowdownPRNGSeed = NonNullable<ConstructorParameters<typeof PRNG>[0]>;

export const SIDE_IDS: readonly BattleSideId[] = ['p1', 'p2'];
/** Fixed names the simulator sees. Display names live only in the PokeStudio domain. */
export const SHOWDOWN_SIDE_NAME: Record<BattleSideId, string> = { p1: 'P1', p2: 'P2' };

const MAX_TEAM_SIZE = 6;
/** True for C0 control characters (including CR/LF) and DEL. */
const hasControlChars = (text: string) =>
  [...text].some((char) => {
    const code = char.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
/** Characters that would break the packed-team or protocol grammar. */
const hasUnsafeNameChars = (text: string) => /[|,\][]/.test(text) || hasControlChars(text);
const SEED_SHAPE = /^(sodium|gen5),[0-9a-f]+$/;
const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function identifierProblem(label: string, value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '')
    return `${label} must be a non-empty string`;
  if (value.length > 40 || hasUnsafeNameChars(value))
    return `${label} contains unsupported characters`;
  return null;
}

function statTableProblems(label: string, value: unknown, max: number): string[] {
  if (value === undefined) return [];
  if (!isRecord(value)) return [`${label} must be an object`];
  return Object.entries(value).flatMap(([stat, amount]) =>
    (STAT_KEYS as readonly string[]).includes(stat) &&
    typeof amount === 'number' &&
    Number.isInteger(amount) &&
    amount >= 0 &&
    amount <= max
      ? []
      : [`${label}.${stat} must be an integer from 0 to ${max}`],
  );
}

/** Structural team problems (display text). Legality is left to the simulator's TeamValidator. */
export function teamStructureProblems(team: unknown): string[] {
  if (!isRecord(team) || !Array.isArray(team['members'])) return ['team.members must be an array'];
  const members: unknown[] = team['members'];
  if (members.length < 1) return ['team must have at least 1 member'];
  if (members.length > MAX_TEAM_SIZE) return [`team can have at most ${MAX_TEAM_SIZE} members`];
  const problems: string[] = [];
  members.forEach((member, i) => {
    const at = `members[${i}]`;
    if (!isRecord(member)) {
      problems.push(`${at} must be an object`);
      return;
    }
    const required: [string, unknown][] = [
      ['species', member['species']],
      ['ability', member['ability']],
    ];
    for (const [name, value] of required) {
      const problem = identifierProblem(`${at}.${name}`, value);
      if (problem) problems.push(problem);
    }
    for (const name of ['item', 'nature', 'teraType'] as const) {
      if (member[name] === undefined) continue;
      const problem = identifierProblem(`${at}.${name}`, member[name]);
      if (problem) problems.push(problem);
    }
    const moves = member['moves'];
    if (!Array.isArray(moves) || moves.length < 1 || moves.length > 4) {
      problems.push(`${at}.moves must have 1 to 4 entries`);
    } else {
      moves.forEach((move, m) => {
        const problem = identifierProblem(`${at}.moves[${m}]`, move);
        if (problem) problems.push(problem);
      });
    }
    const nickname = member['nickname'];
    if (
      nickname !== undefined &&
      (typeof nickname !== 'string' ||
        nickname.trim() === '' ||
        nickname.length > 24 ||
        hasControlChars(nickname))
    ) {
      problems.push(`${at}.nickname must be 1-24 printable characters`);
    }
    const level = member['level'];
    if (
      level !== undefined &&
      !(Number.isInteger(level) && (level as number) >= 1 && (level as number) <= 100)
    ) {
      problems.push(`${at}.level must be an integer from 1 to 100`);
    }
    const gender = member['gender'];
    if (gender !== undefined && gender !== 'M' && gender !== 'F' && gender !== 'N') {
      problems.push(`${at}.gender must be M, F or N`);
    }
    const happiness = member['happiness'];
    if (
      happiness !== undefined &&
      !(Number.isInteger(happiness) && (happiness as number) >= 0 && (happiness as number) <= 255)
    ) {
      problems.push(`${at}.happiness must be an integer from 0 to 255`);
    }
    if (member['shiny'] !== undefined && typeof member['shiny'] !== 'boolean') {
      problems.push(`${at}.shiny must be a boolean`);
    }
    problems.push(...statTableProblems(`${at}.evs`, member['evs'], 255));
    problems.push(...statTableProblems(`${at}.ivs`, member['ivs'], 31));
  });
  return problems;
}

/** A partially specified spread: stats the caller left out take the neutral value for that kind. */
function completeTable(partial: Partial<BattleStatTable>, missing: number): BattleStatTable {
  return {
    hp: missing,
    atk: missing,
    def: missing,
    spa: missing,
    spd: missing,
    spe: missing,
    ...partial,
  };
}

/**
 * Omitted optional fields stay OMITTED so the simulator's own defaults apply (level → the format's
 * default level, evs/ivs → its fill rules, nature → Serious, teraType → first type, gender → resolved
 * from the species). Only a partially given `evs`/`ivs` table is completed, with 0 / 31.
 * Note `name` is set to '' here (the validator reports by species); tokens are added later.
 */
function toShowdownSets(team: BattleTeamInput): ShowdownSet[] {
  return team.members.map((member) => {
    const set = {
      name: '',
      species: member.species.trim(),
      item: member.item?.trim() ?? '',
      ability: member.ability.trim(),
      moves: member.moves.map((move) => move.trim()),
      nature: member.nature?.trim() ?? '',
      gender: member.gender ?? '',
    } as ShowdownSet;
    if (member.level !== undefined) set.level = member.level;
    if (member.evs) set.evs = completeTable(member.evs, 0);
    if (member.ivs) set.ivs = completeTable(member.ivs, 31);
    if (member.shiny !== undefined) set.shiny = member.shiny;
    if (member.happiness !== undefined) set.happiness = member.happiness;
    if (member.teraType) set.teraType = member.teraType.trim();
    return set;
  });
}

function configIssues(config: unknown): string[] {
  if (!isRecord(config)) return ['config must be an object'];
  const issues: string[] = [];
  const formatId = config['formatId'];
  if (typeof formatId !== 'string' || formatId.trim() === '' || formatId.length > 64) {
    issues.push('formatId must be a non-empty string');
  }
  const sides = config['sides'];
  if (!isRecord(sides)) {
    issues.push('sides must be an object with p1 and p2');
  } else {
    for (const id of SIDE_IDS) {
      const side = sides[id];
      if (!isRecord(side)) {
        issues.push(`sides.${id} must be an object`);
        continue;
      }
      const name = side['displayName'];
      if (
        typeof name !== 'string' ||
        name.trim() === '' ||
        name.length > 40 ||
        hasControlChars(name)
      ) {
        issues.push(`sides.${id}.displayName must be 1-40 printable characters`);
      }
    }
  }
  const seed = config['seed'];
  if (seed !== undefined) {
    if (typeof seed !== 'string' || !SEED_SHAPE.test(seed)) {
      issues.push('seed must be a string like "sodium,<hex>" or "gen5,<hex>"');
    } else {
      try {
        new PRNG(seed as ShowdownPRNGSeed);
      } catch {
        issues.push('seed is not accepted by the simulator');
      }
    }
  }
  return issues;
}

export interface ShowdownBattleBundle {
  battle: Battle;
  format: BattleFormatInfo;
  seed: BattleSeed;
  /** The simulator's own format id. Internal: never part of a player-visible state. */
  engineFormatId: string;
  /** Simulator Pokémon instance → original team position. Identity, never content matching. */
  refs: Map<Pokemon, BattlePokemonRef>;
}

/** Where a battle runs: the simulator format id plus the public description of it. */
interface FormatTarget {
  showdownId: string;
  info: BattleFormatInfo;
  /** Open Team Sheets as the simulator defines them for the format (see `showdown/formats.ts`). */
  openTeamSheets: 'accepted' | 'forced' | null;
}

const unsupportedFormat = (
  formatId: string,
  reason: 'not-in-catalog' | 'blocked' | 'engine-unsupported',
) =>
  battleError(
    'UNSUPPORTED_FORMAT',
    { formatId, reason },
    `Unsupported format "${formatId}": ${reason}`,
  );

/**
 * @internal Exported for tests. A format is runnable only if it is in the catalog and available.
 */
export function assertCatalogAvailable(
  descriptor: BattleFormatDescriptor | undefined,
  formatId: string,
): BattleFormatDescriptor {
  if (!descriptor) throw unsupportedFormat(formatId, 'not-in-catalog');
  if (descriptor.availability.level === 'blocked') throw unsupportedFormat(formatId, 'blocked');
  return descriptor;
}

function assertValidConfig(config: BattleConfig) {
  const issues = configIssues(config);
  if (issues.length > 0) {
    throw battleError('INVALID_CONFIG', { issues }, `Invalid battle config: ${issues.join('; ')}`);
  }
}

/**
 * Public path: `formatId` must be a PokeStudio catalog id whose availability is `available`. Any
 * other string — including a raw simulator id such as "gen9ou" — is `not-in-catalog`.
 */
export function createShowdownBattle(
  config: BattleConfig,
  send: (type: string, data: string | string[]) => void,
): ShowdownBattleBundle {
  assertValidConfig(config);
  const descriptor = assertCatalogAvailable(findBattleFormat(config.formatId), config.formatId);
  let resolved;
  try {
    resolved = resolveExecutableFormat(descriptor);
  } catch (cause) {
    throw battleError(
      'ENGINE_ERROR',
      { operation: 'resolve-format' },
      'Catalog/simulator mismatch',
      cause,
    );
  }
  return buildBattle(config, send, {
    showdownId: resolved.showdownId,
    openTeamSheets: resolved.openTeamSheets,
    info: {
      id: descriptor.id,
      name: resolved.name,
      generation: descriptor.generation,
      gameType: descriptor.gameType,
      category: descriptor.category,
      family: descriptor.family,
      openTeamSheets: resolved.openTeamSheets !== null,
    },
  });
}

/**
 * @internal TEST-ONLY. Runs a raw simulator format id (e.g. `gen9customgame`) so mechanics tests can
 * use artificial formats. Not exported from `index.ts`, not reachable through `BattleConfig`, and it
 * still validates teams. The resulting format info is marked as internal.
 */
export function createShowdownBattleForTests(
  config: BattleConfig,
  send: (type: string, data: string | string[]) => void,
): ShowdownBattleBundle {
  assertValidConfig(config);
  const format = Dex.formats.get(config.formatId.trim());
  if (!format.exists || format.effectType !== 'Format') {
    throw unsupportedFormat(config.formatId, 'not-in-catalog');
  }
  if (format.playerCount !== 2 || format.team) {
    throw unsupportedFormat(config.formatId, 'engine-unsupported');
  }
  if (format.gameType !== 'singles' && format.gameType !== 'doubles') {
    throw unsupportedFormat(config.formatId, 'engine-unsupported');
  }
  return buildBattle(config, send, {
    showdownId: format.id,
    openTeamSheets: openTeamSheetsOf(Dex.formats.getRuleTable(format)),
    info: {
      // Not a catalog id: tests only. Typed as one so the public shape stays unchanged.
      id: `internal:${format.id}` as BattleFormatInfo['id'],
      name: format.name,
      generation: Dex.forFormat(format).gen,
      gameType: format.gameType,
      category: 'smogon-tier',
      family: 'scarlet-violet',
      openTeamSheets: openTeamSheetsOf(Dex.formats.getRuleTable(format)) !== null,
    },
  });
}

/**
 * Validates teams and builds the simulator battle. Team legality is ALWAYS checked with the
 * simulator's TeamValidator; there is no way to skip it.
 */
function buildBattle(
  config: BattleConfig,
  send: (type: string, data: string | string[]) => void,
  target: FormatTarget,
): ShowdownBattleBundle {
  const packed: Record<BattleSideId, string> = { p1: '', p2: '' };
  const memberCount: Record<BattleSideId, number> = { p1: 0, p2: 0 };
  for (const id of SIDE_IDS) {
    const team = config.sides[id].team;
    const problems = teamStructureProblems(team);
    if (problems.length === 0) {
      // Validate a clone: the validator normalizes sets in place, and messages should name the
      // species rather than the adapter's internal member token.
      const validated = toShowdownSets(team);
      const validatorProblems = TeamValidator.get(target.showdownId).validateTeam(validated);
      if (validatorProblems && validatorProblems.length > 0) problems.push(...validatorProblems);
      else {
        // The validator normalizes sets in place (defaults, canonical names) and we keep that. Two
        // exceptions: `name` becomes the internal token, and `gender` goes back to exactly what the
        // caller said — in formats without "obtainable misc" rules the validator writes 'N' (genderless)
        // over an unspecified gender, which would wrongly make e.g. a Garchomp genderless.
        const sets = validated.map((set, teamIndex) => ({
          ...set,
          name: memberToken(teamIndex),
          gender: team.members[teamIndex]?.gender ?? '',
        }));
        packed[id] = Teams.pack(sets);
        memberCount[id] = sets.length;
      }
    }
    if (problems.length > 0) {
      throw battleError(
        'INVALID_TEAM',
        { side: id, problems },
        `Invalid team for ${id}: ${problems.length} problem(s)`,
      );
    }
  }

  try {
    const battle = new Battle({
      formatid: target.showdownId as never,
      ...(config.seed ? { seed: config.seed as ShowdownPRNGSeed } : {}),
      send,
      p1: { name: SHOWDOWN_SIDE_NAME.p1, team: packed.p1 },
      p2: { name: SHOWDOWN_SIDE_NAME.p2, team: packed.p2 },
    });
    // Open Team Sheets are opt-in in the simulator (each player accepts through the room UI). A
    // PokeStudio session treats them as accepted, so the sheets are public from the start. Formats
    // with forced sheets already publish them during team preview.
    if (target.openTeamSheets === 'accepted') battle.showOpenTeamSheets();
    const refs = new Map<Pokemon, BattlePokemonRef>();
    for (const [n, id] of SIDE_IDS.entries()) {
      const side = battle.sides[n];
      if (!side || side.pokemon.length !== memberCount[id]) {
        throw new Error(`side ${id} was not created with ${memberCount[id]} Pokémon`);
      }
      // Right after construction `side.pokemon` is still in input order: capture identity now.
      side.pokemon.forEach((pokemon, teamIndex) => {
        // The adapter token must agree with the identity map: two independent mechanisms, one truth.
        if (pokemon.name !== memberToken(teamIndex)) {
          throw new Error(`side ${id} position ${teamIndex} lost its identity token`);
        }
        refs.set(pokemon, { side: id, teamIndex });
      });
    }
    return {
      battle,
      format: target.info,
      seed: battle.prngSeed,
      engineFormatId: target.showdownId,
      refs,
    };
  } catch (cause) {
    throw battleError(
      'ENGINE_ERROR',
      { operation: 'create' },
      'Failed to create the battle',
      cause,
    );
  }
}
