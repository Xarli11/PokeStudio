'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type {
  ComparablePokemonForm,
  FormLearnsetAllVersionGroups,
  VersionGroupSummary,
} from '@pokelab/database';
import { formatMessage, type Locale } from '@pokelab/i18n';

import { resolveBuildGameCapabilities } from '@/lib/build-game-capabilities';
import { buttonClass, cardClass } from '@/lib/ui-classes';
import {
  buildMemberValidationContexts,
  computeTeamStatus,
  computeTeamWarnings,
  type TeamStatus,
} from '@/lib/team-analysis';
import { createEmptyTeamDraft, type TeamDraft } from '@/lib/team-draft';
import { deleteTeamDraft, listTeamDrafts, saveTeamDraft } from '@/lib/team-storage';

import { fetchTeamMemberReferenceData } from '@/app/[locale]/build/actions';

import { ConfirmDialog } from './confirm-dialog';

export interface BuildHomeLabels {
  myTeams: string;
  newTeam: string;
  untitledTeam: string;
  noTeams: string;
  memberCountTemplate: string;
  openTeamTemplate: string;
  deleteTeamTemplate: string;
  deleteConfirmTemplate: string;
  deleteDialogTitle: string;
  confirmDeleteLabel: string;
  cancelLabel: string;
  /** "Valid" — a team with no incomplete requirements and no invalid issues (task §9: persistence never implies legality, so this is always spelled out, not just "Saved"). */
  teamStatusValid: string;
  teamStatusIncomplete: string;
  teamStatusInvalidOne: string;
  teamStatusInvalidManyTemplate: string;
}

interface TeamStatusSummary {
  status: TeamStatus;
  invalidCount: number;
}

export interface BuildHomeProps {
  locale: Locale;
  defaultVersionGroupSlug: string | null;
  versionGroups: VersionGroupSummary[];
  labels: BuildHomeLabels;
}

/**
 * Build's home: a lightweight "My Teams" list, not a dashboard (task's
 * explicit restraint). Reads/writes only `localStorage` — there is no
 * server-side team storage yet, so this never fetches from the database.
 * `teams === null` is the one-render "hasn't hydrated from localStorage
 * yet" state, kept distinct from "loaded and empty" so a page reload never
 * flashes a false "no teams" message before the real list is read.
 */
export function BuildHome({
  locale,
  defaultVersionGroupSlug,
  versionGroups,
  labels,
}: BuildHomeProps) {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamDraft[] | null>(null);
  // Manual review: a browser-native `window.confirm` isn't styled/localized
  // consistently and reads as a chrome interruption, not a PokeLab
  // surface — replaced with `ConfirmDialog`. Holding the target team here
  // (not just a boolean) keeps its name available for the dialog's
  // description without re-reading storage.
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  // "My Teams" status badges (task §9/§17: persistence never implies
  // legality, so each saved draft's real INCOMPLETE/INVALID/VALID status is
  // shown, not just "saved"). One batched reference-data fetch across every
  // team's distinct form slugs, reusing the exact same validation-context
  // and warning logic `TeamEditor` uses for a single team — no duplicated
  // rules, no per-card round trip.
  const [statusByTeamId, setStatusByTeamId] = useState<Record<string, TeamStatusSummary>>({});

  useEffect(() => {
    const loaded = listTeamDrafts();
    setTeams(loaded);

    function summarize(
      formsBySlug: ReadonlyMap<string, ComparablePokemonForm>,
      learnsetsByFormSlug: Readonly<Record<string, FormLearnsetAllVersionGroups>>,
    ): Record<string, TeamStatusSummary> {
      const statuses: Record<string, TeamStatusSummary> = {};
      for (const team of loaded) {
        const context = buildMemberValidationContexts(
          team.members,
          team.versionGroupSlug,
          formsBySlug,
          learnsetsByFormSlug,
        );
        const generation =
          versionGroups.find((vg) => vg.slug === team.versionGroupSlug)?.generation ?? 0;
        const capabilities = resolveBuildGameCapabilities({
          slug: team.versionGroupSlug,
          generation,
        });
        const warnings = computeTeamWarnings(team, context, capabilities);
        statuses[team.id] = {
          status: computeTeamStatus(warnings),
          invalidCount: warnings.filter((item) => item.severity === 'invalid').length,
        };
      }
      return statuses;
    }

    const allFormSlugs = [
      ...new Set(loaded.flatMap((team) => team.members.map((m) => m.formSlug))),
    ];
    if (allFormSlugs.length === 0) {
      // No member has a form to resolve, but an empty/partial team still has
      // a real status (INCOMPLETE) computable with no reference data at all.
      setStatusByTeamId(summarize(new Map(), {}));
      return;
    }
    let cancelled = false;
    fetchTeamMemberReferenceData(allFormSlugs).then((data) => {
      if (cancelled) return;
      const formsBySlug = new Map(data.forms.map((form) => [form.formSlug, form]));
      setStatusByTeamId(summarize(formsBySlug, data.learnsets));
    });
    return () => {
      cancelled = true;
    };
    // `versionGroups` comes from the server for this page's lifetime (a
    // locale/navigation change remounts the whole page), so listing it here
    // doesn't turn this into a per-render effect — it just satisfies
    // exhaustive-deps honestly instead of suppressing the lint rule.
  }, [versionGroups]);

  function statusText(summary: TeamStatusSummary | undefined): string | null {
    if (!summary) return null;
    if (summary.status === 'valid') return labels.teamStatusValid;
    if (summary.status === 'incomplete') return labels.teamStatusIncomplete;
    return summary.invalidCount === 1
      ? labels.teamStatusInvalidOne
      : formatMessage(labels.teamStatusInvalidManyTemplate, { count: summary.invalidCount });
  }

  function handleNewTeam(): void {
    if (!defaultVersionGroupSlug) return;
    const draft = createEmptyTeamDraft(defaultVersionGroupSlug, labels.untitledTeam);
    saveTeamDraft(draft);
    router.push(`/${locale}/build/${draft.id}`);
  }

  function confirmDelete(): void {
    if (!pendingDelete) return;
    deleteTeamDraft(pendingDelete.id);
    setTeams(listTeamDrafts());
    setPendingDelete(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-xl">{labels.myTeams}</h2>
        <button
          type="button"
          onClick={handleNewTeam}
          disabled={!defaultVersionGroupSlug}
          className={buttonClass('primary')}
        >
          {labels.newTeam}
        </button>
      </div>

      {teams === null ? null : teams.length === 0 ? (
        <p className={cardClass('m-0 px-5 py-8 text-center text-sm text-muted')}>
          {labels.noTeams}
        </p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <li key={team.id} className={cardClass('flex items-center justify-between gap-3 p-4')}>
              <Link
                href={`/${locale}/build/${team.id}`}
                aria-label={formatMessage(labels.openTeamTemplate, { name: team.name })}
                className="min-w-0 flex-1 text-inherit no-underline"
              >
                <span className="block truncate font-semibold text-foreground">{team.name}</span>
                <span className="block text-xs text-muted">
                  {formatMessage(labels.memberCountTemplate, { count: team.members.length })}
                </span>
                {statusText(statusByTeamId[team.id]) ? (
                  <span
                    className={`mt-0.5 block text-xs font-semibold ${
                      statusByTeamId[team.id]?.status === 'valid'
                        ? 'text-success'
                        : statusByTeamId[team.id]?.status === 'invalid'
                          ? 'text-danger'
                          : 'text-muted'
                    }`}
                  >
                    <span aria-hidden="true">
                      {statusByTeamId[team.id]?.status === 'valid'
                        ? '✓ '
                        : statusByTeamId[team.id]?.status === 'invalid'
                          ? '⚠ '
                          : '○ '}
                    </span>
                    {statusText(statusByTeamId[team.id])}
                  </span>
                ) : null}
              </Link>
              <button
                type="button"
                onClick={() => setPendingDelete({ id: team.id, name: team.name })}
                aria-label={formatMessage(labels.deleteTeamTemplate, { name: team.name })}
                className="shrink-0 rounded-full border border-border-subtle bg-surface px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={labels.deleteDialogTitle}
        description={formatMessage(labels.deleteConfirmTemplate, {
          name: pendingDelete?.name ?? '',
        })}
        confirmLabel={labels.confirmDeleteLabel}
        cancelLabel={labels.cancelLabel}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
