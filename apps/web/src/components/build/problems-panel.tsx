'use client';

import { cardClass } from '@/lib/ui-classes';
import type { TeamWarningSeverity } from '@/lib/team-analysis';

import { SEVERITY_BADGE_STYLE, type WarningRow } from './team-analysis-panel';

export interface ProblemsPanelLabels {
  /** "Problems" */
  problemsTitle: string;
  /** "No problems detected." */
  noProblemsDetected: string;
  /** "Review" */
  reviewLabel: string;
  severityLabels: Record<TeamWarningSeverity, string>;
}

/**
 * "What do I need to fix?" (Milestone 2 final Build pass, task §13/§14) — a
 * dedicated, visually and semantically distinct section from Team Analysis
 * ("how does this team behave strategically?"). Renders the exact same
 * shared `warningRows` model the top status header already uses (task §17:
 * "no duplicated validation logic"), minus `warning`-severity rows —
 * `repeatedSevereWeakness` is the one warning-severity code today, and it's
 * a strategic observation that belongs on Team Analysis' own Defensive
 * Profile card, not a correction Problems should list (task §14's own
 * explicit call: "the exact repeated-weakness question may still belong
 * more naturally to Team Analysis").
 *
 * `id="build-problems"` is `TeamEditor`'s "View all N issues" scroll target
 * — never Team Analysis (task §15).
 */
export function ProblemsPanel({
  warningRows,
  labels,
  onReviewMember,
}: {
  warningRows: readonly WarningRow[];
  labels: ProblemsPanelLabels;
  onReviewMember: (memberId: string) => void;
}) {
  const problemRows = warningRows.filter((row) => row.severity !== 'warning');

  return (
    // `tabIndex={-1}` makes this a valid focus target for "View all N
    // issues" (task §17/§27: move focus here, not just scroll, where it can
    // be done cleanly) without adding it to the normal Tab order.
    //
    // `scroll-mt-28` (manual review, final correction pass §1): the app
    // shell's own nav header is `sticky top-0` (`persistent-shell.tsx`) and
    // can wrap to two lines on narrow viewports — `scrollIntoView`'s
    // `block: 'start'` otherwise lands this section's top edge exactly at
    // the viewport top, right under that sticky header, clipping the
    // heading and first rows. `scroll-margin-top` (not a JS pixel
    // calculation) reserves that space so the same scroll call surfaces the
    // heading and first issues below the header, generously sized to clear
    // the header's tallest (wrapped-nav, mobile) state.
    <section
      id="build-problems"
      tabIndex={-1}
      className="flex scroll-mt-28 flex-col gap-3 outline-none"
    >
      <h2 className="m-0 text-lg">{labels.problemsTitle}</h2>
      {problemRows.length === 0 ? (
        <p className="m-0 text-sm text-muted">{labels.noProblemsDetected}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {problemRows.map((row) => (
            <li
              key={row.key}
              className={cardClass('flex items-start justify-between gap-3 px-3 py-2 text-sm')}
            >
              <div className="flex min-w-0 items-start gap-2">
                <span
                  className="shrink-0 rounded-full border border-border-subtle px-2 py-0.5 text-[0.625rem] font-bold tracking-wide text-foreground uppercase"
                  style={SEVERITY_BADGE_STYLE[row.severity]}
                >
                  {labels.severityLabels[row.severity]}
                </span>
                <span className="text-foreground">{row.text}</span>
              </div>
              {/* A team-wide issue (no `memberId`, e.g. `unsupportedRuleset`)
                  gets no Review action — there's no single member selecting
                  it could open (task §32: "no fake Review action"). */}
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
      )}
    </section>
  );
}
