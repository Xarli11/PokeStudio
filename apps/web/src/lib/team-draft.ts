import type { StatSpread } from '@pokelab/damage';
import type { PokemonType } from '@pokelab/pokemon-data';

/**
 * The Build pillar's own domain model (Milestone 2, Stage 2B) — a draft
 * team a player is assembling, persisted locally (no Supabase team tables
 * yet). Every identity field is a stable slug (`formSlug`, `abilitySlug`,
 * ...), never a display name — display names/localization are resolved at
 * render time from the reference data, same discipline as `SpeciesSearchItem`.
 *
 * `schemaVersion` exists so `team-storage.ts` can recognize and safely
 * discard a shape it no longer understands instead of crashing on it — see
 * that file's "no fake completeness" handling of corrupt/old localStorage
 * state.
 */
export const TEAM_DRAFT_SCHEMA_VERSION = 1;

export const MAX_TEAM_MEMBERS = 6;
export const MAX_TEAM_MOVES = 4;
export const MAX_EV_PER_STAT = 252;
export const MAX_EV_TOTAL = 510;
export const MAX_IV_PER_STAT = 31;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 100;

export const ZERO_EVS: StatSpread = {
  hp: 0,
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
};

/**
 * Real EVs are not required to be multiples of 4 (only every 4th point
 * changes the calculated stat) — task is explicit that enforcing that would
 * be wrong, so IVs default to a real "everything perfect" default (31,
 * the actual common default) while EVs default to genuinely zero, not some
 * invented in-between value.
 */
export const DEFAULT_IVS: StatSpread = {
  hp: 31,
  attack: 31,
  defense: 31,
  specialAttack: 31,
  specialDefense: 31,
  speed: 31,
};

export interface TeamMemberDraft {
  /** The member's own id (not the form slug) — stable across a form change, so swapping species doesn't reshuffle team order or look like remove+add. */
  id: string;
  formSlug: string;
  nickname: string;
  level: number;
  abilitySlug: string | null;
  itemSlug: string | null;
  teraType: PokemonType | null;
  natureSlug: string | null;
  evs: StatSpread;
  ivs: StatSpread;
  /** Fixed length `MAX_TEAM_MOVES`; `null` = empty slot. */
  moveSlugs: (string | null)[];
}

export interface TeamDraft {
  schemaVersion: number;
  id: string;
  name: string;
  versionGroupSlug: string;
  members: TeamMemberDraft[];
  updatedAt: string;
}

function randomId(): string {
  // `crypto.randomUUID` is available in every browser PokeLab targets
  // and in Node's test environment (jsdom polyfills `crypto` via Node's own
  // `webcrypto`) — no uuid dependency needed (Ponytail: platform capability
  // beats a library).
  return crypto.randomUUID();
}

export function createEmptyTeamMember(formSlug: string): TeamMemberDraft {
  return {
    id: randomId(),
    formSlug,
    nickname: '',
    level: MAX_LEVEL,
    abilitySlug: null,
    itemSlug: null,
    teraType: null,
    natureSlug: null,
    evs: { ...ZERO_EVS },
    ivs: { ...DEFAULT_IVS },
    moveSlugs: Array.from({ length: MAX_TEAM_MOVES }, () => null),
  };
}

export function createEmptyTeamDraft(versionGroupSlug: string, name: string): TeamDraft {
  return {
    schemaVersion: TEAM_DRAFT_SCHEMA_VERSION,
    id: randomId(),
    name,
    versionGroupSlug,
    members: [],
    updatedAt: new Date().toISOString(),
  };
}

function touch(draft: TeamDraft): TeamDraft {
  return { ...draft, updatedAt: new Date().toISOString() };
}

export function addTeamMember(draft: TeamDraft, formSlug: string): TeamDraft {
  if (draft.members.length >= MAX_TEAM_MEMBERS) return draft;
  return touch({ ...draft, members: [...draft.members, createEmptyTeamMember(formSlug)] });
}

export function removeTeamMember(draft: TeamDraft, memberId: string): TeamDraft {
  return touch({ ...draft, members: draft.members.filter((member) => member.id !== memberId) });
}

/**
 * Sanitizes whatever a caller sends for the numeric fields before merging —
 * the domain-state boundary of the "clamp, not reject" strategy (see
 * `clampLevel`/`clampEv`/`clampIv` below). Applied here so it holds
 * regardless of caller: the set editor's own inputs, a future
 * Showdown-import feature, or a stray programmatic update all go through
 * this one place.
 */
function sanitizeMemberPatch(
  patch: Partial<Omit<TeamMemberDraft, 'id'>>,
): Partial<Omit<TeamMemberDraft, 'id'>> {
  const sanitized = { ...patch };
  if (sanitized.level !== undefined) sanitized.level = clampLevel(sanitized.level);
  if (sanitized.evs !== undefined) sanitized.evs = clampStatSpread(sanitized.evs, clampEv);
  if (sanitized.ivs !== undefined) sanitized.ivs = clampStatSpread(sanitized.ivs, clampIv);
  return sanitized;
}

export function updateTeamMember(
  draft: TeamDraft,
  memberId: string,
  patch: Partial<Omit<TeamMemberDraft, 'id'>>,
): TeamDraft {
  const sanitized = sanitizeMemberPatch(patch);
  return touch({
    ...draft,
    members: draft.members.map((member) =>
      member.id === memberId ? { ...member, ...sanitized } : member,
    ),
  });
}

/**
 * Non-destructive form swap (manual review v2 — "PokeLab never destroys
 * user work merely because a draft becomes invalid"): a form change used to
 * reset ability and moves to null outright. Now it only changes `formSlug`
 * — ability/moves are *kept* and simply revalidated against the new form
 * (see `team-analysis.ts`'s `invalidAbility`/`illegalMove` warnings and the
 * Set Editor's own invalid-state UI), never silently deleted.
 * Nickname/level/nature/EVs/IVs/item/tera are untouched either way, since
 * they never depended on the specific form.
 */
export function changeTeamMemberForm(
  draft: TeamDraft,
  memberId: string,
  formSlug: string,
): TeamDraft {
  return updateTeamMember(draft, memberId, { formSlug });
}

export function renameTeamDraft(draft: TeamDraft, name: string): TeamDraft {
  return touch({ ...draft, name });
}

export function setTeamVersionGroup(draft: TeamDraft, versionGroupSlug: string): TeamDraft {
  // Non-destructive version change (manual review v2): previously this reset
  // every member's moves to null on any version switch. A move that becomes
  // unavailable in the new version group is surfaced as invalid instead (see
  // `team-analysis.ts`'s `illegalMove` warning + the Set Editor's own
  // invalid-move UI) — never silently deleted. Switching back to a
  // compatible version makes it valid again automatically, with no
  // re-selection needed, since the move slug itself was never touched.
  // Ability/item aren't version-group-scoped in PokeLab's model, so they
  // were already kept.
  return touch({ ...draft, versionGroupSlug });
}

export function evTotal(evs: StatSpread): number {
  return evs.hp + evs.attack + evs.defense + evs.specialAttack + evs.specialDefense + evs.speed;
}

/**
 * Numeric domain safety (manual review finding): the UI's own input
 * handlers already tried to keep values in range, but nothing stopped a
 * corrupt/old localStorage value, a pasted value, or a future programmatic
 * caller from writing an out-of-range number straight into a `TeamDraft`.
 * Chosen strategy — **clamp, not reject** — applied uniformly here and in
 * `team-storage.ts`'s load-time sanitization, so a `TeamDraft` can never
 * hold a level/EV/IV outside its real range regardless of where the write
 * came from. Decimals are truncated (`Math.trunc`), not rounded — an
 * accidental "31.7" becomes the still-valid "31", never rounds up past the
 * max. Non-finite input (`NaN`/`Infinity`, e.g. from an empty/garbled
 * string) falls back to `min` rather than propagating.
 */
function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function clampLevel(value: number): number {
  return clampInt(value, MIN_LEVEL, MAX_LEVEL);
}

export function clampEv(value: number): number {
  return clampInt(value, 0, MAX_EV_PER_STAT);
}

export function clampIv(value: number): number {
  return clampInt(value, 0, MAX_IV_PER_STAT);
}

export function clampStatSpread(
  spread: StatSpread,
  clampFn: (value: number) => number,
): StatSpread {
  return {
    hp: clampFn(spread.hp),
    attack: clampFn(spread.attack),
    defense: clampFn(spread.defense),
    specialAttack: clampFn(spread.specialAttack),
    specialDefense: clampFn(spread.specialDefense),
    speed: clampFn(spread.speed),
  };
}

/**
 * The most an EV field can grow to right now — the smaller of its own
 * per-field cap (`MAX_EV_PER_STAT`) and whatever headroom is left in the
 * 510 team-wide budget given the *other* five stats' current values (task:
 * prevent an invalid total by constraining what a single edit can reach,
 * never by redistributing the other fields). A single complete ceiling, so
 * callers never forget to combine it with the per-field cap themselves.
 */
export function maxEvForStat(evs: StatSpread, stat: keyof StatSpread): number {
  const others = evTotal(evs) - evs[stat];
  return Math.min(MAX_EV_PER_STAT, Math.max(0, MAX_EV_TOTAL - others));
}
