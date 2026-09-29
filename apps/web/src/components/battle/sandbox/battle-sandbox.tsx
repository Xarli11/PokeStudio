'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatMessage } from '@pokestudio/i18n';
import type { Dictionary } from '@pokestudio/i18n';

import { makeCopyContext } from '@/lib/battle/copy-context';
import { buildTurns } from '@/lib/battle/timeline';
import type {
  ActionResult,
  BattleCommand,
  BattleDisplayNames,
  BattleEvent,
  BattleReplay,
  BattleSideId,
  BattleState,
  BattleSubmitResult,
  BattleTeamInput,
  CreatedBattle,
  ReadablePerspective,
  SideView,
} from '@/lib/battle/types';
import { buttonClass, cardClass } from '@/lib/ui-classes';

import { ActionPanel, TeamPreviewPanel } from './action-panel';
import { Battlefield } from './battlefield';
import { BattleResultPanel } from './battle-result';
import { SandboxSetup } from './sandbox-setup';
import { TimelinePanel, TurnInspector } from './timeline-panel';

export type SandboxLabels = Dictionary['battle']['sandbox'];

/** The server actions the sandbox calls. Injected so the UI is testable without a battle server. */
export interface SandboxServerActions {
  createSandboxBattle(input: {
    formatId: string;
    p1Team: BattleTeamInput;
    p2Team: BattleTeamInput;
  }): Promise<ActionResult<CreatedBattle>>;
  importTeamText(text: string): Promise<ActionResult<{ team: BattleTeamInput }>>;
  loadSideView(battleId: string, side: BattleSideId): Promise<ActionResult<SideView>>;
  loadPerspectiveState(
    battleId: string,
    perspective: ReadablePerspective,
  ): Promise<ActionResult<BattleState>>;
  loadEvents(
    battleId: string,
    perspective: ReadablePerspective,
    afterSeq?: number,
  ): Promise<ActionResult<{ events: BattleEvent[] }>>;
  submitSandboxCommand(
    battleId: string,
    side: BattleSideId,
    command: BattleCommand,
  ): Promise<ActionResult<BattleSubmitResult>>;
  loadDisplayNames(): Promise<ActionResult<BattleDisplayNames>>;
  loadReplay(battleId: string): Promise<ActionResult<BattleReplay>>;
}

type Views = { p1: SideView | null; p2: SideView | null };

const PERSPECTIVES: ReadablePerspective[] = ['p1', 'p2', 'spectator'];

/**
 * Battle Sandbox: one person plays both sides of an authoritative battle. Every panel reads the
 * state of one explicit perspective (a player's or the spectator's) from the battle server; the
 * browser never receives an omniscient view and cannot ask for one.
 */
export function BattleSandbox({
  labels,
  typeNames,
  actions,
}: {
  labels: SandboxLabels;
  typeNames: Record<string, string>;
  actions: SandboxServerActions;
}) {
  const [battle, setBattle] = useState<CreatedBattle | null>(null);
  const [views, setViews] = useState<Views>({ p1: null, p2: null });
  const [spectator, setSpectator] = useState<BattleState | null>(null);
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [viewAs, setViewAs] = useState<ReadablePerspective>('p1');
  const [names, setNames] = useState<BattleDisplayNames | null>(null);
  const [selectedTurn, setSelectedTurn] = useState<number | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [problems, setProblems] = useState<{
    side: 'p1' | 'p2';
    problems: readonly string[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [replayBusy, setReplayBusy] = useState(false);

  const errorText = (code: string) =>
    (labels.errors as Record<string, string>)[code] ?? labels.errors.generic;

  useEffect(() => {
    let alive = true;
    void actions.loadDisplayNames().then((result) => {
      if (alive && result.ok) setNames(result.data);
    });
    return () => {
      alive = false;
    };
  }, [actions]);

  const refresh = useCallback(
    async (battleId: string, perspective: ReadablePerspective) => {
      const [p1, p2, spec, ev] = await Promise.all([
        actions.loadSideView(battleId, 'p1'),
        actions.loadSideView(battleId, 'p2'),
        perspective === 'spectator'
          ? actions.loadPerspectiveState(battleId, 'spectator')
          : Promise.resolve(null),
        actions.loadEvents(battleId, perspective, 0),
      ]);
      const failure = [p1, p2, spec, ev].find((r) => r !== null && !r.ok);
      if (failure && !failure.ok) {
        setErrorCode(failure.error.code);
        return;
      }
      setViews({ p1: p1.ok ? p1.data : null, p2: p2.ok ? p2.data : null });
      setSpectator(spec && spec.ok ? spec.data : null);
      setEvents(ev && ev.ok ? ev.data.events : []);
      setErrorCode(null);
    },
    [actions],
  );

  const pendingSide: BattleSideId | null =
    (['p1', 'p2'] as const).find((side) => {
      const view = views[side];
      return !!view && view.choices.kind !== 'wait' && !view.state.requests[side]?.submitted;
    }) ?? null;

  const board: BattleState | null =
    viewAs === 'spectator' ? spectator : (views[viewAs]?.state ?? null);
  const status = views.p1?.state.status;

  const perspectiveLabel = (perspective: ReadablePerspective) =>
    perspective === 'p1'
      ? labels.battle.player1
      : perspective === 'p2'
        ? labels.battle.player2
        : labels.battle.spectator;
  const sideLabel = (side: BattleSideId) =>
    side === 'p1' ? labels.battle.player1 : labels.battle.player2;

  const ctx = useMemo(
    () =>
      makeCopyContext({
        templates: labels.events,
        names,
        state: board,
        sideLabel,
        unknownLabel: labels.battle.unknownPokemon,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [labels, names, board],
  );
  const turns = useMemo(() => buildTurns(events), [events]);
  const inspected =
    selectedTurn === null ? null : (turns.find((t) => t.turn === selectedTurn) ?? null);

  const startBattle = async (input: {
    formatId: string;
    p1Team: BattleTeamInput;
    p2Team: BattleTeamInput;
  }) => actions.createSandboxBattle(input);

  const onCreated = async (result: ActionResult<CreatedBattle>) => {
    if (!result.ok) {
      const details = result.error.details as
        { side?: 'p1' | 'p2'; problems?: string[] } | undefined;
      setProblems(
        result.error.code === 'INVALID_TEAM' && details?.side && details.problems
          ? { side: details.side, problems: details.problems }
          : null,
      );
      setErrorCode(result.error.code);
      return;
    }
    setProblems(null);
    setErrorCode(null);
    setBattle(result.data);
    setViewAs('p1');
    setSelectedTurn(null);
    await refresh(result.data.battleId, 'p1');
  };

  const submit = async (side: BattleSideId, command: BattleCommand) => {
    if (!battle) return;
    setBusy(true);
    const result = await actions.submitSandboxCommand(battle.battleId, side, command);
    if (!result.ok) {
      setErrorCode(result.error.code);
      setBusy(false);
      return;
    }
    await refresh(battle.battleId, viewAs);
    setBusy(false);
  };

  const changeView = async (perspective: ReadablePerspective) => {
    setViewAs(perspective);
    if (battle) await refresh(battle.battleId, perspective);
  };

  const downloadReplay = async () => {
    if (!battle) return;
    setReplayBusy(true);
    const result = await actions.loadReplay(battle.battleId);
    setReplayBusy(false);
    if (!result.ok) {
      setErrorCode(result.error.code);
      return;
    }
    if (typeof URL.createObjectURL === 'function') {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `pokestudio-replay-${battle.battleId.slice(0, 8)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const reset = () => {
    setBattle(null);
    setViews({ p1: null, p2: null });
    setSpectator(null);
    setEvents([]);
    setSelectedTurn(null);
    setErrorCode(null);
    setProblems(null);
  };

  const formatLabels = {
    formats: labels.formats as Record<string, string>,
    singles: labels.formatMeta.singles,
    doubles: labels.formatMeta.doubles,
    openTeamSheets: labels.formatMeta.openTeamSheets,
  };

  const errorBanner = errorCode ? (
    <p
      role="alert"
      className={cardClass('m-0 border-danger p-3 text-sm')}
      data-testid="sandbox-error"
    >
      {errorText(errorCode)}
    </p>
  ) : null;

  if (!battle) {
    return (
      <div className="flex flex-col gap-4">
        {errorBanner && !problems ? errorBanner : null}
        <SandboxSetup
          labels={labels.setup}
          formatLabels={formatLabels}
          problems={problems}
          onCreated={(result) => void onCreated(result)}
          actions={{
            importTeam: async (text) => {
              const result = await actions.importTeamText(text);
              return result.ok ? { ok: true, team: result.data.team } : result;
            },
            create: (input) => startBattle(input),
          }}
        />
      </div>
    );
  }

  const acting = pendingSide ? views[pendingSide] : null;
  const finishedResult = views.p1?.state.result ?? null;

  return (
    <div className="flex flex-col gap-4" data-testid="sandbox-battle">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="m-0 text-xl font-bold">
            {labels.formats[battle.format.id as keyof typeof labels.formats] ?? battle.format.name}
          </h2>
          <span className="text-xs text-muted" data-testid="turn-indicator">
            {board && board.turn === 0
              ? labels.battle.preview
              : formatMessage(labels.battle.turnTemplate, { turn: board?.turn ?? 0 })}
          </span>
        </div>
        <div role="tablist" aria-label={labels.battle.viewAs} className="flex gap-1">
          {PERSPECTIVES.map((perspective) => (
            <button
              key={perspective}
              role="tab"
              type="button"
              aria-selected={viewAs === perspective}
              onClick={() => void changeView(perspective)}
              className={`${buttonClass('default')} ${viewAs === perspective ? 'border-brand bg-brand-muted' : ''}`}
            >
              {perspectiveLabel(perspective)}
            </button>
          ))}
        </div>
      </header>

      {errorBanner}

      {board ? (
        <Battlefield
          state={board}
          labels={{
            ...labels.battle,
            hpLabel: labels.battle.hpLabel,
            levelTemplate: labels.battle.levelTemplate,
            fainted: labels.battle.fainted,
            teraTemplate: labels.battle.tera,
          }}
          typeNames={typeNames}
          names={names}
        />
      ) : null}

      {status === 'finished' && finishedResult && views.p1 ? (
        <BattleResultPanel
          result={finishedResult}
          turns={views.p1.state.turn}
          labels={labels.result}
          playerLabel={sideLabel}
          replayBusy={replayBusy}
          onDownloadReplay={() => void downloadReplay()}
          onNewBattle={reset}
        />
      ) : pendingSide && acting ? (
        <div className="flex flex-col gap-2" data-testid="acting-panel">
          <p className="m-0 text-sm font-semibold">
            {formatMessage(labels.battle.yourActionTemplate, { player: sideLabel(pendingSide) })}
          </p>
          {acting.choices.kind === 'team-preview' ? (
            <TeamPreviewPanel
              key={`preview-${pendingSide}`}
              side={pendingSide}
              state={acting.state}
              pick={acting.choices.pick}
              labels={labels.preview}
              openTeamSheets={battle.format.openTeamSheets}
              busy={busy}
              onSubmit={(command) => void submit(pendingSide, command)}
            />
          ) : acting.choices.kind === 'wait' ? null : (
            <ActionPanel
              key={`${pendingSide}-${acting.state.turn}-${acting.choices.kind}-${acting.state.eventCursor}`}
              choices={acting.choices}
              state={acting.state}
              labels={labels.action}
              names={names}
              busy={busy}
              onSubmit={(command) => void submit(pendingSide, command)}
            />
          )}
          <p className="m-0 text-xs text-muted">{labels.battle.endTurnHint}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TimelinePanel
          turns={turns}
          labels={labels.timeline}
          ctx={ctx}
          selectedTurn={selectedTurn}
          onSelect={setSelectedTurn}
        />
        {inspected ? (
          <TurnInspector
            turn={inspected}
            labels={labels.inspector}
            ctx={ctx}
            perspectiveLabel={perspectiveLabel(viewAs)}
            onClose={() => setSelectedTurn(null)}
          />
        ) : null}
      </div>
    </div>
  );
}
