'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import type { DamageClass, PokemonType } from '@pokelab/pokemon-data';
import type { FormLearnsetAllEntry } from '@pokelab/database';
import { formatMessage } from '@pokelab/i18n';
import { pokemonTypeColorVar } from '@pokelab/ui';

import { PopoverDisclosure } from '@/components/popover-disclosure';
import { cardClass } from '@/lib/ui-classes';
import {
  aggregateAllMoves,
  groupVersionGroupsByGeneration,
  rowsForVersionGroup,
  summarizeGames,
  summarizeMethods,
  type AggregatedMoveRow,
  type VersionGroupInfo,
} from '@/lib/moves-explorer';

import { VersionGroupSelect, type VersionGroupOption } from './version-group-select';

/** Normalized move metadata (Phase 1C.2b instant switching) — sent once per unique move, never repeated per learnset entry; labels are looked up from the dictionary props at render time, not pre-localized server-side. */
export interface MovesExplorerMove {
  slug: string;
  name: string;
  type: PokemonType;
  damageClass: DamageClass;
  power?: number | undefined;
  accuracy?: number | undefined;
  pp: number;
}

export type MoveSortColumn = 'name' | 'power' | 'accuracy' | 'pp' | 'level';

export interface PokemonMovesSectionProps {
  moves: MovesExplorerMove[];
  entries: FormLearnsetAllEntry[];
  /** Newest-first — only version groups this form actually has data in. */
  versionGroups: VersionGroupOption[];
  /** The version group to open on (task: "sensible and deterministic") — `undefined` only when the form has no learnset data at all. */
  initialVersionGroupSlug: string | undefined;
  localePrefix: string;
  title: string;
  versionGroupLabel: string;
  allMovesLabel: string;
  /** Clarifies "All moves" is a historical aggregate, not "legal now" — task §3. */
  allMovesHint: string;
  noMoveDataLabel: string;
  noResultsLabel: string;
  /** Raw `{count}`/`{total}` template (e.g. "{count} of {total} moves") — formatted locally so this stays a serializable string across the server/client boundary. */
  resultCountTemplate: string;
  searchPlaceholder: string;
  searchLabel: string;
  allTypesLabel: string;
  allDamageClassesLabel: string;
  allMethodsLabel: string;
  typeLabels: Record<PokemonType, string>;
  damageClassLabels: Record<DamageClass, string>;
  methodLabels: Record<string, string>;
  typeFilterLabel: string;
  damageClassFilterLabel: string;
  methodFilterLabel: string;
  columnLabels: {
    name: string;
    type: string;
    category: string;
    power: string;
    accuracy: string;
    pp: string;
    method: string;
    level: string;
    games: string;
  };
  noPowerLabel: string;
  neverMissesLabel: string;
  /** Raw `{level}` template (e.g. "Lv. {level}") — formatted locally, same reasoning as `resultCountTemplate`. */
  levelTemplate: string;
  /** Raw `{min}`/`{max}` template for an "All moves" row learnable at different levels in different games (e.g. "Lv. {min}–{max}"). */
  levelRangeTemplate: string;
  levelOnEvolveLabel: string;
  levelNotApplicableLabel: string;
  /** Raw `{count}` template — fallback games-popover trigger text when generation metadata is missing (e.g. "{count} games"). */
  gamesCountTemplate: string;
  /** Raw `{count}`/`{number}` template for 2+ games all in the same generation (e.g. "{count} games · Gen. {number}"). */
  gamesSummarySameGenerationTemplate: string;
  /** Raw `{count}`/`{min}`/`{max}` template for games spanning generations (e.g. "{count} games · Gen. {min}–{max}"). */
  gamesSummaryRangeTemplate: string;
  /** Raw `{number}` template for a games-popover generation group heading (e.g. "Generation {number}") — the same string `VersionGroupSelect`'s own options compose with, reused here for consistency. */
  generationLabelTemplate: string;
  /** Raw `{primary}`/`{count}` template for a multi-method row's compact trigger (e.g. "{primary} +{count}"). */
  methodsSummaryTemplate: string;
  /** Raw `{primary}`/`{count}` template for the same trigger's accessible name (e.g. "{primary}, and {count} more methods"). */
  methodsSummaryAriaLabelTemplate: string;
}

/** Everything a row renderer needs beyond the row itself — bundled into one object instead of threading a growing prop list through `MethodCell`/`GamesCell`/`MoveDesktopRow`/`MoveCard` individually. */
type RowRenderCommon = Pick<
  PokemonMovesSectionProps,
  | 'localePrefix'
  | 'typeLabels'
  | 'damageClassLabels'
  | 'methodLabels'
  | 'noPowerLabel'
  | 'neverMissesLabel'
  | 'levelTemplate'
  | 'levelRangeTemplate'
  | 'levelOnEvolveLabel'
  | 'levelNotApplicableLabel'
  | 'gamesCountTemplate'
  | 'gamesSummarySameGenerationTemplate'
  | 'gamesSummaryRangeTemplate'
  | 'generationLabelTemplate'
  | 'methodsSummaryTemplate'
  | 'methodsSummaryAriaLabelTemplate'
  | 'columnLabels'
> & { versionGroupInfoBySlug: Map<string, VersionGroupInfo> };

/** One row shape both render modes share — single-version-group rows and "All moves" aggregate rows both resolve into this before filtering/sorting/rendering. */
interface DisplayRow {
  key: string;
  move: MovesExplorerMove;
  methodSlugs: string[];
  /** Single-version-group mode: exactly one method/level, matching the pre-1C.2b UI's one-row-per-entry granularity. */
  single?: { learnMethod: string; level: number };
  /** "All moves" mode: every method/level/version-group this move is known through, aggregated (task §3 — never one misleading value). */
  aggregate?: AggregatedMoveRow;
}

/** Undefined/not-applicable values always sort after every real value, regardless of direction — a null power/level is not "less than 0", it's a different kind of thing. */
function compareNullableLast(a: number | undefined, b: number | undefined): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a - b;
}

function singleRowSortLevel(row: DisplayRow): number | undefined {
  return row.single && row.single.learnMethod === 'level-up' ? row.single.level : undefined;
}

/** For "All moves" sorting: the earliest level-up level across every version group that grants it, or undefined for a move with no level-up method anywhere (sorts last, same as a non-level-up single row). */
function aggregateRowSortLevel(row: DisplayRow): number | undefined {
  const levelUp = row.aggregate?.methods.find((m) => m.learnMethod === 'level-up');
  return levelUp && levelUp.levels.length > 0 ? levelUp.levels[0] : undefined;
}

function ariaSortFor(
  column: MoveSortColumn,
  activeColumn: MoveSortColumn,
  direction: 'asc' | 'desc',
): 'ascending' | 'descending' | undefined {
  if (column !== activeColumn) return undefined;
  return direction === 'asc' ? 'ascending' : 'descending';
}

interface LevelCellProps {
  row: DisplayRow;
  levelTemplate: string;
  levelRangeTemplate: string;
  levelOnEvolveLabel: string;
  levelNotApplicableLabel: string;
}

/** Never a single possibly-misleading number when levels genuinely differ across games (task §3) — a range, "On evolve", or "—", never an invented single value. */
function LevelCell({
  row,
  levelTemplate,
  levelRangeTemplate,
  levelOnEvolveLabel,
  levelNotApplicableLabel,
}: LevelCellProps) {
  if (row.single) {
    if (row.single.learnMethod !== 'level-up') return <>{levelNotApplicableLabel}</>;
    if (row.single.level === 0) return <>{levelOnEvolveLabel}</>;
    return <>{formatMessage(levelTemplate, { level: row.single.level })}</>;
  }

  const levelUp = row.aggregate?.methods.find((m) => m.learnMethod === 'level-up');
  if (!levelUp || levelUp.levels.length === 0) return <>{levelNotApplicableLabel}</>;
  const real = levelUp.levels.filter((l) => l > 0);
  if (real.length === 0) return <>{levelOnEvolveLabel}</>;
  const min = real[0]!;
  const max = real[real.length - 1]!;
  if (min === max) return <>{formatMessage(levelTemplate, { level: min })}</>;
  return <>{formatMessage(levelRangeTemplate, { min, max })}</>;
}

/** One method's own level suffix, e.g. " (Lv. 10)" / " (On evolve)" — empty for a non-level-up method. Shared between the single-row method cell and the full method list inside the multi-method popover. */
function methodLevelSuffix(
  levels: number[],
  learnMethod: string,
  levelTemplate: string,
  levelOnEvolveLabel: string,
): string {
  if (learnMethod !== 'level-up') return '';
  const real = levels.filter((l) => l > 0);
  if (real.length > 0) {
    return ` (${formatMessage(levelTemplate, { level: real[0]! })}${real.length > 1 ? '+' : ''})`;
  }
  return ` (${levelOnEvolveLabel})`;
}

/**
 * A move's learn method(s) for one row (Phase 1C.2 density polish). A
 * single-version-group row is always one method — rendered plainly, no
 * popover. An "All moves" row can carry several; stacking every one as its
 * own badge used to make rows grow tall for a move learnable half a dozen
 * ways, so 2+ collapse into "{primary method} +{N}" with the full list one
 * click away — same information, none of it lost, none of it inline.
 */
function MethodCell({ row, common }: { row: DisplayRow; common: RowRenderCommon }) {
  const {
    methodLabels,
    levelTemplate,
    levelOnEvolveLabel,
    methodsSummaryTemplate,
    methodsSummaryAriaLabelTemplate,
  } = common;

  if (row.single) {
    const suffix = methodLevelSuffix(
      [row.single.level],
      row.single.learnMethod,
      levelTemplate,
      levelOnEvolveLabel,
    );
    return <>{(methodLabels[row.single.learnMethod] ?? row.single.learnMethod) + suffix}</>;
  }

  const methods = row.aggregate!.methods;
  if (methods.length === 1) {
    const m = methods[0]!;
    const suffix = methodLevelSuffix(m.levels, m.learnMethod, levelTemplate, levelOnEvolveLabel);
    return <>{(methodLabels[m.learnMethod] ?? m.learnMethod) + suffix}</>;
  }

  const { primary, otherCount } = summarizeMethods(methods);
  const primaryLabel = methodLabels[primary.learnMethod] ?? primary.learnMethod;
  return (
    <PopoverDisclosure
      trigger={formatMessage(methodsSummaryTemplate, { primary: primaryLabel, count: otherCount })}
      triggerAriaLabel={formatMessage(methodsSummaryAriaLabelTemplate, {
        primary: primaryLabel,
        count: otherCount,
      })}
    >
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {methods.map((m) => (
          <li key={m.learnMethod}>
            {(methodLabels[m.learnMethod] ?? m.learnMethod) +
              methodLevelSuffix(m.levels, m.learnMethod, levelTemplate, levelOnEvolveLabel)}
          </li>
        ))}
      </ul>
    </PopoverDisclosure>
  );
}

/**
 * A move's granting version groups for one "All moves" row (Phase 1C.2
 * density polish — replaces an inline `<details>` expansion that grew the
 * row itself; see `PopoverDisclosure`). One game shows its own name
 * directly; more collapse to a count plus a generation hint, grouped by
 * generation inside the popover so "Generación 9" is never repeated once
 * per game.
 */
function GamesCell({
  row,
  common,
  align,
}: {
  row: DisplayRow;
  common: RowRenderCommon;
  align: 'start' | 'end';
}) {
  const {
    versionGroupInfoBySlug,
    gamesCountTemplate,
    gamesSummarySameGenerationTemplate,
    gamesSummaryRangeTemplate,
    generationLabelTemplate,
  } = common;

  if (!row.aggregate) return null;
  const slugs = row.aggregate.versionGroupSlugs;
  const summary = summarizeGames(slugs, versionGroupInfoBySlug);

  if (summary.singleName !== undefined) {
    return <span className="max-w-[11rem] truncate text-xs text-muted">{summary.singleName}</span>;
  }

  const triggerText =
    summary.minGeneration === undefined
      ? formatMessage(gamesCountTemplate, { count: summary.count })
      : summary.minGeneration === summary.maxGeneration
        ? formatMessage(gamesSummarySameGenerationTemplate, {
            count: summary.count,
            number: summary.minGeneration,
          })
        : formatMessage(gamesSummaryRangeTemplate, {
            count: summary.count,
            min: summary.minGeneration,
            max: summary.maxGeneration!,
          });

  const groups = groupVersionGroupsByGeneration(slugs, versionGroupInfoBySlug);

  return (
    <PopoverDisclosure trigger={triggerText} align={align}>
      <div className="flex flex-col gap-2">
        {groups.map((group) => (
          <div key={group.generation}>
            <p className="m-0 text-[0.6875rem] font-bold tracking-wide text-muted uppercase">
              {formatMessage(generationLabelTemplate, { number: group.generation })}
            </p>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {group.names.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </PopoverDisclosure>
  );
}

function MoveDesktopRow({ row, common }: { row: DisplayRow; common: RowRenderCommon }) {
  const { localePrefix, typeLabels, damageClassLabels, noPowerLabel, neverMissesLabel } = common;
  const colorVar = pokemonTypeColorVar[row.move.type];

  return (
    <tr className="border-b border-border-subtle last:border-b-0">
      <th scope="row" className="px-3 py-1.5 text-left font-semibold">
        <Link
          href={`${localePrefix}/moves/${row.move.slug}`}
          className="text-foreground no-underline hover:text-brand hover:underline"
        >
          {row.move.name}
        </Link>
      </th>
      <td className="px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: `var(${colorVar})` }}
          />
          {typeLabels[row.move.type]}
        </span>
      </td>
      <td className="px-3 py-1.5">{damageClassLabels[row.move.damageClass]}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{row.move.power ?? noPowerLabel}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">
        {row.move.accuracy ?? neverMissesLabel}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums">{row.move.pp}</td>
      <td className="px-3 py-1.5">
        <MethodCell row={row} common={common} />
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums">
        <LevelCell
          row={row}
          levelTemplate={common.levelTemplate}
          levelRangeTemplate={common.levelRangeTemplate}
          levelOnEvolveLabel={common.levelOnEvolveLabel}
          levelNotApplicableLabel={common.levelNotApplicableLabel}
        />
      </td>
      {row.aggregate ? (
        <td className="px-3 py-1.5">
          <GamesCell row={row} common={common} align="end" />
        </td>
      ) : null}
    </tr>
  );
}

function MoveCard({ row, common }: { row: DisplayRow; common: RowRenderCommon }) {
  const {
    localePrefix,
    columnLabels,
    typeLabels,
    damageClassLabels,
    noPowerLabel,
    neverMissesLabel,
  } = common;
  const colorVar = pokemonTypeColorVar[row.move.type];

  return (
    <li className="flex flex-col gap-1.5 border-b border-border-subtle py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`${localePrefix}/moves/${row.move.slug}`}
          className="font-semibold text-foreground no-underline hover:text-brand hover:underline"
        >
          {row.move.name}
        </Link>
        <MethodCell row={row} common={common} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: `var(${colorVar})` }}
          />
          {typeLabels[row.move.type]}
        </span>
        <span>{damageClassLabels[row.move.damageClass]}</span>
        <span>
          {columnLabels.power} {row.move.power ?? noPowerLabel}
        </span>
        <span>
          {columnLabels.accuracy} {row.move.accuracy ?? neverMissesLabel}
        </span>
        <span>
          {columnLabels.pp} {row.move.pp}
        </span>
        <span>
          {columnLabels.level}{' '}
          <LevelCell
            row={row}
            levelTemplate={common.levelTemplate}
            levelRangeTemplate={common.levelRangeTemplate}
            levelOnEvolveLabel={common.levelOnEvolveLabel}
            levelNotApplicableLabel={common.levelNotApplicableLabel}
          />
        </span>
      </div>
      {row.aggregate ? <GamesCell row={row} common={common} align="start" /> : null}
    </li>
  );
}

/**
 * A filterable/sortable Moves explorer for the Pokémon detail page (Phase
 * 1C.2b instant client-side version switching). Owns version-group
 * selection, "All moves", and every filter/sort as plain client state —
 * the server fetches this form's *entire* learnset once
 * (`getFormLearnsetAllVersionGroups`, a bounded per-form query, never the
 * ~693k-row global table); switching version groups or toggling "All moves"
 * only re-derives rows from that already-fetched payload via pure functions
 * (`@/lib/moves-explorer`) — never a `router.push`, never a new request, no
 * loading transition. Desktop/tablet renders a real `<table>`; mobile
 * renders a compact card list — never both visible at once, never a table
 * forced into horizontal scroll on narrow screens.
 */
export function PokemonMovesSection({
  moves,
  entries,
  versionGroups,
  initialVersionGroupSlug,
  localePrefix,
  title,
  versionGroupLabel,
  allMovesLabel,
  allMovesHint,
  noMoveDataLabel,
  noResultsLabel,
  resultCountTemplate,
  searchPlaceholder,
  searchLabel,
  allTypesLabel,
  allDamageClassesLabel,
  allMethodsLabel,
  typeLabels,
  damageClassLabels,
  methodLabels,
  typeFilterLabel,
  damageClassFilterLabel,
  methodFilterLabel,
  columnLabels,
  noPowerLabel,
  neverMissesLabel,
  levelTemplate,
  levelRangeTemplate,
  levelOnEvolveLabel,
  levelNotApplicableLabel,
  gamesCountTemplate,
  gamesSummarySameGenerationTemplate,
  gamesSummaryRangeTemplate,
  generationLabelTemplate,
  methodsSummaryTemplate,
  methodsSummaryAriaLabelTemplate,
}: PokemonMovesSectionProps) {
  const [selectedVersionGroup, setSelectedVersionGroup] = useState<string | undefined>(
    initialVersionGroupSlug,
  );
  const [allMoves, setAllMoves] = useState(false);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [damageClass, setDamageClass] = useState('');
  const [method, setMethod] = useState('');
  const [sortColumn, setSortColumn] = useState<MoveSortColumn>('level');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const moveBySlug = useMemo(() => new Map(moves.map((m) => [m.slug, m])), [moves]);
  const versionGroupInfoBySlug = useMemo(
    () =>
      new Map(
        versionGroups.map((vg) => [
          vg.slug,
          { slug: vg.slug, name: vg.name, generation: vg.generation },
        ]),
      ),
    [versionGroups],
  );
  const versionGroupSlugsNewestFirst = useMemo(
    () => versionGroups.map((vg) => vg.slug),
    [versionGroups],
  );

  const rows: DisplayRow[] = useMemo(() => {
    const result: DisplayRow[] = [];
    if (allMoves) {
      for (const aggregate of aggregateAllMoves(entries, versionGroupSlugsNewestFirst)) {
        const move = moveBySlug.get(aggregate.moveSlug);
        if (!move) continue; // defensive: should never happen, moves/entries come from the same query
        result.push({
          key: aggregate.moveSlug,
          move,
          methodSlugs: aggregate.methods.map((m) => m.learnMethod),
          aggregate,
        });
      }
      return result;
    }
    if (!selectedVersionGroup) return result;
    for (const entry of rowsForVersionGroup(entries, selectedVersionGroup)) {
      const move = moveBySlug.get(entry.moveSlug);
      if (!move) continue; // defensive: should never happen, moves/entries come from the same query
      result.push({
        key: `${entry.moveSlug}:${entry.learnMethod}:${entry.level}`,
        move,
        methodSlugs: [entry.learnMethod],
        single: { learnMethod: entry.learnMethod, level: entry.level },
      });
    }
    return result;
  }, [allMoves, entries, moveBySlug, selectedVersionGroup, versionGroupSlugsNewestFirst]);

  const availableTypes = useMemo(() => [...new Set(rows.map((r) => r.move.type))].sort(), [rows]);
  const availableDamageClasses = useMemo(
    () => [...new Set(rows.map((r) => r.move.damageClass))].sort(),
    [rows],
  );
  const availableMethods = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) for (const m of r.methodSlugs) seen.add(m);
    return [...seen].map((slug) => [slug, methodLabels[slug] ?? slug] as const);
  }, [rows, methodLabels]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (query && !r.move.name.toLowerCase().includes(query)) return false;
      if (type && r.move.type !== type) return false;
      if (damageClass && r.move.damageClass !== damageClass) return false;
      if (method && !r.methodSlugs.includes(method)) return false;
      return true;
    });
  }, [rows, search, type, damageClass, method]);

  const sorted = useMemo(() => {
    const withIndex = filtered.map((row, index) => ({ row, index }));
    withIndex.sort((a, b) => {
      let cmp: number;
      switch (sortColumn) {
        case 'name':
          cmp = a.row.move.name.localeCompare(b.row.move.name);
          break;
        case 'power':
          cmp = compareNullableLast(a.row.move.power, b.row.move.power);
          break;
        case 'accuracy':
          cmp = compareNullableLast(a.row.move.accuracy, b.row.move.accuracy);
          break;
        case 'pp':
          cmp = a.row.move.pp - b.row.move.pp;
          break;
        case 'level':
          cmp = compareNullableLast(
            a.row.single ? singleRowSortLevel(a.row) : aggregateRowSortLevel(a.row),
            b.row.single ? singleRowSortLevel(b.row) : aggregateRowSortLevel(b.row),
          );
          break;
      }
      if (cmp !== 0) return sortDirection === 'asc' ? cmp : -cmp;
      return a.index - b.index; // stable
    });
    return withIndex.map((x) => x.row);
  }, [filtered, sortColumn, sortDirection]);

  function toggleSort(column: MoveSortColumn) {
    if (column === sortColumn) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  function sortButton(column: MoveSortColumn, label: string) {
    const active = sortColumn === column;
    return (
      <button
        type="button"
        onClick={() => toggleSort(column)}
        aria-pressed={active}
        className="inline-flex cursor-pointer items-center gap-1 bg-transparent p-0 font-semibold text-foreground hover:text-brand focus-visible:text-brand"
      >
        {label}
        {active ? <span aria-hidden="true">{sortDirection === 'asc' ? '▲' : '▼'}</span> : null}
      </button>
    );
  }

  const common: RowRenderCommon = {
    localePrefix,
    typeLabels,
    damageClassLabels,
    methodLabels,
    noPowerLabel,
    neverMissesLabel,
    levelTemplate,
    levelRangeTemplate,
    levelOnEvolveLabel,
    levelNotApplicableLabel,
    columnLabels,
    versionGroupInfoBySlug,
    gamesCountTemplate,
    gamesSummarySameGenerationTemplate,
    gamesSummaryRangeTemplate,
    generationLabelTemplate,
    methodsSummaryTemplate,
    methodsSummaryAriaLabelTemplate,
  };

  const hasAnyData = versionGroups.length > 0;

  return (
    <section className={cardClass('flex flex-col gap-3 px-5 py-4')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-lg">{title}</h2>
        <VersionGroupSelect
          label={versionGroupLabel}
          options={versionGroups}
          selectedSlug={allMoves ? undefined : selectedVersionGroup}
          allMovesLabel={allMovesLabel}
          onChange={(selection) => {
            if ('allMoves' in selection) {
              setAllMoves(true);
            } else {
              setAllMoves(false);
              setSelectedVersionGroup(selection.versionGroupSlug);
            }
          }}
        />
      </div>

      {!hasAnyData ? (
        <p className="m-0 text-sm text-muted">{noMoveDataLabel}</p>
      ) : (
        <>
          {allMoves ? (
            <p className="m-0 max-w-prose text-xs leading-relaxed text-muted">{allMovesHint}</p>
          ) : null}

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-1 basis-40 flex-col gap-1 text-xs text-muted">
              <span>{searchLabel}</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              <span>{typeFilterLabel}</span>
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">{allTypesLabel}</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {typeLabels[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              <span>{damageClassFilterLabel}</span>
              <select
                value={damageClass}
                onChange={(event) => setDamageClass(event.target.value)}
                className="rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">{allDamageClassesLabel}</option>
                {availableDamageClasses.map((d) => (
                  <option key={d} value={d}>
                    {damageClassLabels[d]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              <span>{methodFilterLabel}</span>
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className="rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">{allMethodsLabel}</option>
                {availableMethods.map(([slug, label]) => (
                  <option key={slug} value={slug}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="m-0 text-xs text-muted" aria-live="polite">
            {formatMessage(resultCountTemplate, { count: sorted.length, total: rows.length })}
          </p>

          {sorted.length === 0 ? (
            <p className="m-0 text-sm text-muted">{noResultsLabel}</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle text-left text-xs text-muted uppercase tracking-wide">
                      <th
                        scope="col"
                        className="px-3 py-2"
                        aria-sort={ariaSortFor('name', sortColumn, sortDirection)}
                      >
                        {sortButton('name', columnLabels.name)}
                      </th>
                      <th scope="col" className="px-3 py-2">
                        {columnLabels.type}
                      </th>
                      <th scope="col" className="px-3 py-2">
                        {columnLabels.category}
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-right"
                        aria-sort={ariaSortFor('power', sortColumn, sortDirection)}
                      >
                        {sortButton('power', columnLabels.power)}
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-right"
                        aria-sort={ariaSortFor('accuracy', sortColumn, sortDirection)}
                      >
                        {sortButton('accuracy', columnLabels.accuracy)}
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-right"
                        aria-sort={ariaSortFor('pp', sortColumn, sortDirection)}
                      >
                        {sortButton('pp', columnLabels.pp)}
                      </th>
                      <th scope="col" className="px-3 py-2">
                        {columnLabels.method}
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-right"
                        aria-sort={ariaSortFor('level', sortColumn, sortDirection)}
                      >
                        {sortButton('level', columnLabels.level)}
                      </th>
                      {allMoves ? (
                        <th scope="col" className="px-3 py-2">
                          {columnLabels.games}
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row) => (
                      <MoveDesktopRow key={row.key} row={row} common={common} />
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="m-0 flex list-none flex-col p-0 sm:hidden">
                {sorted.map((row) => (
                  <MoveCard key={row.key} row={row} common={common} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
