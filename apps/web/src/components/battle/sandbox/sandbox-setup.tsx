'use client';

import { useEffect, useState } from 'react';

import { BATTLE_FORMATS, type BattleFormatId } from '@pokestudio/battle-engine/formats';
import { formatMessage } from '@pokestudio/i18n';

import { buttonClass } from '@/lib/ui-classes';

import {
  badgeClass,
  labelClass,
  panelClass,
  primaryActionClass,
  segmentButtonClass,
  segmentTrackClass,
} from './styles';
import { teamDraftToBattleTeam } from '@/lib/battle/team-from-build';
import type {
  ActionResult,
  BattleServerError,
  BattleTeamInput,
  CreatedBattle,
} from '@/lib/battle/types';
import { listTeamDrafts } from '@/lib/team-storage';
import type { TeamDraft } from '@/lib/team-draft';

export interface SetupLabels {
  heading: string;
  formatLabel: string;
  playerTemplate: string;
  fromBuild: string;
  fromPaste: string;
  chooseTeam: string;
  noBuildTeams: string;
  pasteLabel: string;
  pastePlaceholder: string;
  importButton: string;
  importing: string;
  memberCountTemplate: string;
  createButton: string;
  creating: string;
  buildMappingNote: string;
  purpose: string;
  purposeDetail: string;
  stepTemplate: string;
  stepFormat: string;
  statusEmpty: string;
  statusChecking: string;
  statusReady: string;
  statusInvalid: string;
  statusUnavailable: string;
  invalidHeadingTemplate: string;
  detailLabel: string;
  startReady: string;
  startCheckingHelp: string;
  startInvalidTemplate: string;
  startMissingTemplate: string;
  startUnavailable: string;
}

export interface SetupFormatLabels {
  formats: Record<string, string>;
  singles: string;
  doubles: string;
  singlesSummary: string;
  doublesSummary: string;
  openTeamSheets: string;
}

export interface SetupActions {
  importTeam(
    text: string,
  ): Promise<{ ok: true; team: BattleTeamInput } | { ok: false; error: BattleServerError }>;
  validateTeam(
    formatId: BattleFormatId,
    team: BattleTeamInput,
  ): Promise<ActionResult<{ valid: true }>>;
  create(input: {
    formatId: BattleFormatId;
    p1Team: BattleTeamInput;
    p2Team: BattleTeamInput;
  }): Promise<ActionResult<CreatedBattle>>;
}

type Source = 'build' | 'paste';

/** What is known about one player's team: nothing, being checked, legal, illegal or unverifiable. */
type TeamStatus =
  | { kind: 'empty' }
  | { kind: 'checking' }
  | { kind: 'ready' }
  | { kind: 'invalid'; problems: readonly string[] }
  | { kind: 'unavailable'; code: string };

/**
 * Asks the engine (through the battle server) whether a team is legal in the chosen format as soon
 * as both are known, so the player learns it before starting. Legality is never decided here.
 */
function useTeamStatus(
  formatId: BattleFormatId,
  team: BattleTeamInput | null,
  validate: SetupActions['validateTeam'],
): TeamStatus {
  const [status, setStatus] = useState<TeamStatus>({ kind: 'empty' });
  useEffect(() => {
    if (!team) {
      setStatus({ kind: 'empty' });
      return;
    }
    let alive = true;
    setStatus({ kind: 'checking' });
    void validate(formatId, team).then((result) => {
      if (!alive) return;
      if (result.ok) setStatus({ kind: 'ready' });
      else if (result.error.code === 'INVALID_TEAM') {
        const details = result.error.details as { problems?: string[] } | undefined;
        setStatus({ kind: 'invalid', problems: details?.problems ?? [] });
      } else setStatus({ kind: 'unavailable', code: result.error.code });
    });
    return () => {
      alive = false;
    };
  }, [formatId, team, validate]);
  return status;
}

const STATUS_MARK: Record<TeamStatus['kind'], string> = {
  empty: '○',
  checking: '…',
  ready: '✓',
  invalid: '⚠',
  unavailable: '⚠',
};

function TeamPicker({
  n,
  step,
  labels,
  drafts,
  team,
  status,
  formatName,
  errorText,
  onTeam,
  importTeam,
}: {
  n: 1 | 2;
  step: number;
  labels: SetupLabels;
  drafts: TeamDraft[];
  team: BattleTeamInput | null;
  status: TeamStatus;
  formatName: string;
  errorText: (code: string) => string;
  onTeam: (team: BattleTeamInput | null) => void;
  importTeam: SetupActions['importTeam'];
}) {
  const [source, setSource] = useState<Source>('build');
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  const read = async () => {
    setReading(true);
    setReadError(null);
    const result = await importTeam(text);
    setReading(false);
    if (result.ok) onTeam(result.team);
    else {
      onTeam(null);
      setReadError(result.error.code);
    }
  };

  const tone =
    status.kind === 'ready'
      ? 'ready'
      : status.kind === 'invalid' || status.kind === 'unavailable'
        ? 'warning'
        : 'neutral';
  return (
    <section
      aria-labelledby={`team-title-${n}`}
      className={panelClass('flex flex-col gap-4 p-4 sm:p-5')}
      data-testid={`team-picker-${n}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`team-title-${n}`} className="m-0 text-base font-bold">
          {formatMessage(labels.stepTemplate, {
            step,
            title: formatMessage(labels.playerTemplate, { n }),
          })}
        </h3>
        <span
          role="status"
          data-testid={`team-status-${n}`}
          data-status={status.kind}
          className={badgeClass(tone)}
        >
          <span aria-hidden="true">{STATUS_MARK[status.kind]}</span>
          {status.kind === 'empty'
            ? labels.statusEmpty
            : status.kind === 'checking'
              ? labels.statusChecking
              : status.kind === 'ready'
                ? labels.statusReady
                : status.kind === 'invalid'
                  ? labels.statusInvalid
                  : labels.statusUnavailable}
        </span>
      </div>
      <div role="group" className={segmentTrackClass + ' self-start'}>
        {(['build', 'paste'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={source === value}
            onClick={() => {
              setSource(value);
              onTeam(null);
            }}
            className={segmentButtonClass(source === value)}
          >
            {value === 'build' ? labels.fromBuild : labels.fromPaste}
          </button>
        ))}
      </div>
      {source === 'build' ? (
        drafts.length === 0 ? (
          <p className="m-0 text-sm text-muted">{labels.noBuildTeams}</p>
        ) : (
          <select
            aria-label={labels.chooseTeam}
            defaultValue=""
            onChange={(event) => {
              const draft = drafts.find((d) => d.id === event.target.value);
              onTeam(draft ? teamDraftToBattleTeam(draft) : null);
            }}
            className="min-h-11 w-full rounded-md border border-border-subtle bg-surface px-3 text-sm font-semibold text-foreground focus:border-brand focus:outline-none"
          >
            <option value="">{labels.chooseTeam}</option>
            {drafts.map((draft) => (
              <option key={draft.id} value={draft.id}>
                {draft.name} (
                {formatMessage(labels.memberCountTemplate, { count: draft.members.length })})
              </option>
            ))}
          </select>
        )
      ) : (
        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor={`paste-${n}`}>
            {labels.pasteLabel}
          </label>
          <textarea
            id={`paste-${n}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={labels.pastePlaceholder}
            rows={6}
            className="w-full rounded-md border border-border-subtle bg-surface p-3 font-mono text-xs text-foreground focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            className={buttonClass('default', 'self-start')}
            disabled={reading || text.trim() === ''}
            onClick={read}
          >
            {reading ? labels.importing : labels.importButton}
          </button>
          {readError ? (
            <p role="alert" className="m-0 text-xs text-danger" data-testid={`read-error-${n}`}>
              {errorText(readError)}
            </p>
          ) : null}
        </div>
      )}
      {team ? (
        <p className="m-0 text-xs text-muted" data-testid={`team-ready-${n}`}>
          <span className="font-semibold text-foreground">
            {formatMessage(labels.memberCountTemplate, { count: team.members.length })}
          </span>
          {': '}
          {team.members.map((m) => m.nickname ?? m.species).join(', ')}
        </p>
      ) : null}
      {status.kind === 'invalid' ? (
        <div
          data-testid={`team-invalid-${n}`}
          className="flex flex-col gap-1.5 rounded-md bg-warning/10 p-3 text-sm"
        >
          <span className="font-semibold">
            {formatMessage(labels.invalidHeadingTemplate, { format: formatName })}
          </span>
          {status.problems.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-muted">
              {status.problems.map((problem) => (
                <li key={problem}>
                  <span className="font-semibold">{labels.detailLabel}:</span> {problem}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {status.kind === 'unavailable' ? (
        <p className="m-0 text-xs text-muted" data-testid={`team-status-detail-${n}`}>
          {errorText(status.code)}
        </p>
      ) : null}
    </section>
  );
}

/** Battle setup: a format, and a team for each player from Build or pasted text. */
export function SandboxSetup({
  labels,
  formatLabels,
  actions,
  problems,
  errorText,
  onCreated,
}: {
  labels: SetupLabels;
  formatLabels: SetupFormatLabels;
  actions: SetupActions;
  /** Team problems from a rejected creation, by player number. */
  problems: { side: 'p1' | 'p2'; problems: readonly string[] } | null;
  errorText: (code: string) => string;
  onCreated: (result: ActionResult<CreatedBattle>) => void;
}) {
  const available = BATTLE_FORMATS.filter((f) => f.availability.level === 'available');
  const [formatId, setFormatId] = useState<BattleFormatId>(available[0]!.id);
  const [drafts, setDrafts] = useState<TeamDraft[]>([]);
  const [p1, setP1] = useState<BattleTeamInput | null>(null);
  const [p2, setP2] = useState<BattleTeamInput | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setDrafts(listTeamDrafts());
  }, []);

  const descriptor = available.find((f) => f.id === formatId)!;
  // Only what the catalog itself records: game type (and so active Pokémon) and Open Team Sheets.
  // Pick size and level adjustment belong to the simulator's rules and show up at team preview.
  const meta =
    descriptor.gameType === 'doubles' ? formatLabels.doublesSummary : formatLabels.singlesSummary;
  const formatName = formatLabels.formats[formatId] ?? formatId;
  const status1 = useTeamStatus(formatId, p1, actions.validateTeam);
  const status2 = useTeamStatus(formatId, p2, actions.validateTeam);
  const statuses = [status1, status2] as const;
  const blocker = statuses
    .map((status, index) => ({ status, n: index + 1 }))
    .find(({ status }) => status.kind !== 'ready');
  const help = !blocker
    ? labels.startReady
    : blocker.status.kind === 'empty'
      ? formatMessage(labels.startMissingTemplate, { n: blocker.n })
      : blocker.status.kind === 'checking'
        ? labels.startCheckingHelp
        : blocker.status.kind === 'invalid'
          ? formatMessage(labels.startInvalidTemplate, { n: blocker.n })
          : labels.startUnavailable;

  const create = async () => {
    if (!p1 || !p2 || blocker) return;
    setCreating(true);
    const result = await actions.create({ formatId, p1Team: p1, p2Team: p2 });
    setCreating(false);
    onCreated(result);
  };

  return (
    <section aria-label={labels.heading} className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="m-0 text-xl font-bold">{labels.heading}</h2>
        <p className="m-0 max-w-2xl text-base text-foreground" data-testid="sandbox-purpose">
          {labels.purpose}
        </p>
        <p className="m-0 text-sm text-muted">{labels.purposeDetail}</p>
      </div>

      <div className={panelClass('flex flex-col gap-3 p-4 sm:p-5')}>
        <label htmlFor="sandbox-format" className="text-base font-bold">
          {formatMessage(labels.stepTemplate, { step: 1, title: labels.stepFormat })}
        </label>
        <select
          id="sandbox-format"
          aria-label={labels.formatLabel}
          value={formatId}
          onChange={(event) => setFormatId(event.target.value as BattleFormatId)}
          className="min-h-11 w-full rounded-md border border-border-subtle bg-surface px-3 text-sm font-semibold text-foreground focus:border-brand focus:outline-none sm:max-w-md"
        >
          {available.map((format) => (
            <option key={format.id} value={format.id}>
              {formatLabels.formats[format.id] ?? format.id}
            </option>
          ))}
        </select>
        <p className="m-0 text-xs text-muted" data-testid="format-meta">
          {meta}
          {descriptor.category === 'vgc' ? ` · ${formatLabels.openTeamSheets}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TeamPicker
          n={1}
          step={2}
          labels={labels}
          drafts={drafts}
          team={p1}
          status={status1}
          formatName={formatName}
          errorText={errorText}
          onTeam={setP1}
          importTeam={actions.importTeam}
        />
        <TeamPicker
          n={2}
          step={3}
          labels={labels}
          drafts={drafts}
          team={p2}
          status={status2}
          formatName={formatName}
          errorText={errorText}
          onTeam={setP2}
          importTeam={actions.importTeam}
        />
      </div>

      {problems ? (
        <div
          role="alert"
          className="flex flex-col gap-1.5 rounded-lg bg-danger/10 p-4 text-sm"
          data-testid="team-problems"
        >
          <strong>{formatMessage(labels.invalidHeadingTemplate, { format: formatName })}</strong>
          <span>
            {formatMessage(labels.startInvalidTemplate, { n: problems.side === 'p1' ? 1 : 2 })}
          </span>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-muted">
            {problems.problems.map((problem) => (
              <li key={problem}>
                <span className="font-semibold">{labels.detailLabel}:</span> {problem}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        className={panelClass(
          'flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5',
        )}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden="true" className={blocker ? 'text-muted' : 'text-brand'}>
              {blocker ? '○' : '✓'}
            </span>
            <span
              role="status"
              data-testid="start-help"
              data-ready={blocker ? 'false' : 'true'}
              className={blocker ? 'text-muted' : 'text-foreground'}
            >
              {help}
            </span>
          </span>
          <span className="text-xs text-muted">{labels.buildMappingNote}</span>
        </div>
        <button
          type="button"
          className={primaryActionClass('shrink-0 sm:min-w-44')}
          disabled={!!blocker || creating}
          onClick={create}
        >
          {creating ? labels.creating : labels.createButton}
        </button>
      </div>
    </section>
  );
}
