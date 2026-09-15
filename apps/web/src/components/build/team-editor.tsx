'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import type {
  FormLearnsetAllVersionGroups,
  Item,
  Nature,
  SpeciesSearchAlias,
  SpeciesSearchItem,
  VersionGroupSummary,
} from '@pokestudio/database';
import { formatMessage, type Locale } from '@pokestudio/i18n';
import type { DamageClass, PokemonType } from '@pokestudio/pokemon-data';

import { resolveBuildGameCapabilities } from '@/lib/build-game-capabilities';
import {
  buildMemberValidationContexts,
  computeOffensiveCoverage,
  computeTeamDefensiveProfile,
  computeTeamStatus,
  computeTeamWarnings,
  type MemberValidationContext,
  type TeamWarning,
} from '@/lib/team-analysis';
import {
  MAX_TEAM_MEMBERS,
  addTeamMember,
  changeTeamMemberForm,
  removeTeamMember,
  renameTeamDraft,
  setTeamVersionGroup,
  updateTeamMember,
  type TeamDraft,
} from '@/lib/team-draft';
import { loadTeamDraft, saveTeamDraft } from '@/lib/team-storage';
import { groupVersionGroupsByGeneration, versionGroupDisplayName } from '@/lib/version-group-label';

import {
  fetchTeamMemberReferenceData,
  type TeamMemberReferenceData,
} from '@/app/[locale]/build/actions';

import { BuildStatusHeader, type BuildStatusHeaderLabels } from './build-status-header';
import { ProblemsPanel, type ProblemsPanelLabels } from './problems-panel';
import { RosterPicker, type RosterPickerLabels, type RosterPickerTarget } from './roster-picker';
import { SetEditor, type SetEditorLabels } from './set-editor';
import {
  TeamAnalysisPanel,
  buildWarningRows,
  type TeamAnalysisLabels,
  type WarningRow,
} from './team-analysis-panel';
import { EmptyTeamTile, FilledTeamTile, type TeamSlotLabels } from './team-slot';

export interface TeamEditorLabels {
  backToTeams: string;
  teamNameLabel: string;
  versionGroupLabel: string;
  /** "Generation {number}" — combined with `versionGroupDisplayName(slug)` for each game option, same pairing the Pokémon detail page's Moves section already uses. Reuses `dictionary.moves.generation`, not a duplicate copy. Also doubles as each `<optgroup>`'s own label now that every generation is exposed (task §1). */
  generationOptionTemplate: string;
  /** The compact, actionable top-of-page status summary — same "Saved · Valid" / "Draft saved · Incomplete" / "Draft saved · N errors" copy as before (task §9), now with actual reasons + Review/View-all actions (manual review v3, §3-§7). */
  statusHeader: BuildStatusHeaderLabels;
  /** "Close" — visible text on the Set Editor's own header close/collapse control. */
  closeEditorLabel: string;
  /** "Close {name}'s configuration" — its accessible name. */
  closeEditorTemplate: string;
  teamSlot: TeamSlotLabels;
  rosterPicker: RosterPickerLabels;
  setEditor: SetEditorLabels;
  analysis: TeamAnalysisLabels;
  problems: ProblemsPanelLabels;
}

export interface TeamEditorProps {
  locale: Locale;
  teamId: string;
  searchIndex: { items: SpeciesSearchItem[]; aliases: SpeciesSearchAlias[] };
  natures: Nature[];
  items: Item[];
  versionGroups: VersionGroupSummary[];
  typeLabels: Record<PokemonType, string>;
  labels: TeamEditorLabels;
}

const AUTOSAVE_DEBOUNCE_MS = 600;

/** Same nickname-falls-back-to-species/form-name rule the roster tile itself uses. */
function memberDisplayName(
  member: { nickname: string; formSlug: string },
  form:
    | {
        isDefaultForm: boolean;
        speciesName: Record<Locale, string>;
        formName: Record<Locale, string>;
      }
    | undefined,
  locale: Locale,
): string {
  if (member.nickname.trim().length > 0) return member.nickname;
  if (!form) return member.formSlug;
  return form.isDefaultForm ? form.speciesName[locale] : form.formName[locale];
}

/**
 * The Build set-editor shell (Milestone 2, Stage 2B). The roster lives in
 * `localStorage` (`team-storage.ts`), not the URL, so unlike Compare this
 * needs a real client → server round trip (`actions.ts`'s Server Action)
 * whenever the roster's set of form slugs changes, to fetch each member's
 * real types/abilities/base stats/learnset.
 */
export function TeamEditor({
  locale,
  teamId,
  searchIndex,
  natures,
  items,
  versionGroups,
  typeLabels,
  labels,
}: TeamEditorProps) {
  const [draft, setDraft] = useState<TeamDraft | null | 'not-found'>(null);
  const [referenceData, setReferenceData] = useState<TeamMemberReferenceData>({
    forms: [],
    learnsets: {},
  });
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<RosterPickerTarget | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const editorRef = useRef<HTMLDivElement>(null);
  // Always the latest `draft`, readable from the unmount-flush effect below
  // without making that effect re-run on every edit (see its own comment).
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    setDraft(loadTeamDraft(teamId) ?? 'not-found');
  }, [teamId]);

  const formSlugsKey =
    draft && draft !== 'not-found' ? draft.members.map((member) => member.formSlug).join(',') : '';

  useEffect(() => {
    if (!formSlugsKey) {
      setReferenceData({ forms: [], learnsets: {} });
      return;
    }
    let cancelled = false;
    fetchTeamMemberReferenceData(formSlugsKey.split(',')).then((data) => {
      if (!cancelled) setReferenceData(data);
    });
    return () => {
      cancelled = true;
    };
    // Intentionally keyed on the derived slug string, not `draft` itself —
    // refetching on every keystroke of an unrelated field (nickname, EVs)
    // would be wasteful; only the roster's *identity* matters here.
  }, [formSlugsKey]);

  // Debounced autosave: fires `AUTOSAVE_DEBOUNCE_MS` after the last edit.
  useEffect(() => {
    if (!draft || draft === 'not-found') return;
    setSaveStatus('saving');
    const timeout = setTimeout(() => {
      setSaveStatus(saveTeamDraft(draft) ? 'saved' : 'error');
    }, AUTOSAVE_DEBOUNCE_MS);
    // Only ever cancels a timer this same effect run just scheduled, before
    // scheduling the next one — normal debounce behavior, not a save.
    return () => clearTimeout(timeout);
  }, [draft]);

  // Manual review (CRITICAL bug): switching locale — or any navigation away
  // from this page — unmounts this component. Since the debounce effect's
  // cleanup above only *cancels* its timer, an edit made within the last
  // `AUTOSAVE_DEBOUNCE_MS` before leaving was silently never persisted: the
  // timer that would have saved it was cancelled by that same cleanup, and
  // no future timer ever fires once the component is gone. This is a
  // separate mount-once (`[]`) effect specifically so its cleanup runs only
  // on a *real* unmount, not on every `draft` change — reading the latest
  // draft via `draftRef` (a ref, not a dependency) rather than closing over
  // a stale value from the initial render.
  useEffect(() => {
    return () => {
      const latest = draftRef.current;
      if (latest && latest !== 'not-found') saveTeamDraft(latest);
    };
  }, []);

  // "When Configure is activated... scroll it into view smoothly" — fires
  // whenever a member becomes (or changes to become) the active one.
  // `selectedMemberId` always starts `null` on mount (the open editor is
  // ephemeral UI state, never persisted), so this never fires from a
  // reload/locale-switch remount — only from a genuine user action.
  useEffect(() => {
    // jsdom (test environment) doesn't implement `scrollIntoView` — no real
    // browser ships without it, so this guard only ever matters in tests.
    if (selectedMemberId && typeof editorRef.current?.scrollIntoView === 'function') {
      editorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedMemberId]);

  const formsBySlug = useMemo(
    () => new Map(referenceData.forms.map((form) => [form.formSlug, form])),
    [referenceData],
  );

  function updateDraft(updater: (current: TeamDraft) => TeamDraft): void {
    setDraft((current) => (current && current !== 'not-found' ? updater(current) : current));
  }

  /**
   * The roster's one shared picker resolves to either "add a new member" or
   * "swap this member's form". Adding a member (task §5, reversing the
   * earlier behavior) never opens its Set Editor — the picker just closes
   * and the new member appears in the roster, so adding several Pokémon in
   * a row stays fast; the user opens the editor explicitly via Configure
   * (or via Review, for a specific issue). Reads `draft` directly (fresh
   * every render, not stale — this function itself is recreated each
   * render) rather than through the generic `updateDraft` wrapper.
   */
  function handlePickerSelect(formSlug: string): void {
    if (!pickerTarget || !draft || draft === 'not-found') return;
    if (pickerTarget.kind === 'add') {
      setDraft(addTeamMember(draft, formSlug));
    } else {
      setDraft(changeTeamMemberForm(draft, pickerTarget.memberId, formSlug));
    }
    setPickerTarget(null);
  }

  const contextByMemberId = useMemo(() => {
    if (!draft || draft === 'not-found') return new Map<string, MemberValidationContext>();
    return buildMemberValidationContexts(
      draft.members,
      draft.versionGroupSlug,
      formsBySlug,
      referenceData.learnsets,
    );
  }, [draft, formsBySlug, referenceData.learnsets]);

  // Build's central game/ruleset capability model (task §2) — resolved once
  // per selected game, consumed by the Set Editor's conditional fields and
  // by team validity (never a scattered `if (versionGroupSlug === 'x')`).
  const capabilities = useMemo(() => {
    const slug = draft && draft !== 'not-found' ? draft.versionGroupSlug : '';
    const generation = versionGroups.find((vg) => vg.slug === slug)?.generation ?? 0;
    return resolveBuildGameCapabilities({ slug, generation });
  }, [draft, versionGroups]);

  const warnings: TeamWarning[] = useMemo(
    () =>
      draft && draft !== 'not-found'
        ? computeTeamWarnings(draft, contextByMemberId, capabilities)
        : [],
    [draft, contextByMemberId, capabilities],
  );

  const teamStatus = useMemo(() => computeTeamStatus(warnings), [warnings]);

  // Member id → its displayed name, for warning copy that names a specific
  // member (task §17's own examples: "Mew has only 2 moves selected").
  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (!draft || draft === 'not-found') return map;
    for (const member of draft.members) {
      map.set(member.id, memberDisplayName(member, formsBySlug.get(member.formSlug), locale));
    }
    return map;
  }, [draft, formsBySlug, locale]);

  // Ability/move slug → localized display name, for warning copy (task:
  // never show a raw slug like "earthquake" when the real name is already
  // in the reference data this component already fetched).
  const displayNameBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const form of referenceData.forms) {
      for (const ability of form.abilities) {
        map.set(
          ability.slug,
          locale === 'es' ? (ability.nameEs ?? ability.nameEn) : ability.nameEn,
        );
      }
    }
    for (const learnset of Object.values(referenceData.learnsets)) {
      for (const move of learnset.moves) {
        map.set(move.slug, locale === 'es' ? (move.nameEs ?? move.nameEn) : move.nameEn);
      }
    }
    return map;
  }, [referenceData, locale]);

  // The current Build game context's human-readable name (never the raw
  // slug) — used by the aggregated illegal-move message both surfaces share.
  const gameLabel = useMemo(
    () => (draft && draft !== 'not-found' ? versionGroupDisplayName(draft.versionGroupSlug) : ''),
    [draft],
  );

  // Built ONCE and shared by `BuildStatusHeader` and `TeamAnalysisPanel`
  // (manual review v3, §3: "Team header and Team Analysis must consume the
  // same source of truth" — never a second validation engine for the header).
  const warningRows: WarningRow[] = useMemo(
    () =>
      buildWarningRows(
        warnings,
        labels.analysis,
        typeLabels,
        displayNameBySlug,
        memberNameById,
        gameLabel,
      ),
    [warnings, labels.analysis, typeLabels, displayNameBySlug, memberNameById, gameLabel],
  );

  const defensiveProfile = useMemo(() => {
    if (!draft || draft === 'not-found') return {};
    const memberTypes = draft.members
      .map((member) => formsBySlug.get(member.formSlug)?.types)
      .filter((types): types is PokemonType[] => types !== undefined);
    return computeTeamDefensiveProfile(memberTypes);
  }, [draft, formsBySlug]);

  const offensiveCoverage = useMemo(() => {
    if (!draft || draft === 'not-found') return [];
    const moves: { type: PokemonType; damageClass: DamageClass }[] = [];
    for (const member of draft.members) {
      const learnset = referenceData.learnsets[member.formSlug];
      if (!learnset) continue;
      for (const slug of member.moveSlugs) {
        if (!slug) continue;
        const move = learnset.moves.find((m) => m.slug === slug);
        if (move) moves.push({ type: move.type, damageClass: move.damageClass });
      }
    }
    return computeOffensiveCoverage(moves);
  }, [draft, referenceData.learnsets]);

  if (draft === null) return null;

  if (draft === 'not-found') {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href={`/${locale}/build`}
          className="text-sm text-muted no-underline hover:text-foreground"
        >
          ← {labels.backToTeams}
        </Link>
      </div>
    );
  }

  const selectedMember = draft.members.find((member) => member.id === selectedMemberId) ?? null;
  const selectedForm = selectedMember ? formsBySlug.get(selectedMember.formSlug) : undefined;
  const selectedLearnset: FormLearnsetAllVersionGroups | undefined = selectedMember
    ? referenceData.learnsets[selectedMember.formSlug]
    : undefined;
  // Every generation PokeStudio has data for, grouped for the selector
  // (task §1 — reversing the earlier Scarlet/Violet-only restriction).
  const versionGroupsByGeneration = groupVersionGroupsByGeneration(versionGroups);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href={`/${locale}/build`}
          className="self-start text-sm text-muted no-underline hover:text-foreground"
        >
          ← {labels.backToTeams}
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="flex flex-col gap-1 text-xs text-muted">
            {labels.teamNameLabel}
            <input
              type="text"
              value={draft.name}
              onChange={(event) =>
                updateDraft((current) => renameTeamDraft(current, event.target.value))
              }
              className="rounded-md border border-border-subtle bg-surface px-3 py-2 text-base font-semibold text-foreground"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            {labels.versionGroupLabel}
            <select
              value={draft.versionGroupSlug}
              onChange={(event) =>
                updateDraft((current) => setTeamVersionGroup(current, event.target.value))
              }
              className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-sm text-foreground"
            >
              {/* Every historical game/version-group PokeStudio has data
                  for (task §1) — grouped by generation, never a raw slug
                  (task §1/§26/§27: "no raw slugs", "grouped options if
                  applicable/accessibly supported"). */}
              {versionGroupsByGeneration.map((group) => (
                <optgroup
                  key={group.generation}
                  label={formatMessage(labels.generationOptionTemplate, {
                    number: group.generation,
                  })}
                >
                  {group.versionGroups.map((vg) => (
                    <option key={vg.slug} value={vg.slug}>
                      {versionGroupDisplayName(vg.slug)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        <BuildStatusHeader
          saveStatus={saveStatus}
          teamStatus={teamStatus}
          warningRows={warningRows}
          labels={labels.statusHeader}
          onReviewMember={(memberId) => setSelectedMemberId(memberId)}
          onViewAllIssues={() => {
            const target = document.getElementById('build-problems');
            if (target && typeof target.scrollIntoView === 'function') {
              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            // Moves focus, not just the viewport (task §17/§27) — the
            // section itself is `tabIndex={-1}` exactly so this is valid.
            if (target && typeof target.focus === 'function') {
              target.focus({ preventScroll: true });
            }
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: MAX_TEAM_MEMBERS }, (_, index) => {
          const member = draft.members[index];
          if (!member) {
            return (
              <EmptyTeamTile
                key={`empty-${index}`}
                labels={labels.teamSlot}
                onStartAdd={() => setPickerTarget({ kind: 'add' })}
              />
            );
          }
          const form = formsBySlug.get(member.formSlug);
          return (
            <FilledTeamTile
              key={member.id}
              locale={locale}
              member={member}
              form={form}
              typeLabels={typeLabels}
              labels={labels.teamSlot}
              selected={selectedMemberId === member.id}
              onSelect={() => setSelectedMemberId(member.id)}
              onRemove={() => {
                updateDraft((current) => removeTeamMember(current, member.id));
                if (selectedMemberId === member.id) setSelectedMemberId(null);
              }}
              onStartChangeForm={() =>
                setPickerTarget({
                  kind: 'swap',
                  memberId: member.id,
                  memberName: memberDisplayName(member, form, locale),
                })
              }
            />
          );
        })}
      </div>

      {pickerTarget ? (
        <RosterPicker
          locale={locale}
          target={pickerTarget}
          searchIndex={searchIndex}
          typeLabels={typeLabels}
          labels={labels.rosterPicker}
          onSelect={handlePickerSelect}
          onClose={() => setPickerTarget(null)}
        />
      ) : null}

      {selectedMember ? (
        <div
          ref={editorRef}
          className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setSelectedMemberId(null);
            }
          }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-3">
            <h2 className="m-0 text-base font-semibold text-foreground">
              {formatMessage(labels.teamSlot.configureTemplate, {
                name: memberDisplayName(selectedMember, selectedForm, locale),
              })}
            </h2>
            <button
              type="button"
              onClick={() => setSelectedMemberId(null)}
              aria-label={formatMessage(labels.closeEditorTemplate, {
                name: memberDisplayName(selectedMember, selectedForm, locale),
              })}
              className="shrink-0 rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              {labels.closeEditorLabel} ×
            </button>
          </div>
          <SetEditor
            key={selectedMember.id}
            locale={locale}
            member={selectedMember}
            form={selectedForm}
            learnset={selectedLearnset}
            versionGroupSlug={draft.versionGroupSlug}
            capabilities={capabilities}
            natures={natures}
            items={items}
            labels={labels.setEditor}
            onChange={(patch) =>
              updateDraft((current) => updateTeamMember(current, selectedMember.id, patch))
            }
          />
        </div>
      ) : null}

      <ProblemsPanel
        warningRows={warningRows}
        labels={labels.problems}
        onReviewMember={(memberId) => setSelectedMemberId(memberId)}
      />

      <TeamAnalysisPanel
        defensiveProfile={defensiveProfile}
        offensiveCoverage={offensiveCoverage}
        warnings={warnings}
        typeLabels={typeLabels}
        labels={labels.analysis}
        supported={capabilities.teamAnalysisSupported}
        gameLabel={gameLabel}
      />
    </div>
  );
}
