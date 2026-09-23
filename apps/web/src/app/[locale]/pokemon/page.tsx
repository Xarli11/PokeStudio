import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getSpeciesSearchIndex, listSpeciesPage } from '@pokestudio/database';
import { formatMessage, getDictionary, isLocale, locales } from '@pokestudio/i18n';

import { SITE_URL } from '@/lib/site-url';
import { PokemonExplorer } from '@/components/pokemon/pokemon-explorer';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';
import { eyebrowClass } from '@/lib/ui-classes';

// Reads live reference data per request — do not attempt to statically
// prerender this at build time (CI has no Supabase instance during `next build`).
export const dynamic = 'force-dynamic';

// The full Pokédex is 1000+ species — rendering it all in one response was a
// ~6MB page (Phase 1B §13 measurement). Simple page-number navigation for the
// *default* (no search) view keeps that payload reasonable; whole-Pokédex
// search (Phase 1C.3) instead ships a separate, much smaller search-only
// dataset (`getSpeciesSearchIndex`, measured ~19KB gzip) that the client
// filters instantly — see `PokemonExplorer`.
const PAGE_SIZE = 60;

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
    metadataBase: new URL(SITE_URL),
    title: dictionary.pokedex.title,
    description: formatMessage(dictionary.pokedex.indexDescription, {
      count: firstPage.totalCount,
    }),
    alternates: {
      canonical: `/${locale}/pokemon`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/pokemon`])),
    },
    openGraph: {
      url: `/${locale}/pokemon`,
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
  const client = getPokemonDatabaseClient();
  const [result, searchIndex] = await Promise.all([
    listSpeciesPage(client, { page, pageSize: PAGE_SIZE }),
    getSpeciesSearchIndex(client),
  ]);

  return (
    <div className="mx-auto flex max-w-wide flex-col gap-10">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <span className={eyebrowClass()}>{dictionary.pokedex.eyebrow}</span>
          <Link
            href={`/${locale}/compare`}
            className="text-sm font-semibold text-brand no-underline hover:underline"
          >
            {dictionary.compare.entryLink} →
          </Link>
        </div>
        <h1 className="m-0 text-3xl tracking-tight">{dictionary.pokedex.title}</h1>
        <p className="m-0 max-w-xl text-muted">{dictionary.pokedex.tagline}</p>
      </header>

      <PokemonExplorer
        locale={locale}
        searchIndex={searchIndex}
        defaultView={{
          items: result.items.map((item) => ({
            slug: item.slug,
            nationalDexNumber: item.nationalDexNumber,
            name: item.name,
            types: item.defaultForm.types,
            baseStats: item.defaultForm.baseStats,
            formSlug: item.defaultForm.slug,
            pokeapiPokemonId: item.defaultForm.pokeapiPokemonId,
          })),
          page: result.page,
          totalPages: result.totalPages,
        }}
        typeLabels={dictionary.types}
        searchLabel={dictionary.pokedex.search}
        searchPlaceholder={dictionary.pokedex.searchPlaceholder}
        searchHelperTitle={dictionary.pokedex.searchHelperTitle}
        searchHelperExample={dictionary.pokedex.searchHelperExample}
        multipleFormsMatchTemplate={dictionary.pokedex.multipleFormsMatch}
        resultCountTemplate={dictionary.pokedex.searchResultCount}
        noResultsLabel={dictionary.pokedex.noSearchResults}
        clearSearchLabel={dictionary.pokedex.clearSearch}
        pageLabelTemplate={dictionary.pokedex.pageLabel}
        previousPageLabel={dictionary.pokedex.previousPage}
        nextPageLabel={dictionary.pokedex.nextPage}
        filterLabels={{
          typeLabel: dictionary.moves.typeFilter,
          allTypesLabel: dictionary.moves.allTypes,
          generationLabel: dictionary.moves.generationFilter,
          allGenerationsLabel: dictionary.moves.allGenerations,
          generationOptionTemplate: dictionary.moves.generation,
          sortByLabel: dictionary.pokedex.sortBy,
          sortDexNumberLabel: dictionary.pokedex.sortByDexNumber,
          sortNameLabel: dictionary.moves.column.name,
          sortBstLabel: dictionary.pokedex.baseStatTotal,
          statLabels: dictionary.pokedex.stat,
          sortAscendingLabel: dictionary.pokedex.sortAscending,
          sortDescendingLabel: dictionary.pokedex.sortDescending,
          clearFiltersLabel: dictionary.pokedex.clearFilters,
        }}
      />
    </div>
  );
}
