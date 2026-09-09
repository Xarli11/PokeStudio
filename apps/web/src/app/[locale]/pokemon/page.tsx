import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { listSpeciesPage } from '@pokestudio/database';
import { formatMessage, getDictionary, isLocale, locales } from '@pokestudio/i18n';

import { PokemonCard } from '@/components/pokemon/card';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';

// Reads live reference data per request — do not attempt to statically
// prerender this at build time (CI has no Supabase instance during `next build`).
export const dynamic = 'force-dynamic';

// The full Pokédex is 1000+ species — rendering it all in one response was a
// ~6MB page (Phase 1B §13 measurement). Simple page-number navigation, no
// client JS/search: the smallest fix that keeps payload size reasonable.
const PAGE_SIZE = 60;

function dexNumberLabel(dictionary: ReturnType<typeof getDictionary>, n: number): string {
  return formatMessage(dictionary.pokedex.dexNumber, { number: String(n).padStart(3, '0') });
}

function parsePage(searchParams: { page?: string }): number {
  const page = Number.parseInt(searchParams.page ?? '1', 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dictionary = getDictionary(locale);
  const firstPage = await listSpeciesPage(getPokemonDatabaseClient(), { page: 1, pageSize: 1 });

  return {
    metadataBase: new URL('https://pokestudio.app'),
    title: dictionary.pokedex.title,
    description: formatMessage(dictionary.pokedex.indexDescription, {
      count: firstPage.totalCount,
    }),
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
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const page = parsePage(await searchParams);
  const result = await listSpeciesPage(getPokemonDatabaseClient(), { page, pageSize: PAGE_SIZE });

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
        {result.items.map((item) => (
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

      <nav
        aria-label={formatMessage(dictionary.pokedex.pageLabel, {
          page: result.page,
          totalPages: result.totalPages,
        })}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        {result.page > 1 ? (
          <Link href={`/${locale}/pokemon?page=${result.page - 1}`}>
            ← {dictionary.pokedex.previousPage}
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
        <span style={{ color: 'var(--ps-color-text-muted)', fontSize: '0.875rem' }}>
          {formatMessage(dictionary.pokedex.pageLabel, {
            page: result.page,
            totalPages: result.totalPages,
          })}
        </span>
        {result.page < result.totalPages ? (
          <Link href={`/${locale}/pokemon?page=${result.page + 1}`}>
            {dictionary.pokedex.nextPage} →
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
      </nav>
    </main>
  );
}
