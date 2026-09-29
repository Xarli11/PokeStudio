'use client';

import { useEffect, useState } from 'react';

import { BATTLE_FORMATS, type BattleFormatId } from '@pokestudio/battle-engine/formats';
import { formatMessage } from '@pokestudio/i18n';

import { buttonClass, cardClass } from '@/lib/ui-classes';
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
  teamMissing: string;
  createButton: string;
  creating: string;
  problemsHeading: string;
  problemsTeamTemplate: string;
  buildMappingNote: string;
}

export interface SetupFormatLabels {
  formats: Record<string, string>;
  singles: string;
  doubles: string;
  openTeamSheets: string;
}

export interface SetupActions {
  importTeam(
    text: string,
  ): Promise<{ ok: true; team: BattleTeamInput } | { ok: false; error: BattleServerError }>;
  create(input: {
    formatId: BattleFormatId;
    p1Team: BattleTeamInput;
    p2Team: BattleTeamInput;
  }): Promise<ActionResult<CreatedBattle>>;
}

type Source = 'build' | 'paste';

function TeamPicker({
  n,
  labels,
  drafts,
  team,
  onTeam,
  importTeam,
}: {
  n: 1 | 2;
  labels: SetupLabels;
  drafts: TeamDraft[];
  team: BattleTeamInput | null;
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

  return (
    <fieldset className={cardClass('m-0 flex flex-col gap-3 p-4')} data-testid={`team-picker-${n}`}>
      <legend className="px-1 text-sm font-bold">
        {formatMessage(labels.playerTemplate, { n })}
      </legend>
      <div role="group" className="flex gap-2">
        {(['build', 'paste'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={source === value}
            onClick={() => {
              setSource(value);
              onTeam(null);
            }}
            className={`${buttonClass('default')} ${source === value ? 'border-brand bg-brand-muted' : ''}`}
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
            className="rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm"
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
          <label className="text-xs font-semibold text-muted" htmlFor={`paste-${n}`}>
            {labels.pasteLabel}
          </label>
          <textarea
            id={`paste-${n}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={labels.pastePlaceholder}
            rows={6}
            className="rounded-md border border-border-subtle bg-surface p-2 font-mono text-xs"
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
              {readError}
            </p>
          ) : null}
        </div>
      )}
      {team ? (
        <p className="m-0 text-xs text-muted" data-testid={`team-ready-${n}`}>
          {formatMessage(labels.memberCountTemplate, { count: team.members.length })}:{' '}
          {team.members.map((m) => m.nickname ?? m.species).join(', ')}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Battle setup: a format, and a team for each player from Build or pasted text. */
export function SandboxSetup({
  labels,
  formatLabels,
  actions,
  problems,
  onCreated,
}: {
  labels: SetupLabels;
  formatLabels: SetupFormatLabels;
  actions: SetupActions;
  /** Team problems from a rejected creation, by player number. */
  problems: { side: 'p1' | 'p2'; problems: readonly string[] } | null;
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
  const meta = [
    descriptor.gameType === 'doubles' ? formatLabels.doubles : formatLabels.singles,
  ].join(' · ');

  const create = async () => {
    if (!p1 || !p2) return;
    setCreating(true);
    const result = await actions.create({ formatId, p1Team: p1, p2Team: p2 });
    setCreating(false);
    onCreated(result);
  };

  return (
    <section aria-label={labels.heading} className="flex flex-col gap-4">
      <h2 className="m-0 text-xl font-bold">{labels.heading}</h2>
      <div className={cardClass('flex flex-col gap-2 p-4')}>
        <label htmlFor="sandbox-format" className="text-sm font-bold">
          {labels.formatLabel}
        </label>
        <select
          id="sandbox-format"
          value={formatId}
          onChange={(event) => setFormatId(event.target.value as BattleFormatId)}
          className="rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm"
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
          labels={labels}
          drafts={drafts}
          team={p1}
          onTeam={setP1}
          importTeam={actions.importTeam}
        />
        <TeamPicker
          n={2}
          labels={labels}
          drafts={drafts}
          team={p2}
          onTeam={setP2}
          importTeam={actions.importTeam}
        />
      </div>
      <p className="m-0 text-xs text-muted">{labels.buildMappingNote}</p>
      {problems ? (
        <div
          role="alert"
          className={cardClass('flex flex-col gap-1 border-danger p-3 text-sm')}
          data-testid="team-problems"
        >
          <strong>{labels.problemsHeading}</strong>
          <span className="font-semibold">
            {formatMessage(labels.problemsTeamTemplate, { n: problems.side === 'p1' ? 1 : 2 })}
          </span>
          <ul className="m-0 pl-5">
            {problems.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {!p1 || !p2 ? <span className="text-xs text-muted">{labels.teamMissing}</span> : null}
        <button
          type="button"
          className={buttonClass('primary', 'ml-auto')}
          disabled={!p1 || !p2 || creating}
          onClick={create}
        >
          {creating ? labels.creating : labels.createButton}
        </button>
      </div>
    </section>
  );
}
