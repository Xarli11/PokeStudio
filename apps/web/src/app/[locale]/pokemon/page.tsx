import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { listSpeciesPage } from '@pokestudio/database';
import { formatMessage, getDictionary, isLocale, locales } from '@pokestudio/i18n';

import { PokemonCard } from '@/components/pokemon/card';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';
import { buttonClass, eyebrowClass } from '@/lib/ui-classes';

// Reads live reference data per request — do not attempt to statically
// prerender this at build time (CI has no Supabase instance during `next build`).
export const dynamic = 'force-dynamic';

// The full Pokédex is 1000+ species — rendering it all in one response was a
// ~6MB page (Phase 1B §13 measurement). Simple page-number navigation, no
// client JS/search: the smallest fix that keeps payload size reasonable.
const PAGE_SIZE = 60;

// National Dex number is a product identifier, not translatable prose
// (CLAUDE.md brand-cleanup pass) — always "#NNN", independent of locale.
function dexNumberLabel(n: number): string {
  return `#${String(n).padStart(3, '0')}`;
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
    <div className="mx-auto flex max-w-wide flex-col gap-10">
      <header className="flex flex-col gap-3">
        <span className={eyebrowClass()}>{dictionary.pokedex.eyebrow}</span>
        <h1 className="m-0 text-3xl tracking-tight">{dictionary.pokedex.title}</h1>
        <p className="m-0 max-w-xl text-muted">{dictionary.pokedex.tagline}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {result.items.map((item) => (
          <PokemonCard
            key={item.slug}
            href={`/${locale}/pokemon/${item.slug}`}
            name={item.name[locale]}
            dexNumberLabel={dexNumberLabel(item.nationalDexNumber)}
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
        className="flex items-center justify-between gap-4"
      >
        {result.page > 1 ? (
          <Link
            href={`/${locale}/pokemon?page=${result.page - 1}`}
            className={buttonClass('default')}
          >
            ← {dictionary.pokedex.previousPage}
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
        <span className="text-sm text-muted tabular-nums">
          {formatMessage(dictionary.pokedex.pageLabel, {
            page: result.page,
            totalPages: result.totalPages,
          })}
        </span>
        {result.page < result.totalPages ? (
          <Link
            href={`/${locale}/pokemon?page=${result.page + 1}`}
            className={buttonClass('default')}
          >
            {dictionary.pokedex.nextPage} →
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
      </nav>
    </div>
  );
}
