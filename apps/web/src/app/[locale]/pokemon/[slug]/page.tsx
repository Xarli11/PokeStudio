import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  getEvolutionFamily,
  getFormLearnsetAllVersionGroups,
  type SpeciesFormDetail,
} from '@pokestudio/database';
import {
  abilityEffectsEs,
  formatMessage,
  getDictionary,
  isLocale,
  locales,
} from '@pokestudio/i18n';

import { PokemonEvolutionSection } from '@/components/pokemon/evolution-section';
import { PokemonFormSection } from '@/components/pokemon/form-section';
import { PokemonMovesSection, type MovesExplorerMove } from '@/components/pokemon/moves-section';
import { getCachedSpeciesBySlug, getPokemonDatabaseClient } from '@/lib/pokemon-database';
import { partitionOtherForms } from '@/lib/form-grouping';
import { pickDefaultVersionGroup } from '@/lib/moves-explorer';
import { buttonClass, cardClass, eyebrowClass, tagClass } from '@/lib/ui-classes';
import { versionGroupDisplayName } from '@/lib/version-group-label';

// Reads live reference data per request — do not attempt to statically
// prerender this at build time (CI has no Supabase instance during `next build`).
export const dynamic = 'force-dynamic';

type PageParams = { locale: string; slug: string };

/** Cosmetic variants beyond this count collapse behind a native <details> (Alcremie: 63, Unown: 27). */
const COSMETIC_VARIANTS_COLLAPSE_THRESHOLD = 8;

// National Dex number is a product identifier, not translatable prose
// (CLAUDE.md brand-cleanup pass) — always "#NNN", independent of locale.
function dexNumberLabel(n: number): string {
  return `#${String(n).padStart(3, '0')}`;
}

function formSectionProps(
  form: SpeciesFormDetail,
  locale: 'en' | 'es',
  dictionary: ReturnType<typeof getDictionary>,
  variant: 'primary' | 'secondary',
) {
  return {
    id: form.slug,
    name: form.name[locale],
    categoryLabel: dictionary.pokedex.formCategory[form.category],
    types: form.types.map((type) => ({ type, label: dictionary.types[type] })),
    stats: form.baseStats,
    statLabels: dictionary.pokedex.stat,
    typesLabel: dictionary.pokedex.types,
    baseStatsLabel: dictionary.pokedex.baseStats,
    statTierLabels: dictionary.pokedex.statTier,
    baseStatTotalLabel: dictionary.pokedex.baseStatTotal,
    abilities: form.abilities.map((ability) => {
      // PokéAPI never publishes a Spanish ability effect (docs/engineering/DATA_SOURCES.md) —
      // 0 of 313 abilities have one upstream, so PokeStudio owns this layer
      // (Phase 1C.2b, packages/i18n/src/ability-effects-es.ts, 313/313,
      // verified against the live dataset — see
      // packages/database/tests/ability-effects-coverage.integration.test.ts).
      // Fallback chain: upstream Spanish (kept first in case PokéAPI ever
      // publishes one) → PokeStudio Spanish → upstream English (marked
      // honestly, never mislabeled as Spanish) → "unavailable" message.
      const pokeStudioEs = abilityEffectsEs[ability.slug];
      const description =
        locale === 'es' ? (ability.effectEs ?? pokeStudioEs ?? ability.effectEn) : ability.effectEn;
      return {
        slug: ability.slug,
        href: `/${locale}/abilities/${ability.slug}`,
        name: locale === 'es' ? (ability.nameEs ?? ability.nameEn) : ability.nameEn,
        description,
        descriptionIsFallback:
          locale === 'es' && !ability.effectEs && !pokeStudioEs && description !== undefined,
        isHidden: ability.isHidden,
      };
    }),
    abilitiesLabel: dictionary.pokedex.abilities,
    hiddenAbilityLabel: dictionary.pokedex.hiddenAbility,
    noAbilityDescriptionLabel: dictionary.pokedex.noAbilityDescription,
    fallbackLanguageLabel: dictionary.pokedex.descriptionFallbackLanguage,
    variant,
  } as const;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale, slug: rawSlug } = await params;
  if (!isLocale(locale)) return {};
  const slug = rawSlug.toLowerCase();
  const dictionary = getDictionary(locale);
  const species = await getCachedSpeciesBySlug(getPokemonDatabaseClient(), slug);
  if (!species) return {};

  const otherFormCount = species.forms.length - 1;
  const formsNote =
    otherFormCount > 0
      ? formatMessage(dictionary.pokedex.detailDescriptionWithForms, { formCount: otherFormCount })
      : '';

  return {
    metadataBase: new URL('https://pokestudio.app'),
    title: `${species.name[locale]} — ${dictionary.pokedex.title}`,
    description: formatMessage(dictionary.pokedex.detailDescription, {
      name: species.name[locale],
      formsNote,
    }),
    alternates: {
      // Always the lowercase canonical slug, regardless of the request's own
      // casing (task §13/§17: "canonical metadata lowercase") — middleware
      // already redirects a non-canonical-case request before this page ever
      // renders for a real visitor (see middleware.ts), but this stays
      // correct on its own regardless.
      canonical: `/${locale}/pokemon/${slug}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/pokemon/${slug}`])),
    },
    openGraph: {
      title: species.name[locale],
      description: dictionary.pokedex.tagline,
      locale,
      type: 'website',
    },
  };
}

export default async function PokemonDetailPage({ params }: { params: Promise<PageParams> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const client = getPokemonDatabaseClient();
  const [species, evolutionFamily] = await Promise.all([
    getCachedSpeciesBySlug(client, slug),
    getEvolutionFamily(client, slug),
  ]);
  if (!species) notFound();

  const defaultForm = species.forms.find((form) => form.isDefault);
  if (!defaultForm) notFound();
  const otherForms = species.forms.filter((form) => !form.isDefault);
  const { distinctForms, cosmeticVariants } = partitionOtherForms(defaultForm, otherForms);
  const hasOtherForms = distinctForms.length > 0 || cosmeticVariants.length > 0;

  // Moves are shown for the default form only in this phase — a per-form
  // Moves section (mirroring abilities/stats) is a reasonable next step,
  // deferred to keep this page restrained (task §15 "not the final Team
  // Builder UI"). One bounded fetch gets this form's *entire* learnset
  // across every version group it has data in (Phase 1C.2b instant
  // client-side switching, docs/adr/0013) — the client owns version-group
  // selection/"All moves"/filters/sorting from here on, never a server
  // round-trip; this initial render still picks a real, deterministic
  // default group so the page has meaningful content before any JS runs
  // (crawlers, no-JS).
  const learnset = await getFormLearnsetAllVersionGroups(client, defaultForm.slug);
  const initialVersionGroupSlug = learnset
    ? pickDefaultVersionGroup(learnset.versionGroups, learnset.entries)
    : undefined;
  const movesExplorerVersionGroups = (learnset?.versionGroups ?? []).map((vg) => ({
    slug: vg.slug,
    label: `${formatMessage(dictionary.moves.generation, { number: vg.generation })} — ${versionGroupDisplayName(vg.slug)}`,
    name: versionGroupDisplayName(vg.slug),
    generation: vg.generation,
  }));
  const movesExplorerMoves: MovesExplorerMove[] = (learnset?.moves ?? []).map((move) => ({
    slug: move.slug,
    name: locale === 'es' ? (move.nameEs ?? move.nameEn) : move.nameEn,
    type: move.type,
    damageClass: move.damageClass,
    power: move.power,
    accuracy: move.accuracy,
    pp: move.pp,
  }));

  return (
    <div className="mx-auto flex max-w-detail flex-col gap-8">
      <Link
        href={`/${locale}/pokemon`}
        className="self-start text-sm text-muted no-underline hover:text-foreground"
      >
        ← {dictionary.pokedex.backToPokedex}
      </Link>

      <header className="flex flex-col gap-2">
        <span className={eyebrowClass('tabular-nums')}>
          {dexNumberLabel(species.nationalDexNumber)}
        </span>
        <h1 className="m-0 text-3xl tracking-tight">{species.name[locale]}</h1>
      </header>

      <PokemonFormSection {...formSectionProps(defaultForm, locale, dictionary, 'primary')} />

      <PokemonMovesSection
        moves={movesExplorerMoves}
        entries={learnset?.entries ?? []}
        versionGroups={movesExplorerVersionGroups}
        initialVersionGroupSlug={initialVersionGroupSlug}
        localePrefix={`/${locale}`}
        title={dictionary.moves.title}
        versionGroupLabel={dictionary.moves.versionGroup}
        allMovesLabel={dictionary.moves.allMoves}
        allMovesHint={dictionary.moves.allMovesHint}
        noMoveDataLabel={dictionary.moves.noMoveData}
        noResultsLabel={dictionary.moves.noResults}
        resultCountTemplate={dictionary.moves.resultCount}
        searchLabel={dictionary.moves.search}
        searchPlaceholder={dictionary.moves.searchPlaceholder}
        allTypesLabel={dictionary.moves.allTypes}
        allDamageClassesLabel={dictionary.moves.allDamageClasses}
        allMethodsLabel={dictionary.moves.allMethods}
        typeLabels={dictionary.types}
        damageClassLabels={dictionary.moves.damageClass}
        methodLabels={dictionary.moves.method}
        typeFilterLabel={dictionary.moves.typeFilter}
        damageClassFilterLabel={dictionary.moves.damageClassFilter}
        methodFilterLabel={dictionary.moves.methodFilter}
        columnLabels={dictionary.moves.column}
        noPowerLabel={dictionary.moves.noPower}
        neverMissesLabel={dictionary.moves.neverMisses}
        levelTemplate={dictionary.moves.level}
        levelRangeTemplate={dictionary.moves.levelRange}
        levelOnEvolveLabel={dictionary.moves.levelOnEvolve}
        levelNotApplicableLabel={dictionary.moves.levelNotApplicable}
        gamesCountTemplate={dictionary.moves.gamesCount}
        gamesSummarySameGenerationTemplate={dictionary.moves.gamesSummarySameGeneration}
        gamesSummaryRangeTemplate={dictionary.moves.gamesSummaryRange}
        generationLabelTemplate={dictionary.moves.generation}
        methodsSummaryTemplate={dictionary.moves.methodsSummary}
        methodsSummaryAriaLabelTemplate={dictionary.moves.methodsSummaryAriaLabel}
      />

      {evolutionFamily ? (
        <PokemonEvolutionSection family={evolutionFamily} locale={locale} dictionary={dictionary} />
      ) : null}

      {hasOtherForms ? (
        <section className="flex flex-col gap-4 border-t border-border-subtle pt-5">
          <h2 className="m-0 text-lg">{dictionary.pokedex.otherForms}</h2>

          {distinctForms.length > 1 ? (
            <nav aria-label={dictionary.pokedex.otherForms}>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {distinctForms.map((form) => (
                  <li key={form.slug}>
                    <a href={`#${form.slug}`} className={buttonClass('default')}>
                      {form.name[locale]}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          {distinctForms.map((form) => (
            <PokemonFormSection
              key={form.slug}
              {...formSectionProps(form, locale, dictionary, 'secondary')}
            />
          ))}

          {cosmeticVariants.length > 0 ? (
            <details
              className={cardClass('px-5 py-4')}
              open={cosmeticVariants.length <= COSMETIC_VARIANTS_COLLAPSE_THRESHOLD || undefined}
            >
              <summary className="cursor-pointer text-base font-semibold text-muted transition-colors hover:text-foreground">
                {formatMessage(dictionary.pokedex.cosmeticVariants, {
                  count: cosmeticVariants.length,
                })}
              </summary>
              <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
                {cosmeticVariants.map((form) => (
                  <li key={form.slug} className={tagClass()}>
                    {form.name[locale]}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
