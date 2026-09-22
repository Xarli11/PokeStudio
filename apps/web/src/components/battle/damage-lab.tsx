'use client';

import { startTransition, useActionState, useEffect, useState } from 'react';

import type {
  ComparablePokemonForm,
  MoveSummary,
  SpeciesSearchAlias,
  SpeciesSearchItem,
  VersionGroupSummary,
} from '@pokestudio/database';
import type { DamageInputErrorCode } from '@pokestudio/damage';
import { formatMessage, type Locale } from '@pokestudio/i18n';
import type { PokemonType } from '@pokestudio/pokemon-data';

import {
  calculateDamageAction,
  fetchAttackerReferenceData,
  fetchDefenderReferenceData,
  type DamageLabCalculationResponse,
} from '@/app/[locale]/battle/damage/actions';
import { MovePicker, type MovePickerLabels } from '@/components/build/move-picker';
import { moveDisplayName } from '@/lib/move-search';
import { DEFAULT_IVS, MAX_LEVEL, ZERO_EVS } from '@/lib/team-draft';
import { buttonClass } from '@/lib/ui-classes';
import { groupVersionGroupsByGeneration, versionGroupDisplayName } from '@/lib/version-group-label';

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
  assumptionsTemplate: string;
  resultHeading: string;
  pokemonSlot: DamagePokemonSlotLabels;
  movePicker: MovePickerLabels;
  result: DamageResultLabels;
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

export function DamageLab({
  locale,
  searchIndex,
  versionGroups,
  defaultVersionGroupSlug,
  typeLabels,
  labels,
}: {
  locale: Locale;
  searchIndex: { items: SpeciesSearchItem[]; aliases: SpeciesSearchAlias[] };
  versionGroups: VersionGroupSummary[];
  defaultVersionGroupSlug: string;
  typeLabels: Record<PokemonType, string>;
  labels: DamageLabLabels;
}) {
  const initialVersionGroupSlug =
    versionGroups.find((vg) => vg.slug === defaultVersionGroupSlug)?.slug ??
    versionGroups[0]?.slug ??
    defaultVersionGroupSlug;
  const [versionGroupSlug, setVersionGroupSlug] = useState(initialVersionGroupSlug);
  const versionGroupsByGeneration = groupVersionGroupsByGeneration(versionGroups);

  const [attackerFormSlug, setAttackerFormSlug] = useState<string | null>(null);
  const [attackerForm, setAttackerForm] = useState<ComparablePokemonForm | null>(null);
  const [attackerMoves, setAttackerMoves] = useState<MoveSummary[]>([]);
  const [attackerLoading, setAttackerLoading] = useState(false);

  const [defenderFormSlug, setDefenderFormSlug] = useState<string | null>(null);
  const [defenderForm, setDefenderForm] = useState<ComparablePokemonForm | null>(null);
  const [defenderLoading, setDefenderLoading] = useState(false);

  const [selectedMoveSlug, setSelectedMoveSlug] = useState<string | null>(null);
  const [movePickerOpen, setMovePickerOpen] = useState(false);

  // Attacker reference data: only fetched once a form is selected (never
  // before), and re-fetched (for this same form) whenever the game changes
  // — task §10/§12. An invalid move for the new game is dropped, not the
  // Pokémon selections themselves.
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
      setDefenderLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [defenderFormSlug]);

  const selectedMove = attackerMoves.find((move) => move.slug === selectedMoveSlug);
  const selectedVersionGroup = versionGroups.find((vg) => vg.slug === versionGroupSlug);

  const canCalculate = Boolean(attackerForm && defenderForm && selectedMoveSlug);

  const [calcState, submitCalculate, isCalculating] = useActionState<
    DamageLabCalculationResponse | null,
    void
  >(async () => {
    if (!attackerForm || !defenderForm || !selectedMoveSlug || !selectedVersionGroup) return null;
    return calculateDamageAction({
      generation: selectedVersionGroup.generation,
      attackerFormSlug: attackerForm.formSlug,
      attackerSpeciesSlug: attackerForm.speciesSlug,
      defenderFormSlug: defenderForm.formSlug,
      defenderSpeciesSlug: defenderForm.speciesSlug,
      moveSlug: selectedMoveSlug,
    });
  }, null);

  const assumptions = formatMessage(labels.assumptionsTemplate, {
    level: MAX_LEVEL,
    evs: ZERO_EVS.hp,
    ivs: DEFAULT_IVS.hp,
  });

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
        <DamagePokemonSlot
          locale={locale}
          label={labels.attackerLabel}
          searchIndex={searchIndex}
          typeLabels={typeLabels}
          selectedFormSlug={attackerFormSlug}
          onSelect={setAttackerFormSlug}
          labels={labels.pokemonSlot}
        />

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

        <DamagePokemonSlot
          locale={locale}
          label={labels.defenderLabel}
          searchIndex={searchIndex}
          typeLabels={typeLabels}
          selectedFormSlug={defenderFormSlug}
          onSelect={setDefenderFormSlug}
          labels={labels.pokemonSlot}
        />
      </div>

      <p className="m-0 text-center text-xs text-muted">{assumptions}</p>

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
          <div className={isCalculating ? 'opacity-60 transition-opacity' : undefined}>
            <h2 className="sr-only">{labels.resultHeading}</h2>
            <DamageResult result={calcState.result} locale={locale} labels={labels.result} />
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
