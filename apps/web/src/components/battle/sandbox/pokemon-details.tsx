'use client';

import { useEffect, useRef } from 'react';

import type { BattleFormatFamily } from '@pokestudio/battle-engine/formats';
import type {
  BattleBoostId,
  BattlePokemonState,
  BattleStatTable,
} from '@pokestudio/battle-engine/types';
import type { Dictionary } from '@pokestudio/i18n';
import { formatMessage } from '@pokestudio/i18n';

import type { BattleDisplayNames } from '@/lib/battle/types';
import { buttonClass, tagClass } from '@/lib/ui-classes';

import { STATUS_LABEL } from './pokemon-card';

export type PokemonDetailsLabels = Dictionary['battle']['sandbox']['details'];

const STAT_ORDER = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const sectionHeading = 'm-0 text-xs font-semibold uppercase tracking-wide text-muted';
const sectionClass =
  'flex flex-col gap-3 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0';
const gridClass = 'm-0 grid grid-cols-2 gap-2 min-[400px]:grid-cols-3';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 min-w-0 text-right font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

/** A compact label/value grid (stats, EVs, IVs): small muted label above a dominant number. */
function StatGrid({
  table,
  labels,
  onlyNonZero = false,
  large = false,
  testId,
}: {
  table: BattleStatTable;
  labels: PokemonDetailsLabels;
  onlyNonZero?: boolean;
  large?: boolean;
  testId?: string;
}) {
  const entries = STAT_ORDER.filter((stat) => !onlyNonZero || table[stat] > 0);
  if (entries.length === 0) return <p className="m-0 text-sm font-semibold tabular-nums">0</p>;
  return (
    <dl className={gridClass} {...(testId ? { 'data-testid': testId } : {})}>
      {entries.map((stat) => (
        <div
          key={stat}
          className="flex min-w-0 flex-col gap-0.5 rounded-md border border-border-subtle bg-surface px-3 py-2"
        >
          <dt className="truncate text-xs text-muted">{labels.stat[stat]}</dt>
          <dd
            className={`m-0 font-bold leading-tight tabular-nums ${large ? 'text-xl' : 'text-base'}`}
          >
            {table[stat]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A labelled spread (EVs / Stat Points / IVs) inside SET. */
function Spread({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{title}</span>
      {children}
    </div>
  );
}

/**
 * On-demand Pokémon sheet. It renders only the `BattlePokemonState` it is given — a Pokémon of the
 * viewing perspective's own board — so a field the perspective may not know is simply absent and
 * never hidden. Informational only: no evaluation, no colouring of stats.
 */
export function PokemonDetailsPanel({
  pokemon,
  family,
  labels,
  levelTemplate,
  faintedLabel,
  names,
  typeNames,
  onClose,
}: {
  pokemon: BattlePokemonState;
  family: BattleFormatFamily;
  labels: PokemonDetailsLabels;
  levelTemplate: string;
  faintedLabel: string;
  names: BattleDisplayNames | null;
  typeNames: Record<string, string>;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus moves into the dialog and returns to whatever opened it. Escape closes; Tab stays inside.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (!panel.current.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const name = pokemon.nickname ?? pokemon.species;
  const details = pokemon.privateDetails;
  const boosts = Object.entries(pokemon.boosts) as [BattleBoostId, number][];
  const hp =
    pokemon.hp.kind === 'exact'
      ? `${pokemon.hp.current} / ${pokemon.hp.max}`
      : `${pokemon.hp.percent}%`;
  const percent = Math.max(
    0,
    Math.min(
      100,
      pokemon.hp.kind === 'exact'
        ? Math.round((pokemon.hp.current * 100) / Math.max(pokemon.hp.max, 1))
        : pokemon.hp.percent,
    ),
  );
  const barColor = percent > 50 ? 'bg-brand' : percent > 20 ? 'bg-warning' : 'bg-danger';
  const gender = pokemon.gender === 'M' ? '♂' : pokemon.gender === 'F' ? '♀' : null;
  const moves = pokemon.moves ?? [];
  const hasSet =
    pokemon.ability !== undefined ||
    (pokemon.item !== undefined && pokemon.item !== null) ||
    pokemon.teraType !== undefined ||
    details !== undefined;
  const label = (table: 'moves' | 'abilities' | 'items', id: string) => names?.[table][id] ?? id;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center sm:items-stretch sm:justify-end"
      data-testid="pokemon-details-overlay"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-background/60"
        onClick={onClose}
        data-testid="pokemon-details-backdrop"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pokemon-details-title"
        data-testid="pokemon-details"
        className="relative flex max-h-[85dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-xl border-t border-border bg-surface-raised shadow-md sm:max-h-none sm:w-[26rem] sm:max-w-full sm:rounded-none sm:border-l sm:border-t-0"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border-subtle p-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h3 id="pokemon-details-title" className="m-0 truncate text-xl font-bold leading-tight">
              {name}
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              {pokemon.nickname ? <span>{pokemon.species}</span> : null}
              <span>{formatMessage(levelTemplate, { level: pokemon.level })}</span>
              {pokemon.types?.map((type) => (
                <span key={type} className={tagClass()}>
                  {typeNames[type.toLowerCase()] ?? type}
                </span>
              ))}
              {gender ? (
                <span aria-label={pokemon.gender === 'M' ? labels.male : labels.female}>
                  {gender}
                </span>
              ) : null}
            </div>
          </div>
          <button
            ref={closeButton}
            type="button"
            aria-label={labels.close}
            onClick={onClose}
            className={buttonClass(
              'default',
              'min-h-11 min-w-11 shrink-0 px-3 sm:min-h-9 sm:min-w-0',
            )}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <section className={sectionClass} aria-label={labels.sectionState}>
            <h4 className={sectionHeading}>{labels.sectionState}</h4>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted">{labels.hp}</span>
                <span className="text-lg font-bold tabular-nums">{hp}</span>
              </div>
              <div
                role="meter"
                aria-label={labels.hp}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-1.5 w-full overflow-hidden rounded-full bg-surface-active"
              >
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
            <dl className="m-0 flex flex-col gap-1.5">
              {pokemon.status ? (
                <Row label={labels.status}>{STATUS_LABEL[pokemon.status]}</Row>
              ) : null}
              {pokemon.fainted ? <Row label={labels.status}>{faintedLabel}</Row> : null}
              {pokemon.terastallized ? (
                <Row label={labels.terastallized}>
                  {typeNames[pokemon.terastallized.toLowerCase()] ?? pokemon.terastallized}
                </Row>
              ) : null}
              {boosts.length > 0 ? (
                <Row label={labels.boosts}>
                  {boosts
                    .map(([stat, value]) => `${labels.stat[stat]} ${value > 0 ? '+' : ''}${value}`)
                    .join(' · ')}
                </Row>
              ) : null}
            </dl>
          </section>

          {details ? (
            <section className={sectionClass} aria-label={labels.sectionStats}>
              <h4 className={sectionHeading}>{labels.sectionStats}</h4>
              <StatGrid table={details.stats} labels={labels} large testId="details-stats" />
            </section>
          ) : null}

          {hasSet ? (
            <section className={sectionClass} aria-label={labels.sectionSet}>
              <h4 className={sectionHeading}>{labels.sectionSet}</h4>
              <dl className="m-0 flex flex-col gap-2">
                {pokemon.ability !== undefined ? (
                  <Row label={labels.ability}>{label('abilities', pokemon.ability)}</Row>
                ) : null}
                {pokemon.item ? (
                  <Row label={labels.item}>{label('items', pokemon.item)}</Row>
                ) : null}
                {details ? <Row label={labels.nature}>{details.nature}</Row> : null}
                {pokemon.teraType ? (
                  <Row label={labels.tera}>
                    {typeNames[pokemon.teraType.toLowerCase()] ?? pokemon.teraType}
                  </Row>
                ) : null}
              </dl>
              {details ? (
                <>
                  <Spread title={family === 'champions' ? labels.statPoints : labels.evs}>
                    <StatGrid table={details.evs} labels={labels} onlyNonZero />
                  </Spread>
                  {details.ivs ? (
                    <Spread title={labels.ivs}>
                      <StatGrid table={details.ivs} labels={labels} />
                    </Spread>
                  ) : null}
                </>
              ) : null}
            </section>
          ) : null}

          {moves.length > 0 ? (
            <section className={sectionClass} aria-label={labels.sectionMoves}>
              <h4 className={sectionHeading}>{labels.sectionMoves}</h4>
              <ul
                className="m-0 flex list-none flex-col divide-y divide-border-subtle overflow-hidden rounded-md border border-border-subtle bg-surface p-0"
                data-testid="details-moves"
              >
                {moves.map((move) => (
                  <li
                    key={move.id}
                    className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate font-semibold">
                      {label('moves', move.id)}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-2 text-muted">
                      {move.disabled ? <span className="text-xs">{labels.disabled}</span> : null}
                      {move.pp !== undefined && move.maxPp !== undefined ? (
                        <span className="tabular-nums">
                          {move.pp} / {move.maxPp}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="m-0 border-t border-border-subtle pt-3 text-xs text-muted">
            {labels.scopeNote}
          </p>
        </div>
      </div>
    </div>
  );
}
