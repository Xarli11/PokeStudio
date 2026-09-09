import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { listSpecies } from '@pokestudio/database';
import { formatMessage, getDictionary, isLocale, locales } from '@pokestudio/i18n';

import { PokemonCard } from '@/components/pokemon/card';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';

// Reads live reference data per request — do not attempt to statically
// prerender this at build time (CI has no Supabase instance during `next build`).
export const dynamic = 'force-dynamic';

function dexNumberLabel(dictionary: ReturnType<typeof getDictionary>, n: number): string {
  return formatMessage(dictionary.pokedex.dexNumber, { number: String(n).padStart(3, '0') });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dictionary = getDictionary(locale);
  const species = await listSpecies(getPokemonDatabaseClient());

  return {
    metadataBase: new URL('https://pokestudio.app'),
    title: dictionary.pokedex.title,
    description: formatMessage(dictionary.pokedex.indexDescription, { count: species.length }),
    alternates: {
      canonical: `/${locale}/pokemon`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/pokemon`])),
    },
    openGraph: {
      title: dictionary.pokedex.title,
      description: dictionary.pokedex.tagline,
      locale,
      type: 'website',
    },
  };
}

export default async function PokemonIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const species = await listSpecies(getPokemonDatabaseClient());

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
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem' }}>{dictionary.pokedex.title}</h1>
        <p style={{ margin: 0, color: 'var(--ps-color-text-muted)' }}>
          {dictionary.pokedex.tagline}
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {species.map((item) => (
          <PokemonCard
            key={item.slug}
            href={`/${locale}/pokemon/${item.slug}`}
            name={item.name[locale]}
            dexNumberLabel={dexNumberLabel(dictionary, item.nationalDexNumber)}
            types={item.defaultForm.types.map((type) => ({
              type,
              label: dictionary.types[type],
            }))}
          />
        ))}
      </div>
    </main>
  );
}
