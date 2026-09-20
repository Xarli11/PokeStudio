import type { MetadataRoute } from 'next';

import { listAbilities, listMovesPage, listSpecies } from '@pokestudio/database';
import { locales } from '@pokestudio/i18n';

import { SITE_URL } from '@/lib/site-url';
import { captureException } from '@/lib/observability';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';

// Depends on live reference data, so this can never be prerendered at build
// time (CI has no Supabase instance during `next build`) — but reference
// data only changes after a controlled ingestion/deploy event (CLAUDE.md
// §21), never between requests, so unlike the detail pages this doesn't
// need `force-dynamic`'s per-request freshness. `revalidate` regenerates at
// most once an hour instead of on every single request (Performance pass —
// measured: this route's TTFB stayed 400-600ms across "warm" repeats with
// force-dynamic, i.e. every hit re-ran all three full-table scans below).
// Assumption: an hour of staleness after an ingestion is acceptable for a
// sitemap (crawlers poll infrequently; this isn't user-facing data).
export const revalidate = 3600;

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

  // Only the query-less shell (task: "query-state URLs shouldn't explode
  // sitemap cardinality") — a specific `?pokemon=...` comparison is
  // shareable but not a distinct indexable entity, same reasoning as why
  // paginated `/pokemon?page=N` isn't listed either.
  const compareIndexEntries = locales.map((locale) => ({
    url: `${SITE_URL}/${locale}/compare`,
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
    const client = getPokemonDatabaseClient();
    // Three independent full-table reads — nothing here depends on another
    // result, so there's no reason to pay for them one after another
    // (Performance pass §2/§7).
    const [species, movesPage, abilities] = await Promise.all([
      listSpecies(client),
      // pageSize large enough to cover the full ~937-move roster in one page —
      // moves are a small, mostly-static reference set (unlike species, no
      // pagination-past-1000 concern here).
      listMovesPage(client, { page: 1, pageSize: 1000 }),
      // Abilities (Phase 1C.3) — 313 rows, one request, same "small reference
      // set" reasoning as moves above.
      listAbilities(client),
    ]);

    const pokemonDetailEntries = locales.flatMap((locale) =>
      species.map((item) => ({
        url: `${SITE_URL}/${locale}/pokemon/${item.slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
      })),
    );

    const moveDetailEntries = locales.flatMap((locale) =>
      movesPage.items.map((move) => ({
        url: `${SITE_URL}/${locale}/moves/${move.slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
      })),
    );

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
      ...compareIndexEntries,
      ...moveIndexEntries,
      ...moveDetailEntries,
      ...abilityIndexEntries,
      ...abilityDetailEntries,
    ];
  } catch (error) {
    captureException(error, {
      context: 'sitemap: listSpecies/listMovesPage/listAbilities failed',
    });
    return [
      ...localeEntries,
      ...pokemonIndexEntries,
      ...compareIndexEntries,
      ...moveIndexEntries,
      ...abilityIndexEntries,
    ];
  }
}
