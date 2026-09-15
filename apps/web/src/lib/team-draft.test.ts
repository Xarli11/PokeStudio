import { describe, expect, it } from 'vitest';

import {
  MAX_TEAM_MEMBERS,
  MAX_TEAM_MOVES,
  addTeamMember,
  changeTeamMemberForm,
  clampEv,
  clampIv,
  clampLevel,
  createEmptyTeamDraft,
  evTotal,
  maxEvForStat,
  removeTeamMember,
  renameTeamDraft,
  setTeamVersionGroup,
  updateTeamMember,
} from './team-draft';

describe('createEmptyTeamDraft', () => {
  it('starts with zero members and the given version group/name', () => {
    const draft = createEmptyTeamDraft('scarlet-violet', 'My Team');
    expect(draft.members).toHaveLength(0);
    expect(draft.versionGroupSlug).toBe('scarlet-violet');
    expect(draft.name).toBe('My Team');
    expect(draft.schemaVersion).toBeGreaterThan(0);
  });

  it('gives every draft a distinct id', () => {
    const a = createEmptyTeamDraft('scarlet-violet', 'A');
    const b = createEmptyTeamDraft('scarlet-violet', 'B');
    expect(a.id).not.toBe(b.id);
  });
});

describe('addTeamMember', () => {
  it('adds a member with real defaults (level 100, zero EVs, full IVs, no moves/ability/item)', () => {
    const draft = addTeamMember(createEmptyTeamDraft('sv', 'Team'), 'garchomp');
    const member = draft.members[0]!;
    expect(member.formSlug).toBe('garchomp');
    expect(member.level).toBe(100);
    expect(evTotal(member.evs)).toBe(0);
    expect(member.ivs.hp).toBe(31);
    expect(member.abilitySlug).toBeNull();
    expect(member.itemSlug).toBeNull();
    expect(member.natureSlug).toBeNull();
    expect(member.teraType).toBeNull();
    expect(member.moveSlugs).toHaveLength(MAX_TEAM_MOVES);
    expect(member.moveSlugs.every((slug) => slug === null)).toBe(true);
  });

  it('refuses a 7th member', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    for (let i = 0; i < MAX_TEAM_MEMBERS; i++) {
      draft = addTeamMember(draft, `mon-${i}`);
    }
    expect(draft.members).toHaveLength(MAX_TEAM_MEMBERS);
    const overflowed = addTeamMember(draft, 'one-too-many');
    expect(overflowed.members).toHaveLength(MAX_TEAM_MEMBERS);
  });

  it('gives every member a distinct id, even for the same species twice', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'ditto');
    draft = addTeamMember(draft, 'ditto');
    expect(draft.members[0]!.id).not.toBe(draft.members[1]!.id);
  });
});

describe('removeTeamMember', () => {
  it('removes exactly the targeted member, keeping others in order', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'a');
    draft = addTeamMember(draft, 'b');
    draft = addTeamMember(draft, 'c');
    const toRemove = draft.members[1]!.id;
    draft = removeTeamMember(draft, toRemove);
    expect(draft.members.map((m) => m.formSlug)).toEqual(['a', 'c']);
  });
});

describe('updateTeamMember', () => {
  it('patches only the targeted member', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'a');
    draft = addTeamMember(draft, 'b');
    const targetId = draft.members[0]!.id;
    draft = updateTeamMember(draft, targetId, { nickname: 'Buddy', level: 50 });
    expect(draft.members[0]!.nickname).toBe('Buddy');
    expect(draft.members[0]!.level).toBe(50);
    expect(draft.members[1]!.nickname).toBe('');
  });
});

describe('changeTeamMemberForm (manual review v2: non-destructive)', () => {
  it('preserves ability and moves along with nickname/level/nature/EVs/IVs — validity is revalidated elsewhere, never silently deleted here', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'meowth');
    const id = draft.members[0]!.id;
    draft = updateTeamMember(draft, id, {
      nickname: 'Cat',
      level: 42,
      abilitySlug: 'pickup',
      natureSlug: 'adamant',
      moveSlugs: ['scratch', null, null, null],
      evs: { hp: 4, attack: 252, defense: 0, specialAttack: 0, specialDefense: 0, speed: 252 },
    });
    draft = changeTeamMemberForm(draft, id, 'meowth-alola');
    const member = draft.members[0]!;
    expect(member.formSlug).toBe('meowth-alola');
    // Kept, not nulled — a form's own ability/move list may or may not still
    // include these; that's `team-analysis.ts`'s `invalidAbility`/
    // `illegalMove` checks to surface, not this function's job to guess.
    expect(member.abilitySlug).toBe('pickup');
    expect(member.moveSlugs).toEqual(['scratch', null, null, null]);
    expect(member.nickname).toBe('Cat');
    expect(member.level).toBe(42);
    expect(member.natureSlug).toBe('adamant');
    expect(evTotal(member.evs)).toBe(508);
  });
});

describe('setTeamVersionGroup (manual review v2: non-destructive)', () => {
  it('changes the version group without touching moves/ability/item — an incompatible move is revalidated as invalid, never deleted (see team-analysis.test.ts)', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    draft = updateTeamMember(draft, id, {
      abilitySlug: 'rough-skin',
      itemSlug: 'leftovers',
      moveSlugs: ['earthquake', null, null, null],
    });
    draft = setTeamVersionGroup(draft, 'sword-shield');
    const member = draft.members[0]!;
    expect(draft.versionGroupSlug).toBe('sword-shield');
    expect(member.moveSlugs).toEqual(['earthquake', null, null, null]);
    expect(member.abilitySlug).toBe('rough-skin');
    expect(member.itemSlug).toBe('leftovers');
  });
});

describe('renameTeamDraft', () => {
  it('changes only the name', () => {
    const draft = renameTeamDraft(createEmptyTeamDraft('sv', 'Old'), 'New');
    expect(draft.name).toBe('New');
  });
});

describe('evTotal', () => {
  it('sums all six stats', () => {
    expect(
      evTotal({ hp: 4, attack: 252, defense: 0, specialAttack: 0, specialDefense: 0, speed: 252 }),
    ).toBe(508);
  });

  it('does not require EVs to be multiples of 4 (real games allow any 0-252 value)', () => {
    expect(
      evTotal({ hp: 5, attack: 7, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 }),
    ).toBe(12);
  });
});

describe('numeric domain safety (clamp, not reject)', () => {
  it('clampLevel keeps 1-100, clamps below/above, truncates decimals, falls back on non-finite', () => {
    expect(clampLevel(50)).toBe(50);
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(-5)).toBe(1);
    expect(clampLevel(101)).toBe(100);
    expect(clampLevel(50.9)).toBe(50);
    expect(clampLevel(Number.NaN)).toBe(1);
    expect(clampLevel(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('clampIv keeps 0-31, clamps below/above, truncates decimals', () => {
    expect(clampIv(31)).toBe(31);
    expect(clampIv(-1)).toBe(0);
    expect(clampIv(32)).toBe(31);
    expect(clampIv(50)).toBe(31);
    expect(clampIv(20.7)).toBe(20);
  });

  it('clampEv keeps 0-252, clamps below/above, truncates decimals', () => {
    expect(clampEv(252)).toBe(252);
    expect(clampEv(-10)).toBe(0);
    expect(clampEv(300)).toBe(252);
    expect(clampEv(100.5)).toBe(100);
  });

  it('updateTeamMember clamps a level patch, regardless of caller', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    draft = updateTeamMember(draft, id, { level: 999 });
    expect(draft.members[0]!.level).toBe(100);
    draft = updateTeamMember(draft, id, { level: -3 });
    expect(draft.members[0]!.level).toBe(1);
  });

  it('updateTeamMember clamps an EV patch per-stat, regardless of caller', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    draft = updateTeamMember(draft, id, {
      evs: { hp: 999, attack: -5, defense: 50.9, specialAttack: 0, specialDefense: 0, speed: 0 },
    });
    expect(draft.members[0]!.evs).toEqual({
      hp: 252,
      attack: 0,
      defense: 50,
      specialAttack: 0,
      specialDefense: 0,
      speed: 0,
    });
  });

  it('updateTeamMember clamps an IV patch per-stat, regardless of caller', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    draft = updateTeamMember(draft, id, {
      ivs: { hp: 50, attack: -1, defense: 31, specialAttack: 0, specialDefense: 0, speed: 0 },
    });
    expect(draft.members[0]!.ivs).toEqual({
      hp: 31,
      attack: 0,
      defense: 31,
      specialAttack: 0,
      specialDefense: 0,
      speed: 0,
    });
  });

  it('does not clamp fields that were not part of the patch', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    draft = updateTeamMember(draft, id, { nickname: 'Landy' });
    expect(draft.members[0]!.nickname).toBe('Landy');
    expect(draft.members[0]!.level).toBe(100); // untouched default, not re-clamped/reset
  });
});

describe('maxEvForStat', () => {
  it('allows up to 252 when the other five stats are still low', () => {
    const evs = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
    expect(maxEvForStat(evs, 'hp')).toBe(252);
  });

  it('shrinks the ceiling for one stat as the others fill the 510 budget', () => {
    // 252 + 252 = 504 already spent on attack/speed; hp has 6 left.
    const evs = { hp: 0, attack: 252, defense: 0, specialAttack: 0, specialDefense: 0, speed: 252 };
    expect(maxEvForStat(evs, 'hp')).toBe(6);
  });

  it('never goes negative even if the other stats already exceed the total budget', () => {
    const evs = {
      hp: 0,
      attack: 252,
      defense: 252,
      specialAttack: 252,
      specialDefense: 0,
      speed: 0,
    };
    expect(maxEvForStat(evs, 'hp')).toBe(0);
  });

  it("excludes the stat's own current value from the 'others' sum", () => {
    // attack is already at 100; raising it further should still be
    // possible up to the per-stat cap (252), not blocked by its own value.
    const evs = { hp: 0, attack: 100, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
    expect(maxEvForStat(evs, 'attack')).toBe(252);
  });
});
