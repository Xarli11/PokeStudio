'use client';

import { useEffect, useMemo, useState } from 'react';

import { formatMessage } from '@pokestudio/i18n';

import type { EventCopyContext } from '@/lib/battle/event-copy';
import { buildTurns, type TurnSummary } from '@/lib/battle/timeline';
import type {
  ActionResult,
  BattleCommand,
  BattleDisplayNames,
  BattleEvent,
  BattleReplay,
  BattleSideId,
  CreatedFork,
  ReadablePerspective,
  SideView,
} from '@/lib/battle/types';
import { buttonClass, cardClass } from '@/lib/ui-classes';

import { ActionPanel, type ActionLabels } from './action-panel';
import { TurnInspector, type InspectorLabels } from './timeline-panel';

export interface ForkLabels {
  heading: string;
  chooseSide: string;
  loading: string;
  noDecision: string;
  original: string;
  alternative: string;
  reusedTemplate: string;
  askedTemplate: string;
  note: string;
  close: string;
  unavailable: string;
}

/** The server actions a fork needs. */
export interface ForkActions {
  loadDecisionView(
    battleId: string,
    atDecision: number,
    side: BattleSideId,
  ): Promise<ActionResult<SideView>>;
  createFork(
    battleId: string,
    input: { atDecision: number; side: BattleSideId; command: BattleCommand },
  ): Promise<ActionResult<CreatedFork>>;
  loadSideView(battleId: string, side: BattleSideId): Promise<ActionResult<SideView>>;
  loadEvents(
    battleId: string,
    perspective: ReadablePerspective,
    afterSeq?: number,
  ): Promise<ActionResult<{ events: BattleEvent[] }>>;
  submitSandboxCommand(
    battleId: string,
    side: BattleSideId,
    command: BattleCommand,
  ): Promise<ActionResult<unknown>>;
}

/**
 * "Try a different play": re-plays one turn of a finished battle with another command for one side.
 * The other side's original command is reused when it is still legal, otherwise it is asked again.
 * The original and the alternative are shown side by side; nothing is scored or recommended.
 */
export function ForkPanel({
  battleId,
  turn,
  replay,
  original,
  viewAs,
  ctx,
  labels,
  inspectorLabels,
  actionLabels,
  names,
  sideLabel,
  perspectiveLabel,
  errorText,
  actions,
  onClose,
}: {
  battleId: string;
  turn: number;
  replay: BattleReplay;
  original: TurnSummary;
  viewAs: ReadablePerspective;
  ctx: EventCopyContext;
  labels: ForkLabels;
  inspectorLabels: InspectorLabels;
  actionLabels: ActionLabels;
  names: BattleDisplayNames | null;
  sideLabel: (side: BattleSideId) => string;
  perspectiveLabel: string;
  errorText: (code: string) => string;
  actions: ForkActions;
  onClose: () => void;
}) {
  const decision = useMemo(
    () => replay.commands.find((c) => c.turn === turn && c.command.kind === 'actions')?.decision,
    [replay, turn],
  );
  const [side, setSide] = useState<BattleSideId | null>(null);
  const [boundary, setBoundary] = useState<SideView | null>(null);
  const [fork, setFork] = useState<CreatedFork | null>(null);
  const [pendingView, setPendingView] = useState<SideView | null>(null);
  const [alternative, setAlternative] = useState<TurnSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (code: string) => {
    setError(code);
    setBusy(false);
  };

  const readAlternative = async (created: CreatedFork) => {
    const events = await actions.loadEvents(created.battleId, viewAs, 0);
    if (!events.ok) return fail(events.error.code);
    setAlternative(buildTurns(events.data.events).find((t) => t.turn === turn) ?? null);
    const pending = created.pending[0];
    if (pending) {
      const view = await actions.loadSideView(created.battleId, pending);
      if (!view.ok) return fail(view.error.code);
      setPendingView(view.data);
    } else {
      setPendingView(null);
    }
    setBusy(false);
  };

  // Which player's play to change: read what that side could do at the boundary.
  useEffect(() => {
    if (side === null || decision === undefined) return;
    let alive = true;
    setBoundary(null);
    setFork(null);
    setAlternative(null);
    setError(null);
    void actions.loadDecisionView(battleId, decision, side).then((result) => {
      if (!alive) return;
      if (result.ok) setBoundary(result.data);
      else setError(result.error.code);
    });
    return () => {
      alive = false;
    };
  }, [actions, battleId, decision, side]);

  const submitAlternative = async (command: BattleCommand) => {
    if (side === null || decision === undefined) return;
    setBusy(true);
    const created = await actions.createFork(battleId, { atDecision: decision, side, command });
    if (!created.ok) return fail(created.error.code);
    setError(null);
    setFork(created.data);
    await readAlternative(created.data);
  };

  const submitPending = async (command: BattleCommand) => {
    const pending = fork?.pending[0];
    if (!fork || !pending) return;
    setBusy(true);
    const result = await actions.submitSandboxCommand(fork.battleId, pending, command);
    if (!result.ok) return fail(result.error.code);
    setError(null);
    const remaining = fork.pending.slice(1);
    const next = { ...fork, pending: remaining };
    setFork(next);
    await readAlternative(next);
  };

  const choices = boundary?.choices;
  const pendingChoices = pendingView?.choices;
  const other = side === 'p1' ? 'p2' : 'p1';

  return (
    <section
      aria-label={labels.heading}
      data-testid="fork-panel"
      className={cardClass('flex flex-col gap-3 p-4')}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-base font-bold">
          {labels.heading} ·{' '}
          {formatMessage(ctx.templates['turnStarted'] ?? 'Turn {turn}', { turn })}
        </h3>
        <button type="button" className={buttonClass()} onClick={onClose}>
          {labels.close}
        </button>
      </div>
      <p className="m-0 text-xs text-muted">{labels.note}</p>

      {decision === undefined ? (
        <p className="m-0 text-sm text-muted">{labels.noDecision}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{labels.chooseSide}</span>
          <div className="flex gap-1">
            {(['p1', 'p2'] as const).map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-pressed={side === candidate}
                onClick={() => setSide(candidate)}
                className={`${buttonClass('default')} ${side === candidate ? 'border-brand bg-brand-muted' : ''}`}
              >
                {sideLabel(candidate)}
              </button>
            ))}
          </div>
        </div>
      )}

      {error ? (
        <p role="alert" data-testid="fork-error" className="m-0 text-sm text-danger">
          {errorText(error)}
        </p>
      ) : null}

      {side && !fork ? (
        choices && (choices.kind === 'move' || choices.kind === 'forced-switch') && boundary ? (
          <ActionPanel
            key={`fork-${side}-${decision}`}
            choices={choices}
            state={boundary.state}
            labels={actionLabels}
            names={names}
            busy={busy}
            onSubmit={(command) => void submitAlternative(command)}
          />
        ) : boundary ? (
          <p className="m-0 text-sm text-muted">{labels.unavailable}</p>
        ) : error ? null : (
          <p className="m-0 text-sm text-muted">{labels.loading}</p>
        )
      ) : null}

      {fork ? (
        <div className="flex flex-col gap-2" data-testid="fork-result">
          {fork.reused.map((reusedSide) => (
            <p key={reusedSide} className="m-0 text-xs text-muted">
              {formatMessage(labels.reusedTemplate, { player: sideLabel(reusedSide) })}
            </p>
          ))}
          {fork.pending.map((pendingSide) => (
            <p key={pendingSide} className="m-0 text-xs font-semibold">
              {formatMessage(labels.askedTemplate, { player: sideLabel(pendingSide) })}
            </p>
          ))}
          {pendingChoices &&
          (pendingChoices.kind === 'move' || pendingChoices.kind === 'forced-switch') &&
          pendingView ? (
            <ActionPanel
              key={`fork-pending-${fork.pending[0] ?? other}`}
              choices={pendingChoices}
              state={pendingView.state}
              labels={actionLabels}
              names={names}
              busy={busy}
              onSubmit={(command) => void submitPending(command)}
            />
          ) : null}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <TurnInspector
              turn={original}
              labels={inspectorLabels}
              ctx={ctx}
              perspectiveLabel={perspectiveLabel}
              variantLabel={labels.original}
            />
            {alternative ? (
              <TurnInspector
                turn={alternative}
                labels={inspectorLabels}
                ctx={ctx}
                perspectiveLabel={perspectiveLabel}
                variantLabel={labels.alternative}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
