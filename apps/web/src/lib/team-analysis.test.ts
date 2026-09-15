import { describe, expect, it } from 'vitest';

import { resolveBuildGameCapabilities } from './build-game-capabilities';
import {
  addTeamMember,
  createEmptyTeamDraft,
  setTeamVersionGroup,
  updateTeamMember,
} from './team-draft';
import {
  buildMemberValidationContexts,
  computeOffensiveCoverage,
  computeTeamDefensiveProfile,
  computeTeamStatus,
  computeTeamWarnings,
  findDuplicateSpecies,
  type MemberValidationContext,
} from './team-analysis';

describe('computeTeamDefensiveProfile', () => {
  it('counts a dual-type double weakness once per member (Dragonite: Dragon/Flying vs Ice)', () => {
    const profile = computeTeamDefensiveProfile([['dragon', 'flying']]);
    expect(profile.ice).toEqual({ weak: 1, resist: 0, immune: 0 });
  });

  it('tallies weak/resist/immune independently across several members', () => {
    // Normal is weak (2x) to Fighting; Ghost is immune (0x) to Fighting —
    // both are real, distinct facts about the same attacking type.
    const profile = computeTeamDefensiveProfile([['normal'], ['ghost'], ['normal']]);
    expect(profile.fighting).toEqual({ weak: 2, resist: 0, immune: 1 });
    // Ghost is also immune to Normal-type attacks.
    expect(profile.normal).toEqual({ weak: 0, resist: 0, immune: 1 });
  });

  it('omits a type entirely when it is neutral against every member', () => {
    const profile = computeTeamDefensiveProfile([['normal']]);
    expect(profile.psychic).toBeUndefined();
  });
});

describe('computeOffensiveCoverage', () => {
  it('includes a defending type only when a damaging move is super effective against it', () => {
    const coverage = computeOffensiveCoverage([{ type: 'fire', damageClass: 'physical' }]);
    expect(coverage).toContain('grass');
    expect(coverage).toContain('ice');
    expect(coverage).not.toContain('water');
  });

  it('ignores status moves entirely, even ones with a notable type', () => {
    const coverage = computeOffensiveCoverage([{ type: 'fire', damageClass: 'status' }]);
    expect(coverage).not.toContain('grass');
  });

  it('combines coverage from every damaging move on the team', () => {
    const coverage = computeOffensiveCoverage([
      { type: 'fire', damageClass: 'physical' },
      { type: 'water', damageClass: 'special' },
    ]);
    expect(coverage).toContain('grass'); // fire > grass
    expect(coverage).toContain('rock'); // water > rock
  });
});

const GARCHOMP_CONTEXT: MemberValidationContext = {
  types: ['dragon', 'ground'],
  validAbilitySlugs: ['sand-veil', 'rough-skin'],
  legalMoveSlugs: ['earthquake', 'dragon-claw', 'swords-dance', 'fire-fang'],
  nationalDexNumber: 445, // Garchomp — Generation IV
};

describe('computeTeamWarnings', () => {
  it('flags an empty team as incomplete and nothing else', () => {
    const draft = createEmptyTeamDraft('sv', 'Team');
    const warnings = computeTeamWarnings(draft, new Map());
    expect(warnings).toEqual([{ code: 'incompleteTeam', severity: 'incomplete' }]);
  });

  it('flags a team under 6 members as incomplete, alongside per-member checks', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    draft = updateTeamMember(draft, id, { abilitySlug: 'rough-skin' });
    const warnings = computeTeamWarnings(draft, new Map([[id, GARCHOMP_CONTEXT]]));
    expect(warnings.some((w) => w.code === 'incompleteTeam')).toBe(true);
  });

  it('does not flag incompleteTeam once all 6 slots are filled', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    for (let i = 0; i < 6; i++) draft = addTeamMember(draft, `mon-${i}`);
    const warnings = computeTeamWarnings(draft, new Map());
    expect(warnings.some((w) => w.code === 'incompleteTeam')).toBe(false);
  });

  it('flags a member with no ability selected as INCOMPLETE, not INVALID — the set is unfinished, not broken (team status model, §8)', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    const warnings = computeTeamWarnings(draft, new Map([[id, GARCHOMP_CONTEXT]]));
    expect(warnings).toContainEqual({ code: 'noAbility', severity: 'incomplete', memberId: id });
  });

  it("flags an ability slug that isn't actually one of this form's abilities", () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    draft = updateTeamMember(draft, id, { abilitySlug: 'levitate' });
    const warnings = computeTeamWarnings(draft, new Map([[id, GARCHOMP_CONTEXT]]));
    expect(warnings).toContainEqual({
      code: 'invalidAbility',
      severity: 'invalid',
      memberId: id,
      detail: 'levitate',
    });
  });

  it('flags a member with no moves selected as INCOMPLETE, not INVALID (team status model, §8)', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    const warnings = computeTeamWarnings(draft, new Map([[id, GARCHOMP_CONTEXT]]));
    expect(warnings).toContainEqual({ code: 'noMoves', severity: 'incomplete', memberId: id });
  });

  it('flags a move this form/version-group cannot actually learn', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    draft = updateTeamMember(draft, id, { moveSlugs: ['thunderbolt', null, null, null] });
    const warnings = computeTeamWarnings(draft, new Map([[id, GARCHOMP_CONTEXT]]));
    expect(warnings).toContainEqual({
      code: 'illegalMove',
      severity: 'invalid',
      memberId: id,
      detail: 'thunderbolt',
    });
  });

  it('flags a duplicate move', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    draft = updateTeamMember(draft, id, {
      moveSlugs: ['earthquake', 'earthquake', null, null],
    });
    const warnings = computeTeamWarnings(draft, new Map([[id, GARCHOMP_CONTEXT]]));
    expect(warnings).toContainEqual({
      code: 'duplicateMove',
      severity: 'invalid',
      memberId: id,
      detail: 'earthquake',
    });
  });

  it('flags EV total over 510', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    draft = updateTeamMember(draft, id, {
      evs: { hp: 252, attack: 252, defense: 252, specialAttack: 0, specialDefense: 0, speed: 0 },
    });
    const warnings = computeTeamWarnings(draft, new Map([[id, GARCHOMP_CONTEXT]]));
    expect(warnings).toContainEqual({ code: 'evTotalExceeded', severity: 'invalid', memberId: id });
  });

  it('does not flag a real, non-multiple-of-4 EV total under 510 as invalid', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    draft = updateTeamMember(draft, id, {
      abilitySlug: 'rough-skin',
      moveSlugs: ['earthquake', null, null, null],
      evs: { hp: 5, attack: 7, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
    });
    const warnings = computeTeamWarnings(draft, new Map([[id, GARCHOMP_CONTEXT]]));
    expect(warnings.some((w) => w.code === 'evTotalExceeded' || w.code === 'evStatExceeded')).toBe(
      false,
    );
  });

  it('flags a single EV stat over 252', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    // `updateTeamMember` itself now clamps EVs to 0-252 (numeric domain
    // safety pass) — this exact input can no longer reach `computeTeamWarnings`
    // through normal editing, only through data that bypassed that boundary
    // (e.g. hand-edited/legacy localStorage, tested directly here rather
    // than laundered through `updateTeamMember`). See
    // `team-draft.test.ts`'s "updateTeamMember clamps..." tests and
    // `team-storage.test.ts`'s load-time sanitization for the normal-path
    // coverage of the same contract.
    draft = {
      ...draft,
      members: [
        {
          ...draft.members[0]!,
          evs: { hp: 0, attack: 300, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
        },
      ],
    };
    const warnings = computeTeamWarnings(draft, new Map([[id, GARCHOMP_CONTEXT]]));
    expect(warnings).toContainEqual({ code: 'evStatExceeded', severity: 'invalid', memberId: id });
  });

  it('flags an out-of-range IV', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    // Same reasoning as the EV test above — `updateTeamMember` now clamps
    // IVs to 0-31, so this is tested by directly constructing the member.
    draft = {
      ...draft,
      members: [
        {
          ...draft.members[0]!,
          ivs: {
            hp: 32,
            attack: 31,
            defense: 31,
            specialAttack: 31,
            specialDefense: 31,
            speed: 31,
          },
        },
      ],
    };
    const warnings = computeTeamWarnings(draft, new Map([[id, GARCHOMP_CONTEXT]]));
    expect(warnings).toContainEqual({ code: 'invalidIv', severity: 'invalid', memberId: id });
  });

  it('updateTeamMember itself now prevents this warning from ever being reachable through normal editing', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    draft = updateTeamMember(draft, id, {
      evs: { hp: 0, attack: 300, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
      ivs: { hp: 32, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
    });
    const warnings = computeTeamWarnings(draft, new Map([[id, GARCHOMP_CONTEXT]]));
    expect(warnings.some((w) => w.code === 'evStatExceeded' || w.code === 'invalidIv')).toBe(false);
  });

  it('flags a repeated severe weakness once 3+ members share it, not for 1-2', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'a');
    draft = addTeamMember(draft, 'b');
    draft = addTeamMember(draft, 'c');
    const [idA, idB, idC] = draft.members.map((m) => m.id);
    const grassContext: MemberValidationContext = {
      types: ['grass'],
      validAbilitySlugs: [],
      legalMoveSlugs: [],
      nationalDexNumber: 1,
    };
    const twoContexts = new Map([
      [idA!, grassContext],
      [idB!, grassContext],
    ]);
    expect(
      computeTeamWarnings(draft, twoContexts).some((w) => w.code === 'repeatedSevereWeakness'),
    ).toBe(false);

    const threeContexts = new Map([
      [idA!, grassContext],
      [idB!, grassContext],
      [idC!, grassContext],
    ]);
    expect(
      computeTeamWarnings(draft, threeContexts).some(
        (w) => w.code === 'repeatedSevereWeakness' && w.detail === 'fire',
      ),
    ).toBe(true);
  });

  it('never invents a warning for a member whose reference data has not loaded yet', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const warnings = computeTeamWarnings(draft, new Map());
    expect(warnings.some((w) => w.memberId !== undefined)).toBe(false);
  });
});

describe('unsupportedRuleset (Milestone 2 final pass §18: honest historical validity)', () => {
  it('is absent when no capabilities are passed at all (backward compatible)', () => {
    const draft = createEmptyTeamDraft('sv', 'Team');
    const warnings = computeTeamWarnings(draft, new Map());
    expect(warnings.some((w) => w.code === 'unsupportedRuleset')).toBe(false);
  });

  it('is absent for a fully-validated (modern, standard) game context', () => {
    const draft = createEmptyTeamDraft('sv', 'Team');
    const warnings = computeTeamWarnings(draft, new Map(), {
      fullyValidated: true,
      abilities: true,
    });
    expect(warnings.some((w) => w.code === 'unsupportedRuleset')).toBe(false);
  });

  it('fires once, team-wide (no memberId), for a not-fully-validated game context', () => {
    const draft = createEmptyTeamDraft('red-blue', 'Team');
    const warnings = computeTeamWarnings(draft, new Map(), {
      fullyValidated: false,
      abilities: false,
    });
    expect(warnings).toContainEqual({ code: 'unsupportedRuleset', severity: 'incomplete' });
  });

  it('never flags noAbility/invalidAbility for a game whose capabilities say abilities do not exist (e.g. Gen I)', () => {
    let draft = createEmptyTeamDraft('red-blue', 'Team');
    draft = addTeamMember(draft, 'garchomp'); // no abilitySlug set — would normally trigger noAbility
    const id = draft.members[0]!.id;
    const warnings = computeTeamWarnings(draft, new Map([[id, GARCHOMP_CONTEXT]]), {
      fullyValidated: false,
      abilities: false,
    });
    expect(warnings.some((w) => w.code === 'noAbility' || w.code === 'invalidAbility')).toBe(false);
  });

  it('never lets computeTeamStatus report VALID while the ruleset is unsupported, even for an otherwise-perfect team', () => {
    let draft = createEmptyTeamDraft('red-blue', 'Team');
    for (let i = 0; i < 6; i++) draft = addTeamMember(draft, `mon-${i}`);
    const context: MemberValidationContext = {
      types: ['normal'],
      validAbilitySlugs: [],
      legalMoveSlugs: ['tackle'],
      nationalDexNumber: 1,
    };
    const contexts = new Map(draft.members.map((m) => [m.id, context]));
    for (const m of draft.members) {
      draft = updateTeamMember(draft, m.id, { moveSlugs: ['tackle', null, null, null] });
    }
    const warnings = computeTeamWarnings(draft, contexts, {
      fullyValidated: false,
      abilities: false,
    });
    expect(computeTeamStatus(warnings)).not.toBe('valid');
  });
});

describe('speciesUnavailableInGeneration (manual review, final correction pass §3)', () => {
  function contextFor(nationalDexNumber: number): MemberValidationContext {
    return { types: ['normal'], validAbilitySlugs: [], legalMoveSlugs: [], nationalDexNumber };
  }

  function warningsFor(versionGroupSlug: string, generation: number, nationalDexNumber: number) {
    let draft = createEmptyTeamDraft(versionGroupSlug, 'Team');
    draft = addTeamMember(draft, 'mon');
    const id = draft.members[0]!.id;
    const capabilities = resolveBuildGameCapabilities({ slug: versionGroupSlug, generation });
    return computeTeamWarnings(draft, new Map([[id, contextFor(nationalDexNumber)]]), capabilities);
  }

  it('Red/Blue + Pikachu (Gen I): available', () => {
    const warnings = warningsFor('red-blue', 1, 25);
    expect(warnings.some((w) => w.code === 'speciesUnavailableInGeneration')).toBe(false);
  });

  it('Red/Blue + Mew (Gen I): available', () => {
    const warnings = warningsFor('red-blue', 1, 151);
    expect(warnings.some((w) => w.code === 'speciesUnavailableInGeneration')).toBe(false);
  });

  it('Red/Blue + Garchomp (Gen IV species in a Gen I game): INVALID', () => {
    const warnings = warningsFor('red-blue', 1, 445);
    expect(warnings).toContainEqual({
      code: 'speciesUnavailableInGeneration',
      severity: 'invalid',
      memberId: expect.any(String),
    });
  });

  it('Emerald (Gen III) + Garchomp (Gen IV): INVALID', () => {
    const warnings = warningsFor('emerald', 3, 445);
    expect(warnings.some((w) => w.code === 'speciesUnavailableInGeneration')).toBe(true);
  });

  it('a Gen IV-era context + Garchomp: available', () => {
    const warnings = warningsFor('diamond-pearl', 4, 445);
    expect(warnings.some((w) => w.code === 'speciesUnavailableInGeneration')).toBe(false);
  });

  it('Scarlet/Violet (Gen IX) + Garchomp: available', () => {
    const warnings = warningsFor('scarlet-violet', 9, 445);
    expect(warnings.some((w) => w.code === 'speciesUnavailableInGeneration')).toBe(false);
  });

  it('makes computeTeamStatus INVALID even when every other check passes', () => {
    let draft = createEmptyTeamDraft('red-blue', 'Team');
    for (let i = 0; i < 6; i++) draft = addTeamMember(draft, `mon-${i}`);
    const context = contextFor(445); // Garchomp — unavailable in Gen I
    const contexts = new Map(draft.members.map((m) => [m.id, context]));
    const capabilities = resolveBuildGameCapabilities({ slug: 'red-blue', generation: 1 });
    const warnings = computeTeamWarnings(draft, contexts, capabilities);
    expect(computeTeamStatus(warnings)).toBe('invalid');
  });

  it('is skipped entirely when no capabilities/generation are known (never guessed)', () => {
    const warnings = warningsFor('red-blue', 1, 445);
    // Sanity: with capabilities, Garchomp is flagged in Red/Blue...
    expect(warnings.some((w) => w.code === 'speciesUnavailableInGeneration')).toBe(true);

    // ...but calling without any capabilities at all must not invent the check.
    let draft = createEmptyTeamDraft('red-blue', 'Team');
    draft = addTeamMember(draft, 'mon');
    const id = draft.members[0]!.id;
    const noCapWarnings = computeTeamWarnings(draft, new Map([[id, contextFor(445)]]));
    expect(noCapWarnings.some((w) => w.code === 'speciesUnavailableInGeneration')).toBe(false);
  });

  it('disappears automatically when switching back to a compatible generation — no re-selection needed', () => {
    const invalidInRedBlue = warningsFor('red-blue', 1, 445);
    expect(invalidInRedBlue.some((w) => w.code === 'speciesUnavailableInGeneration')).toBe(true);

    const validInScarletViolet = warningsFor('scarlet-violet', 9, 445);
    expect(validInScarletViolet.some((w) => w.code === 'speciesUnavailableInGeneration')).toBe(
      false,
    );
  });
});

describe('computeTeamStatus (team status model, §8: INCOMPLETE / INVALID / VALID)', () => {
  it('is incomplete for an empty team', () => {
    const draft = createEmptyTeamDraft('sv', 'Team');
    expect(computeTeamStatus(computeTeamWarnings(draft, new Map()))).toBe('incomplete');
  });

  it('is invalid when any invalid-severity issue exists, even alongside an incomplete one (fewer than 6 members)', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    draft = updateTeamMember(draft, id, { abilitySlug: 'levitate' }); // invalid for Garchomp
    const warnings = computeTeamWarnings(draft, new Map([[id, GARCHOMP_CONTEXT]]));
    expect(warnings.some((w) => w.severity === 'incomplete')).toBe(true); // still <6 members
    expect(computeTeamStatus(warnings)).toBe('invalid'); // invalid still wins
  });

  it('is valid once a full, correctly-configured team has no invalid issues — a repeated-weakness WARNING does not block VALID', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    for (let i = 0; i < 6; i++) draft = addTeamMember(draft, `mon-${i}`);
    const context: MemberValidationContext = {
      types: ['grass'], // all six share a type — triggers repeatedSevereWeakness (a WARNING, not blocking)
      validAbilitySlugs: ['overgrow'],
      legalMoveSlugs: ['tackle'],
      nationalDexNumber: 1,
    };
    const contexts = new Map(draft.members.map((m) => [m.id, context]));
    for (const m of draft.members) {
      draft = updateTeamMember(draft, m.id, {
        abilitySlug: 'overgrow',
        moveSlugs: ['tackle', null, null, null],
      });
    }
    const warnings = computeTeamWarnings(draft, contexts);
    expect(warnings.some((w) => w.code === 'repeatedSevereWeakness')).toBe(true);
    expect(computeTeamStatus(warnings)).toBe('valid');
  });

  it('returns to valid once the invalid issue is corrected — no team-level state gets stuck', () => {
    let draft = createEmptyTeamDraft('sv', 'Team');
    for (let i = 0; i < 6; i++) draft = addTeamMember(draft, `mon-${i}`);
    const context: MemberValidationContext = {
      types: ['normal'],
      validAbilitySlugs: ['run-away'],
      legalMoveSlugs: ['tackle'],
      nationalDexNumber: 1,
    };
    const contexts = new Map(draft.members.map((m) => [m.id, context]));
    for (const m of draft.members) {
      draft = updateTeamMember(draft, m.id, {
        abilitySlug: 'levitate', // invalid for every member
        moveSlugs: ['tackle', null, null, null],
      });
    }
    expect(computeTeamStatus(computeTeamWarnings(draft, contexts))).toBe('invalid');

    for (const m of draft.members) {
      draft = updateTeamMember(draft, m.id, { abilitySlug: 'run-away' });
    }
    expect(computeTeamStatus(computeTeamWarnings(draft, contexts))).toBe('valid');
  });
});

describe('version change is non-destructive (manual review v2, §7: never destroy user work)', () => {
  it('a move that is no longer legal for the current version group is flagged INVALID, not silently removed from the draft', () => {
    let draft = createEmptyTeamDraft('scarlet-violet', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    draft = updateTeamMember(draft, id, { moveSlugs: ['defog', null, null, null] });
    // A no-op version "switch" — proving `setTeamVersionGroup` itself never
    // touches moves (see team-draft.test.ts for the direct unit test).
    draft = setTeamVersionGroup(draft, 'scarlet-violet');
    expect(draft.members[0]!.moveSlugs).toContain('defog');

    const contextWithoutDefog: MemberValidationContext = {
      ...GARCHOMP_CONTEXT,
      legalMoveSlugs: [],
    };
    const warnings = computeTeamWarnings(draft, new Map([[id, contextWithoutDefog]]));
    expect(warnings).toContainEqual({
      code: 'illegalMove',
      severity: 'invalid',
      memberId: id,
      detail: 'defog',
    });
    expect(draft.members[0]!.moveSlugs).toContain('defog'); // still there — never auto-deleted
  });

  it('switching back to a version where the move is legal makes it valid again automatically, with no re-selection and no identity lost', () => {
    let draft = createEmptyTeamDraft('scarlet-violet', 'Team');
    draft = addTeamMember(draft, 'garchomp');
    const id = draft.members[0]!.id;
    draft = updateTeamMember(draft, id, { moveSlugs: ['earthquake', null, null, null] });

    const illegalContext: MemberValidationContext = { ...GARCHOMP_CONTEXT, legalMoveSlugs: [] };
    expect(
      computeTeamWarnings(draft, new Map([[id, illegalContext]])).some(
        (w) => w.code === 'illegalMove',
      ),
    ).toBe(true);

    // Same move slug, no user action at all — only the validation context
    // changed, exactly as it would after `setTeamVersionGroup` back to a
    // compatible game.
    expect(
      computeTeamWarnings(draft, new Map([[id, GARCHOMP_CONTEXT]])).some(
        (w) => w.code === 'illegalMove',
      ),
    ).toBe(false);
    expect(draft.members[0]!.moveSlugs).toEqual(['earthquake', null, null, null]);
  });
});

describe('findDuplicateSpecies (manual review v3, §2: future Species Clause primitive — not wired into generic Build v1 validity)', () => {
  it('detects two members that are the exact same species', () => {
    let draft = createEmptyTeamDraft('scarlet-violet', 'Team');
    draft = addTeamMember(draft, 'pikachu');
    draft = addTeamMember(draft, 'pikachu');
    const [a, b] = draft.members;
    const formsBySlug = new Map([['pikachu', { speciesSlug: 'pikachu' }]]);
    const duplicates = findDuplicateSpecies(draft.members, formsBySlug);
    expect(duplicates).toEqual([{ speciesSlug: 'pikachu', memberIds: [a!.id, b!.id] }]);
  });

  it('does not flag two different species', () => {
    let draft = createEmptyTeamDraft('scarlet-violet', 'Team');
    draft = addTeamMember(draft, 'pikachu');
    draft = addTeamMember(draft, 'garchomp');
    const formsBySlug = new Map([
      ['pikachu', { speciesSlug: 'pikachu' }],
      ['garchomp', { speciesSlug: 'garchomp' }],
    ]);
    expect(findDuplicateSpecies(draft.members, formsBySlug)).toEqual([]);
  });

  it('detects two different FORMS of the same underlying species by speciesSlug, not formSlug (e.g. Rotom-Wash / Rotom-Heat)', () => {
    let draft = createEmptyTeamDraft('scarlet-violet', 'Team');
    draft = addTeamMember(draft, 'rotom-wash');
    draft = addTeamMember(draft, 'rotom-heat');
    const [a, b] = draft.members;
    const formsBySlug = new Map([
      ['rotom-wash', { speciesSlug: 'rotom' }],
      ['rotom-heat', { speciesSlug: 'rotom' }],
    ]);
    const duplicates = findDuplicateSpecies(draft.members, formsBySlug);
    expect(duplicates).toEqual([{ speciesSlug: 'rotom', memberIds: [a!.id, b!.id] }]);
  });

  it('is not reachable through computeTeamStatus/computeTeamWarnings — generic Build v1 allows duplicate species', () => {
    let draft = createEmptyTeamDraft('scarlet-violet', 'Team');
    for (let i = 0; i < 6; i++) draft = addTeamMember(draft, 'pikachu'); // six of the same species
    const context: MemberValidationContext = {
      types: ['electric'],
      validAbilitySlugs: ['static'],
      legalMoveSlugs: ['thunderbolt'],
      nationalDexNumber: 25,
    };
    const contexts = new Map(draft.members.map((m) => [m.id, context]));
    for (const m of draft.members) {
      draft = updateTeamMember(draft, m.id, {
        abilitySlug: 'static',
        moveSlugs: ['thunderbolt', null, null, null],
      });
    }
    const warnings = computeTeamWarnings(draft, contexts);
    expect(warnings.some((w) => (w.code as string).toLowerCase().includes('species'))).toBe(false);
    expect(computeTeamStatus(warnings)).toBe('valid');
  });
});

describe('buildMemberValidationContexts', () => {
  it('resolves a member context from already-fetched forms/learnsets, scoped to the draft’s own version group', () => {
    const draft = addTeamMember(createEmptyTeamDraft('scarlet-violet', 'Team'), 'garchomp');
    const member = draft.members[0]!;
    const formsBySlug = new Map([
      [
        'garchomp',
        {
          types: ['dragon', 'ground'],
          abilities: [{ slug: 'rough-skin' }, { slug: 'sand-veil' }],
          nationalDexNumber: 445,
        } as never,
      ],
    ]);
    const learnsets = {
      garchomp: {
        entries: [
          { moveSlug: 'earthquake', versionGroupSlug: 'scarlet-violet' },
          { moveSlug: 'dragon-claw', versionGroupSlug: 'sword-shield' }, // a different game — excluded
        ],
      } as never,
    };
    const contexts = buildMemberValidationContexts(
      draft.members,
      draft.versionGroupSlug,
      formsBySlug,
      learnsets,
    );
    expect(contexts.get(member.id)).toEqual({
      types: ['dragon', 'ground'],
      validAbilitySlugs: ['rough-skin', 'sand-veil'],
      legalMoveSlugs: ['earthquake'],
      nationalDexNumber: 445,
    });
  });

  it('omits a member whose form has not resolved yet, rather than inventing a context for it', () => {
    const draft = addTeamMember(createEmptyTeamDraft('scarlet-violet', 'Team'), 'garchomp');
    const contexts = buildMemberValidationContexts(
      draft.members,
      draft.versionGroupSlug,
      new Map(),
      {},
    );
    expect(contexts.size).toBe(0);
  });
});
