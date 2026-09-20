import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { formatMessage, getDictionary, isLocale, locales } from '@pokestudio/i18n';

import { SITE_URL } from '@/lib/site-url';
import { AbilityIndexExplorer } from '@/components/abilities/ability-search';
import { getCachedAbilitiesList, getPokemonDatabaseClient } from '@/lib/pokemon-database';
import { eyebrowClass } from '@/lib/ui-classes';

// Reads live reference data per request — do not attempt to statically
// prerender this at build time (CI has no Supabase instance during `next build`).
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dictionary = getDictionary(locale);
  const abilities = await getCachedAbilitiesList(getPokemonDatabaseClient());

  return {
    metadataBase: new URL(SITE_URL),
    title: dictionary.abilities.title,
    description: formatMessage(dictionary.abilities.indexDescription, {
      count: abilities.length,
    }),
    alternates: {
      canonical: `/${locale}/abilities`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/abilities`])),
    },
    openGraph: {
      url: `/${locale}/abilities`,
      title: dictionary.abilities.title,
      description: dictionary.abilities.tagline,
      locale,
      type: 'website',
    },
  };
}

/**
 * The ability index (Phase 1C.3) — the whole ~313-row dataset ships to the
 * client for instant search (task §9: "do not overengineer pagination if the
 * complete dataset is lightweight" — measured ~12.5KB gzip, well under any
 * reasonable threshold), so unlike the Pokédex/Moves indexes there is no
 * separate paginated "default view": the full list is the default view.
 */
export default async function AbilityIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const abilities = await getCachedAbilitiesList(getPokemonDatabaseClient());

  return (
    <div className="mx-auto flex max-w-wide flex-col gap-10">
      <header className="flex flex-col gap-3">
        <span className={eyebrowClass()}>{dictionary.abilities.title}</span>
        <h1 className="m-0 text-3xl tracking-tight">{dictionary.abilities.title}</h1>
        <p className="m-0 max-w-xl text-muted">{dictionary.abilities.tagline}</p>
      </header>

      <AbilityIndexExplorer
        locale={locale}
        abilities={abilities}
        searchLabel={dictionary.abilities.search}
        searchPlaceholder={dictionary.abilities.searchPlaceholder}
        resultCountTemplate={dictionary.abilities.resultCount}
        noResultsLabel={dictionary.abilities.noResults}
        clearSearchLabel={dictionary.abilities.clearSearch}
      />
    </div>
  );
}
