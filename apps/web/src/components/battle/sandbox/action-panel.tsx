'use client';

import { useMemo, useState } from 'react';

import { formatMessage } from '@pokestudio/i18n';
import type {
  BattleCommand,
  BattleCommandAction,
  BattleLegalChoices,
  BattleLegalMoveOption,
  BattlePokemonRef,
  BattleSideId,
  BattleSlotChoices,
  BattleSlotRef,
  BattleState,
} from '@pokestudio/battle-engine/types';

import { buttonClass, cardClass } from '@/lib/ui-classes';
import type { BattleDisplayNames } from '@/lib/battle/types';

export interface ActionLabels {
  slotTemplate: string;
  moves: string;
  switches: string;
  pass: string;
  ppTemplate: string;
  target: string;
  targetFoe: string;
  targetAlly: string;
  terastallize: string;
  submit: string;
  submitting: string;
  forcedHeading: string;
  forcedSwitchCountTemplate: string;
  chooseFirst: string;
  noActionNeeded: string;
}

export interface PreviewLabels {
  heading: string;
  instructionTemplate: string;
  selectedTemplate: string;
  clear: string;
  submit: string;
  openSheets: string;
  orderTemplate: string;
}

const sameRef = (a: BattlePokemonRef, b: BattlePokemonRef) =>
  a.side === b.side && a.teamIndex === b.teamIndex;
const sameSlot = (a: BattleSlotRef, b: BattleSlotRef) =>
  a.side === b.side && a.position === b.position;

function memberName(state: BattleState, ref: BattlePokemonRef): string {
  const member = state.sides[ref.side].team.find((p) => p.ref.teamIndex === ref.teamIndex);
  return member ? (member.nickname ?? member.species) : `#${ref.teamIndex + 1}`;
}

/** Team preview: pick and order the Pokémon that will lead. */
export function TeamPreviewPanel({
  side,
  state,
  pick,
  labels,
  openTeamSheets,
  busy,
  onSubmit,
}: {
  side: BattleSideId;
  state: BattleState;
  pick: number;
  labels: PreviewLabels;
  openTeamSheets: boolean;
  busy: boolean;
  onSubmit: (command: BattleCommand) => void;
}) {
  const team = state.sides[side].team;
  const [order, setOrder] = useState<number[]>([]);
  const toggle = (teamIndex: number) =>
    setOrder((current) =>
      current.includes(teamIndex)
        ? current.filter((i) => i !== teamIndex)
        : current.length < pick
          ? [...current, teamIndex]
          : current,
    );
  return (
    <section aria-label={labels.heading} className={cardClass('flex flex-col gap-3 p-4')}>
      <h3 className="m-0 text-base font-bold">{labels.heading}</h3>
      <p className="m-0 text-sm text-muted">
        {formatMessage(labels.instructionTemplate, { pick, of: team.length })}
      </p>
      {openTeamSheets ? <p className="m-0 text-xs text-muted">{labels.openSheets}</p> : null}
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3">
        {team.map((pokemon) => {
          const position = order.indexOf(pokemon.ref.teamIndex);
          return (
            <li key={pokemon.ref.teamIndex}>
              <button
                type="button"
                aria-pressed={position >= 0}
                onClick={() => toggle(pokemon.ref.teamIndex)}
                className={`${buttonClass('default', 'w-full justify-between')} ${position >= 0 ? 'border-brand bg-brand-muted' : ''}`}
              >
                <span className="truncate">{pokemon.nickname ?? pokemon.species}</span>
                {position >= 0 ? (
                  <span className="text-xs font-bold text-brand">
                    {formatMessage(labels.orderTemplate, { n: position + 1 })}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted">
          {formatMessage(labels.selectedTemplate, { count: order.length, pick })}
        </span>
        <button type="button" className={buttonClass()} onClick={() => setOrder([])}>
          {labels.clear}
        </button>
        <button
          type="button"
          className={buttonClass('primary', 'ml-auto')}
          disabled={order.length !== pick || busy}
          onClick={() => onSubmit({ kind: 'team-order', order })}
        >
          {labels.submit}
        </button>
      </div>
    </section>
  );
}

type Selection =
  | { kind: 'move'; moveId: string; target?: BattleSlotRef; modifier?: 'terastallize' }
  | { kind: 'switch'; pokemon: BattlePokemonRef }
  | { kind: 'pass' };

function toAction(slot: BattleSlotRef, selection: Selection): BattleCommandAction {
  if (selection.kind === 'move') {
    return {
      kind: 'move',
      slot,
      moveId: selection.moveId,
      ...(selection.target ? { target: selection.target } : {}),
      ...(selection.modifier ? { modifier: selection.modifier } : {}),
    };
  }
  if (selection.kind === 'switch') return { kind: 'switch', slot, pokemon: selection.pokemon };
  return { kind: 'pass', slot };
}

/** Move / switch / forced-switch choices for every active slot of one side. */
export function ActionPanel({
  choices,
  state,
  labels,
  names,
  busy,
  onSubmit,
}: {
  choices: Extract<BattleLegalChoices, { kind: 'move' | 'forced-switch' }>;
  state: BattleState;
  labels: ActionLabels;
  names: BattleDisplayNames | null;
  busy: boolean;
  onSubmit: (command: BattleCommand) => void;
}) {
  const slots = choices.slots;
  const forced = choices.kind === 'forced-switch';
  const initial = useMemo(
    () =>
      slots.map((slot): Selection | null =>
        slot.options.length === 1 && slot.options[0]?.kind === 'pass' ? { kind: 'pass' } : null,
      ),
    [slots],
  );
  const [selections, setSelections] = useState<(Selection | null)[]>(initial);

  const set = (index: number, selection: Selection | null) =>
    setSelections((current) => current.map((entry, i) => (i === index ? selection : entry)));

  const switchedIn = selections.flatMap((s) => (s?.kind === 'switch' ? [s.pokemon] : []));
  const teraUsed = selections.some((s) => s?.kind === 'move' && s.modifier === 'terastallize');

  const complete = slots.every((_, i) => {
    const selection = selections[i];
    if (!selection) return false;
    if (selection.kind === 'move') {
      const option = slots[i]!.options.find(
        (o): o is BattleLegalMoveOption => o.kind === 'move' && o.moveId === selection.moveId,
      );
      return option ? option.targets === null || selection.target !== undefined : false;
    }
    return true;
  });
  const switchCountOk =
    !forced || switchedIn.length === (choices as { switchCount: number }).switchCount;

  const submit = () => {
    if (!complete || !switchCountOk) return;
    onSubmit({
      kind: 'actions',
      actions: slots.map((slot, i) => toAction(slot.slot, selections[i]!)),
    });
  };

  const moveName = (id: string) => names?.moves[id] ?? id;
  const targetLabel = (target: BattleSlotRef, actor: BattleSlotRef) =>
    target.side === actor.side
      ? labels.targetAlly
      : formatMessage(labels.targetFoe, { n: target.position + 1 });

  return (
    <section className={cardClass('flex flex-col gap-4 p-4')}>
      {forced ? (
        <h3 className="m-0 text-base font-bold">
          {labels.forcedHeading}
          <span className="ml-2 text-xs font-normal text-muted">
            {formatMessage(labels.forcedSwitchCountTemplate, {
              count: (choices as { switchCount: number }).switchCount,
            })}
          </span>
        </h3>
      ) : null}
      {slots.map((slotChoices: BattleSlotChoices, index) => {
        const selection = selections[index] ?? null;
        const occupant = slotChoices.pokemon ? memberName(state, slotChoices.pokemon) : null;
        const moves = slotChoices.options.filter(
          (o): o is BattleLegalMoveOption => o.kind === 'move',
        );
        const switches = slotChoices.options.filter(
          (o): o is Extract<typeof o, { kind: 'switch' }> => o.kind === 'switch',
        );
        const canPass = slotChoices.options.some((o) => o.kind === 'pass');
        const chosenMove =
          selection?.kind === 'move' ? moves.find((m) => m.moveId === selection.moveId) : undefined;
        return (
          <fieldset
            key={`${slotChoices.slot.side}${slotChoices.slot.position}`}
            className="m-0 flex flex-col gap-3 border-0 p-0"
          >
            <legend className="mb-1 text-sm font-bold">
              {formatMessage(labels.slotTemplate, { n: slotChoices.slot.position + 1 })}
              {occupant ? <span className="ml-2 font-normal text-muted">{occupant}</span> : null}
            </legend>
            {moves.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {labels.moves}
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {moves.map((move) => {
                    const pressed = selection?.kind === 'move' && selection.moveId === move.moveId;
                    return (
                      <button
                        key={move.moveId}
                        type="button"
                        aria-pressed={pressed}
                        onClick={() => set(index, { kind: 'move', moveId: move.moveId })}
                        className={`${buttonClass('default', 'justify-between')} ${pressed ? 'border-brand bg-brand-muted' : ''}`}
                      >
                        <span className="truncate">{moveName(move.moveId)}</span>
                        <span className="text-xs text-muted">
                          {formatMessage(labels.ppTemplate, { pp: move.pp })}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {chosenMove && chosenMove.targets !== null ? (
                  <div
                    role="group"
                    aria-label={labels.target}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="text-xs font-semibold text-muted">{labels.target}</span>
                    {chosenMove.targets.map((target) => {
                      const on =
                        selection?.kind === 'move' &&
                        selection.target !== undefined &&
                        sameSlot(selection.target, target);
                      return (
                        <button
                          key={`${target.side}${target.position}`}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            selection?.kind === 'move' && set(index, { ...selection, target })
                          }
                          className={`${buttonClass('default')} ${on ? 'border-brand bg-brand-muted' : ''}`}
                        >
                          {targetLabel(target, slotChoices.slot)}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {chosenMove?.modifiers.includes('terastallize') ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selection?.kind === 'move' && selection.modifier === 'terastallize'}
                      disabled={
                        teraUsed &&
                        !(selection?.kind === 'move' && selection.modifier === 'terastallize')
                      }
                      onChange={(e) => {
                        if (selection?.kind !== 'move') return;
                        const next = { ...selection };
                        if (e.target.checked) next.modifier = 'terastallize';
                        else delete next.modifier;
                        set(index, next);
                      }}
                    />
                    {labels.terastallize}
                  </label>
                ) : null}
              </div>
            ) : null}
            {switches.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {labels.switches}
                </span>
                <div className="flex flex-wrap gap-2">
                  {switches.map((option) => {
                    const on =
                      selection?.kind === 'switch' && sameRef(selection.pokemon, option.pokemon);
                    const takenElsewhere = switchedIn.some(
                      (ref) => sameRef(ref, option.pokemon) && !on,
                    );
                    return (
                      <button
                        key={option.pokemon.teamIndex}
                        type="button"
                        aria-pressed={on}
                        disabled={takenElsewhere}
                        onClick={() => set(index, { kind: 'switch', pokemon: option.pokemon })}
                        className={`${buttonClass('default')} ${on ? 'border-brand bg-brand-muted' : ''}`}
                      >
                        {memberName(state, option.pokemon)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {canPass && (moves.length > 0 || switches.length > 0) ? (
              <button
                type="button"
                aria-pressed={selection?.kind === 'pass'}
                onClick={() => set(index, { kind: 'pass' })}
                className={`${buttonClass('default', 'self-start')} ${selection?.kind === 'pass' ? 'border-brand bg-brand-muted' : ''}`}
              >
                {labels.pass}
              </button>
            ) : null}
            {canPass && moves.length === 0 && switches.length === 0 ? (
              <span className="text-sm text-muted">{labels.noActionNeeded}</span>
            ) : null}
          </fieldset>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        {!complete || !switchCountOk ? (
          <span className="text-xs text-muted">{labels.chooseFirst}</span>
        ) : null}
        <button
          type="button"
          className={buttonClass('primary', 'ml-auto')}
          disabled={!complete || !switchCountOk || busy}
          onClick={submit}
        >
          {busy ? labels.submitting : labels.submit}
        </button>
      </div>
    </section>
  );
}
