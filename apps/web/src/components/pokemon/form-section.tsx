import Link from 'next/link';

import type { BaseStats, PokemonType } from '@pokestudio/pokemon-data';
import { pokemonTypeColorVar } from '@pokestudio/ui';

import { STAT_TIER_TEXT_CLASS, totalStatTier, type StatTier } from '@/lib/stat-quality';
import { cardClass, tagClass } from '@/lib/ui-classes';

import { PokemonAbilityList, type AbilityListItem } from './ability-list';
import { PokemonFormArt } from './form-art-slot';
import { PokemonStatBars } from './stat-bars';
import { PokemonTypeBadge } from './type-badge';

export interface PokemonFormSectionProps {
  /** Anchor target for "other forms" navigation links. */
  id: string;
  name: string;
  /**
   * This exact form's sprite (visual review — Explore rendered a monogram
   * for every form, valid sprite data notwithstanding). `undefined` when no
   * trusted sprite is known for this form — the only other reason it stops
   * being used is a genuine `<img>` load failure, owned by `PokemonFormArt`
   * (the one small client boundary this otherwise-server component needs);
   * either way it falls back to `PokemonArtSlot`'s own monogram, never a
   * broken image.
   */
  spriteUrl?: string | undefined;
  categoryLabel: string;
  types: { type: PokemonType; label: string }[];
  stats: BaseStats;
  statLabels: Record<keyof BaseStats, string>;
  typesLabel: string;
  baseStatsLabel: string;
  /** Shown only for the primary form — a derived sum of the six base stats already rendered below, not a duplicate figure. */
  baseStatTotalLabel: string;
  statTierLabels: Record<StatTier, string>;
  abilities: AbilityListItem[];
  abilitiesLabel: string;
  hiddenAbilityLabel: string;
  noAbilityDescriptionLabel: string;
  fallbackLanguageLabel: string;
  /**
   * Phase 3 "Explore → Damage Lab" (attacker-only): this exact form's
   * `/battle/damage?attacker=<formSlug>` link, pre-built by the page
   * (which already has `locale` in scope) rather than assembled in here.
   * Optional — omitted entirely (never a disabled/broken link) when a
   * caller doesn't supply it, e.g. every existing test in
   * `form-section.test.tsx`.
   */
  damageLabHref?: string;
  /** "Open in Damage Lab" / "Abrir en Damage Lab" — required alongside `damageLabHref` for the link to render. */
  damageLabLabel?: string;
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
  spriteUrl,
  categoryLabel,
  types,
  stats,
  statLabels,
  typesLabel,
  baseStatsLabel,
  baseStatTotalLabel,
  statTierLabels,
  abilities,
  abilitiesLabel,
  hiddenAbilityLabel,
  noAbilityDescriptionLabel,
  fallbackLanguageLabel,
  damageLabHref,
  damageLabLabel,
  variant,
}: PokemonFormSectionProps) {
  const damageLabLink =
    damageLabHref && damageLabLabel ? (
      <Link
        href={damageLabHref}
        className="self-start text-sm font-semibold text-brand no-underline hover:underline"
      >
        {damageLabLabel} →
      </Link>
    ) : null;
  const primaryTypeVar = pokemonTypeColorVar[types[0]!.type];
  const baseStatTotal =
    stats.hp +
    stats.attack +
    stats.defense +
    stats.specialAttack +
    stats.specialDefense +
    stats.speed;
  const baseStatTotalTier = totalStatTier(baseStatTotal);
  const abilitiesBlock =
    abilities.length > 0 ? (
      <PokemonAbilityList
        abilities={abilities}
        hiddenAbilityLabel={hiddenAbilityLabel}
        noDescriptionLabel={noAbilityDescriptionLabel}
        fallbackLanguageLabel={fallbackLanguageLabel}
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
            <PokemonFormArt
              initial={name.charAt(0)}
              types={types.map((t) => t.type)}
              variant="detailHero"
              spriteUrl={spriteUrl}
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
              <span
                className={`text-2xl leading-none font-bold tabular-nums ${STAT_TIER_TEXT_CLASS[baseStatTotalTier]}`}
              >
                {baseStatTotal}
                <span className="sr-only"> ({statTierLabels[baseStatTotalTier]})</span>
              </span>
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                {baseStatTotalLabel}
              </span>
            </div>
            {damageLabLink}
          </div>

          <div className="border-t border-border-subtle pt-4 md:col-start-1 md:row-start-2">
            <h2 className={SECTION_HEADING_CLASS}>{baseStatsLabel}</h2>
            <PokemonStatBars stats={stats} labels={statLabels} tierLabels={statTierLabels} />
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
        <PokemonFormArt
          initial={name.charAt(0)}
          types={types.map((t) => t.type)}
          variant="hero"
          spriteUrl={spriteUrl}
        />
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="m-0 text-lg">{name}</h3>
          <span className={tagClass({ label: true }, 'self-start whitespace-normal')}>
            {categoryLabel}
          </span>
          <TypeBadgeGroup types={types} typesLabel={typesLabel} />
          {damageLabLink}
        </div>
      </div>

      <div>
        <h4 className={SECTION_HEADING_CLASS}>{baseStatsLabel}</h4>
        <PokemonStatBars stats={stats} labels={statLabels} tierLabels={statTierLabels} />
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
