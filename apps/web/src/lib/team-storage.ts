import type { StatSpread } from '@pokelab/damage';
import type { PokemonType } from '@pokelab/pokemon-data';

import {
  DEFAULT_IVS,
  MAX_LEVEL,
  MAX_TEAM_MOVES,
  TEAM_DRAFT_SCHEMA_VERSION,
  ZERO_EVS,
  clampEv,
  clampIv,
  clampLevel,
  type TeamDraft,
  type TeamMemberDraft,
} from './team-draft';

/**
 * Local-only team persistence (Milestone 2, Stage 2B) — no Supabase team
 * tables yet, so "my teams" lives entirely in this browser's
 * `localStorage`, same defensive posture as `theme-toggle.tsx`'s
 * `resolveStoredOrSystemTheme`: every read is wrapped in `try/catch` and
 * falls back to "nothing saved" rather than throwing, since a private
 * window, cleared site data, or a future-incompatible shape must never
 * crash the Build page.
 */
const STORAGE_KEY = 'pokestudio:teams:v1';

interface StoredState {
  schemaVersion: number;
  teams: Record<string, TeamDraft>;
}

function isTeamDraftShape(value: unknown): value is TeamDraft {
  if (typeof value !== 'object' || value === null) return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.id === 'string' &&
    typeof draft.schemaVersion === 'number' &&
    typeof draft.name === 'string' &&
    typeof draft.versionGroupSlug === 'string' &&
    Array.isArray(draft.members) &&
    typeof draft.updatedAt === 'string'
  );
}

/**
 * Numeric domain safety (manual review, Build UX polish pass): the *shape*
 * check above only proves a member looks structurally like a
 * `TeamMemberDraft` — it says nothing about whether `level`/`evs`/`ivs`
 * are actually in range. Old data from before `team-draft.ts`'s clamping
 * existed (or hand-edited storage) can hold a level of 0, a negative EV, an
 * IV of 50, etc. Chosen strategy — same as the domain layer's own
 * `updateTeamMember`: **clamp, not discard**. A field that's the wrong
 * *type* entirely (not just out of range) falls back to a real default
 * rather than propagating `NaN`/`undefined` into the app.
 */
function sanitizeStatSpread(
  value: unknown,
  clampFn: (n: number) => number,
  fallback: StatSpread,
): StatSpread {
  if (typeof value !== 'object' || value === null) return { ...fallback };
  const spread = value as Record<string, unknown>;
  const result = { ...fallback };
  for (const key of Object.keys(fallback) as (keyof StatSpread)[]) {
    const raw = spread[key];
    if (typeof raw === 'number') result[key] = clampFn(raw);
  }
  return result;
}

function sanitizeMoveSlugs(value: unknown): (string | null)[] {
  const slugs: (string | null)[] = Array.isArray(value)
    ? value.slice(0, MAX_TEAM_MOVES).map((entry) => (typeof entry === 'string' ? entry : null))
    : [];
  while (slugs.length < MAX_TEAM_MOVES) slugs.push(null);
  return slugs;
}

/** Discards a member entirely only when it's missing its actual identity (id/formSlug) — everything else is sanitized in place, never a reason to drop it. */
function sanitizeMember(value: unknown): TeamMemberDraft | null {
  if (typeof value !== 'object' || value === null) return null;
  const member = value as Record<string, unknown>;
  if (typeof member.id !== 'string' || typeof member.formSlug !== 'string') return null;

  return {
    id: member.id,
    formSlug: member.formSlug,
    nickname: typeof member.nickname === 'string' ? member.nickname : '',
    level: typeof member.level === 'number' ? clampLevel(member.level) : MAX_LEVEL,
    abilitySlug: typeof member.abilitySlug === 'string' ? member.abilitySlug : null,
    itemSlug: typeof member.itemSlug === 'string' ? member.itemSlug : null,
    teraType: typeof member.teraType === 'string' ? (member.teraType as PokemonType) : null,
    natureSlug: typeof member.natureSlug === 'string' ? member.natureSlug : null,
    evs: sanitizeStatSpread(member.evs, clampEv, ZERO_EVS),
    ivs: sanitizeStatSpread(member.ivs, clampIv, DEFAULT_IVS),
    moveSlugs: sanitizeMoveSlugs(member.moveSlugs),
  };
}

/** Sanitizes every member of an already shape-valid draft; a member that can't be salvaged is dropped rather than discarding the whole team. */
function sanitizeTeamDraft(draft: TeamDraft): TeamDraft {
  const members = draft.members
    .map(sanitizeMember)
    .filter((member): member is TeamMemberDraft => member !== null);
  return { ...draft, members };
}

/**
 * Reads and validates whatever's stored, discarding anything that doesn't
 * look like this schema version's shape (a future schema bump, hand-edited
 * storage, or corrupted JSON) instead of guessing how to migrate it — "no
 * fake completeness": an unreadable team silently disappearing from the
 * list is safer than the app crashing or showing garbage.
 */
function readState(): StoredState {
  const empty: StoredState = { schemaVersion: TEAM_DRAFT_SCHEMA_VERSION, teams: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return empty;
    const candidate = parsed as Partial<StoredState>;
    if (
      candidate.schemaVersion !== TEAM_DRAFT_SCHEMA_VERSION ||
      typeof candidate.teams !== 'object'
    ) {
      return empty;
    }
    const teams: Record<string, TeamDraft> = {};
    for (const [id, draft] of Object.entries(candidate.teams ?? {})) {
      if (isTeamDraftShape(draft) && draft.id === id) teams[id] = sanitizeTeamDraft(draft);
    }
    return { schemaVersion: TEAM_DRAFT_SCHEMA_VERSION, teams };
  } catch {
    return empty;
  }
}

function writeState(state: StoredState): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // Private-browsing quota, storage disabled, etc. — the caller decides
    // how to surface a failed save; this layer never throws.
    return false;
  }
}

/** Newest-first (by `updatedAt`) — a "My Teams" list is most useful as a recency list, not alphabetical. */
export function listTeamDrafts(): TeamDraft[] {
  return Object.values(readState().teams).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function loadTeamDraft(id: string): TeamDraft | null {
  return readState().teams[id] ?? null;
}

/** Returns whether the save actually persisted (see `writeState`). */
export function saveTeamDraft(draft: TeamDraft): boolean {
  const state = readState();
  state.teams[draft.id] = draft;
  return writeState(state);
}

export function deleteTeamDraft(id: string): boolean {
  const state = readState();
  delete state.teams[id];
  return writeState(state);
}
