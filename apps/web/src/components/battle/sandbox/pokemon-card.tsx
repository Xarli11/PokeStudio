import type { BattlePokemonState } from '@pokestudio/battle-engine/types';

import { tagClass } from '@/lib/ui-classes';

export interface PokemonCardLabels {
  hpLabel: string;
  levelTemplate: string;
  fainted: string;
  teraTemplate: string;
  actingTag: string;
  targetTag: string;
  selectedTag: string;
  inspectTemplate: string;
}

function hpPercent(hp: BattlePokemonState['hp']): number {
  return hp.kind === 'exact' ? Math.round((hp.current * 100) / Math.max(hp.max, 1)) : hp.percent;
}

function hpText(hp: BattlePokemonState['hp']): string {
  return hp.kind === 'exact' ? `${hp.current}/${hp.max}` : `${hp.percent}%`;
}

export const STATUS_LABEL: Record<string, string> = {
  brn: 'BRN',
  par: 'PAR',
  slp: 'SLP',
  frz: 'FRZ',
  psn: 'PSN',
  tox: 'TOX',
};

/** The identity row; a button when the Pokémon can be inspected. */
function HeaderRow({
  onInspect,
  label,
  children,
}: {
  onInspect: (() => void) | undefined;
  label: string;
  children: React.ReactNode;
}) {
  if (!onInspect) return <div className="flex items-center gap-3">{children}</div>;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onInspect}
      className="-m-1 flex cursor-pointer items-center gap-3 rounded-md bg-transparent p-1 text-left text-inherit transition-colors hover:bg-surface-hover"
    >
      {children}
    </button>
  );
}

/** One Pokémon in the battlefield: identity, HP, status, boosts and Tera — from the viewer's state only. */
export function PokemonCard({
  pokemon,
  labels,
  typeNames,
  compact = false,
  highlight,
  onInspect,
}: {
  pokemon: BattlePokemonState;
  labels: PokemonCardLabels;
  typeNames: Record<string, string>;
  compact?: boolean;
  /** Set by the action panel: this Pokémon is acting, or is a legal target being chosen. */
  highlight?: 'actor' | 'target' | 'selected';
  /** Opens the on-demand details sheet for this Pokémon. */
  onInspect?: () => void;
}) {
  const percent = Math.max(0, Math.min(100, hpPercent(pokemon.hp)));
  const barColor = percent > 50 ? 'bg-brand' : percent > 20 ? 'bg-warning' : 'bg-danger';
  const boosts = Object.entries(pokemon.boosts);
  const label = pokemon.nickname ?? pokemon.species;
  // Strongest to weakest: the chosen target, the acting Pokémon, a possible target.
  const ring =
    highlight === 'selected'
      ? 'bg-brand-muted ring-2 ring-brand'
      : highlight === 'actor'
        ? 'ring-1 ring-brand'
        : highlight === 'target'
          ? 'ring-1 ring-brand/40'
          : 'ring-1 ring-transparent';
  return (
    <div
      data-testid={`pokemon-${pokemon.ref.side}-${pokemon.ref.teamIndex}`}
      data-fainted={pokemon.fainted}
      data-highlight={highlight}
      className={`flex min-w-0 flex-col gap-2.5 rounded-lg bg-surface p-3.5 transition-shadow ${ring} ${pokemon.fainted ? 'opacity-50' : ''} ${compact ? 'text-sm' : ''}`}
    >
      <HeaderRow onInspect={onInspect} label={labels.inspectTemplate.replace('{name}', label)}>
        {/* Monogram only: no sprite is shown until Battle has a licensed, species-keyed source. */}
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-raised text-sm font-bold text-muted"
        >
          {label.slice(0, 1).toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-bold leading-tight">{label}</span>
          <span className="truncate text-xs text-muted">
            {pokemon.nickname ? `${pokemon.species} · ` : ''}
            {labels.levelTemplate.replace('{level}', String(pokemon.level))}
          </span>
        </div>
        {highlight ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${highlight === 'selected' ? 'bg-brand-action text-brand-contrast' : 'bg-brand-muted text-brand'}`}
          >
            {highlight === 'actor'
              ? labels.actingTag
              : highlight === 'selected'
                ? labels.selectedTag
                : labels.targetTag}
          </span>
        ) : null}
        {onInspect ? (
          <span aria-hidden="true" className="shrink-0 text-muted">
            ›
          </span>
        ) : null}
      </HeaderRow>
      <div className="flex flex-col gap-1.5">
        <div
          role="meter"
          aria-label={labels.hpLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1.5 w-full overflow-hidden rounded-full bg-surface-active"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${barColor}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <span className="tabular-nums">
            {labels.hpLabel} {hpText(pokemon.hp)}
          </span>
          {pokemon.fainted ? (
            <span className="font-semibold text-danger">{labels.fainted}</span>
          ) : null}
        </div>
      </div>
      {pokemon.status || boosts.length > 0 || pokemon.terastallized || pokemon.types?.length ? (
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
      ) : null}
    </div>
  );
}
