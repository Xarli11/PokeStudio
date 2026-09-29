import { Dex } from './simulator';

import type { BattleFormatDescriptor, BattleFormatId } from '../formats';

/**
 * INTERNAL, server-side: the mapping from PokeStudio format ids to simulator format ids, and the
 * resolution of a catalog entry against the installed simulator. Nothing here is exported from the
 * package. The simulator stays the authority for rules and legality; this only reads the few
 * structural facts the engine needs and verifies they still agree with the catalog.
 */
const SHOWDOWN_FORMAT_ID: Readonly<Record<BattleFormatId, string>> = {
  'sv-ou': 'gen9ou',
  'sv-ubers': 'gen9ubers',
  'champions-bss-reg-mb': 'gen9championsbssregmb',
  'champions-vgc-reg-mb': 'gen9championsvgc2026regmb',
  'sv-doubles-ou': 'gen9doublesou',
};

export interface ResolvedFormat {
  showdownId: string;
  name: string;
  generation: number;
  gameType: string;
  playerCount: number;
  generatedTeams: boolean;
  mod: string;
  minTeamSize: number;
  maxTeamSize: number;
  pickedTeamSize: number | null;
  adjustLevel: number | null;
  /** `'accepted'`: the format's Open Team Sheets are opt-in and PokeStudio treats them as accepted. */
  openTeamSheets: 'accepted' | 'forced' | null;
}

/** Reads the Open Team Sheets rule the simulator itself defines for the format. */
export function openTeamSheetsOf(rules: {
  has(rule: string): boolean;
}): 'accepted' | 'forced' | null {
  if (rules.has('forceopenteamsheets')) return 'forced';
  return rules.has('openteamsheets') ? 'accepted' : null;
}

export const showdownIdOf = (id: BattleFormatId): string => SHOWDOWN_FORMAT_ID[id];

/** Reads the structural facts of a catalog entry from the installed simulator. */
export function resolveFormat(id: BattleFormatId): ResolvedFormat {
  const format = Dex.formats.get(SHOWDOWN_FORMAT_ID[id]);
  if (!format.exists || format.effectType !== 'Format') {
    throw new Error(`catalog format ${id} does not exist in the installed simulator`);
  }
  const rules = Dex.formats.getRuleTable(format);
  return {
    showdownId: format.id,
    name: format.name,
    generation: Dex.forFormat(format).gen,
    gameType: format.gameType,
    playerCount: format.playerCount,
    generatedTeams: Boolean(format.team),
    mod: format.mod,
    minTeamSize: rules.minTeamSize,
    maxTeamSize: rules.maxTeamSize,
    pickedTeamSize: rules.pickedTeamSize ?? null,
    adjustLevel: rules.adjustLevel ?? null,
    openTeamSheets: openTeamSheetsOf(rules),
  };
}

/**
 * Resolves and checks an entry the engine is about to run. A mismatch means the catalog and the
 * installed simulator disagree (an upgrade or a catalog mistake), which is an engine invariant.
 */
export function resolveExecutableFormat(descriptor: BattleFormatDescriptor): ResolvedFormat {
  const resolved = resolveFormat(descriptor.id);
  const problems: string[] = [];
  // The entry's own generation, not the current-generation constant: raising it must never
  // invalidate an already published id.
  if (resolved.generation !== descriptor.generation) problems.push('generation');
  if (resolved.gameType !== descriptor.gameType) problems.push('game type');
  if (resolved.playerCount !== 2) problems.push('player count');
  if (resolved.generatedTeams) problems.push('generated teams');
  if (problems.length > 0) {
    throw new Error(
      `catalog format ${descriptor.id} disagrees with the simulator: ${problems.join(', ')}`,
    );
  }
  return resolved;
}
