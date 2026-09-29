import type { TeamDraft, TeamMemberDraft } from '@/lib/team-draft';

import type { BattleTeamInput } from './types';

/**
 * Maps a Build team to the battle engine's neutral team input. Mapping only: identifiers are sent
 * as Build stores them (slugs such as `rotom-wash` or `dragon-claw`), which the simulator resolves;
 * anything it cannot resolve, and every legality question, comes back as the engine's own typed team
 * problems. Nothing is defaulted here — omitted fields keep the simulator's defaults.
 */
function mapStats(spread: TeamMemberDraft['evs']) {
  return {
    hp: spread.hp,
    atk: spread.attack,
    def: spread.defense,
    spa: spread.specialAttack,
    spd: spread.specialDefense,
    spe: spread.speed,
  };
}
export function teamDraftToBattleTeam(draft: TeamDraft): BattleTeamInput {
  return {
    members: draft.members.map((member) => ({
      species: member.formSlug,
      ...(member.nickname.trim() ? { nickname: member.nickname.trim() } : {}),
      level: member.level,
      // A missing ability is passed as an empty string so the engine reports it as a team problem
      // instead of the adapter inventing one.
      ability: member.abilitySlug ?? '',
      ...(member.itemSlug ? { item: member.itemSlug } : {}),
      ...(member.natureSlug ? { nature: member.natureSlug } : {}),
      ...(member.teraType ? { teraType: member.teraType } : {}),
      moves: member.moveSlugs.filter((slug): slug is string => Boolean(slug)),
      evs: mapStats(member.evs),
      ivs: mapStats(member.ivs),
    })),
  };
}
