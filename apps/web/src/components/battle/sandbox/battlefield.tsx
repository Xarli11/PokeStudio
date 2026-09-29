import type { BattleSideId, BattleState } from '@pokestudio/battle-engine/types';

import { cardClass, tagClass } from '@/lib/ui-classes';
import type { BattleDisplayNames } from '@/lib/battle/types';

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
}: {
  state: BattleState;
  labels: BattlefieldLabels;
  typeNames: Record<string, string>;
  names: BattleDisplayNames | null;
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

  // The rival is shown on top, the first side at the bottom.
  const order: BattleSideId[] = ['p2', 'p1'];
  return (
    <section aria-label="battlefield" className="flex flex-col gap-3">
      {order.map((side) => {
        const data = state.sides[side];
        const bench = data.team.filter((p) => !p.active);
        return (
          <div
            key={side}
            data-testid={`side-${side}`}
            className={cardClass('flex flex-col gap-3 p-3')}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-muted">
                {sideTitle(side, labels)}
              </h3>
              <div className="flex flex-wrap gap-1">
                {data.sideConditions.map((c) => (
                  <span key={c.id} className={tagClass()}>
                    {label('conditions', c.id)}
                    {c.layers ? ` ×${c.layers}` : ''}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {data.active.map((pokemon, index) =>
                pokemon ? (
                  <PokemonCard
                    key={pokemon.ref.teamIndex}
                    pokemon={pokemon}
                    labels={labels}
                    typeNames={typeNames}
                  />
                ) : (
                  <div
                    key={`empty-${index}`}
                    className="rounded-lg border border-dashed border-border-subtle p-3 text-xs text-muted"
                  />
                ),
              )}
            </div>
            {bench.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
                <span className="font-semibold">{labels.bench}:</span>
                {bench.map((pokemon) => (
                  <span
                    key={pokemon.ref.teamIndex}
                    className={tagClass()}
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
      })}
      <p className="m-0 text-xs text-muted" data-testid="field-summary">
        {field.length > 0 ? field.join(' · ') : labels.fieldEmpty}
      </p>
    </section>
  );
}
