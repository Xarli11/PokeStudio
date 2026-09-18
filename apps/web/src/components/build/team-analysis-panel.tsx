import type { CSSProperties } from 'react';

import { formatMessage } from '@pokelab/i18n';
import { ALL_POKEMON_TYPES } from '@pokelab/pokemon-data';
import type { PokemonType } from '@pokelab/pokemon-data';

import { cardClass } from '@/lib/ui-classes';
import type { TeamDefensiveProfile, TeamWarning, TeamWarningSeverity } from '@/lib/team-analysis';

import { PokemonTypeBadge } from '../pokemon/type-badge';

export interface TeamAnalysisLabels {
  analysisTitle: string;
  /** "Team analysis for {game} isn't fully supported yet." — shown instead of the modern Defensive/Offensive breakdown whenever `capabilities.teamAnalysisSupported` is false (final correction pass §4). */
  unsupportedTemplate: string;
  /** "Historical type mechanics for this game are still being implemented." */
  unsupportedDetail: string;
  defensiveTitle: string;
  defensiveHint: string;
  defensiveWeakCountTemplate: string;
  defensiveResistCountTemplate: string;
  defensiveImmuneCountTemplate: string;
  /** "Repeated weakness" — badge on a defensive row that also triggered the `repeatedSevereWeakness` warning. */
  repeatedWeaknessBadge: string;
  offensiveTitle: string;
  offensiveHint: string;
  /** "{covered} / {total} types covered super-effectively". */
  offensiveSummaryTemplate: string;
  offensiveNoCoverage: string;
  coveredLabel: string;
  uncoveredLabel: string;
  severityLabels: Record<TeamWarningSeverity, string>;
  warningMessages: Record<TeamWarning['code'], string>;
  /** "{member} has 1 move unavailable in {game}." — one aggregated row per member instead of one row per illegal move (task §17: "do not flood users"). */
  memberMovesUnavailableOneTemplate: string;
  /** "{member} has {count} moves unavailable in {game}." */
  memberMovesUnavailableManyTemplate: string;
}

/**
 * Severity is a decorative accent (background wash + border), never the
 * readable text color — same accessibility discipline as `PokemonTypeBadge`
 * (`../pokemon/type-badge.tsx`). A prior version used the raw type-color
 * variable as text color directly; `--ps-type-electric` (`#f5cf4d`, a light
 * gold) against the card's light-mode background fails contrast as body
 * text — caught in manual review, fixed by keeping text on the normal
 * `text-foreground` token and moving color to the wash/border instead.
 */
export const SEVERITY_BADGE_STYLE: Record<TeamWarningSeverity, CSSProperties | undefined> = {
  incomplete: undefined,
  warning: {
    border: '1px solid color-mix(in srgb, var(--ps-type-electric) 45%, var(--ps-color-border))',
    background: 'color-mix(in srgb, var(--ps-type-electric) 16%, var(--ps-color-bg-elevated))',
  },
  invalid: {
    border: '1px solid color-mix(in srgb, var(--ps-type-fire) 45%, var(--ps-color-border))',
    background: 'color-mix(in srgb, var(--ps-type-fire) 16%, var(--ps-color-bg-elevated))',
  },
};

function warningMessage(
  warningItem: TeamWarning,
  labels: TeamAnalysisLabels,
  typeLabels: Record<PokemonType, string>,
  displayNameBySlug: ReadonlyMap<string, string>,
  memberNameById: ReadonlyMap<string, string>,
  gameLabel: string,
): string {
  const template = labels.warningMessages[warningItem.code];
  const detail = warningItem.detail ?? '';
  // `repeatedSevereWeakness`'s detail is a PokemonType slug — localize via
  // `typeLabels`. Every other code's detail is an ability/move slug —
  // resolved to its real display name via `displayNameBySlug` (already
  // available from the same reference data the set editor uses; no extra
  // query). Falls back to the raw slug only if that data hasn't loaded yet,
  // which is honest rather than blank, and self-corrects once it has.
  const resolved =
    warningItem.code === 'repeatedSevereWeakness'
      ? (typeLabels[detail as PokemonType] ?? detail)
      : (displayNameBySlug.get(detail) ?? detail);
  const member = warningItem.memberId ? (memberNameById.get(warningItem.memberId) ?? '') : '';
  return formatMessage(template, { type: resolved, detail: resolved, member, game: gameLabel });
}

export interface WarningRow {
  key: string;
  severity: TeamWarningSeverity;
  text: string;
  /** The member this issue belongs to, if any — lets a "Review" action select and open that member's Set Editor (task §7). A team-wide issue (e.g. `repeatedSevereWeakness`, `incompleteTeam`) has none. */
  memberId?: string;
}

/**
 * `illegalMove` fires once per illegal move slug — grouped here into one row
 * per member ("Mew has 2 moves unavailable in Scarlet / Violet") instead of
 * flooding the list with one line per move (task §17). Every other warning
 * code passes through unchanged, one row each.
 *
 * The ONE place this is computed — `TeamEditor` calls it once and hands the
 * same `WarningRow[]` to both `BuildStatusHeader` (the top summary) and this
 * panel's own Issues section (manual review v3, §3: "Team header and Team
 * Analysis must consume the same source of truth", never a second
 * validation engine for the header).
 */
export function buildWarningRows(
  warnings: readonly TeamWarning[],
  labels: TeamAnalysisLabels,
  typeLabels: Record<PokemonType, string>,
  displayNameBySlug: ReadonlyMap<string, string>,
  memberNameById: ReadonlyMap<string, string>,
  gameLabel: string,
): WarningRow[] {
  const illegalMoveCountByMember = new Map<string, number>();
  const rows: WarningRow[] = [];

  for (const [index, item] of warnings.entries()) {
    if (item.code === 'illegalMove' && item.memberId) {
      illegalMoveCountByMember.set(
        item.memberId,
        (illegalMoveCountByMember.get(item.memberId) ?? 0) + 1,
      );
      continue;
    }
    rows.push({
      key: `${item.code}-${item.memberId ?? ''}-${item.detail ?? ''}-${index}`,
      severity: item.severity,
      text: warningMessage(item, labels, typeLabels, displayNameBySlug, memberNameById, gameLabel),
      ...(item.memberId !== undefined ? { memberId: item.memberId } : {}),
    });
  }

  for (const [memberId, count] of illegalMoveCountByMember) {
    const template =
      count === 1
        ? labels.memberMovesUnavailableOneTemplate
        : labels.memberMovesUnavailableManyTemplate;
    rows.push({
      key: `illegalMove-${memberId}`,
      severity: 'invalid',
      text: formatMessage(template, {
        member: memberNameById.get(memberId) ?? '',
        count,
        game: gameLabel,
      }),
      memberId,
    });
  }

  return rows;
}

/**
 * Team-level analysis (Milestone 2, Stage 2B; scope narrowed in the final
 * Build pass, task §13/§23) — strictly the strategic surfaces: defensive
 * type counts and offensive type-only coverage. "What's wrong and needs
 * fixing" now lives in its own `ProblemsPanel` (`problems-panel.tsx`),
 * a distinct product surface from "how does this team behave strategically"
 * — this panel never renders a corrective issues list itself anymore.
 */
export function TeamAnalysisPanel({
  defensiveProfile,
  offensiveCoverage,
  warnings,
  typeLabels,
  labels,
  supported,
  gameLabel,
}: {
  defensiveProfile: TeamDefensiveProfile;
  offensiveCoverage: PokemonType[];
  /** Raw warnings — used here only to cross-reference which defensive types also triggered `repeatedSevereWeakness` (the badge on the Defensive Profile card) — that repeated-weakness observation is strategic, not corrective (task §14), so it stays here rather than in Problems. */
  warnings: TeamWarning[];
  typeLabels: Record<PokemonType, string>;
  labels: TeamAnalysisLabels;
  /** `capabilities.teamAnalysisSupported` (final correction pass §4) — false whenever the modern 18-type chart isn't historically accurate for the selected game. Never affects team validity; only what this one panel renders. */
  supported: boolean;
  /** The current game's human-readable name (never the raw slug) — only used in the unsupported message. */
  gameLabel: string;
}) {
  if (!supported) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="m-0 text-lg">{labels.analysisTitle}</h2>
        <p className="m-0 text-sm text-muted">
          {formatMessage(labels.unsupportedTemplate, { game: gameLabel })}
        </p>
        <p className="m-0 text-sm text-muted">{labels.unsupportedDetail}</p>
      </div>
    );
  }

  // Most-notable-first: a type with more team members weak to it (the thing
  // "surface repeated weaknesses especially clearly" is asking for) sorts
  // above one that's merely resisted, rather than alphabetical/insertion
  // order.
  const defensiveEntries = (
    Object.entries(defensiveProfile) as [
      PokemonType,
      { weak: number; resist: number; immune: number },
    ][]
  ).sort(([, a], [, b]) => b.weak - a.weak || b.resist - a.resist);
  const repeatedWeaknessTypes = new Set(
    warnings.filter((item) => item.code === 'repeatedSevereWeakness').map((item) => item.detail),
  );

  const uncoveredTypes = ALL_POKEMON_TYPES.filter((type) => !offensiveCoverage.includes(type));

  return (
    <div className="flex flex-col gap-6">
      <h2 className="m-0 text-lg">{labels.analysisTitle}</h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={cardClass('flex flex-col gap-3 p-4')}>
          <div>
            <h3 className="m-0 text-sm font-semibold text-muted">{labels.defensiveTitle}</h3>
            <p className="m-0 text-xs text-muted">{labels.defensiveHint}</p>
          </div>
          {defensiveEntries.length === 0 ? (
            <p className="m-0 text-sm text-muted">—</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {defensiveEntries.map(([type, count]) => (
                <li key={type} className="flex flex-wrap items-center gap-2 text-sm">
                  <PokemonTypeBadge type={type} label={typeLabels[type]} size="sm" />
                  <span className="text-xs text-muted">
                    {[
                      count.weak > 0
                        ? formatMessage(labels.defensiveWeakCountTemplate, { count: count.weak })
                        : null,
                      count.resist > 0
                        ? formatMessage(labels.defensiveResistCountTemplate, {
                            count: count.resist,
                          })
                        : null,
                      count.immune > 0
                        ? formatMessage(labels.defensiveImmuneCountTemplate, {
                            count: count.immune,
                          })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {repeatedWeaknessTypes.has(type) ? (
                    <span className="rounded-full border border-danger/45 bg-danger/10 px-2 py-0.5 text-[0.625rem] font-bold tracking-wide text-danger uppercase">
                      {labels.repeatedWeaknessBadge}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cardClass('flex flex-col gap-3 p-4')}>
          <div>
            <h3 className="m-0 text-sm font-semibold text-muted">{labels.offensiveTitle}</h3>
            <p className="m-0 text-xs text-muted">{labels.offensiveHint}</p>
          </div>
          <p className="m-0 text-sm font-semibold text-foreground">
            {formatMessage(labels.offensiveSummaryTemplate, {
              covered: offensiveCoverage.length,
              total: ALL_POKEMON_TYPES.length,
            })}
          </p>
          {offensiveCoverage.length === 0 ? (
            <p className="m-0 text-sm text-muted">{labels.offensiveNoCoverage}</p>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted">{labels.coveredLabel}</span>
              <div className="flex flex-wrap gap-1.5">
                {offensiveCoverage.map((type) => (
                  <PokemonTypeBadge key={type} type={type} label={typeLabels[type]} size="sm" />
                ))}
              </div>
            </div>
          )}
          {uncoveredTypes.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted">{labels.uncoveredLabel}</span>
              <div className="flex flex-wrap gap-1.5 opacity-60">
                {uncoveredTypes.map((type) => (
                  <PokemonTypeBadge key={type} type={type} label={typeLabels[type]} size="sm" />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
