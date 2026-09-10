import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getEvolutionFamily, getSpeciesBySlug, type SpeciesFormDetail } from '@pokestudio/database';
import { formatMessage, getDictionary, isLocale, locales } from '@pokestudio/i18n';

import { PokemonEvolutionSection } from '@/components/pokemon/evolution-section';
import { PokemonFormSection } from '@/components/pokemon/form-section';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';

// Reads live reference data per request — do not attempt to statically
// prerender this at build time (CI has no Supabase instance during `next build`).
export const dynamic = 'force-dynamic';

type PageParams = { locale: string; slug: string };

function dexNumberLabel(dictionary: ReturnType<typeof getDictionary>, n: number): string {
  return formatMessage(dictionary.pokedex.dexNumber, { number: String(n).padStart(3, '0') });
}

function formSectionProps(
  form: SpeciesFormDetail,
  locale: 'en' | 'es',
  dictionary: ReturnType<typeof getDictionary>,
) {
  return {
    id: form.slug,
    name: form.name[locale],
    categoryLabel: form.isDefault ? undefined : dictionary.pokedex.formCategory[form.category],
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
  };
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

  return (
    <main
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '3rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      <Link href={`/${locale}/pokemon`} style={{ color: 'var(--ps-color-text-muted)' }}>
        ← {dictionary.pokedex.backToPokedex}
      </Link>

      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <span style={{ color: 'var(--ps-color-text-muted)', fontSize: '0.875rem' }}>
          {dexNumberLabel(dictionary, species.nationalDexNumber)}
        </span>
        <h1 style={{ margin: 0, fontSize: '2rem' }}>{species.name[locale]}</h1>
      </header>

      <PokemonFormSection {...formSectionProps(defaultForm, locale, dictionary)} />

      {evolutionFamily ? (
        <PokemonEvolutionSection family={evolutionFamily} locale={locale} dictionary={dictionary} />
      ) : null}

      {otherForms.length > 0 ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>
              {dictionary.pokedex.otherForms}
            </h2>
            <nav aria-label={dictionary.pokedex.otherForms}>
              <ul
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                }}
              >
                {otherForms.map((form) => (
                  <li key={form.slug}>
                    <a
                      href={`#${form.slug}`}
                      style={{
                        display: 'inline-block',
                        padding: '0.375rem 0.75rem',
                        borderRadius: '9999px',
                        border: '1px solid var(--ps-color-border)',
                        color: 'var(--ps-color-text)',
                        textDecoration: 'none',
                        fontSize: '0.875rem',
                      }}
                    >
                      {form.name[locale]}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {otherForms.map((form) => (
            <PokemonFormSection key={form.slug} {...formSectionProps(form, locale, dictionary)} />
          ))}
        </section>
      ) : null}
    </main>
  );
}
