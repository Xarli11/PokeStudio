import Link from 'next/link';

import { formatMessage, type Locale } from '@pokestudio/i18n';

/**
 * Build → Damage Lab import outcome (Fase M3.2) — every state the
 * `?team=&member=` query params can resolve to. `'none'` (no import
 * params at all) renders nothing; the other three all stay discreet
 * (task §17: "No giant success alert. No green celebration banner.").
 */
export type DamageLabImportStatus =
  | { kind: 'none' }
  | {
      kind: 'imported';
      teamId: string;
      teamName: string;
      /** `null` only in the rare case the imported form isn't in the already-loaded search index (task §18: never a raw slug fallback). */
      memberDisplayName: string | null;
      /** The team's own game isn't one Damage Lab recognizes — game import was skipped, not guessed (task §7). */
      gameUnavailable: boolean;
    }
  | { kind: 'team-not-found' }
  | { kind: 'member-not-found'; teamName: string };

export interface DamageLabImportBannerLabels {
  importedFromBuildLabel: string;
  importedMemberTeamTemplate: string;
  backToTeamLabel: string;
  teamNotFoundWarning: string;
  memberNotFoundWarning: string;
  gameNotAvailableWarning: string;
}

export function DamageLabImportBanner({
  locale,
  status,
  labels,
}: {
  locale: Locale;
  status: DamageLabImportStatus;
  labels: DamageLabImportBannerLabels;
}) {
  if (status.kind === 'none') return null;

  if (status.kind === 'team-not-found') {
    return (
      <p role="note" className="m-0 text-sm text-muted">
        {labels.teamNotFoundWarning}
      </p>
    );
  }

  if (status.kind === 'member-not-found') {
    return (
      <p role="note" className="m-0 text-sm text-muted">
        {labels.memberNotFoundWarning}
      </p>
    );
  }

  const detail = status.memberDisplayName
    ? formatMessage(labels.importedMemberTeamTemplate, {
        member: status.memberDisplayName,
        team: status.teamName,
      })
    : status.teamName;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-xs">
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-foreground">{labels.importedFromBuildLabel}</span>
        <span className="text-muted">{detail}</span>
        {status.gameUnavailable ? (
          <span role="note" className="text-muted">
            {labels.gameNotAvailableWarning}
          </span>
        ) : null}
      </div>
      <Link
        href={`/${locale}/build/${status.teamId}`}
        className="shrink-0 font-semibold text-brand no-underline hover:underline"
      >
        {labels.backToTeamLabel}
      </Link>
    </div>
  );
}
