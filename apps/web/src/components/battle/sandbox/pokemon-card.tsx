import type { BattlePokemonState } from '@pokestudio/battle-engine/types';

import { cardClass, tagClass } from '@/lib/ui-classes';

export interface PokemonCardLabels {
  hpLabel: string;
  levelTemplate: string;
  fainted: string;
  teraTemplate: string;
}

function hpPercent(hp: BattlePokemonState['hp']): number {
  return hp.kind === 'exact' ? Math.round((hp.current * 100) / Math.max(hp.max, 1)) : hp.percent;
}

function hpText(hp: BattlePokemonState['hp']): string {
  return hp.kind === 'exact' ? `${hp.current}/${hp.max}` : `${hp.percent}%`;
}

const STATUS_LABEL: Record<string, string> = {
  brn: 'BRN',
  par: 'PAR',
  slp: 'SLP',
  frz: 'FRZ',
  psn: 'PSN',
  tox: 'TOX',
};

/** One Pokémon in the battlefield: identity, HP, status, boosts and Tera — from the viewer's state only. */
export function PokemonCard({
  pokemon,
  labels,
  typeNames,
  compact = false,
}: {
  pokemon: BattlePokemonState;
  labels: PokemonCardLabels;
  typeNames: Record<string, string>;
  compact?: boolean;
}) {
  const percent = Math.max(0, Math.min(100, hpPercent(pokemon.hp)));
  const barColor = percent > 50 ? 'bg-success' : percent > 20 ? 'bg-warning' : 'bg-danger';
  const boosts = Object.entries(pokemon.boosts);
  const label = pokemon.nickname ?? pokemon.species;
  return (
    <div
      data-testid={`pokemon-${pokemon.ref.side}-${pokemon.ref.teamIndex}`}
      data-fainted={pokemon.fainted}
      className={cardClass(
        `flex min-w-0 flex-col gap-2 p-3 ${pokemon.fainted ? 'opacity-50' : ''} ${compact ? 'text-sm' : ''}`,
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-bold">{label}</span>
        <span className="shrink-0 text-xs text-muted">
          {labels.levelTemplate.replace('{level}', String(pokemon.level))}
        </span>
      </div>
      {pokemon.nickname ? (
        <span className="-mt-1 text-xs text-muted">{pokemon.species}</span>
      ) : null}
      <div
        role="meter"
        aria-label={labels.hpLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 w-full overflow-hidden rounded-full bg-border-subtle"
      >
        <div className={`h-full ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>
          {labels.hpLabel} {hpText(pokemon.hp)}
        </span>
        {pokemon.fainted ? (
          <span className={tagClass({ label: true })}>{labels.fainted}</span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1">
        {pokemon.status ? (
          <span className={tagClass({ label: true, accent: true })}>
            {STATUS_LABEL[pokemon.status]}
          </span>
        ) : null}
        {boosts.map(([stat, value]) => (
          <span key={stat} className={tagClass()}>
            {stat.toUpperCase()} {value > 0 ? `+${value}` : value}
          </span>
        ))}
        {pokemon.terastallized ? (
          <span className={tagClass({ accent: true })}>
            {labels.teraTemplate.replace(
              '{type}',
              typeNames[pokemon.terastallized.toLowerCase()] ?? pokemon.terastallized,
            )}
          </span>
        ) : null}
        {pokemon.types?.map((type) => (
          <span key={type} className={tagClass()}>
            {typeNames[type.toLowerCase()] ?? type}
          </span>
        ))}
      </div>
    </div>
  );
}
