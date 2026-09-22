import { describe, expect, it } from 'vitest';

import type { MoveSummary } from '@pokestudio/database';

import type { TeamMemberDraft } from '@/lib/team-draft';

import { advancedConfigFromTeamMember, preferredDamageMoveSlug } from './build-damage-import';

const EVS = { hp: 0, attack: 252, defense: 0, specialAttack: 0, specialDefense: 4, speed: 252 };
const IVS = { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 };

const GARCHOMP_MEMBER: TeamMemberDraft = {
  id: 'member-1',
  formSlug: 'garchomp',
  nickname: '',
  level: 50,
  abilitySlug: 'rough-skin',
  itemSlug: 'life-orb',
  teraType: 'ground',
  natureSlug: 'jolly',
  evs: EVS,
  ivs: IVS,
  moveSlugs: ['protect', 'swords-dance', 'earthquake', 'dragon-claw'],
};

describe('advancedConfigFromTeamMember', () => {
  it('maps every configured field (task §9)', () => {
    const config = advancedConfigFromTeamMember(GARCHOMP_MEMBER);
    expect(config).toEqual({
      level: 50,
      abilitySlug: 'rough-skin',
      itemSlug: 'life-orb',
      natureSlug: 'jolly',
      evs: EVS,
      ivs: IVS,
      teraEnabled: false,
      teraType: 'ground',
    });
  });

  it('teraEnabled is always false even when a Tera Type is configured (task §10)', () => {
    expect(advancedConfigFromTeamMember(GARCHOMP_MEMBER).teraEnabled).toBe(false);
    expect(advancedConfigFromTeamMember({ ...GARCHOMP_MEMBER, teraType: null }).teraEnabled).toBe(
      false,
    );
  });

  it('copies evs/ivs into fresh objects — never shares the TeamMemberDraft reference (task §9)', () => {
    const config = advancedConfigFromTeamMember(GARCHOMP_MEMBER);
    expect(config.evs).not.toBe(GARCHOMP_MEMBER.evs);
    expect(config.ivs).not.toBe(GARCHOMP_MEMBER.ivs);
    config.evs.attack = 0;
    expect(GARCHOMP_MEMBER.evs.attack).toBe(252); // the original draft is untouched
  });
});

const EARTHQUAKE: MoveSummary = {
  slug: 'earthquake',
  nameEn: 'Earthquake',
  type: 'ground',
  damageClass: 'physical',
  power: 100,
  accuracy: 100,
  pp: 10,
  priority: 0,
};
const DRAGON_CLAW: MoveSummary = {
  slug: 'dragon-claw',
  nameEn: 'Dragon Claw',
  type: 'dragon',
  damageClass: 'physical',
  power: 80,
  accuracy: 100,
  pp: 15,
  priority: 0,
};

describe('preferredDamageMoveSlug', () => {
  it('picks the first set move (in order) that is a legal, damaging attacker move (task §12)', () => {
    // fetchAttackerReferenceData already filters out status moves — Protect
    // and Swords Dance are never part of `attackerMoves` in practice.
    const attackerMoves = [EARTHQUAKE, DRAGON_CLAW];
    expect(preferredDamageMoveSlug(GARCHOMP_MEMBER.moveSlugs, attackerMoves)).toBe('earthquake');
  });

  it('skips a set move no longer legal for this game — not present in attackerMoves', () => {
    const attackerMoves = [DRAGON_CLAW]; // Earthquake not legal in this game fixture
    expect(preferredDamageMoveSlug(GARCHOMP_MEMBER.moveSlugs, attackerMoves)).toBe('dragon-claw');
  });

  it('returns null when every set move is a status move (task §12)', () => {
    const attackerMoves = [EARTHQUAKE, DRAGON_CLAW]; // neither Protect nor Swords Dance ever appear here
    expect(preferredDamageMoveSlug(['protect', 'swords-dance', null, null], attackerMoves)).toBe(
      null,
    );
  });

  it('returns null when the attacker has no legal damaging moves at all', () => {
    expect(preferredDamageMoveSlug(GARCHOMP_MEMBER.moveSlugs, [])).toBeNull();
  });

  it('returns null for empty move slugs', () => {
    expect(preferredDamageMoveSlug([null, null, null, null], [EARTHQUAKE])).toBeNull();
  });
});
