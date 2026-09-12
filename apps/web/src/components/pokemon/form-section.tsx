import type { BaseStats, PokemonType } from '@pokestudio/pokemon-data';
import { pokemonTypeColorVar } from '@pokestudio/ui';

import { cardClass, tagClass } from '@/lib/ui-classes';

import { PokemonAbilityList, type AbilityListItem } from './ability-list';
import { PokemonArtSlot } from './art-slot';
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
   * side by side, stats+abilities below — a 2-column grid from `md:` up),
   * and its Base stats/Abilities are top-level `h2` sections. `secondary`
   * — any other form: a simpler stacked card, its name is an `h3` (nested
   * under the "Other forms" `h2`), with `h4` subsections. Keeps the
   * document outline correct instead of skipping/duplicating levels
   * (UX/UI 0.1 Part D).
   */
  variant: 'primary' | 'secondary';
}

const SECTION_HEADING_CLASS = 'm-0 mb-2 text-sm font-semibold text-muted uppercase tracking-wide';

function TypeBadgeGroup({
  types,
  typesLabel,
}: {
  types: { type: PokemonType; label: string }[];
  typesLabel: string;
}) {
  return (
    <div role="group" aria-label={typesLabel} className="flex flex-wrap gap-1">
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
        className={cardClass('scroll-mt-6 p-6')}
        style={{
          // A faint type-tinted wash across the whole panel — ties the
          // identity area to the art slot's gradient without becoming a
          // full banner (UX/UI 0.2 Part F, carried into 0.2b's wider panel).
          background: `linear-gradient(120deg, color-mix(in srgb, var(${primaryTypeVar}) 8%, var(--ps-color-bg-surface)), var(--ps-color-bg-surface) 65%)`,
        }}
      >
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(200px,300px)_1fr] md:items-start md:gap-x-12 md:gap-y-6">
          <div className="flex md:col-start-1 md:row-start-1">
            <PokemonArtSlot
              initial={name.charAt(0)}
              types={types.map((t) => t.type)}
              variant="detailHero"
            />
          </div>

          <div className="flex flex-col gap-3 md:col-start-2 md:row-start-1 md:justify-center">
            <p className="m-0 text-xl font-bold">{name}</p>
            <span className={tagClass({ label: true }, 'self-start whitespace-normal')}>
              {categoryLabel}
            </span>
            <TypeBadgeGroup types={types} typesLabel={typesLabel} />
            {/* A derived summary (sum of the six stats shown below), not a
                duplicate — fills the identity column with real signal when
                a form otherwise has little else to say (0.2c Part C). */}
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl leading-none font-bold text-brand tabular-nums">
                {baseStatTotal}
              </span>
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                {baseStatTotalLabel}
              </span>
            </div>
          </div>

          <div className="border-t border-border-subtle pt-4 md:col-start-1 md:row-start-2">
            <h2 className={SECTION_HEADING_CLASS}>{baseStatsLabel}</h2>
            <PokemonStatBars stats={stats} labels={statLabels} />
          </div>

          {abilitiesBlock ? (
            <div className="border-t border-border-subtle pt-4 md:col-start-2 md:row-start-2 md:border-l md:border-t-0 md:pt-0 md:pl-12">
              <h2 className={SECTION_HEADING_CLASS}>{abilitiesLabel}</h2>
              {abilitiesBlock}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section id={id} className={cardClass('scroll-mt-6 flex flex-col gap-4 p-6')}>
      <div className="flex items-center gap-4">
        <PokemonArtSlot initial={name.charAt(0)} types={types.map((t) => t.type)} variant="hero" />
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="m-0 text-lg">{name}</h3>
          <span className={tagClass({ label: true }, 'self-start whitespace-normal')}>
            {categoryLabel}
          </span>
          <TypeBadgeGroup types={types} typesLabel={typesLabel} />
        </div>
      </div>

      <div>
        <h4 className={SECTION_HEADING_CLASS}>{baseStatsLabel}</h4>
        <PokemonStatBars stats={stats} labels={statLabels} />
      </div>

      {abilitiesBlock ? (
        <div>
          <h4 className={SECTION_HEADING_CLASS}>{abilitiesLabel}</h4>
          {abilitiesBlock}
        </div>
      ) : null}
    </section>
  );
}
