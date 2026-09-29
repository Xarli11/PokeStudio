import { Dex, Teams } from './simulator';

import { battleError } from '../errors';
import type { BattleTeamInput, BattleTeamMemberInput } from '../types';

const MAX_TEXT = 20_000;

/**
 * Parses a team pasted in the common export text format into the neutral `BattleTeamInput`.
 * Parsing only: legality is decided later by `createBattle`. Untrusted text: bounded in size and
 * anything that does not parse is an `INVALID_CONFIG`.
 */
export function importTeamText(text: unknown): BattleTeamInput {
  const fail = (issue: string): never => {
    throw battleError('INVALID_CONFIG', { issues: [issue] }, `Cannot import team: ${issue}`);
  };
  if (typeof text !== 'string' || text.trim() === '')
    return fail('team text must be a non-empty string');
  if (text.length > MAX_TEXT) return fail('team text is too long');
  const sets = Teams.import(text);
  if (!sets || sets.length === 0) return fail('no Pokémon could be read from the text');
  const unknown = sets.filter((set) => !Dex.species.get(set.species || set.name).exists);
  if (unknown.length > 0) {
    return fail(
      `unknown Pokémon: ${unknown
        .map((set) => set.species || set.name)
        .join(', ')
        .slice(0, 80)}`,
    );
  }
  const members: BattleTeamMemberInput[] = sets.map((set) => {
    const member: BattleTeamMemberInput = {
      species: set.species || set.name,
      ability: set.ability,
      moves: set.moves.filter(Boolean),
    };
    if (set.name && set.name !== set.species) member.nickname = set.name;
    if (set.item) member.item = set.item;
    if (set.nature) member.nature = set.nature;
    if (set.gender === 'M' || set.gender === 'F' || set.gender === 'N') member.gender = set.gender;
    if (set.level && set.level !== 100) member.level = set.level;
    if (set.shiny) member.shiny = true;
    if (set.teraType) member.teraType = set.teraType;
    if (set.evs) member.evs = { ...set.evs };
    if (set.ivs) member.ivs = { ...set.ivs };
    return member;
  });
  return { members };
}
