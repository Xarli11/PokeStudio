'use client';

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from 'react';

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
  type AdvancedReferenceData,
  type DamageLabCalculationRequest,
  type DamageLabCalculationResponse,
} from '@/app/[locale]/battle/damage/actions';
import { MovePicker, type MovePickerLabels } from '@/components/build/move-picker';
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
import { moveDisplayName } from '@/lib/move-search';
import { buttonClass } from '@/lib/ui-classes';
import { groupVersionGroupsByGeneration, versionGroupDisplayName } from '@/lib/version-group-label';

import { DamageAdvancedPanel, type DamageAdvancedPanelLabels } from './damage-advanced-panel';
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
  resultHeading: string;
  pokemonSlot: DamagePokemonSlotLabels;
  movePicker: MovePickerLabels;
  result: DamageResultLabels;
  /** `statLabels`/`typeLabels` are supplied separately (`DamageLab`'s own props, shared with the rest of the page) rather than duplicated in here. */
  advancedPanel: Omit<DamageAdvancedPanelLabels, 'statLabels' | 'typeLabels'>;
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
}: {
  locale: Locale;
  searchIndex: { items: SpeciesSearchItem[]; aliases: SpeciesSearchAlias[] };
  versionGroups: VersionGroupSummary[];
  defaultVersionGroupSlug: string;
  typeLabels: Record<PokemonType, string>;
  statLabels: Record<keyof BaseStats, string>;
  labels: DamageLabLabels;
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
  const [attackerLoading, setAttackerLoading] = useState(false);
  const [attackerConfig, setAttackerConfig] = useState<DamageAdvancedConfig>(
    createDefaultAdvancedConfig(),
  );
  const [attackerAdvancedOpen, setAttackerAdvancedOpen] = useState(false);
  const [isCritical, setIsCritical] = useState(false);

  const [defenderFormSlug, setDefenderFormSlug] = useState<string | null>(null);
  const [defenderForm, setDefenderForm] = useState<ComparablePokemonForm | null>(null);
  const [defenderLoading, setDefenderLoading] = useState(false);
  const [defenderConfig, setDefenderConfig] = useState<DamageAdvancedConfig>(
    createDefaultAdvancedConfig(),
  );
  const [defenderAdvancedOpen, setDefenderAdvancedOpen] = useState(false);

  const [selectedMoveSlug, setSelectedMoveSlug] = useState<string | null>(null);
  const [movePickerOpen, setMovePickerOpen] = useState(false);

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

  function ensureAdvancedReferenceData(): void {
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
  }

  // Attacker reference data: only fetched once a form is selected (never
  // before), and re-fetched (for this same form) whenever the game changes
  // — task §10/§12. An invalid move for the new game is dropped, not the
  // Pokémon selections themselves. A form swap also revalidates the
  // Advanced ability, mirroring Build's own `changeTeamMemberForm` (task
  // §14) — only ability is form-scoped, everything else in the Advanced
  // config survives untouched.
  useEffect(() => {
    if (!attackerFormSlug) {
      setAttackerForm(null);
      setAttackerMoves([]);
      setSelectedMoveSlug(null);
      return;
    }
    let cancelled = false;
    setAttackerLoading(true);
    fetchAttackerReferenceData(attackerFormSlug, versionGroupSlug).then((data) => {
      if (cancelled) return;
      setAttackerForm(data.form);
      setAttackerMoves(data.moves);
      setSelectedMoveSlug((current) =>
        current && data.moves.some((move) => move.slug === current) ? current : null,
      );
      setAttackerConfig((config) => revalidateAdvancedConfigForForm(config, data.form));
      setAttackerLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [attackerFormSlug, versionGroupSlug]);

  // Defender reference data: only its form, never a learnset (task §10).
  useEffect(() => {
    if (!defenderFormSlug) {
      setDefenderForm(null);
      return;
    }
    let cancelled = false;
    setDefenderLoading(true);
    fetchDefenderReferenceData(defenderFormSlug).then((form) => {
      if (cancelled) return;
      setDefenderForm(form);
      setDefenderConfig((config) => revalidateAdvancedConfigForForm(config, form));
      setDefenderLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [defenderFormSlug]);

  // Game-switch revalidation (task §15) — re-runs only when the version
  // group actually changes (`capabilities` is memoized on its slug/
  // generation above, so this effect doesn't fire on every render).
  useEffect(() => {
    if (!capabilities) return;
    setAttackerConfig((config) => revalidateAdvancedConfigForCapabilities(config, capabilities));
    setDefenderConfig((config) => revalidateAdvancedConfigForCapabilities(config, capabilities));
  }, [capabilities]);

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

      <div className="flex flex-col items-stretch gap-6 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <DamagePokemonSlot
            locale={locale}
            label={labels.attackerLabel}
            searchIndex={searchIndex}
            typeLabels={typeLabels}
            selectedFormSlug={attackerFormSlug}
            onSelect={setAttackerFormSlug}
            labels={labels.pokemonSlot}
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

        <div className="flex flex-col items-center gap-2 self-center">
          <span aria-hidden="true" className="text-lg text-muted">
            →
          </span>
          <div className="flex flex-col gap-1.5 text-center">
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">
              {labels.moveLabel}
            </span>
            {attackerLoading ? (
              <span className="text-sm text-muted">…</span>
            ) : !attackerFormSlug ? (
              <span className="text-sm text-muted">{labels.noMoveSelected}</span>
            ) : movePickerOpen ? (
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
              />
            ) : attackerMoves.length === 0 ? (
              <span className="text-sm text-muted">{labels.noLegalMoves}</span>
            ) : (
              <button
                type="button"
                onClick={() => setMovePickerOpen(true)}
                aria-label={
                  selectedMove
                    ? formatMessage(labels.changeMoveTemplate, {
                        name: moveDisplayName(selectedMove, locale),
                      })
                    : labels.selectMoveLabel
                }
                className={buttonClass('default', 'px-3 py-1.5 text-sm font-semibold')}
              >
                {selectedMove ? moveDisplayName(selectedMove, locale) : labels.selectMoveLabel}
              </button>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <DamagePokemonSlot
            locale={locale}
            label={labels.defenderLabel}
            searchIndex={searchIndex}
            typeLabels={typeLabels}
            selectedFormSlug={defenderFormSlug}
            onSelect={setDefenderFormSlug}
            labels={labels.pokemonSlot}
          />
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

      {attackerFormSlug && !attackerLoading && attackerForm === null ? (
        <p className="m-0 text-center text-sm text-muted">{labels.errors['unknown-form']}</p>
      ) : null}
      {defenderFormSlug && !defenderLoading && defenderForm === null ? (
        <p className="m-0 text-center text-sm text-muted">{labels.errors['unknown-form']}</p>
      ) : null}
    </div>
  );
}
