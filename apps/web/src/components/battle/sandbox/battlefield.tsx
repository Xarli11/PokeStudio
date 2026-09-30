import type { BattleSideId, BattleState } from '@pokestudio/battle-engine/types';

import { tagClass } from '@/lib/ui-classes';
import type { BattleDisplayNames } from '@/lib/battle/types';

import type { ActionFocus } from './action-panel';
import { PokemonCard, type PokemonCardLabels } from './pokemon-card';

export interface BattlefieldLabels extends PokemonCardLabels {
  player1: string;
  player2: string;
  active: string;
  bench: string;
  weather: string;
  terrain: string;
  fieldEmpty: string;
  hazards: string;
  battlefield: string;
}

function sideTitle(side: BattleSideId, labels: BattlefieldLabels) {
  return side === 'p1' ? labels.player1 : labels.player2;
}

/**
 * Both sides of the field, from one perspective. It only renders the state it is given, so what it
 * can show is exactly what that perspective is allowed to know — the UI never receives (or hides)
 * anything more.
 */
export function Battlefield({
  state,
  labels,
  typeNames,
  names,
  focus = null,
  bottom = 'p1',
}: {
  state: BattleState;
  labels: BattlefieldLabels;
  typeNames: Record<string, string>;
  names: BattleDisplayNames | null;
  focus?: ActionFocus | null;
  /** The side drawn at the bottom (the one being viewed); the other is on top. */
  bottom?: BattleSideId;
}) {
  const label = (table: 'conditions', id: string) => names?.[table][id] ?? id;
  const field = [
    state.field.weather
      ? `${labels.weather}: ${label('conditions', state.field.weather.id)}`
      : null,
    state.field.terrain
      ? `${labels.terrain}: ${label('conditions', state.field.terrain.id)}`
      : null,
    ...state.field.pseudoWeather.map((c) => label('conditions', c.id)),
  ].filter((entry): entry is string => entry !== null);

  const order: BattleSideId[] = bottom === 'p2' ? ['p1', 'p2'] : ['p2', 'p1'];
  // Selected target > acting Pokémon > legal target.
  const highlightOf = (side: BattleSideId, position: number) => {
    const here = (slot: { side: BattleSideId; position: number }) =>
      slot.side === side && slot.position === position;
    if (focus?.selected && here(focus.selected)) return 'selected' as const;
    if (focus && here(focus.actor)) return 'actor' as const;
    if (focus?.targets?.some(here)) return 'target' as const;
    return undefined;
  };
  const compact = state.gameType === 'singles';
  const fieldLine = field.length > 0 ? field.join(' · ') : labels.fieldEmpty;
  const [top, lower] = order as [BattleSideId, BattleSideId];
  const renderSide = (side: BattleSideId) => {
    const data = state.sides[side];
    const bench = data.team.filter((p) => !p.active);
    const single = data.active.length <= 1;
    return (
      <div key={side} data-testid={`side-${side}`} className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-sm font-semibold text-muted">{sideTitle(side, labels)}</h3>
          {data.sideConditions.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {data.sideConditions.map((c) => (
                <span key={c.id} className={tagClass()}>
                  {label('conditions', c.id)}
                  {c.layers ? ` ×${c.layers}` : ''}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div
          className={`grid grid-cols-1 gap-3 ${single ? 'sm:mx-auto sm:w-full sm:max-w-sm' : 'sm:grid-cols-2'}`}
        >
          {data.active.map((pokemon, index) =>
            pokemon ? (
              <PokemonCard
                key={pokemon.ref.teamIndex}
                pokemon={pokemon}
                labels={labels}
                typeNames={typeNames}
                {...(highlightOf(side, index) ? { highlight: highlightOf(side, index)! } : {})}
              />
            ) : (
              <div
                key={`empty-${index}`}
                className="min-h-24 rounded-lg border border-dashed border-border-subtle"
              />
            ),
          )}
        </div>
        {bench.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span className="font-semibold">{labels.bench}</span>
            {bench.map((pokemon) => (
              <span
                key={pokemon.ref.teamIndex}
                className="rounded-full bg-surface px-2 py-0.5"
                data-fainted={pokemon.fainted}
              >
                {pokemon.nickname ?? pokemon.species}
                {pokemon.fainted ? ' ✕' : ''}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  };
  return (
    <section
      aria-label={labels.battlefield}
      className={`flex min-w-0 flex-col rounded-lg border border-border-subtle bg-surface-raised ${compact ? 'gap-3 p-3 sm:p-4' : 'gap-4 p-4 sm:p-5'}`}
    >
      {renderSide(top)}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border-subtle" />
        <p
          className={`m-0 text-xs ${field.length > 0 ? 'rounded-full bg-brand-muted px-2.5 py-1 font-semibold text-brand' : 'text-muted'}`}
          data-testid="field-summary"
        >
          {fieldLine}
        </p>
        <span className="h-px flex-1 bg-border-subtle" />
      </div>
      {renderSide(lower)}
    </section>
  );
}
