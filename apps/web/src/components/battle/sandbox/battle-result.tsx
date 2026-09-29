'use client';

import { formatMessage } from '@pokestudio/i18n';
import type { BattleResult } from '@pokestudio/battle-engine/types';

import { buttonClass, cardClass } from '@/lib/ui-classes';

export interface ResultLabels {
  heading: string;
  winnerTemplate: string;
  tie: string;
  turnsTemplate: string;
  downloadReplay: string;
  newBattle: string;
  replayNote: string;
}

export function BattleResultPanel({
  result,
  turns,
  labels,
  playerLabel,
  replayBusy,
  onDownloadReplay,
  onNewBattle,
}: {
  result: BattleResult;
  turns: number;
  labels: ResultLabels;
  playerLabel: (side: 'p1' | 'p2') => string;
  replayBusy: boolean;
  onDownloadReplay: () => void;
  onNewBattle: () => void;
}) {
  return (
    <section
      aria-label={labels.heading}
      data-testid="battle-result"
      className={cardClass('flex flex-col gap-3 p-4')}
    >
      <h3 className="m-0 text-lg font-bold">{labels.heading}</h3>
      <p className="m-0 text-base">
        {result.kind === 'win'
          ? formatMessage(labels.winnerTemplate, { player: playerLabel(result.winner) })
          : labels.tie}
      </p>
      <p className="m-0 text-sm text-muted">{formatMessage(labels.turnsTemplate, { turns })}</p>
      <p className="m-0 text-xs text-muted">{labels.replayNote}</p>
      <div className="flex flex-wrap gap-3">
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
    </section>
  );
}
