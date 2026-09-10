import type { BaseStats, PokemonType } from '@pokestudio/pokemon-data';
import { pokemonTypeColorVar } from '@pokestudio/ui';

import { PokemonAbilityList, type AbilityListItem } from './ability-list';
import { PokemonArtSlot } from './art-slot';
import styles from './form-section.module.css';
import { PokemonStatBars } from './stat-bars';
import { PokemonTypeBadge } from './type-badge';

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
  /** Shown only for the primary form — a derived sum of the six base stats already rendered below, not a duplicate figure. */
  baseStatTotalLabel: string;
  abilities: AbilityListItem[];
  abilitiesLabel: string;
  hiddenAbilityLabel: string;
  noAbilityDescriptionLabel: string;
  /**
   * `primary` — the form the page's own `<h1>` already names (the default
   * form): no redundant name heading, a composed desktop panel (art+info
   * side by side, stats+abilities below — `form-section.module.css`), and
   * its Base stats/Abilities are top-level `h2` sections. `secondary` —
   * any other form: a simpler stacked card, its name is an `h3` (nested
   * under the "Other forms" `h2`), with `h4` subsections. Keeps the
   * document outline correct instead of skipping/duplicating levels
   * (UX/UI 0.1 Part D).
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

function TypeBadgeGroup({
  types,
  typesLabel,
}: {
  types: { type: PokemonType; label: string }[];
  typesLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={typesLabel}
      style={{ display: 'flex', gap: 'var(--ps-space-1)', flexWrap: 'wrap' }}
    >
      {types.map(({ type, label }) => (
        <PokemonTypeBadge key={type} type={type} label={label} />
      ))}
    </div>
  );
}

/** One form's full detail block — a composed hero panel for the primary form, a compact card for every other form. */
export function PokemonFormSection({
  id,
  name,
  categoryLabel,
  types,
  stats,
  statLabels,
  typesLabel,
  baseStatsLabel,
  baseStatTotalLabel,
  abilities,
  abilitiesLabel,
  hiddenAbilityLabel,
  noAbilityDescriptionLabel,
  variant,
}: PokemonFormSectionProps) {
  const primaryTypeVar = pokemonTypeColorVar[types[0]!.type];
  const baseStatTotal =
    stats.hp +
    stats.attack +
    stats.defense +
    stats.specialAttack +
    stats.specialDefense +
    stats.speed;
  const abilitiesBlock =
    abilities.length > 0 ? (
      <PokemonAbilityList
        abilities={abilities}
        hiddenAbilityLabel={hiddenAbilityLabel}
        noDescriptionLabel={noAbilityDescriptionLabel}
      />
    ) : null;

  if (variant === 'primary') {
    return (
      <section
        id={id}
        className="ps-card"
        style={{
          padding: 'var(--ps-space-5)',
          scrollMarginTop: 'var(--ps-space-5)',
          // A faint type-tinted wash across the whole panel — ties the
          // identity area to the art slot's gradient without becoming a
          // full banner (UX/UI 0.2 Part F, carried into 0.2b's wider panel).
          background: `linear-gradient(120deg, color-mix(in srgb, var(${primaryTypeVar}) 8%, var(--ps-color-bg-surface)), var(--ps-color-bg-surface) 65%)`,
        }}
      >
        <div className={styles.heroGrid}>
          <div className={styles.artArea}>
            <PokemonArtSlot
              initial={name.charAt(0)}
              types={types.map((t) => t.type)}
              variant="detailHero"
            />
          </div>

          <div className={styles.infoArea}>
            <p style={{ margin: 0, fontSize: 'var(--ps-font-size-xl)', fontWeight: 700 }}>{name}</p>
            <span className="ps-tag ps-tag-label" style={{ alignSelf: 'flex-start' }}>
              {categoryLabel}
            </span>
            <TypeBadgeGroup types={types} typesLabel={typesLabel} />
            {/* A derived summary (sum of the six stats shown below), not a
                duplicate — fills the identity column with real signal when
                a form otherwise has little else to say (0.2c Part C). */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 'var(--ps-space-2)',
                marginTop: 'var(--ps-space-2)',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--ps-font-size-2xl)',
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--ps-color-primary)',
                  lineHeight: 1,
                }}
              >
                {baseStatTotal}
              </span>
              <span
                style={{
                  fontSize: 'var(--ps-font-size-xs)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--ps-color-text-muted)',
                }}
              >
                {baseStatTotalLabel}
              </span>
            </div>
          </div>

          <div className={styles.statsArea}>
            <h2 style={sectionHeadingStyle}>{baseStatsLabel}</h2>
            <PokemonStatBars stats={stats} labels={statLabels} />
          </div>

          {abilitiesBlock ? (
            <div className={styles.abilitiesArea}>
              <h2 style={sectionHeadingStyle}>{abilitiesLabel}</h2>
              {abilitiesBlock}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

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
        <PokemonArtSlot initial={name.charAt(0)} types={types.map((t) => t.type)} variant="hero" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ps-space-2)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--ps-font-size-lg)' }}>{name}</h3>
          <span className="ps-tag ps-tag-label" style={{ alignSelf: 'flex-start' }}>
            {categoryLabel}
          </span>
          <TypeBadgeGroup types={types} typesLabel={typesLabel} />
        </div>
      </div>

      <div>
        <h4 style={sectionHeadingStyle}>{baseStatsLabel}</h4>
        <PokemonStatBars stats={stats} labels={statLabels} />
      </div>

      {abilitiesBlock ? (
        <div>
          <h4 style={sectionHeadingStyle}>{abilitiesLabel}</h4>
          {abilitiesBlock}
        </div>
      ) : null}
    </section>
  );
}
