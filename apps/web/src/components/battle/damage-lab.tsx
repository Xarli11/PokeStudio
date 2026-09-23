'use client';

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  ComparablePokemonForm,
  MoveSummary,
  SpeciesSearchAlias,
  SpeciesSearchItem,
  VersionGroupSummary,
} from '@pokestudio/database';
import type { DamageInputErrorCode } from '@pokestudio/damage';
import { formatMessage, type Locale } from '@pokestudio/i18n';
import type { BaseStats, PokemonType } from '@pokestudio/pokemon-data';

import {
  calculateDamageAction,
  fetchAdvancedReferenceData,
  fetchAttackerReferenceData,
  fetchDefenderReferenceData,
  fetchFormSupportedVersionGroups,
  type AdvancedReferenceData,
  type DamageLabCalculationRequest,
  type DamageLabCalculationResponse,
} from '@/app/[locale]/battle/damage/actions';
import { advancedConfigFromTeamMember, preferredDamageMoveSlug } from '@/lib/build-damage-import';
import { MovePicker, type MovePickerLabels } from '@/components/build/move-picker';
import { PopoverDisclosure } from '@/components/popover-disclosure';
import {
  resolveBuildGameCapabilities,
  type BuildGameCapabilities,
} from '@/lib/build-game-capabilities';
import {
  createDefaultAdvancedConfig,
  effectiveTeraType,
  isAdvancedConfigValid,
  revalidateAdvancedConfigForCapabilities,
  revalidateAdvancedConfigForForm,
  type DamageAdvancedConfig,
} from '@/lib/damage-advanced';
import { saveDamageLocaleHandoff, takeDamageLocaleHandoff } from '@/lib/damage-locale-handoff';
import { LOCALE_CHANGE_EVENT } from '@/lib/locale-navigation';
import { moveDisplayName } from '@/lib/move-search';
import { resolveRosterVisualIdentity } from '@/lib/roster-visual-identity';
import { loadTeamDraft } from '@/lib/team-storage';
import { buttonClass } from '@/lib/ui-classes';
import { groupVersionGroupsByGeneration, versionGroupDisplayName } from '@/lib/version-group-label';

import { DamageAdvancedPanel, type DamageAdvancedPanelLabels } from './damage-advanced-panel';
import {
  DamageLabImportBanner,
  type DamageLabImportBannerLabels,
  type DamageLabImportStatus,
} from './damage-lab-import-banner';
import { DamagePokemonSlot, type DamagePokemonSlotLabels } from './damage-pokemon-slot';
import { DamageResult, type DamageResultLabels } from './damage-result';

export interface DamageLabLabels {
  gameLabel: string;
  generationOptionTemplate: string;
  attackerLabel: string;
  defenderLabel: string;
  moveLabel: string;
  noMoveSelected: string;
  selectMoveLabel: string;
  changeMoveTemplate: string;
  noLegalMoves: string;
  calculateLabel: string;
  calculatingLabel: string;
  inputsChangedLabel: string;
  recalculateLabel: string;
  attackerReferenceError: string;
  defenderReferenceError: string;
  retry: string;
  resultHeading: string;
  pokemonSlot: DamagePokemonSlotLabels;
  movePicker: MovePickerLabels;
  result: DamageResultLabels;
  /** `statLabels`/`typeLabels` are supplied separately (`DamageLab`'s own props, shared with the rest of the page) rather than duplicated in here. */
  advancedPanel: Omit<DamageAdvancedPanelLabels, 'statLabels' | 'typeLabels'>;
  importBanner: DamageLabImportBannerLabels;
  errors: Record<
    | Exclude<DamageInputErrorCode, 'natures-not-available-in-generation'>
    | 'naturesNotAvailableInGeneration'
    | 'unknown',
    string
  >;
}

/** Maps the Server Action's structured error code to a localized message (task §23) — exhaustive by construction: TS errors if a `DamageInputErrorCode` is ever added without a case here. */
function errorMessageFor(
  code: DamageInputErrorCode | 'unknown',
  labels: DamageLabLabels['errors'],
): string {
  switch (code) {
    case 'unknown-form':
      return labels['unknown-form'];
    case 'unsupported-form':
      return labels['unsupported-form'];
    case 'unknown-move':
      return labels['unknown-move'];
    case 'unknown-ability':
      return labels['unknown-ability'];
    case 'unknown-item':
      return labels['unknown-item'];
    case 'unknown-nature':
      return labels['unknown-nature'];
    case 'natures-not-available-in-generation':
      return labels.naturesNotAvailableInGeneration;
    case 'level-out-of-range':
      return labels['level-out-of-range'];
    case 'ev-out-of-range':
      return labels['ev-out-of-range'];
    case 'iv-out-of-range':
      return labels['iv-out-of-range'];
    case 'generation-out-of-range':
      return labels['generation-out-of-range'];
    case 'unknown':
      return labels.unknown;
  }
}

function toCombatantRequest(form: ComparablePokemonForm, config: DamageAdvancedConfig) {
  return {
    formSlug: form.formSlug,
    speciesSlug: form.speciesSlug,
    level: config.level,
    abilitySlug: config.abilitySlug,
    itemSlug: config.itemSlug,
    natureSlug: config.natureSlug,
    evs: config.evs,
    ivs: config.ivs,
    teraType: effectiveTeraType(config),
  };
}

export function DamageLab({
  locale,
  searchIndex,
  versionGroups,
  defaultVersionGroupSlug,
  typeLabels,
  statLabels,
  labels,
  teamId = null,
  memberId = null,
  exploreAttackerFormSlug = null,
}: {
  locale: Locale;
  searchIndex: { items: SpeciesSearchItem[]; aliases: SpeciesSearchAlias[] };
  versionGroups: VersionGroupSummary[];
  defaultVersionGroupSlug: string;
  typeLabels: Record<PokemonType, string>;
  statLabels: Record<keyof BaseStats, string>;
  labels: DamageLabLabels;
  /** Build → Damage Lab one-way import (Fase M3.2) — both present, or the import is skipped entirely (task §5/§23: normal usage without these params must behave exactly as before). */
  teamId?: string | null;
  memberId?: string | null;
  /**
   * Explore → Damage Lab, attacker-only (Phase 3 roadmap). One-way,
   * one-time: seeds `attackerFormSlug` only — never the defender, move or
   * Advanced config, and never an import banner (unlike Build's own
   * import, this isn't "a saved set," just "the Pokémon already being
   * viewed"). A valid Build import always wins if both are somehow present
   * in the URL; see the effect below.
   */
  exploreAttackerFormSlug?: string | null;
}) {
  const initialVersionGroupSlug =
    versionGroups.find((vg) => vg.slug === defaultVersionGroupSlug)?.slug ??
    versionGroups[0]?.slug ??
    defaultVersionGroupSlug;
  const [versionGroupSlug, setVersionGroupSlug] = useState(initialVersionGroupSlug);
  const versionGroupsByGeneration = groupVersionGroupsByGeneration(versionGroups);
  const selectedVersionGroup = versionGroups.find((vg) => vg.slug === versionGroupSlug);

  const capabilities: BuildGameCapabilities | null = useMemo(
    () => (selectedVersionGroup ? resolveBuildGameCapabilities(selectedVersionGroup) : null),
    [selectedVersionGroup],
  );

  const [attackerFormSlug, setAttackerFormSlug] = useState<string | null>(null);
  const [attackerForm, setAttackerForm] = useState<ComparablePokemonForm | null>(null);
  const [attackerMoves, setAttackerMoves] = useState<MoveSummary[]>([]);
  // A real status (idle/loading/success/error), not a bare boolean — a
  // rejected fetch used to leave `attackerLoading` stuck `true` forever
  // (same production failure-mode `advancedReferenceStatus` above already
  // fixed for Advanced; this closes it for the attacker/defender fetches
  // too). `*RequestIdRef` is the staleness guard: each call to
  // `loadAttackerReference` claims the next id, and neither its success
  // nor its failure handler is allowed to touch state unless its id is
  // still the latest one — so a slow response for a Pokémon/game the user
  // has since moved on from can never overwrite the current selection
  // (task §5), and a late `.catch` from an old request can never flip a
  // newer request's `loading` back to `error` (task §6). One counter
  // serves both the effect-driven fetch and a manual Retry click, so they
  // can never race each other either.
  const [attackerReferenceStatus, setAttackerReferenceStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const attackerRequestIdRef = useRef(0);
  const [attackerConfig, setAttackerConfig] = useState<DamageAdvancedConfig>(
    createDefaultAdvancedConfig(),
  );
  const [attackerAdvancedOpen, setAttackerAdvancedOpen] = useState(false);
  const [isCritical, setIsCritical] = useState(false);

  const [defenderFormSlug, setDefenderFormSlug] = useState<string | null>(null);
  const [defenderForm, setDefenderForm] = useState<ComparablePokemonForm | null>(null);
  const [defenderReferenceStatus, setDefenderReferenceStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const defenderRequestIdRef = useRef(0);
  const [defenderConfig, setDefenderConfig] = useState<DamageAdvancedConfig>(
    createDefaultAdvancedConfig(),
  );
  const [defenderAdvancedOpen, setDefenderAdvancedOpen] = useState(false);

  const [selectedMoveSlug, setSelectedMoveSlug] = useState<string | null>(null);
  const [movePickerOpen, setMovePickerOpen] = useState(false);

  // Build import (Fase M3.2) — `importStatus` drives the banner; the two
  // refs below are the "apply exactly once" guards: `teamImportAppliedRef`
  // for the whole import (level/EVs/ability/... are seeded directly into
  // `attackerConfig`'s state, so there's nothing further to "consume" for
  // them — only setting them once, ever, matters), and
  // `pendingImportedMoveSlugsRef` specifically for the move preference,
  // which can only be resolved once `fetchAttackerReferenceData` returns
  // real legal moves to check the set's moves against (task §12/§13) —
  // consumed the first time that happens, never reapplied after a manual
  // move/attacker change.
  const [importStatus, setImportStatus] = useState<DamageLabImportStatus>({ kind: 'none' });
  const teamImportAppliedRef = useRef(false);
  // Set synchronously (not via `importStatus` state) the instant a Build
  // import actually resolves to a real team member, so the Explore-seed
  // effect declared right after this one — which React always runs after
  // it, in source order, within the same mount — can check it reliably
  // even on the very first render. A state read here would still show the
  // *previous* render's value to that later effect (React batches state
  // updates from one effect within a single commit; they aren't visible to
  // a sibling effect until the next render), which a ref sidesteps.
  const buildImportSucceededRef = useRef(false);
  const pendingImportedMoveSlugsRef = useRef<(string | null)[] | null>(null);

  // Advanced's own reference data (natures/items) — interaction-gated
  // (task §16), fetched at most once, the first time either side's
  // Advanced panel opens. Shared between attacker/defender: natures/items
  // are global, not per-Pokémon. A real state machine (idle/loading/
  // success/error), not two booleans — a rejected fetch used to leave
  // `loading` stuck `true` forever (production incident: `fetchAdvancedReferenceData`
  // 500ing left both panels showing "Loading…" indefinitely, with no error
  // or retry). `startedRef` — not the `status` state — is the request
  // guard: it's set synchronously the instant a fetch starts, so two
  // panels opened in the same tick (before React has applied the `loading`
  // state update) still only ever start one request (task §10).
  const [advancedReferenceStatus, setAdvancedReferenceStatus] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: AdvancedReferenceData }
    | { status: 'error' }
  >({ status: 'idle' });
  const advancedReferenceFetchStartedRef = useRef(false);

  // `useCallback` (empty deps — every value it closes over is a stable ref
  // or setter) so the Build-import effect below can name it in its own
  // dependency array without re-running on every render.
  const ensureAdvancedReferenceData = useCallback((): void => {
    if (advancedReferenceFetchStartedRef.current) return;
    advancedReferenceFetchStartedRef.current = true;
    setAdvancedReferenceStatus({ status: 'loading' });
    fetchAdvancedReferenceData()
      .then((data) => {
        setAdvancedReferenceStatus({ status: 'success', data });
      })
      .catch((error: unknown) => {
        // Server-side detail is already logged by the action itself (task
        // §13's boundary); this is the client-side symptom only.
        console.error('fetchAdvancedReferenceData failed', error);
        advancedReferenceFetchStartedRef.current = false; // allow Retry to try again
        setAdvancedReferenceStatus({ status: 'error' });
      });
  }, []);

  // Locale-switch state handoff — a locale switch is a real route-segment
  // change ([locale]), which unmounts this whole component; without this,
  // every selection/config here was silently lost on every ES↔EN switch.
  // `localeRestoredRef` doubles as the signal the Build-import effect below
  // checks: if this mount is a restore, the import must not re-seed state
  // over a since-changed manual selection (task §11 of the review — the
  // exact scenario: import Garchomp → manually swap to Charizard → switch
  // locale → Charizard, not Garchomp, must survive). `restoringGameRef`
  // stops the game-switch capability-revalidation effect (declared later)
  // from running its very first pass against the *default* game's
  // capabilities before this restore has actually applied — that pass
  // would self-correct on the next render regardless, but skipping it
  // avoids a pointless transient revalidation against the wrong game.
  const localeRestoredRef = useRef(false);
  const restoringGameRef = useRef<string | null>(null);
  useEffect(() => {
    const draft = takeDamageLocaleHandoff();
    if (!draft || !versionGroups.some((vg) => vg.slug === draft.versionGroupSlug)) return;
    localeRestoredRef.current = true;
    restoringGameRef.current = draft.versionGroupSlug;
    setVersionGroupSlug(draft.versionGroupSlug);
    setAttackerFormSlug(draft.attackerFormSlug);
    setDefenderFormSlug(draft.defenderFormSlug);
    setAttackerConfig(draft.attackerConfig);
    setDefenderConfig(draft.defenderConfig);
    setIsCritical(draft.isCritical);
    // Reuses the exact same "consume once, once real legal moves exist to
    // check it against" mechanism the Build import already relies on
    // (task: "reuse existing reference-data/Pokémon-loading infrastructure,
    // do not create a parallel fetch system") — never a second move-restore
    // path.
    pendingImportedMoveSlugsRef.current = [draft.selectedMoveSlug];
    // Only start Advanced's reference-data fetch if the restored config
    // actually needs a name to render honestly — same reasoning as the
    // Build-import branch below, same shared gate/guard.
    if (
      draft.attackerConfig.natureSlug ||
      draft.attackerConfig.itemSlug ||
      draft.defenderConfig.natureSlug ||
      draft.defenderConfig.itemSlug
    ) {
      ensureAdvancedReferenceData();
    }
    // Deliberately not preserved: the calculated result. A fresh mount's
    // `useActionState` already starts at `null`, and `DamageLocaleDraft`
    // never carries one — inputs survive, the result is recalculated,
    // never left looking current for state that's just been replaced.
  }, [versionGroups, ensureAdvancedReferenceData]);

  useEffect(() => {
    function handleLocaleChange(event: Event): void {
      const target = (event as CustomEvent<string>).detail;
      saveDamageLocaleHandoff(target, {
        versionGroupSlug,
        attackerFormSlug,
        defenderFormSlug,
        selectedMoveSlug,
        attackerConfig,
        defenderConfig,
        isCritical,
      });
    }
    window.addEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange);
    return () => window.removeEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange);
  }, [
    versionGroupSlug,
    attackerFormSlug,
    defenderFormSlug,
    selectedMoveSlug,
    attackerConfig,
    defenderConfig,
    isCritical,
  ]);

  // Build import (Fase M3.2) — runs once per mount, only when both
  // `teamId`/`memberId` are present. `loadTeamDraft` is the one sanctioned
  // read of local team storage (task §2: never a second parsing path).
  // Seeding `attackerFormSlug`/`versionGroupSlug`/`attackerConfig` here —
  // rather than fetching the attacker's reference data specially — means
  // the existing attacker-fetch effect below picks it up exactly the same
  // way any manual selection would (task §8: "reutiliza el flujo real
  // existente"); the game-switch capability-revalidation effect further
  // down does the same for `attackerConfig` (task §14 — "las reglas
  // actuales siguen siendo autoridad", never duplicated here).
  useEffect(() => {
    if (teamImportAppliedRef.current) return;
    teamImportAppliedRef.current = true;
    if (!teamId || !memberId) return;
    // A locale-restore that already applied (this same mount, from the
    // effect above) takes priority over the original Build import in every
    // respect — including the banner, and including a stale "team/member
    // not found" warning a fresh lookup could otherwise produce. The
    // restored state already fully represents "now"; a `loadTeamDraft`
    // re-read here would only describe the *original* import, which may
    // no longer be true (the user may have manually changed the attacker
    // since) — never resurrect that provenance once it's stale (review
    // finding: the state-seeding guard alone wasn't enough, this whole
    // branch — including `setImportStatus` — needs the same guard).
    if (localeRestoredRef.current) return;

    const team = loadTeamDraft(teamId);
    if (!team) {
      setImportStatus({ kind: 'team-not-found' });
      return;
    }
    const member = team.members.find((candidate) => candidate.id === memberId);
    if (!member) {
      setImportStatus({ kind: 'member-not-found', teamName: team.name });
      return;
    }

    const gameAvailable = versionGroups.some((vg) => vg.slug === team.versionGroupSlug);
    if (gameAvailable) setVersionGroupSlug(team.versionGroupSlug);

    buildImportSucceededRef.current = true;
    setAttackerFormSlug(member.formSlug);
    setAttackerConfig(advancedConfigFromTeamMember(member));
    pendingImportedMoveSlugsRef.current = member.moveSlugs;

    // The optimistic identity the search index already has, same source
    // `DamagePokemonSlot` itself uses — never the raw `formSlug` (task
    // §18), and available immediately rather than waiting on a fetch.
    const identity = resolveRosterVisualIdentity(searchIndex, member.formSlug);
    const memberDisplayName = member.nickname.trim() || identity?.displayName[locale] || null;

    setImportStatus({
      kind: 'imported',
      teamId: team.id,
      teamName: team.name,
      memberDisplayName,
      gameUnavailable: !gameAvailable,
    });

    // Only start Advanced's reference-data fetch if the imported set
    // actually needs it to render honestly (task §16) — a nature/item slug
    // with no name to show would otherwise render as a raw slug while
    // still loading.
    if (member.natureSlug || member.itemSlug) ensureAdvancedReferenceData();
  }, [teamId, memberId, versionGroups, searchIndex, locale, ensureAdvancedReferenceData]);

  // Explore → Damage Lab attacker seed (Phase 3 roadmap, attacker-only) —
  // runs once per mount, only when `exploreAttackerFormSlug` is present.
  // Seeds `attackerFormSlug` (and, only when needed, `versionGroupSlug` —
  // see below); the existing attacker-fetch effect right below picks up
  // whichever pair results exactly like a manual selection would, and
  // Advanced config/defender/move all stay at their normal defaults (task:
  // "no parallel Pokémon-loading mechanism, no import banner — this isn't
  // a saved set, just the Pokémon already being viewed").
  //
  // Precedence (task §5): a *validly resolved* Build import always wins if
  // both are somehow present in the URL — `buildImportSucceededRef` is set
  // synchronously inside the Build-import effect above, and React runs
  // effects within one component in declaration order on mount, so this
  // check is never racy even on the very first render. A locale-restore
  // wins for the same reason Build's own import defers to it: the restored
  // state already represents "now," including any manual change since.
  //
  // Defensive (task §6): `exploreAttackerFormSlug` is resolved against the
  // search index — the exact same lookup Build's own optimistic identity
  // already trusts (`resolveRosterVisualIdentity`, imported above) — before
  // ever being applied. A malformed, unknown, or stale slug simply resolves
  // to `undefined` and is silently ignored; Damage Lab loads with its
  // normal empty attacker state, never an error for an optional seed.
  //
  // Compatible-game fallback (visual review — a Mega Evolution seed landed
  // in Damage Lab's default game with zero legal moves, a real form
  // correctly resolved into a dead end): `fetchFormSupportedVersionGroups`
  // asks whether the *default* game is itself one this exact form has
  // learnset data for; only when it genuinely isn't does this switch to the
  // most recent version group (the query's own result is newest-first)
  // that both this form supports and Damage Lab itself offers. This runs
  // exactly once, inside this same one-time effect, and both state setters
  // are called together in the same callback — the existing game-switch
  // capability-revalidation effect further down reacts to the result
  // exactly as it would a manual game change, nothing special-cased there.
  // A form with no learnset data anywhere (or none that overlaps Damage
  // Lab's own games) simply keeps the default game — the existing
  // "no damaging moves" state already handles that honestly, never a crash
  // or a second unsupported-form mechanism.
  const exploreSeedAppliedRef = useRef(false);
  useEffect(() => {
    if (exploreSeedAppliedRef.current) return;
    exploreSeedAppliedRef.current = true;
    if (!exploreAttackerFormSlug) return;
    if (localeRestoredRef.current) return;
    if (buildImportSucceededRef.current) return;
    const identity = resolveRosterVisualIdentity(searchIndex, exploreAttackerFormSlug);
    if (!identity) return;

    fetchFormSupportedVersionGroups(identity.formSlug)
      .then((supported) => {
        // Re-checked: this callback runs well after mount, but a locale
        // switch/Build import can't happen mid-flight in practice (this
        // effect only ever runs once, and nothing else sets
        // `attackerFormSlug` before it does) — defensive, not load-bearing.
        if (localeRestoredRef.current || buildImportSucceededRef.current) return;
        setAttackerFormSlug(identity.formSlug);
        const supportedSlugs = new Set(supported.map((vg) => vg.slug));
        setVersionGroupSlug((current) => {
          if (supportedSlugs.has(current)) return current; // default already usable — keep it
          const damageLabSlugs = new Set(versionGroups.map((vg) => vg.slug));
          const compatible = supported.find((vg) => damageLabSlugs.has(vg.slug));
          return compatible ? compatible.slug : current; // no compatible game found — stay put
        });
      })
      .catch((error: unknown) => {
        console.error('fetchFormSupportedVersionGroups failed', error);
        // The compatible-game check is a UX nicety, not a correctness
        // requirement — still seed the attacker at the default game rather
        // than dropping the seed entirely over a failed secondary lookup.
        if (localeRestoredRef.current || buildImportSucceededRef.current) return;
        setAttackerFormSlug(identity.formSlug);
      });
  }, [exploreAttackerFormSlug, searchIndex, versionGroups]);

  // Attacker reference data: only fetched once a form is selected (never
  // before), and re-fetched (for this same form) whenever the game changes
  // — task §10/§12. An invalid move for the new game is dropped, not the
  // Pokémon selections themselves. A form swap also revalidates the
  // Advanced ability, mirroring Build's own `changeTeamMemberForm` (task
  // §14) — only ability is form-scoped, everything else in the Advanced
  // config survives untouched. `attackerForm`/`attackerMoves` are cleared
  // the instant a new request starts (not just on failure) — task §7's
  // second constraint: once the identity the user selected has changed,
  // the *previous* Pokémon's abilities/moves must never keep showing under
  // it, success or not. `loadAttackerReference` is `useCallback`'d with no
  // reactive deps (every setter it closes over is a stable React
  // identity, and the ref is stable by definition) purely so it can be
  // named in this effect's own dependency array without re-running on
  // every render.
  const loadAttackerReference = useCallback(
    (formSlug: string, forVersionGroupSlug: string): void => {
      const requestId = attackerRequestIdRef.current + 1;
      attackerRequestIdRef.current = requestId;
      setAttackerReferenceStatus('loading');
      setAttackerForm(null);
      setAttackerMoves([]);
      fetchAttackerReferenceData(formSlug, forVersionGroupSlug)
        .then((data) => {
          if (attackerRequestIdRef.current !== requestId) return; // superseded — task §5/§6
          setAttackerForm(data.form);
          setAttackerMoves(data.moves);
          setSelectedMoveSlug((current) => {
            if (current && data.moves.some((move) => move.slug === current)) return current;
            // Imported move preference (task §12/§13) — consumed exactly
            // once, the first time real legal moves exist to check it
            // against, win or lose. A later manual attacker/game change
            // that re-runs this same effect must never re-apply it.
            const pending = pendingImportedMoveSlugsRef.current;
            if (pending) {
              pendingImportedMoveSlugsRef.current = null;
              return preferredDamageMoveSlug(pending, data.moves);
            }
            return null;
          });
          setAttackerConfig((config) => revalidateAdvancedConfigForForm(config, data.form));
          setAttackerReferenceStatus('success');
        })
        .catch((error: unknown) => {
          if (attackerRequestIdRef.current !== requestId) return; // superseded — task §5/§6
          // Server-side detail is already logged by the action itself (task §13's boundary).
          console.error('fetchAttackerReferenceData failed', error);
          setAttackerReferenceStatus('error');
        });
    },
    [],
  );

  useEffect(() => {
    if (!attackerFormSlug) {
      attackerRequestIdRef.current += 1; // invalidates any request still in flight
      setAttackerReferenceStatus('idle');
      setAttackerForm(null);
      setAttackerMoves([]);
      setSelectedMoveSlug(null);
      return;
    }
    loadAttackerReference(attackerFormSlug, versionGroupSlug);
  }, [attackerFormSlug, versionGroupSlug, loadAttackerReference]);

  function retryAttackerReferenceData(): void {
    if (attackerFormSlug) loadAttackerReference(attackerFormSlug, versionGroupSlug);
  }

  // Defender reference data: only its form, never a learnset (task §10) —
  // same staleness/error/retry treatment as the attacker above.
  const loadDefenderReference = useCallback((formSlug: string): void => {
    const requestId = defenderRequestIdRef.current + 1;
    defenderRequestIdRef.current = requestId;
    setDefenderReferenceStatus('loading');
    setDefenderForm(null);
    fetchDefenderReferenceData(formSlug)
      .then((form) => {
        if (defenderRequestIdRef.current !== requestId) return; // superseded — task §5/§6
        setDefenderForm(form);
        setDefenderConfig((config) => revalidateAdvancedConfigForForm(config, form));
        setDefenderReferenceStatus('success');
      })
      .catch((error: unknown) => {
        if (defenderRequestIdRef.current !== requestId) return; // superseded — task §5/§6
        console.error('fetchDefenderReferenceData failed', error);
        setDefenderReferenceStatus('error');
      });
  }, []);

  useEffect(() => {
    if (!defenderFormSlug) {
      defenderRequestIdRef.current += 1;
      setDefenderReferenceStatus('idle');
      setDefenderForm(null);
      return;
    }
    loadDefenderReference(defenderFormSlug);
  }, [defenderFormSlug, loadDefenderReference]);

  function retryDefenderReferenceData(): void {
    if (defenderFormSlug) loadDefenderReference(defenderFormSlug);
  }

  // Game-switch revalidation (task §15) — re-runs only when the version
  // group actually changes (`capabilities` is memoized on its slug/
  // generation above, so this effect doesn't fire on every render).
  // `restoringGameRef` skips this effect's very first pass on a
  // locale-restore mount, before the restored `versionGroupSlug` has
  // actually applied — without it, this would revalidate the just-restored
  // config against the *default* game's capabilities for one render (it
  // self-corrects the next render regardless, since `capabilities`/
  // `versionGroupSlug` change again once the restore lands, but skipping
  // the wrong pass avoids a pointless transient revalidation).
  useEffect(() => {
    if (!capabilities) return;
    if (restoringGameRef.current && restoringGameRef.current !== versionGroupSlug) return;
    restoringGameRef.current = null;
    setAttackerConfig((config) => revalidateAdvancedConfigForCapabilities(config, capabilities));
    setDefenderConfig((config) => revalidateAdvancedConfigForCapabilities(config, capabilities));
  }, [capabilities, versionGroupSlug]);

  const selectedMove = attackerMoves.find((move) => move.slug === selectedMoveSlug);

  function buildRequest(): DamageLabCalculationRequest | null {
    if (!attackerForm || !defenderForm || !selectedMoveSlug || !capabilities) return null;
    return {
      generation: capabilities.generation,
      attacker: toCombatantRequest(attackerForm, attackerConfig),
      defender: toCombatantRequest(defenderForm, defenderConfig),
      moveSlug: selectedMoveSlug,
      isCritical,
    };
  }

  const currentRequest = buildRequest();
  const configsValid =
    capabilities !== null &&
    isAdvancedConfigValid(attackerConfig, capabilities, attackerForm) &&
    isAdvancedConfigValid(defenderConfig, capabilities, defenderForm);
  const canCalculate = Boolean(currentRequest) && configsValid;

  const [lastCalculatedKey, setLastCalculatedKey] = useState<string | null>(null);

  const [calcState, submitCalculate, isCalculating] = useActionState<
    DamageLabCalculationResponse | null,
    void
  >(async () => {
    const request = buildRequest();
    if (!request) return null;
    const response = await calculateDamageAction(request);
    setLastCalculatedKey(JSON.stringify(request));
    return response;
  }, null);

  // Stale-result detection (task §20): a visible result stays visible, but
  // is clearly marked outdated the instant any input it depended on changes
  // — never a silently-wrong number left looking current.
  const currentRequestKey = currentRequest ? JSON.stringify(currentRequest) : null;
  const isStale =
    calcState?.ok === true && lastCalculatedKey !== null && currentRequestKey !== lastCalculatedKey;

  return (
    <div className="flex flex-col gap-8">
      <DamageLabImportBanner locale={locale} status={importStatus} labels={labels.importBanner} />

      <label className="flex max-w-xs flex-col gap-1 text-xs font-semibold text-muted">
        {labels.gameLabel}
        <select
          value={versionGroupSlug}
          onChange={(event) => setVersionGroupSlug(event.target.value)}
          className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-sm text-foreground"
        >
          {versionGroupsByGeneration.map((group) => (
            <optgroup
              key={group.generation}
              label={formatMessage(labels.generationOptionTemplate, { number: group.generation })}
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

      {/* A real `[1fr auto 1fr]` grid, only at `lg:` and up — below that,
          two full Pokémon-plus-Advanced columns side by side leaves too
          little room, so it stays the existing single-column stack. DOM
          order (attacker → move → defender) is unchanged at every width;
          the mirroring below is presentational only.

          Sizing (visual review round 2 — attacker/defender cards rendered
          different widths from each other and from their own Advanced
          panel): neither the column nor the compact card is width-capped
          anymore, and neither column uses `items-end`/`items-start` as an
          alignment-based substitute for width. Both columns are plain
          `w-full` of their equal `minmax(0,1fr)` tracks, and both the
          compact card and `DamageAdvancedPanel` (already `w-full` on its
          own root) are explicit `w-full` of that same column — so card
          width and Advanced width are byte-identical on each side, and
          attacker/defender sides are byte-identical to each other, at
          every width, regardless of name length or badge count. (An
          earlier pass used `lg:items-end` on the attacker column to pull
          it toward the Move column — that inadvertently switched its
          children from the default `align-items: stretch`, which fills up
          to a max-width, to shrink-to-content, which is exactly why the
          two sides drifted apart; the fix is explicit width, not
          alignment.) `mx-auto lg:max-w-[80rem]` still gives the whole
          composition its own sensible ceiling — a no-op today since the
          page shell is narrower, but correct if that ever changes. The
          center track is a fixed `minmax` (not `auto`), so the Move block
          reads as a stable connector.

          Mirroring (visual review — "attacker → MOVE ← defender", artwork
          nearest the center): with both cards now the same full width,
          centering the Pokémon *within* each card is `DamagePokemonSlot`'s
          own concern (fixed-size artwork + `flex-1` info area, filling the
          card edge to edge — see that component). `artworkTrailing`
          (attacker only) reverses the *visual* order of its two children —
          text/info then artwork — via `lg:flex-row-reverse`, never a
          `transform` and never a DOM/reading-order change; the defender
          keeps the component's plain default order (artwork then text),
          which already puts its artwork on the side nearest the center. */}
      <div className="mx-auto grid w-full grid-cols-1 items-start gap-6 lg:max-w-[80rem] lg:grid-cols-[minmax(0,1fr)_minmax(10rem,12.5rem)_minmax(0,1fr)] lg:gap-10">
        <div className="flex w-full min-w-0 flex-col gap-3">
          <DamagePokemonSlot
            locale={locale}
            label={labels.attackerLabel}
            searchIndex={searchIndex}
            typeLabels={typeLabels}
            selectedFormSlug={attackerFormSlug}
            onSelect={setAttackerFormSlug}
            labels={labels.pokemonSlot}
            artworkTrailing
          />
          {capabilities ? (
            <DamageAdvancedPanel
              locale={locale}
              side="attacker"
              form={attackerForm}
              capabilities={capabilities}
              config={attackerConfig}
              onChange={(patch) => setAttackerConfig((config) => ({ ...config, ...patch }))}
              isCritical={isCritical}
              onCriticalChange={setIsCritical}
              isOpen={attackerAdvancedOpen}
              onToggleOpen={() =>
                setAttackerAdvancedOpen((open) => {
                  if (!open) ensureAdvancedReferenceData();
                  return !open;
                })
              }
              referenceData={advancedReferenceStatus}
              onRetryReferenceData={ensureAdvancedReferenceData}
              labels={{ ...labels.advancedPanel, statLabels, typeLabels }}
            />
          ) : null}
        </div>

        {/* Visual polish pass: deliberately no `self-center` — the grid's
            own `items-start` already lines this block up with the top of
            both compact summary cards (art/name start there too), which
            keeps working "naturally" once a side's Advanced panel opens and
            makes the row much taller, instead of drifting toward the
            middle of that full height. */}
        <div className="flex flex-col items-center gap-2.5">
          <span aria-hidden="true" className="text-2xl leading-none text-muted">
            →
          </span>
          <div className="flex flex-col gap-2 text-center">
            <span className="text-xs font-bold tracking-wide text-foreground uppercase">
              {labels.moveLabel}
            </span>
            {attackerReferenceStatus === 'error' ? (
              <div className="flex flex-col items-center gap-1">
                <p role="alert" className="m-0 text-xs font-semibold text-danger">
                  {labels.attackerReferenceError}
                </p>
                <button
                  type="button"
                  onClick={retryAttackerReferenceData}
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  {labels.retry}
                </button>
              </div>
            ) : attackerReferenceStatus === 'loading' ? (
              <span className="text-sm text-muted">…</span>
            ) : !attackerFormSlug ? (
              <span className="text-sm text-muted">{labels.noMoveSelected}</span>
            ) : attackerMoves.length === 0 ? (
              <span className="text-sm text-muted">{labels.noLegalMoves}</span>
            ) : (
              // Overlay, not inline grid content (visual review — the
              // expanded picker used to be constrained by/break the narrow
              // center track): `PopoverDisclosure` positions it absolutely,
              // anchored under this trigger and centered on it, so opening
              // it never resizes the Move column or pushes attacker/
              // defender. `panelClassName` drops the primitive's own small-
              // popover chrome entirely (width/border/background/padding)
              // since `MovePicker`'s own `surfaceClassName` below supplies
              // a proper self-contained overlay frame instead — Build's
              // original dashed-brand "editing in place" border read as a
              // stray oversized focus ring once floating on its own
              // (visual review round 2); this is a solid, opaque, bordered
              // surface instead, sized for an overlay rather than a form
              // row. ~34rem (544px) is the target — comfortably inside the
              // requested 32–35rem/512–560px range — viewport-clamped so it
              // never overflows a narrow screen.
              <PopoverDisclosure
                align="center"
                open={movePickerOpen}
                onOpenChange={setMovePickerOpen}
                panelClassName="w-[min(34rem,calc(100vw-2rem))]"
                renderTrigger={({ toggle, ref }) => (
                  <button
                    ref={ref}
                    type="button"
                    onClick={toggle}
                    aria-expanded={movePickerOpen}
                    aria-label={
                      selectedMove
                        ? formatMessage(labels.changeMoveTemplate, {
                            name: moveDisplayName(selectedMove, locale),
                          })
                        : labels.selectMoveLabel
                    }
                    className={buttonClass('default', 'px-4 py-2 text-sm font-semibold')}
                  >
                    {selectedMove ? moveDisplayName(selectedMove, locale) : labels.selectMoveLabel}
                  </button>
                )}
              >
                <MovePicker
                  locale={locale}
                  moves={attackerMoves}
                  typeLabels={typeLabels}
                  selectedMoveSlugs={[]}
                  labels={labels.movePicker}
                  onSelect={(moveSlug) => {
                    setSelectedMoveSlug(moveSlug);
                    setMovePickerOpen(false);
                  }}
                  onClose={() => setMovePickerOpen(false)}
                  surfaceClassName="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-3 shadow-md"
                />
              </PopoverDisclosure>
            )}
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-3">
          <DamagePokemonSlot
            locale={locale}
            label={labels.defenderLabel}
            searchIndex={searchIndex}
            typeLabels={typeLabels}
            selectedFormSlug={defenderFormSlug}
            onSelect={setDefenderFormSlug}
            labels={labels.pokemonSlot}
          />
          {defenderReferenceStatus === 'error' ? (
            <div className="flex items-center gap-2">
              <p role="alert" className="m-0 text-xs font-semibold text-danger">
                {labels.defenderReferenceError}
              </p>
              <button
                type="button"
                onClick={retryDefenderReferenceData}
                className="text-xs font-semibold text-brand hover:underline"
              >
                {labels.retry}
              </button>
            </div>
          ) : null}
          {capabilities ? (
            <DamageAdvancedPanel
              locale={locale}
              side="defender"
              form={defenderForm}
              capabilities={capabilities}
              config={defenderConfig}
              onChange={(patch) => setDefenderConfig((config) => ({ ...config, ...patch }))}
              isCritical={false}
              onCriticalChange={() => {}}
              isOpen={defenderAdvancedOpen}
              onToggleOpen={() =>
                setDefenderAdvancedOpen((open) => {
                  if (!open) ensureAdvancedReferenceData();
                  return !open;
                })
              }
              referenceData={advancedReferenceStatus}
              onRetryReferenceData={ensureAdvancedReferenceData}
              labels={{ ...labels.advancedPanel, statLabels, typeLabels }}
            />
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => startTransition(() => submitCalculate())}
        disabled={!canCalculate || isCalculating}
        aria-busy={isCalculating}
        className={buttonClass('primary', 'min-h-11 self-center px-6 py-2.5 text-base')}
      >
        {isCalculating ? labels.calculatingLabel : labels.calculateLabel}
      </button>

      <div aria-live="polite">
        {calcState?.ok === false ? (
          <p role="alert" className="m-0 text-center text-sm font-semibold text-danger">
            {errorMessageFor(calcState.code, labels.errors)}
          </p>
        ) : null}
        {calcState?.ok === true ? (
          <div className="flex flex-col items-center gap-3">
            {isStale ? (
              <div className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface-raised px-3 py-1.5 text-xs font-semibold text-muted">
                <span>{labels.inputsChangedLabel}</span>
                <button
                  type="button"
                  onClick={() => startTransition(() => submitCalculate())}
                  disabled={!canCalculate || isCalculating}
                  className="text-brand hover:underline"
                >
                  {labels.recalculateLabel}
                </button>
              </div>
            ) : null}
            <div className={isCalculating || isStale ? 'opacity-60 transition-opacity' : undefined}>
              <h2 className="sr-only">{labels.resultHeading}</h2>
              <DamageResult result={calcState.result} locale={locale} labels={labels.result} />
            </div>
          </div>
        ) : null}
      </div>

      {/* A successful fetch that resolved to no form at all (an unknown
          slug) is distinct from a rejected fetch — that has its own inline
          error+Retry above/below, this is the pre-existing "this slug
          doesn't exist" honesty message and stays scoped to `'success'`. */}
      {attackerFormSlug && attackerReferenceStatus === 'success' && attackerForm === null ? (
        <p className="m-0 text-center text-sm text-muted">{labels.errors['unknown-form']}</p>
      ) : null}
      {defenderFormSlug && defenderReferenceStatus === 'success' && defenderForm === null ? (
        <p className="m-0 text-center text-sm text-muted">{labels.errors['unknown-form']}</p>
      ) : null}
    </div>
  );
}
