import type { BaseStats, PokemonType } from '@pokestudio/pokemon-data';

import { PokemonAbilityList, type AbilityListItem } from './ability-list';
import { PokemonStatBars } from './stat-bars';
import { PokemonTypeBadge } from './type-badge';
import { PokemonVisualPlaceholder } from './visual-placeholder';

export interface PokemonFormSectionProps {
  /** Anchor target for "other forms" navigation links. */
  id: string;
  name: string;
  /** Omitted for the default form — only shown for non-default forms. */
  categoryLabel?: string | undefined;
  types: { type: PokemonType; label: string }[];
  stats: BaseStats;
  statLabels: Record<keyof BaseStats, string>;
  typesLabel: string;
  baseStatsLabel: string;
  abilities: AbilityListItem[];
  abilitiesLabel: string;
  hiddenAbilityLabel: string;
  noAbilityDescriptionLabel: string;
}

/** One form's full detail block — used for both the default form and each other form. */
export function PokemonFormSection({
  id,
  name,
  categoryLabel,
  types,
  stats,
  statLabels,
  typesLabel,
  baseStatsLabel,
  abilities,
  abilitiesLabel,
  hiddenAbilityLabel,
  noAbilityDescriptionLabel,
}: PokemonFormSectionProps) {
  return (
    <section
      id={id}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.25rem',
        borderRadius: '0.75rem',
        border: '1px solid var(--ps-color-border)',
        background: 'var(--ps-color-bg-surface)',
        scrollMarginTop: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <PokemonVisualPlaceholder initial={name.charAt(0)} primaryType={types[0]!.type} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{name}</h3>
          {categoryLabel ? (
            <span style={{ color: 'var(--ps-color-text-muted)', fontSize: '0.8125rem' }}>
              {categoryLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div>
        <h4
          style={{
            margin: '0 0 0.5rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--ps-color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          {typesLabel}
        </h4>
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {types.map(({ type, label }) => (
            <PokemonTypeBadge key={type} type={type} label={label} />
          ))}
        </div>
      </div>

      <div>
        <h4
          style={{
            margin: '0 0 0.5rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--ps-color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          {baseStatsLabel}
        </h4>
        <PokemonStatBars stats={stats} labels={statLabels} />
      </div>

      {abilities.length > 0 ? (
        <div>
          <h4
            style={{
              margin: '0 0 0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--ps-color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            {abilitiesLabel}
          </h4>
          <PokemonAbilityList
            abilities={abilities}
            hiddenAbilityLabel={hiddenAbilityLabel}
            noDescriptionLabel={noAbilityDescriptionLabel}
          />
        </div>
      ) : null}
    </section>
  );
}
