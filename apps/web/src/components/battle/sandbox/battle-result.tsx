'use client';

import { formatMessage } from '@pokestudio/i18n';
import type { BattleResult } from '@pokestudio/battle-engine/types';

import { buttonClass } from '@/lib/ui-classes';

import { panelClass } from './styles';

export interface ResultLabels {
  heading: string;
  winnerTemplate: string;
  tie: string;
  turnsTemplate: string;
  downloadReplay: string;
  newBattle: string;
  replayNote: string;
  showTimeline: string;
  hideTimeline: string;
  inspectHint: string;
}

export function BattleResultPanel({
  result,
  turns,
  labels,
  playerLabel,
  replayBusy,
  timelineOpen,
  onToggleTimeline,
  onDownloadReplay,
  onNewBattle,
}: {
  result: BattleResult;
  turns: number;
  labels: ResultLabels;
  playerLabel: (side: 'p1' | 'p2') => string;
  replayBusy: boolean;
  timelineOpen: boolean;
  onToggleTimeline: () => void;
  onDownloadReplay: () => void;
  onNewBattle: () => void;
}) {
  return (
    <section
      aria-label={labels.heading}
      data-testid="battle-result"
      className={panelClass('flex min-w-0 flex-col gap-3 p-4 sm:p-5')}
    >
      <h3 className="m-0 text-sm font-semibold text-muted">{labels.heading}</h3>
      <p className="m-0 text-2xl font-bold leading-tight" data-testid="result-headline">
        {result.kind === 'win'
          ? formatMessage(labels.winnerTemplate, { player: playerLabel(result.winner) })
          : labels.tie}
      </p>
      <p className="m-0 text-sm text-muted">{formatMessage(labels.turnsTemplate, { turns })}</p>
      <p className="m-0 text-sm text-muted">{labels.inspectHint}</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={buttonClass()}
          aria-expanded={timelineOpen}
          onClick={onToggleTimeline}
        >
          {timelineOpen ? labels.hideTimeline : labels.showTimeline}
        </button>
        <button
          type="button"
          className={buttonClass()}
          disabled={replayBusy}
          onClick={onDownloadReplay}
        >
          {labels.downloadReplay}
        </button>
        <button type="button" className={buttonClass('primary')} onClick={onNewBattle}>
          {labels.newBattle}
        </button>
      </div>
      <p className="m-0 border-t border-border-subtle pt-3 text-xs text-muted">
        {labels.replayNote}
      </p>
    </section>
  );
}
