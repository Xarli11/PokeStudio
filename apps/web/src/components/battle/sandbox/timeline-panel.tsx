'use client';

import { formatMessage } from '@pokestudio/i18n';

import { describeEvent, type EventCopyContext } from '@/lib/battle/event-copy';
import { refKey, type HpChange, type TurnSummary } from '@/lib/battle/timeline';
import { buttonClass, cardClass } from '@/lib/ui-classes';

export interface TimelineLabels {
  heading: string;
  empty: string;
  turnTemplate: string;
  openInspector: string;
  startLabel: string;
}

export interface InspectorLabels {
  heading: string;
  close: string;
  actions: string;
  endOfTurn: string;
  hpChanges: string;
  hpArrowTemplate: string;
  noActions: string;
  perspectiveNote: string;
  tryDifferent: string;
}

const hpText = (hp: HpChange['before']) =>
  hp.kind === 'exact' ? `${hp.current}/${hp.max}` : `${hp.percent}%`;

/** The turn list. Selecting a turn opens the Turn Inspector for it. */
export function TimelinePanel({
  turns,
  labels,
  ctx,
  selectedTurn,
  onSelect,
}: {
  turns: TurnSummary[];
  labels: TimelineLabels;
  ctx: EventCopyContext;
  selectedTurn: number | null;
  onSelect: (turn: number) => void;
}) {
  return (
    <section aria-label={labels.heading} className={cardClass('flex flex-col gap-2 p-4')}>
      <h3 className="m-0 text-base font-bold">{labels.heading}</h3>
      {turns.length === 0 ? (
        <p className="m-0 text-sm text-muted">{labels.empty}</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-1 p-0">
          {turns.map((turn) => {
            const first = turn.actions[0]?.action;
            const summary = first ? describeEvent(first, ctx) : null;
            return (
              <li key={turn.turn}>
                <button
                  type="button"
                  aria-current={selectedTurn === turn.turn ? 'true' : undefined}
                  onClick={() => onSelect(turn.turn)}
                  data-testid={`turn-${turn.turn}`}
                  className={`${buttonClass('default', 'w-full justify-start text-left')} ${selectedTurn === turn.turn ? 'border-brand bg-brand-muted' : ''}`}
                >
                  <span className="shrink-0 font-bold">
                    {turn.turn === 0
                      ? labels.startLabel
                      : formatMessage(labels.turnTemplate, { turn: turn.turn })}
                  </span>
                  {summary ? (
                    <span className="truncate text-xs font-normal text-muted">{summary}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Explains one turn from the structured trace only: actions, their effects, end of turn, HP. */
export function TurnInspector({
  turn,
  labels,
  ctx,
  perspectiveLabel,
  variantLabel,
  onClose,
  onFork,
}: {
  turn: TurnSummary;
  labels: InspectorLabels;
  ctx: EventCopyContext;
  perspectiveLabel: string;
  /** Names this inspector when two are shown side by side (original / alternative). */
  variantLabel?: string;
  onClose?: () => void;
  /** Offered only when the turn can be forked (a finished battle). */
  onFork?: () => void;
}) {
  const line = (event: TurnSummary['residual'][number]) => describeEvent(event, ctx);
  return (
    <section
      aria-label={labels.heading}
      data-testid="turn-inspector"
      className={cardClass('flex flex-col gap-3 p-4')}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-base font-bold">
          {labels.heading} ·{' '}
          {formatMessage(ctx.templates['turnStarted'] ?? 'Turn {turn}', { turn: turn.turn })}
        </h3>
        {variantLabel ? (
          <span className="rounded-md bg-brand-muted px-2 py-0.5 text-xs font-semibold">
            {variantLabel}
          </span>
        ) : null}
        {onClose ? (
          <button type="button" className={buttonClass()} onClick={onClose}>
            {labels.close}
          </button>
        ) : null}
      </div>
      <p className="m-0 text-xs text-muted">
        {formatMessage(labels.perspectiveNote, { perspective: perspectiveLabel })}
      </p>

      <div className="flex flex-col gap-2">
        <h4 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted">
          {labels.actions}
        </h4>
        {turn.actions.length === 0 ? (
          <p className="m-0 text-sm text-muted">{labels.noActions}</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {turn.actions.map(({ action, children }) => (
              <li
                key={action.seq}
                className="flex flex-col gap-1 rounded-md border border-border-subtle p-2"
              >
                <span className="text-sm font-semibold">{line(action)}</span>
                {children.length > 0 ? (
                  <ul className="m-0 flex list-none flex-col gap-0.5 p-0 pl-3 text-sm text-muted">
                    {children.map((child) => (
                      <li key={child.seq}>{line(child)}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>

      {turn.residual.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h4 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted">
            {labels.endOfTurn}
          </h4>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-sm text-muted">
            {turn.residual.map((event) => (
              <li key={event.seq}>{line(event)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {turn.hp.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h4 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted">
            {labels.hpChanges}
          </h4>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-sm">
            {turn.hp.map((change) => (
              <li key={refKey(change.pokemon)} className="flex justify-between gap-2">
                <span className="truncate">{ctx.pokemonName(change.pokemon)}</span>
                <span className="shrink-0 text-muted">
                  {formatMessage(labels.hpArrowTemplate, {
                    before: hpText(change.before),
                    after: hpText(change.after),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {onFork ? (
        <button type="button" className={buttonClass('default')} onClick={onFork}>
          {labels.tryDifferent}
        </button>
      ) : null}
    </section>
  );
}
