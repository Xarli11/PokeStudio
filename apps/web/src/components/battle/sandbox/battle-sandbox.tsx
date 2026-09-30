'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  CreatedFork,
  ReadablePerspective,
  SideView,
} from '@/lib/battle/types';
import { badgeClass, segmentButtonClass, segmentTrackClass } from './styles';

import { ActionPanel, TeamPreviewPanel, type ActionFocus } from './action-panel';
import { Battlefield } from './battlefield';
import { BattleResultPanel } from './battle-result';
import { ForkPanel } from './fork-panel';
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
  validateSandboxTeam(
    formatId: string,
    team: BattleTeamInput,
  ): Promise<ActionResult<{ valid: true }>>;
  loadDecisionView(
    battleId: string,
    atDecision: number,
    side: BattleSideId,
  ): Promise<ActionResult<SideView>>;
  createFork(
    battleId: string,
    input: { atDecision: number; side: BattleSideId; command: BattleCommand },
  ): Promise<ActionResult<CreatedFork>>;
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
  const [focus, setFocus] = useState<ActionFocus | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const sending = useRef(false);
  const [forking, setForking] = useState<{ turn: number; replay: BattleReplay } | null>(null);

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
    if (!battle || sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const result = await actions.submitSandboxCommand(battle.battleId, side, command);
      if (!result.ok) {
        setErrorCode(result.error.code);
        return;
      }
      await refresh(battle.battleId, viewAs);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const changeView = async (perspective: ReadablePerspective) => {
    setViewAs(perspective);
    if (battle) await refresh(battle.battleId, perspective);
  };

  const startFork = async (turn: number) => {
    if (!battle) return;
    const result = await actions.loadReplay(battle.battleId);
    if (!result.ok) {
      setErrorCode(result.error.code);
      return;
    }
    setErrorCode(null);
    setForking({ turn, replay: result.data });
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
    setForking(null);
    setTimelineOpen(false);
    setErrorCode(null);
    setProblems(null);
  };

  const formatLabels = {
    formats: labels.formats as Record<string, string>,
    singles: labels.formatMeta.singles,
    doubles: labels.formatMeta.doubles,
    singlesSummary: labels.formatMeta.singlesSummary,
    doublesSummary: labels.formatMeta.doublesSummary,
    openTeamSheets: labels.formatMeta.openTeamSheets,
  };

  const errorBanner = errorCode ? (
    <p
      role="alert"
      className="m-0 rounded-lg bg-danger/10 p-3 text-sm font-semibold text-foreground"
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
          errorText={errorText}
          onCreated={(result) => void onCreated(result)}
          actions={{
            importTeam: async (text) => {
              const result = await actions.importTeamText(text);
              return result.ok ? { ok: true, team: result.data.team } : result;
            },
            validateTeam: (formatId, team) => actions.validateSandboxTeam(formatId, team),
            create: (input) => startBattle(input),
          }}
        />
      </div>
    );
  }

  const acting = pendingSide ? views[pendingSide] : null;
  const sidesAsked = (['p1', 'p2'] as const).filter((side) => {
    const view = views[side];
    return !!view && view.choices.kind !== 'wait';
  });
  const finishedResult = views.p1?.state.result ?? null;

  return (
    <div className="flex flex-col gap-5" data-testid="sandbox-battle">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="m-0 text-sm font-semibold text-muted">
            {labels.formats[battle.format.id as keyof typeof labels.formats] ?? battle.format.name}
          </h2>
          <span className="text-xl font-bold leading-tight" data-testid="turn-indicator">
            {board && board.turn === 0
              ? labels.battle.preview
              : formatMessage(labels.battle.turnTemplate, { turn: board?.turn ?? 0 })}
          </span>
        </div>
        <div role="tablist" aria-label={labels.battle.viewAs} className={segmentTrackClass}>
          {PERSPECTIVES.map((perspective) => (
            <button
              key={perspective}
              role="tab"
              type="button"
              aria-selected={viewAs === perspective}
              onClick={() => void changeView(perspective)}
              className={segmentButtonClass(viewAs === perspective)}
            >
              {perspectiveLabel(perspective)}
            </button>
          ))}
        </div>
      </header>

      {errorBanner}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-start">
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
            focus={pendingSide ? focus : null}
            bottom={viewAs === 'p2' ? 'p2' : 'p1'}
          />
        ) : null}

        {status === 'finished' && finishedResult && views.p1 ? (
          <BattleResultPanel
            result={finishedResult}
            turns={views.p1.state.turn}
            labels={labels.result}
            playerLabel={sideLabel}
            replayBusy={replayBusy}
            timelineOpen={timelineOpen}
            onToggleTimeline={() => setTimelineOpen((open) => !open)}
            onDownloadReplay={() => void downloadReplay()}
            onNewBattle={reset}
          />
        ) : pendingSide && acting ? (
          <div
            data-testid="acting-panel"
            className="sticky bottom-0 z-20 -mx-4 flex w-auto min-w-0 max-h-[45dvh] flex-col gap-3 lg:gap-4 overflow-y-auto rounded-t-xl border-t border-border bg-surface-raised p-4 shadow-md sm:mx-0 lg:sticky lg:top-4 lg:bottom-auto lg:max-h-none lg:rounded-lg lg:border lg:border-border-subtle lg:p-5 lg:shadow-none"
          >
            <div className="flex flex-col gap-2">
              <ol
                className="m-0 flex list-none flex-wrap items-center gap-1 p-0 text-xs"
                data-testid="side-progress"
              >
                {sidesAsked.map((side) => {
                  const done = views[side]?.state.requests[side]?.submitted === true;
                  const now = side === pendingSide;
                  return (
                    <li
                      key={side}
                      data-state={done ? 'done' : now ? 'current' : 'pending'}
                      aria-current={now ? 'step' : undefined}
                      className={`${badgeClass(now ? 'ready' : 'neutral')} ${now ? '' : done ? 'text-foreground' : ''}`}
                    >
                      <span aria-hidden="true">{done ? '✓' : now ? '→' : '○'}</span>
                      {sideLabel(side)}
                      <span className="sr-only">
                        {' '}
                        (
                        {done
                          ? labels.action.progressDone
                          : now
                            ? labels.action.progressCurrent
                            : labels.action.progressPending}
                        )
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
            {busy ? (
              <p role="status" className="m-0 text-sm font-semibold" data-testid="resolving">
                {labels.battle.resolving}
              </p>
            ) : null}
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
                playerLabel={sideLabel(pendingSide)}
                onFocus={setFocus}
                onSubmit={(command) => void submit(pendingSide, command)}
              />
            )}
            <p className="m-0 text-xs text-muted">{labels.battle.endTurnHint}</p>
          </div>
        ) : null}
      </div>

      {status !== 'finished' && turns.length > 0 ? (
        <div className="flex items-center gap-3 border-t border-border-subtle pt-3">
          <button
            type="button"
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-foreground"
            aria-expanded={timelineOpen}
            onClick={() => setTimelineOpen((open) => !open)}
          >
            <span aria-hidden="true">{timelineOpen ? '▾' : '▸'}</span>
            {timelineOpen
              ? labels.timeline.hide
              : formatMessage(labels.timeline.showTemplate, { count: turns.length })}
          </button>
        </div>
      ) : null}

      {timelineOpen || inspected ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
          {timelineOpen ? (
            <TimelinePanel
              turns={turns}
              labels={labels.timeline}
              ctx={ctx}
              selectedTurn={selectedTurn}
              onSelect={setSelectedTurn}
            />
          ) : null}
          {inspected ? (
            <div className={timelineOpen ? '' : 'lg:col-span-2'}>
              <TurnInspector
                turn={inspected}
                labels={labels.inspector}
                ctx={ctx}
                perspectiveLabel={perspectiveLabel(viewAs)}
                onClose={() => {
                  setSelectedTurn(null);
                  setForking(null);
                }}
                {...(status === 'finished' && inspected.turn > 0
                  ? { onFork: () => void startFork(inspected.turn) }
                  : {})}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {battle && inspected && forking && forking.turn === inspected.turn ? (
        <ForkPanel
          key={`${battle.battleId}-${forking.turn}-${viewAs}`}
          battleId={battle.battleId}
          turn={forking.turn}
          replay={forking.replay}
          original={inspected}
          viewAs={viewAs}
          ctx={ctx}
          labels={labels.fork}
          inspectorLabels={labels.inspector}
          actionLabels={labels.action}
          names={names}
          sideLabel={sideLabel}
          perspectiveLabel={perspectiveLabel(viewAs)}
          errorText={errorText}
          actions={actions}
          onClose={() => setForking(null)}
        />
      ) : null}
    </div>
  );
}
