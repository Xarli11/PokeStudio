import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getEvolutionFamily, getSpeciesBySlug, type SpeciesFormDetail } from '@pokestudio/database';
import { formatMessage, getDictionary, isLocale, locales } from '@pokestudio/i18n';

import { PokemonEvolutionSection } from '@/components/pokemon/evolution-section';
import { PokemonFormSection } from '@/components/pokemon/form-section';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';
import { partitionOtherForms } from '@/lib/form-grouping';
import { buttonClass, cardClass, eyebrowClass, tagClass } from '@/lib/ui-classes';

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
    baseStatTotalLabel: dictionary.pokedex.baseStatTotal,
    abilities: form.abilities.map((ability) => ({
      slug: ability.slug,
      name: locale === 'es' ? (ability.nameEs ?? ability.nameEn) : ability.nameEn,
      description: locale === 'es' ? ability.effectEs : ability.effectEn,
      isHidden: ability.isHidden,
    })),
    abilitiesLabel: dictionary.pokedex.abilities,
    hiddenAbilityLabel: dictionary.pokedex.hiddenAbility,
    noAbilityDescriptionLabel: dictionary.pokedex.noAbilityDescription,
    variant,
  } as const;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const dictionary = getDictionary(locale);
  const species = await getSpeciesBySlug(getPokemonDatabaseClient(), slug);
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
    getSpeciesBySlug(client, slug),
    getEvolutionFamily(client, slug),
  ]);
  if (!species) notFound();

  const defaultForm = species.forms.find((form) => form.isDefault);
  if (!defaultForm) notFound();
  const otherForms = species.forms.filter((form) => !form.isDefault);
  const { distinctForms, cosmeticVariants } = partitionOtherForms(defaultForm, otherForms);
  const hasOtherForms = distinctForms.length > 0 || cosmeticVariants.length > 0;

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
