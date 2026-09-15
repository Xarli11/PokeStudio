import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { addTeamMember, createEmptyTeamDraft } from './team-draft';
import { deleteTeamDraft, listTeamDrafts, loadTeamDraft, saveTeamDraft } from './team-storage';

const STORAGE_KEY = 'pokestudio:teams:v1';

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe('team-storage', () => {
  it('returns an empty list when nothing has been saved', () => {
    expect(listTeamDrafts()).toEqual([]);
  });

  it('round-trips a saved draft through loadTeamDraft', () => {
    const draft = addTeamMember(createEmptyTeamDraft('sv', 'My Team'), 'garchomp');
    saveTeamDraft(draft);
    const loaded = loadTeamDraft(draft.id);
    expect(loaded).toEqual(draft);
  });

  it('returns null for an id that was never saved', () => {
    expect(loadTeamDraft('does-not-exist')).toBeNull();
  });

  it('lists every saved draft, newest updatedAt first', () => {
    const older = { ...createEmptyTeamDraft('sv', 'Older'), updatedAt: '2020-01-01T00:00:00.000Z' };
    const newer = { ...createEmptyTeamDraft('sv', 'Newer'), updatedAt: '2025-01-01T00:00:00.000Z' };
    saveTeamDraft(older);
    saveTeamDraft(newer);
    expect(listTeamDrafts().map((d) => d.name)).toEqual(['Newer', 'Older']);
  });

  it('deleteTeamDraft removes exactly the targeted team', () => {
    const a = createEmptyTeamDraft('sv', 'A');
    const b = createEmptyTeamDraft('sv', 'B');
    saveTeamDraft(a);
    saveTeamDraft(b);
    deleteTeamDraft(a.id);
    expect(listTeamDrafts().map((d) => d.name)).toEqual(['B']);
  });

  it('saving again with the same id overwrites rather than duplicating', () => {
    const draft = createEmptyTeamDraft('sv', 'Original');
    saveTeamDraft(draft);
    saveTeamDraft({ ...draft, name: 'Renamed' });
    expect(listTeamDrafts()).toHaveLength(1);
    expect(listTeamDrafts()[0]!.name).toBe('Renamed');
  });

  it('falls back to empty instead of throwing when storage holds invalid JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(listTeamDrafts()).toEqual([]);
  });

  it('falls back to empty instead of throwing when storage holds a recognizable-but-wrong shape', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ hello: 'world' }));
    expect(listTeamDrafts()).toEqual([]);
  });

  it('discards entries from an old/unrecognized schema version rather than guessing how to migrate them', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 999, teams: { x: { id: 'x' } } }),
    );
    expect(listTeamDrafts()).toEqual([]);
  });

  it('discards one malformed team entry without losing the other valid ones', () => {
    const good = createEmptyTeamDraft('sv', 'Good');
    saveTeamDraft(good);
    const raw = window.localStorage.getItem(STORAGE_KEY)!;
    const state = JSON.parse(raw) as { schemaVersion: number; teams: Record<string, unknown> };
    state.teams['broken'] = { not: 'a team' };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    expect(listTeamDrafts().map((d) => d.name)).toEqual(['Good']);
  });
});

describe('numeric domain safety on load (manual review: corrupt/old data must never crash Build)', () => {
  it('clamps an out-of-range level, EVs, and IVs read back from storage', () => {
    let draft = addTeamMember(createEmptyTeamDraft('sv', 'Team'), 'garchomp');
    const corruptMember = {
      ...draft.members[0]!,
      level: 999,
      evs: { hp: 999, attack: -5, defense: 50.9, specialAttack: 0, specialDefense: 0, speed: 0 },
      ivs: { hp: 50, attack: -1, defense: 31, specialAttack: 0, specialDefense: 0, speed: 0 },
    };
    draft = { ...draft, members: [corruptMember] };
    saveTeamDraft(draft);

    const loaded = loadTeamDraft(draft.id);
    expect(loaded?.members[0]?.level).toBe(100);
    expect(loaded?.members[0]?.evs).toEqual({
      hp: 252,
      attack: 0,
      defense: 50,
      specialAttack: 0,
      specialDefense: 0,
      speed: 0,
    });
    expect(loaded?.members[0]?.ivs).toEqual({
      hp: 31,
      attack: 0,
      defense: 31,
      specialAttack: 0,
      specialDefense: 0,
      speed: 0,
    });
  });

  it('falls back to real defaults when a numeric field is the wrong type entirely, rather than propagating garbage', () => {
    let draft = addTeamMember(createEmptyTeamDraft('sv', 'Team'), 'garchomp');
    const corruptMember = {
      ...draft.members[0]!,
      level: 'not a number',
      evs: 'also not an object',
    };
    draft = { ...draft, members: [corruptMember as never] };
    saveTeamDraft(draft);

    const loaded = loadTeamDraft(draft.id);
    expect(loaded?.members[0]?.level).toBe(100);
    expect(loaded?.members[0]?.evs).toEqual({
      hp: 0,
      attack: 0,
      defense: 0,
      specialAttack: 0,
      specialDefense: 0,
      speed: 0,
    });
  });

  it('never crashes, and drops only the truly unsalvageable member (missing id/formSlug)', () => {
    let draft = addTeamMember(createEmptyTeamDraft('sv', 'Team'), 'garchomp');
    draft = addTeamMember(draft, 'meowth');
    const broken = { nickname: 'Ghost', level: 50 };
    draft = { ...draft, members: [draft.members[0]!, broken as never, draft.members[1]!] };
    saveTeamDraft(draft);

    const loaded = loadTeamDraft(draft.id);
    expect(loaded?.members).toHaveLength(2);
    expect(loaded?.members.map((m) => m.formSlug)).toEqual(['garchomp', 'meowth']);
  });

  it('pads/truncates a malformed moveSlugs array to exactly 4 entries', () => {
    let draft = addTeamMember(createEmptyTeamDraft('sv', 'Team'), 'garchomp');
    const corruptMember = { ...draft.members[0]!, moveSlugs: ['tackle', 123, null] as never };
    draft = { ...draft, members: [corruptMember] };
    saveTeamDraft(draft);

    const loaded = loadTeamDraft(draft.id);
    expect(loaded?.members[0]?.moveSlugs).toEqual(['tackle', null, null, null]);
  });
});
