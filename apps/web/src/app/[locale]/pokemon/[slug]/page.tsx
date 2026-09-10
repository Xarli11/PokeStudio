import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getEvolutionFamily, getSpeciesBySlug, type SpeciesFormDetail } from '@pokestudio/database';
import { formatMessage, getDictionary, isLocale, locales } from '@pokestudio/i18n';

import { AppShell } from '@/components/app-shell';
import { PokemonEvolutionSection } from '@/components/pokemon/evolution-section';
import { PokemonFormSection } from '@/components/pokemon/form-section';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';
import { partitionOtherForms } from '@/lib/form-grouping';

// Reads live reference data per request — do not attempt to statically
// prerender this at build time (CI has no Supabase instance during `next build`).
export const dynamic = 'force-dynamic';

type PageParams = { locale: string; slug: string };

/** Cosmetic variants beyond this count collapse behind a native <details> (Alcremie: 63, Unown: 27). */
const COSMETIC_VARIANTS_COLLAPSE_THRESHOLD = 8;

function dexNumberLabel(dictionary: ReturnType<typeof getDictionary>, n: number): string {
  return formatMessage(dictionary.pokedex.dexNumber, { number: String(n).padStart(3, '0') });
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
    <AppShell locale={locale} dictionary={dictionary} active="explore">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ps-space-6)' }}>
        <Link
          href={`/${locale}/pokemon`}
          style={{
            color: 'var(--ps-color-text-muted)',
            fontSize: 'var(--ps-font-size-sm)',
            alignSelf: 'flex-start',
          }}
        >
          ← {dictionary.pokedex.backToPokedex}
        </Link>

        <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ps-space-1)' }}>
          <span
            style={{
              color: 'var(--ps-color-text-muted)',
              fontSize: 'var(--ps-font-size-sm)',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
            }}
          >
            {dexNumberLabel(dictionary, species.nationalDexNumber)}
          </span>
          <h1 style={{ margin: 0, fontSize: 'var(--ps-font-size-3xl)', letterSpacing: '-0.02em' }}>
            {species.name[locale]}
          </h1>
        </header>

        <PokemonFormSection {...formSectionProps(defaultForm, locale, dictionary, 'primary')} />

        {evolutionFamily ? (
          <PokemonEvolutionSection
            family={evolutionFamily}
            locale={locale}
            dictionary={dictionary}
          />
        ) : null}

        {hasOtherForms ? (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ps-space-4)' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--ps-font-size-lg)' }}>
              {dictionary.pokedex.otherForms}
            </h2>

            {distinctForms.length > 1 ? (
              <nav aria-label={dictionary.pokedex.otherForms}>
                <ul
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--ps-space-2)',
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                  }}
                >
                  {distinctForms.map((form) => (
                    <li key={form.slug}>
                      <a href={`#${form.slug}`} className="ps-btn">
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
                className="ps-card"
                open={cosmeticVariants.length <= COSMETIC_VARIANTS_COLLAPSE_THRESHOLD || undefined}
                style={{ padding: 'var(--ps-space-4) var(--ps-space-5)' }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 'var(--ps-font-size-base)',
                    color: 'var(--ps-color-text-muted)',
                  }}
                >
                  {formatMessage(dictionary.pokedex.cosmeticVariants, {
                    count: cosmeticVariants.length,
                  })}
                </summary>
                <ul
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--ps-space-2)',
                    margin: 'var(--ps-space-3) 0 0',
                    padding: 0,
                    listStyle: 'none',
                  }}
                >
                  {cosmeticVariants.map((form) => (
                    <li key={form.slug} className="ps-tag">
                      {form.name[locale]}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
