import { describe, expect, it } from 'vitest';

import { addTeamMember, createEmptyTeamDraft, updateTeamMember } from '@/lib/team-draft';

import { teamDraftToBattleTeam } from './team-from-build';

describe('Build team → BattleTeamInput', () => {
  const draft = () => {
    let team = createEmptyTeamDraft('scarlet-violet', 'My team');
    team = addTeamMember(team, 'rotom-wash');
    team = addTeamMember(team, 'garchomp');
    const [first, second] = team.members;
    team = updateTeamMember(team, first!.id, {
      nickname: '  Wash  ',
      level: 50,
      abilitySlug: 'levitate',
      itemSlug: 'leftovers',
      natureSlug: 'bold',
      teraType: 'water',
      evs: { hp: 252, attack: 0, defense: 252, specialAttack: 4, specialDefense: 0, speed: 0 },
      moveSlugs: ['hydro-pump', 'volt-switch', null, 'will-o-wisp'],
    });
    return updateTeamMember(team, second!.id, {
      abilitySlug: 'rough-skin',
      moveSlugs: ['earthquake', null, null, null],
    });
  };

  it('maps identities, stats and moves, dropping empty move slots', () => {
    const team = teamDraftToBattleTeam(draft());
    expect(team.members).toHaveLength(2);
    expect(team.members[0]).toEqual({
      species: 'rotom-wash',
      nickname: 'Wash',
      level: 50,
      ability: 'levitate',
      item: 'leftovers',
      nature: 'bold',
      teraType: 'water',
      moves: ['hydro-pump', 'volt-switch', 'will-o-wisp'],
      evs: { hp: 252, atk: 0, def: 252, spa: 4, spd: 0, spe: 0 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    });
  });

  it('omits what Build left empty instead of inventing values', () => {
    const second = teamDraftToBattleTeam(draft()).members[1]!;
    expect(second).not.toHaveProperty('item');
    expect(second).not.toHaveProperty('nature');
    expect(second).not.toHaveProperty('teraType');
    expect(second).not.toHaveProperty('nickname');
    expect(second.moves).toEqual(['earthquake']);
  });

  it('passes a missing ability through as empty so the engine reports it', () => {
    let team = createEmptyTeamDraft('scarlet-violet', 'x');
    team = addTeamMember(team, 'garchomp');
    expect(teamDraftToBattleTeam(team).members[0]!.ability).toBe('');
  });

  it('keeps team order', () => {
    expect(teamDraftToBattleTeam(draft()).members.map((m) => m.species)).toEqual([
      'rotom-wash',
      'garchomp',
    ]);
  });
});
