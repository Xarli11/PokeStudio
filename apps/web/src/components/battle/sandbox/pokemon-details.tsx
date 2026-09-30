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
const row = 'flex items-baseline justify-between gap-3 text-sm';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={row}>
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 min-w-0 text-right font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

function StatChips({
  table,
  labels,
  onlyNonZero,
}: {
  table: BattleStatTable;
  labels: PokemonDetailsLabels;
  onlyNonZero: boolean;
}) {
  const entries = STAT_ORDER.filter((stat) => !onlyNonZero || table[stat] > 0);
  if (entries.length === 0) return <>0</>;
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {entries.map((stat) => (
        <span key={stat} className={tagClass()}>
          {labels.stat[stat]} {table[stat]}
        </span>
      ))}
    </span>
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
  const typeText = pokemon.types?.map((type) => typeNames[type.toLowerCase()] ?? type).join(' / ');
  const hp =
    pokemon.hp.kind === 'exact'
      ? `${pokemon.hp.current} / ${pokemon.hp.max}`
      : `${pokemon.hp.percent}%`;
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
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 id="pokemon-details-title" className="m-0 truncate text-lg font-bold leading-tight">
              {name}
            </h3>
            <p className="m-0 text-sm text-muted">
              {pokemon.nickname ? `${pokemon.species} · ` : ''}
              {formatMessage(levelTemplate, { level: pokemon.level })}
              {typeText ? ` · ${typeText}` : ''}
              {gender ? (
                <>
                  {' · '}
                  <span aria-label={pokemon.gender === 'M' ? labels.male : labels.female}>
                    {gender}
                  </span>
                </>
              ) : null}
            </p>
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

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
          <p className="m-0 text-xs text-muted">{labels.scopeNote}</p>

          <section className="flex flex-col gap-2" aria-label={labels.sectionState}>
            <h4 className={sectionHeading}>{labels.sectionState}</h4>
            <dl className="m-0 flex flex-col gap-1.5">
              <Row label={labels.hp}>{hp}</Row>
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
            <section className="flex flex-col gap-2" aria-label={labels.sectionStats}>
              <h4 className={sectionHeading}>{labels.sectionStats}</h4>
              <dl className="m-0 flex flex-col gap-1.5" data-testid="details-stats">
                {STAT_ORDER.map((stat) => (
                  <Row key={stat} label={labels.stat[stat]}>
                    {details.stats[stat]}
                  </Row>
                ))}
              </dl>
            </section>
          ) : null}

          {hasSet ? (
            <section className="flex flex-col gap-2" aria-label={labels.sectionSet}>
              <h4 className={sectionHeading}>{labels.sectionSet}</h4>
              <dl className="m-0 flex flex-col gap-1.5">
                {pokemon.ability !== undefined ? (
                  <Row label={labels.ability}>{label('abilities', pokemon.ability)}</Row>
                ) : null}
                {pokemon.item ? (
                  <Row label={labels.item}>{label('items', pokemon.item)}</Row>
                ) : null}
                {details ? (
                  <>
                    <Row label={labels.nature}>{details.nature}</Row>
                    <Row label={family === 'champions' ? labels.statPoints : labels.evs}>
                      <StatChips table={details.evs} labels={labels} onlyNonZero />
                    </Row>
                    {details.ivs ? (
                      <Row label={labels.ivs}>
                        <StatChips table={details.ivs} labels={labels} onlyNonZero={false} />
                      </Row>
                    ) : null}
                  </>
                ) : null}
                {pokemon.teraType ? (
                  <Row label={labels.tera}>
                    {typeNames[pokemon.teraType.toLowerCase()] ?? pokemon.teraType}
                  </Row>
                ) : null}
              </dl>
            </section>
          ) : null}

          {moves.length > 0 ? (
            <section className="flex flex-col gap-2" aria-label={labels.sectionMoves}>
              <h4 className={sectionHeading}>{labels.sectionMoves}</h4>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0" data-testid="details-moves">
                {moves.map((move) => (
                  <li key={move.id} className={row}>
                    <span className="min-w-0 truncate font-semibold">
                      {label('moves', move.id)}
                      {move.disabled ? (
                        <span className="ml-2 text-xs font-normal text-muted">
                          {labels.disabled}
                        </span>
                      ) : null}
                    </span>
                    {move.pp !== undefined && move.maxPp !== undefined ? (
                      <span className="shrink-0 tabular-nums text-muted">
                        {move.pp} / {move.maxPp}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
