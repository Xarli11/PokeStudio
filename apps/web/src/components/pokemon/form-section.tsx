import type { BaseStats, PokemonType } from '@pokestudio/pokemon-data';

import { PokemonAbilityList, type AbilityListItem } from './ability-list';
import { PokemonStatBars } from './stat-bars';
import { PokemonTypeBadge } from './type-badge';
import { PokemonVisualPlaceholder } from './visual-placeholder';

export interface PokemonFormSectionProps {
  /** Anchor target for "other forms" navigation links. */
  id: string;
  name: string;
  categoryLabel: string;
  types: { type: PokemonType; label: string }[];
  stats: BaseStats;
  statLabels: Record<keyof BaseStats, string>;
  typesLabel: string;
  baseStatsLabel: string;
  abilities: AbilityListItem[];
  abilitiesLabel: string;
  hiddenAbilityLabel: string;
  noAbilityDescriptionLabel: string;
  /**
   * `primary` — the form the page's own `<h1>` already names (the default
   * form): no redundant name heading, and its Types/Stats/Abilities are
   * top-level `h2` sections. `secondary` — any other form: its name is an
   * `h3` (nested under the "Other forms" `h2`), with `h4` subsections.
   * Keeps the document outline correct instead of skipping/duplicating
   * levels (UX/UI 0.1 Part D).
   */
  variant: 'primary' | 'secondary';
}

const sectionHeadingStyle: React.CSSProperties = {
  margin: '0 0 var(--ps-space-2)',
  fontSize: 'var(--ps-font-size-sm)',
  fontWeight: 600,
  color: 'var(--ps-color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

/** One form's full detail block — used for both the default (primary) form and each other form. */
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
  variant,
}: PokemonFormSectionProps) {
  const SectionHeading = variant === 'primary' ? 'h2' : 'h4';

  return (
    <section
      id={id}
      className="ps-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ps-space-4)',
        padding: 'var(--ps-space-5)',
        scrollMarginTop: 'var(--ps-space-5)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ps-space-4)' }}>
        <PokemonVisualPlaceholder initial={name.charAt(0)} primaryType={types[0]!.type} size={64} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ps-space-1)' }}>
          {variant === 'secondary' ? (
            <h3 style={{ margin: 0, fontSize: 'var(--ps-font-size-lg)' }}>{name}</h3>
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--ps-font-size-lg)', fontWeight: 600 }}>{name}</p>
          )}
          <span className="ps-tag ps-tag-label" style={{ alignSelf: 'flex-start' }}>
            {categoryLabel}
          </span>
        </div>
      </div>

      <div>
        <SectionHeading style={sectionHeadingStyle}>{typesLabel}</SectionHeading>
        <div style={{ display: 'flex', gap: 'var(--ps-space-1)', flexWrap: 'wrap' }}>
          {types.map(({ type, label }) => (
            <PokemonTypeBadge key={type} type={type} label={label} />
          ))}
        </div>
      </div>

      <div>
        <SectionHeading style={sectionHeadingStyle}>{baseStatsLabel}</SectionHeading>
        <PokemonStatBars stats={stats} labels={statLabels} />
      </div>

      {abilities.length > 0 ? (
        <div>
          <SectionHeading style={sectionHeadingStyle}>{abilitiesLabel}</SectionHeading>
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
