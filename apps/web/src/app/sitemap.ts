import type { MetadataRoute } from 'next';

import { listAbilities, listMovesPage, listSpecies } from '@pokestudio/database';
import { locales } from '@pokestudio/i18n';

import { captureException } from '@/lib/observability';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';

// Depends on live reference data — never attempt to prerender at build time.
export const dynamic = 'force-dynamic';

const SITE_URL = 'https://pokestudio.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const localeEntries = locales.map((locale) => ({
    url: `${SITE_URL}/${locale}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
  }));

  const pokemonIndexEntries = locales.map((locale) => ({
    url: `${SITE_URL}/${locale}/pokemon`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
  }));

  const moveIndexEntries = locales.map((locale) => ({
    url: `${SITE_URL}/${locale}/moves`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
  }));

  const abilityIndexEntries = locales.map((locale) => ({
    url: `${SITE_URL}/${locale}/abilities`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
  }));

  // Best-effort: a sitemap missing the small, currently-fixed set of detail
  // pages is a minor SEO gap, not a broken page — never 500 the sitemap over it.
  try {
    const species = await listSpecies(getPokemonDatabaseClient());
    const pokemonDetailEntries = locales.flatMap((locale) =>
      species.map((item) => ({
        url: `${SITE_URL}/${locale}/pokemon/${item.slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
      })),
    );

    // pageSize large enough to cover the full ~937-move roster in one page —
    // moves are a small, mostly-static reference set (unlike species, no
    // pagination-past-1000 concern here).
    const movesPage = await listMovesPage(getPokemonDatabaseClient(), { page: 1, pageSize: 1000 });
    const moveDetailEntries = locales.flatMap((locale) =>
      movesPage.items.map((move) => ({
        url: `${SITE_URL}/${locale}/moves/${move.slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
      })),
    );

    // Abilities (Phase 1C.3) — 313 rows, one request, same "small reference
    // set" reasoning as moves above.
    const abilities = await listAbilities(getPokemonDatabaseClient());
    const abilityDetailEntries = locales.flatMap((locale) =>
      abilities.map((ability) => ({
        url: `${SITE_URL}/${locale}/abilities/${ability.slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
      })),
    );

    return [
      ...localeEntries,
      ...pokemonIndexEntries,
      ...pokemonDetailEntries,
      ...moveIndexEntries,
      ...moveDetailEntries,
      ...abilityIndexEntries,
      ...abilityDetailEntries,
    ];
  } catch (error) {
    captureException(error, {
      context: 'sitemap: listSpecies/listMovesPage/listAbilities failed',
    });
    return [...localeEntries, ...pokemonIndexEntries, ...moveIndexEntries, ...abilityIndexEntries];
  }
}
