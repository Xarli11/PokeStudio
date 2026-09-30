'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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

import { buttonClass } from '@/lib/ui-classes';
import type { BattleDisplayNames } from '@/lib/battle/types';

import { labelClass, optionClass, primaryActionClass, segmentTrackClass } from './styles';

export interface ActionLabels {
  actorTemplate: string;
  stepOfTemplate: string;
  chooseAction: string;
  chooseReplacement: string;
  forcedSwitchCountTemplate: string;
  moves: string;
  switches: string;
  pass: string;
  ppTemplate: string;
  chooseTarget: string;
  targetFoeTemplate: string;
  targetAllyTemplate: string;
  targetAutoTemplate: string;
  terastallize: string;
  next: string;
  back: string;
  review: string;
  reviewHeading: string;
  change: string;
  changeMove: string;
  summaryMoveTemplate: string;
  summaryMoveTargetTemplate: string;
  summarySwitchTemplate: string;
  summaryPassTemplate: string;
  summaryTera: string;
  submit: string;
  confirmTurn: string;
  submitting: string;
  chooseFirst: string;
  forcedCountHint: string;
  progressDone: string;
  progressCurrent: string;
  progressPending: string;
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
    <section aria-label={labels.heading} className="flex flex-col gap-3">
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
                className={optionClass(position >= 0, 'min-h-12 w-full')}
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
          className={primaryActionClass('ml-auto')}
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

/** What the action panel is pointing at, so the battlefield can highlight it. */
export interface ActionFocus {
  actor: BattleSlotRef;
  /** Legal targets while one is being chosen, otherwise `null`. */
  targets: BattleSlotRef[] | null;
  /** The target already picked among those, otherwise `null`. */
  selected: BattleSlotRef | null;
}

const isAutoPass = (slot: BattleSlotChoices) =>
  slot.options.length === 1 && slot.options[0]?.kind === 'pass';

/**
 * Move / switch / forced-switch choices for one side, one Pokémon at a time. With several slots the
 * turn is built step by step and reviewed before it is sent; with one slot it is confirmed directly.
 * Everything is local state until the final confirm: the engine only ever receives a whole command.
 */
export function ActionPanel({
  choices,
  state,
  labels,
  names,
  busy,
  playerLabel,
  onFocus,
  onSubmit,
}: {
  choices: Extract<BattleLegalChoices, { kind: 'move' | 'forced-switch' }>;
  state: BattleState;
  labels: ActionLabels;
  names: BattleDisplayNames | null;
  busy: boolean;
  playerLabel: string;
  onFocus?: (focus: ActionFocus | null) => void;
  onSubmit: (command: BattleCommand) => void;
}) {
  const slots = choices.slots;
  const forced = choices.kind === 'forced-switch';
  const switchCount = forced ? (choices as { switchCount: number }).switchCount : 0;
  const steps = useMemo(
    () => slots.flatMap((slot, index) => (isAutoPass(slot) ? [] : [index])),
    [slots],
  );
  const [selections, setSelections] = useState<(Selection | null)[]>(() =>
    slots.map((slot): Selection | null => (isAutoPass(slot) ? { kind: 'pass' } : null)),
  );
  const [step, setStep] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const submitted = useRef(false);
  const targetChooser = useRef<HTMLDivElement>(null);

  const set = (index: number, selection: Selection | null) =>
    setSelections((current) => current.map((entry, i) => (i === index ? selection : entry)));

  const moveName = (id: string) => names?.moves[id] ?? id;
  const occupantName = (slot: BattleSlotChoices) =>
    slot.pokemon ? memberName(state, slot.pokemon) : '';
  const slotName = (slot: BattleSlotRef) => {
    const pokemon = state.sides[slot.side].active[slot.position];
    return pokemon ? (pokemon.nickname ?? pokemon.species) : null;
  };

  const optionFor = (index: number, selection: Selection | null) =>
    selection?.kind === 'move'
      ? slots[index]!.options.find(
          (o): o is BattleLegalMoveOption => o.kind === 'move' && o.moveId === selection.moveId,
        )
      : undefined;
  const slotComplete = (index: number) => {
    const selection = selections[index];
    if (!selection) return false;
    if (selection.kind === 'move') {
      const option = optionFor(index, selection);
      return option ? option.targets === null || selection.target !== undefined : false;
    }
    return true;
  };

  const switchedIn = selections.flatMap((s) => (s?.kind === 'switch' ? [s.pokemon] : []));
  const teraUsed = selections.some((s) => s?.kind === 'move' && s.modifier === 'terastallize');
  const switchCountOk = !forced || switchedIn.length === switchCount;
  const allComplete = slots.every((_, i) => slotComplete(i));

  const current = steps.length === 0 ? null : (steps[Math.min(step, steps.length - 1)] ?? null);
  const single = steps.length <= 1;
  const showReview = !single && reviewing;

  // Point the battlefield at the acting Pokémon, and at the legal targets while one is chosen.
  const focusSelection = current === null ? null : selections[current];
  const focusOption = current === null ? undefined : optionFor(current, focusSelection ?? null);
  const focusSlot = current === null || showReview ? null : slots[current]!.slot;
  const focusTargets =
    focusOption && focusOption.targets !== null && focusOption.targets.length > 1
      ? focusOption.targets
      : null;
  const focusSelected =
    focusTargets && focusSelection?.kind === 'move' ? (focusSelection.target ?? null) : null;
  useEffect(() => {
    onFocus?.(
      focusSlot ? { actor: focusSlot, targets: focusTargets, selected: focusSelected } : null,
    );
  }, [onFocus, focusSlot, focusTargets, focusSelected]);
  useEffect(() => () => onFocus?.(null), [onFocus]);

  // In the small-screen sheet the target list can sit below the fold: bring it into view when it
  // appears (the sticky footer is cleared by the chooser's scroll margin).
  const choosingTarget = focusTargets !== null && focusSelection?.kind === 'move';
  useEffect(() => {
    if (choosingTarget) targetChooser.current?.scrollIntoView?.({ block: 'nearest' });
  }, [choosingTarget, focusSelection]);

  const send = () => {
    if (!allComplete || !switchCountOk || busy || submitted.current) return;
    submitted.current = true;
    onSubmit({
      kind: 'actions',
      actions: slots.map((slot, i) => toAction(slot.slot, selections[i]!)),
    });
  };
  // A new decision mounts a new panel (keyed by the caller), so the guard resets with it; a rejected
  // command must be retryable, so it also resets whenever the panel stops being busy.
  useEffect(() => {
    if (!busy) submitted.current = false;
  }, [busy]);

  const summary = (index: number) => {
    const slot = slots[index]!;
    const selection = selections[index];
    const who = occupantName(slot);
    if (!selection || selection.kind === 'pass') {
      return formatMessage(labels.summaryPassTemplate, { pokemon: who });
    }
    if (selection.kind === 'switch') {
      return formatMessage(labels.summarySwitchTemplate, {
        pokemon: who,
        to: memberName(state, selection.pokemon),
      });
    }
    const target = selection.target ? slotName(selection.target) : null;
    const text = target
      ? formatMessage(labels.summaryMoveTargetTemplate, {
          pokemon: who,
          move: moveName(selection.moveId),
          target,
        })
      : formatMessage(labels.summaryMoveTemplate, {
          pokemon: who,
          move: moveName(selection.moveId),
        });
    return selection.modifier === 'terastallize' ? `${text}${labels.summaryTera}` : text;
  };

  const actorLine = (index: number) =>
    formatMessage(labels.actorTemplate, {
      player: playerLabel,
      pokemon: occupantName(slots[index]!),
    });

  const renderSlot = (index: number) => {
    const slotChoices = slots[index]!;
    const selection = selections[index] ?? null;
    const moves = slotChoices.options.filter((o): o is BattleLegalMoveOption => o.kind === 'move');
    const switches = slotChoices.options.filter(
      (o): o is Extract<typeof o, { kind: 'switch' }> => o.kind === 'switch',
    );
    const canPass = slotChoices.options.some((o) => o.kind === 'pass');
    const chosenMove = optionFor(index, selection);
    // Only ask for a target when there is a real choice; one legal target is picked for the player.
    const legalTargets = chosenMove?.targets ?? null;
    const askTarget = legalTargets !== null && legalTargets.length > 1;
    const targetSlots = (['p2', 'p1'] as const).flatMap((side) =>
      state.sides[side].active.flatMap((pokemon, position) =>
        pokemon && !(side === slotChoices.slot.side && position === slotChoices.slot.position)
          ? [{ side, position }]
          : [],
      ),
    );
    const isLegal = (target: BattleSlotRef) =>
      (legalTargets ?? []).some((t) => sameSlot(t, target));
    const canTera = chosenMove?.modifiers.includes('terastallize') ?? false;
    const teraOn = selection?.kind === 'move' && selection.modifier === 'terastallize';
    const hasOthers =
      switches.length > 0 || canTera || (canPass && moves.length + switches.length > 0);
    return (
      <fieldset
        key={`${slotChoices.slot.side}${slotChoices.slot.position}`}
        className="m-0 flex flex-col gap-3 border-0 p-0 lg:gap-4"
      >
        <legend className="sr-only">{actorLine(index)}</legend>
        {moves.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className={labelClass}>{labels.moves}</span>
            <div className="grid grid-cols-1 gap-2 min-[21rem]:grid-cols-2">
              {moves.map((move) => {
                const pressed = selection?.kind === 'move' && selection.moveId === move.moveId;
                return (
                  <button
                    key={move.moveId}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => {
                      const only = move.targets?.length === 1 ? move.targets[0] : undefined;
                      set(index, {
                        kind: 'move',
                        moveId: move.moveId,
                        ...(only ? { target: only } : {}),
                      });
                    }}
                    className={optionClass(
                      pressed,
                      `min-h-12 text-base ${askTarget && chosenMove && !pressed ? 'max-lg:hidden' : ''}`,
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`w-3 shrink-0 text-sm ${pressed ? 'text-brand' : 'text-transparent'}`}
                      >
                        ✓
                      </span>
                      <span className="line-clamp-2 break-words leading-tight">
                        {moveName(move.moveId)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-normal text-muted tabular-nums">
                      {formatMessage(labels.ppTemplate, { pp: move.pp })}
                    </span>
                  </button>
                );
              })}
            </div>
            {chosenMove && askTarget ? (
              <button
                type="button"
                className="cursor-pointer self-start text-sm font-semibold text-brand hover:underline lg:hidden"
                onClick={() => set(index, null)}
              >
                {labels.changeMove}
              </button>
            ) : null}
            {chosenMove && askTarget ? (
              <div
                role="group"
                aria-label={labels.chooseTarget}
                data-testid="target-chooser"
                ref={targetChooser}
                className="mt-1 flex scroll-mb-24 flex-col gap-2 rounded-md bg-surface p-3"
              >
                <span className="text-sm font-semibold">{labels.chooseTarget}</span>
                <div className="grid grid-cols-1 gap-2 min-[21rem]:grid-cols-2">
                  {targetSlots.map((target) => {
                    const legal = isLegal(target);
                    const on =
                      selection?.kind === 'move' &&
                      selection.target !== undefined &&
                      sameSlot(selection.target, target);
                    const name = slotName(target) ?? '';
                    return (
                      <button
                        key={`${target.side}${target.position}`}
                        type="button"
                        aria-pressed={on}
                        disabled={!legal}
                        onClick={() =>
                          selection?.kind === 'move' && set(index, { ...selection, target })
                        }
                        className={optionClass(on, 'min-h-11 bg-surface-raised')}
                      >
                        {formatMessage(
                          target.side === slotChoices.slot.side
                            ? labels.targetAllyTemplate
                            : labels.targetFoeTemplate,
                          { name },
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : chosenMove && legalTargets !== null && legalTargets.length === 1 ? (
              <span className="text-xs text-muted" data-testid="target-auto">
                {formatMessage(labels.targetAutoTemplate, {
                  name: slotName(legalTargets[0]!) ?? '',
                })}
              </span>
            ) : null}
          </div>
        ) : null}
        {hasOthers ? (
          <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
            {switches.length > 0 ? (
              <>
                <span className={`${labelClass} ${askTarget && chosenMove ? 'max-lg:hidden' : ''}`}>
                  {labels.switches}
                </span>
                <div
                  className={`flex flex-wrap gap-2 ${askTarget && chosenMove ? 'max-lg:hidden' : ''}`}
                >
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
                        className={optionClass(on, 'min-h-11')}
                      >
                        {memberName(state, option.pokemon)}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
            {canTera || (canPass && moves.length + switches.length > 0) ? (
              <div className="flex flex-wrap items-center gap-2">
                {canTera ? (
                  <label
                    className={optionClass(
                      teraOn,
                      `min-h-11 justify-start gap-2 ${teraUsed && !teraOn ? 'opacity-45' : ''}`,
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-brand"
                      checked={teraOn}
                      disabled={teraUsed && !teraOn}
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
                {canPass && moves.length + switches.length > 0 ? (
                  <button
                    type="button"
                    aria-pressed={selection?.kind === 'pass'}
                    onClick={() => set(index, { kind: 'pass' })}
                    className={optionClass(selection?.kind === 'pass', 'min-h-11')}
                  >
                    {labels.pass}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </fieldset>
    );
  };

  const prompt = forced ? labels.chooseReplacement : labels.chooseAction;
  const confirmLabel = busy ? labels.submitting : single ? labels.submit : labels.confirmTurn;

  return (
    <section className="flex flex-col gap-3 lg:gap-4" data-testid="action-panel">
      <div className="flex flex-col gap-0.5" role="status">
        <span className="text-lg font-bold leading-tight" data-testid="actor-line">
          {showReview ? labels.reviewHeading : current === null ? playerLabel : actorLine(current)}
        </span>
        <span className="text-sm text-muted" data-testid="action-prompt">
          {showReview ? playerLabel : prompt}
          {!showReview && !single
            ? ` · ${formatMessage(labels.stepOfTemplate, { n: Math.min(step, steps.length - 1) + 1, total: steps.length })}`
            : ''}
          {forced && !showReview
            ? ` · ${formatMessage(labels.forcedSwitchCountTemplate, { count: switchCount })}`
            : ''}
        </span>
      </div>

      {!single ? (
        <ol
          className={`${segmentTrackClass} m-0 list-none self-start p-0.5`}
          data-testid="turn-progress"
        >
          {steps.map((slotIndex, position) => {
            const done = slotComplete(slotIndex) && (showReview || position < step);
            const now = !showReview && position === Math.min(step, steps.length - 1);
            return (
              <li
                key={slotIndex}
                aria-current={now ? 'step' : undefined}
                data-state={done ? 'done' : now ? 'current' : 'pending'}
                className={`rounded-full px-2.5 py-1 text-xs ${now ? 'bg-brand-muted font-semibold text-brand' : done ? 'text-foreground' : 'text-muted'}`}
              >
                <span aria-hidden="true">{done ? '✓' : now ? '→' : '○'} </span>
                {occupantName(slots[slotIndex]!)}
                <span className="sr-only">
                  {' '}
                  (
                  {done
                    ? labels.progressDone
                    : now
                      ? labels.progressCurrent
                      : labels.progressPending}
                  )
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {steps.length === 0 ? (
        <span className="text-sm text-muted">{labels.noActionNeeded}</span>
      ) : showReview ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="turn-review">
          {slots.map((_, index) => (
            <li
              key={index}
              className="flex items-center justify-between gap-3 rounded-md bg-surface px-3.5 py-3 text-sm font-semibold"
            >
              <span className="min-w-0">{summary(index)}</span>
              {!isAutoPass(slots[index]!) ? (
                <button
                  type="button"
                  className="shrink-0 cursor-pointer text-sm font-semibold text-brand hover:underline"
                  onClick={() => {
                    setStep(steps.indexOf(index));
                    setReviewing(false);
                  }}
                >
                  {labels.change}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : current !== null ? (
        renderSlot(current)
      ) : null}

      {/* Below the desktop layout the panel scrolls inside itself: keep its actions in view. */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-3 max-lg:sticky max-lg:bottom-0 max-lg:-mx-4 max-lg:-mb-4 max-lg:bg-surface-raised max-lg:px-4 max-lg:pb-4">
        {showReview && !switchCountOk ? (
          <span className="text-xs text-muted">{labels.forcedCountHint}</span>
        ) : !showReview && current !== null && !slotComplete(current) ? (
          <span className="text-xs text-muted">{labels.chooseFirst}</span>
        ) : null}
        {!single && !showReview && step > 0 ? (
          <button type="button" className={buttonClass()} onClick={() => setStep(step - 1)}>
            {labels.back}
          </button>
        ) : null}
        {showReview ? (
          <button type="button" className={buttonClass()} onClick={() => setReviewing(false)}>
            {labels.back}
          </button>
        ) : null}
        {!single && !showReview ? (
          <button
            type="button"
            className={primaryActionClass('ml-auto')}
            disabled={current === null || !slotComplete(current)}
            onClick={() => (step >= steps.length - 1 ? setReviewing(true) : setStep(step + 1))}
          >
            {step >= steps.length - 1 ? labels.review : labels.next}
          </button>
        ) : (
          <button
            type="button"
            className={primaryActionClass('ml-auto')}
            disabled={
              busy ||
              !switchCountOk ||
              !allComplete ||
              (single && current !== null && !slotComplete(current))
            }
            onClick={send}
          >
            {confirmLabel}
          </button>
        )}
      </div>
    </section>
  );
}
