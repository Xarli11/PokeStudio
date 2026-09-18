import type { FormLearnsetAllEntry, VersionGroupSummary } from '@pokelab/database';

/**
 * Pure client-side derivation for the Pokémon detail Moves explorer (Phase
 * 1C.2b instant version-group switching) — the server fetches one form's
 * *entire* learnset once (`getFormLearnsetAllVersionGroups`), and everything
 * else (version-group selection, "All moves", search/type/category/method
 * filters, sorting) is computed here from that single payload. No network
 * request happens after the initial page load.
 */

/** One row per raw (move, method, level) fact, scoped to a single version group — same granularity the pre-1C.2c UI showed (a move learnable via two methods in one game is two rows). */
export interface SingleGroupMoveRow {
  moveSlug: string;
  learnMethod: string;
  level: number;
}

/** One (method, its distinct levels) pair for an aggregated "All moves" row. `levels` is only ever non-empty for `level-up` — level has no meaning for machine/egg/tutor/etc. */
export interface AggregatedMethodContext {
  learnMethod: string;
  /** Ascending, deduplicated level-up levels this move is known at, across every version group that grants it via level-up. Empty for non-level-up methods. */
  levels: number[];
}

/** One row per unique move, aggregated across every version group the form has data in (task's "All moves" semantics — never a single, possibly-misleading level/method). */
export interface AggregatedMoveRow {
  moveSlug: string;
  methods: AggregatedMethodContext[];
  /** Every version group (slug) that grants this move via any method, newest-first. */
  versionGroupSlugs: string[];
}

/** Rows for one selected version group — deliberately the same shape/granularity `getFormLearnset` used to return per-entry, just derived client-side from the already-fetched full payload instead of a new request. */
export function rowsForVersionGroup(
  entries: readonly FormLearnsetAllEntry[],
  versionGroupSlug: string,
): SingleGroupMoveRow[] {
  return entries
    .filter((entry) => entry.versionGroupSlug === versionGroupSlug)
    .map((entry) => ({
      moveSlug: entry.moveSlug,
      learnMethod: entry.learnMethod,
      level: entry.level,
    }));
}

/**
 * "All moves" aggregation: one primary row per move (task §3 — "deduplicate
 * by move identity"), collecting which methods/levels/version groups grant
 * it rather than picking one arbitrary (method, level, version group) and
 * silently discarding the rest.
 */
export function aggregateAllMoves(
  entries: readonly FormLearnsetAllEntry[],
  /** Version group slugs, newest-first — just the ranking order, not full summaries (the client component only has slug/label, computed once server-side). */
  versionGroupSlugsNewestFirst: readonly string[],
): AggregatedMoveRow[] {
  const versionGroupRank = new Map(
    versionGroupSlugsNewestFirst.map((slug, index) => [slug, index]),
  );
  const byMove = new Map<
    string,
    { methods: Map<string, Set<number>>; versionGroups: Set<string> }
  >();

  for (const entry of entries) {
    let bucket = byMove.get(entry.moveSlug);
    if (!bucket) {
      bucket = { methods: new Map(), versionGroups: new Set() };
      byMove.set(entry.moveSlug, bucket);
    }
    bucket.versionGroups.add(entry.versionGroupSlug);
    let levels = bucket.methods.get(entry.learnMethod);
    if (!levels) {
      levels = new Set();
      bucket.methods.set(entry.learnMethod, levels);
    }
    if (entry.learnMethod === 'level-up') levels.add(entry.level);
  }

  return [...byMove.entries()].map(([moveSlug, bucket]) => ({
    moveSlug,
    methods: [...bucket.methods.entries()].map(([learnMethod, levels]) => ({
      learnMethod,
      levels: [...levels].sort((a, b) => a - b),
    })),
    versionGroupSlugs: [...bucket.versionGroups].sort(
      (a, b) => (versionGroupRank.get(a) ?? 0) - (versionGroupRank.get(b) ?? 0),
    ),
  }));
}

/**
 * The version group the explorer opens on — the newest (form-scoped) group
 * that has at least one `level-up` entry, same "has real mainline coverage"
 * principle `getDefaultVersionGroup` uses site-wide (docs/engineering/DATABASE.md
 * "Raspberry Pi local development"'s sibling fix), just computed directly
 * from this form's own already-fetched data instead of a second query — a
 * form's default is always genuinely available for that form this way,
 * with no separate "requested slug not in this form's list" fallback needed.
 * Falls back to the newest group at all, then undefined for a form with no
 * learnset data anywhere.
 */
export function pickDefaultVersionGroup(
  versionGroupsNewestFirst: readonly VersionGroupSummary[],
  entries: readonly FormLearnsetAllEntry[],
): string | undefined {
  const versionGroupsWithLevelUp = new Set(
    entries
      .filter((entry) => entry.learnMethod === 'level-up')
      .map((entry) => entry.versionGroupSlug),
  );
  const preferred = versionGroupsNewestFirst.find((vg) => versionGroupsWithLevelUp.has(vg.slug));
  return (preferred ?? versionGroupsNewestFirst[0])?.slug;
}

/** A version group's display identity — `name` is the short game title alone (e.g. "Scarlet / Violet"), never the "Generation N — " prefix, so the games summary/popover (Phase 1C.2 polish) can compose either form as needed. */
export interface VersionGroupInfo {
  slug: string;
  name: string;
  generation: number;
}

/**
 * What the compact "games" trigger in an "All moves" row should show —
 * never the full list inline (that's what blew up row height before this
 * polish pass). One real game shows its own name; more than one collapses
 * to a count plus a generation hint, falling back to count-only if
 * generation metadata is somehow missing for every group.
 */
export interface GamesSummary {
  count: number;
  /** Present only when `count === 1` — the one game's own short name. */
  singleName?: string;
  minGeneration?: number;
  maxGeneration?: number;
}

export function summarizeGames(
  versionGroupSlugs: readonly string[],
  versionGroupInfoBySlug: ReadonlyMap<string, VersionGroupInfo>,
): GamesSummary {
  const infos = versionGroupSlugs
    .map((slug) => versionGroupInfoBySlug.get(slug))
    .filter((info): info is VersionGroupInfo => info !== undefined);
  if (infos.length === 0) return { count: versionGroupSlugs.length };
  if (infos.length === 1) return { count: 1, singleName: infos[0]!.name };
  const generations = infos.map((info) => info.generation);
  return {
    count: infos.length,
    minGeneration: Math.min(...generations),
    maxGeneration: Math.max(...generations),
  };
}

/**
 * Groups a move's version groups by generation for the games popover, e.g.
 * "Generación 9 / Scarlet-Violet, Champions / Generación 8 / Sword-Shield"
 * — never repeating the generation header per game (task's explicit
 * example). Relies on `versionGroupSlugs` already being newest-first with
 * same-generation entries contiguous (`aggregateAllMoves`'s own ordering
 * guarantees this — see its `versionGroupRank`).
 */
export function groupVersionGroupsByGeneration(
  versionGroupSlugs: readonly string[],
  versionGroupInfoBySlug: ReadonlyMap<string, VersionGroupInfo>,
): { generation: number; names: string[] }[] {
  const groups: { generation: number; names: string[] }[] = [];
  for (const slug of versionGroupSlugs) {
    const info = versionGroupInfoBySlug.get(slug);
    if (!info) continue;
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.generation === info.generation) {
      lastGroup.names.push(info.name);
    } else {
      groups.push({ generation: info.generation, names: [info.name] });
    }
  }
  return groups;
}

/**
 * Which learn method to show in an "All moves" row's compact summary (e.g.
 * "Level up +2") when a move has more than one — level-up preferred since
 * it's the most immediately actionable for a player, otherwise whichever
 * method sorts first in the already-deterministic `methods` order
 * (`aggregateAllMoves`'s own `Map` iteration order, itself derived from
 * the entries' own order — stable, not re-sorted here).
 */
export function summarizeMethods(methods: readonly AggregatedMethodContext[]): {
  primary: AggregatedMethodContext;
  otherCount: number;
} {
  const levelUpIndex = methods.findIndex((m) => m.learnMethod === 'level-up');
  const primary = methods[levelUpIndex >= 0 ? levelUpIndex : 0]!;
  return { primary, otherCount: methods.length - 1 };
}
