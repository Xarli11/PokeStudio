'use client';

import { formatMessage } from '@pokelab/i18n';

import type { TeamStatus } from '@/lib/team-analysis';

import type { WarningRow } from './team-analysis-panel';

export interface BuildStatusHeaderLabels {
  savingIndicator: string;
  saveFailed: string;
  /** "Saved · Valid" */
  savedValidLabel: string;
  /** "Draft saved · Incomplete" */
  draftSavedIncomplete: string;
  /** "Draft saved · 1 error" */
  draftSavedInvalidOne: string;
  /** "Draft saved · {count} errors" */
  draftSavedInvalidManyTemplate: string;
  /** "Review" */
  reviewLabel: string;
  /** "View all {count} issues" */
  viewAllIssuesTemplate: string;
}

/** At most this many issue lines show inline — the rest are one click away via "View all N issues" (task §5/§6: never dump a giant list into the header). */
const MAX_VISIBLE_ISSUES = 2;

/**
 * The compact, actionable top-of-page status summary (manual review v3,
 * §3-§7). Answers "what is wrong?" without hunting through the page: a
 * one-line headline plus up to two real reasons, each with a "Review"
 * action when it belongs to a specific member.
 *
 * Deliberately takes `warningRows` — the exact same array `TeamAnalysisPanel`
 * renders in its own Issues section (built once, by `buildWarningRows`, in
 * `TeamEditor`) — never a second computation of "what's wrong." Persistence
 * status (`saveStatus`) and team legality status (`teamStatus`) are two
 * different axes on purpose: a team can be `saved` and simultaneously
 * `invalid` — persistence never implies legality (task §9).
 */
export function BuildStatusHeader({
  saveStatus,
  teamStatus,
  warningRows,
  labels,
  onReviewMember,
  onViewAllIssues,
}: {
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  teamStatus: TeamStatus;
  warningRows: readonly WarningRow[];
  labels: BuildStatusHeaderLabels;
  onReviewMember: (memberId: string) => void;
  onViewAllIssues: () => void;
}) {
  if (saveStatus === 'saving') {
    return (
      <p aria-live="polite" className="m-0 text-xs text-muted">
        {labels.savingIndicator}
      </p>
    );
  }
  if (saveStatus === 'error') {
    return (
      <p role="alert" className="m-0 text-xs font-semibold text-danger">
        {labels.saveFailed}
      </p>
    );
  }
  if (saveStatus !== 'saved') return null; // idle — nothing to report yet.

  if (teamStatus === 'valid') {
    return (
      <p aria-live="polite" className="m-0 text-sm font-semibold text-success">
        <span aria-hidden="true">✓ </span>
        {labels.savedValidLabel}
      </p>
    );
  }

  // Priority mirrors `computeTeamStatus`: INVALID always wins, so when the
  // team is invalid the header shows the invalid issues (the more urgent
  // problem) — an incomplete requirement can't coexist with `teamStatus
  // === 'incomplete'` at the same time by construction (see team-analysis.ts).
  const relevantSeverity = teamStatus === 'invalid' ? 'invalid' : 'incomplete';
  const relevantRows = warningRows.filter((row) => row.severity === relevantSeverity);
  const visibleRows = relevantRows.slice(0, MAX_VISIBLE_ISSUES);
  const hiddenCount = relevantRows.length - visibleRows.length;

  const headline =
    teamStatus === 'incomplete'
      ? labels.draftSavedIncomplete
      : relevantRows.length === 1
        ? labels.draftSavedInvalidOne
        : formatMessage(labels.draftSavedInvalidManyTemplate, { count: relevantRows.length });

  return (
    <div aria-live="polite" className="flex flex-col gap-1.5">
      <p
        className={`m-0 text-sm font-semibold ${teamStatus === 'invalid' ? 'text-danger' : 'text-muted'}`}
      >
        {headline}
      </p>
      {visibleRows.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {visibleRows.map((row) => (
            <li key={row.key} className="flex flex-wrap items-center gap-2 text-sm text-foreground">
              <span aria-hidden="true">{teamStatus === 'invalid' ? '⚠' : '○'}</span>
              <span className="min-w-0 flex-1">{row.text}</span>
              {row.memberId ? (
                <button
                  type="button"
                  onClick={() => onReviewMember(row.memberId!)}
                  className="shrink-0 text-xs font-semibold text-brand underline-offset-2 hover:underline"
                >
                  {labels.reviewLabel}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={onViewAllIssues}
          className="self-start text-xs font-semibold text-brand underline-offset-2 hover:underline"
        >
          {formatMessage(labels.viewAllIssuesTemplate, { count: relevantRows.length })}
        </button>
      ) : null}
    </div>
  );
}
