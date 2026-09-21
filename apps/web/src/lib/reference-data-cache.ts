import { unstable_cache } from 'next/cache';

import {
  getSpeciesSearchIndex,
  listItems,
  listNatures,
  listVersionGroups,
} from '@pokestudio/database';

import { getPokemonDatabaseClient } from './pokemon-database';

/**
 * Cached wrappers for global Pokémon reference data — species search index,
 * natures, held items, playable version groups. All four are independent of
 * user, teamId, locale, cookies and localStorage (Fase 2B.1); they only
 * change after a controlled ingestion (CLAUDE.md §21, docs/engineering/CI_CD.md),
 * same reasoning `sitemap.ts` already uses for its own `revalidate`.
 *
 * Cache semantics under the deployed Cloudflare Worker (@opennextjs/cloudflare,
 * apps/web/open-next.config.ts — no R2/KV incremental-cache backend
 * configured): this is the **in-memory, per-isolate** Data Cache OpenNext
 * falls back to, not a persistent or globally-shared cache. A cold isolate
 * (after a new deploy, or one Cloudflare simply hasn't reused yet) has an
 * empty cache and will query Supabase again — that's expected, not a bug.
 * `revalidate: 3600` is a backstop for isolates that stay warm a long time
 * between deploys; it is not the primary invalidation mechanism. Every real
 * ingestion is followed by a deploy in the same pipeline run (`migration/ingest
 * -> build -> deploy`), and a deploy's fresh isolates start with an empty
 * cache regardless of `revalidate` — see docs/engineering/DOMAIN.md and
 * CI_CD.md for that pipeline ordering. Correctness never depends on a cache
 * hit: every wrapper falls straight through to the real query on a miss.
 */
const REVALIDATE_SECONDS = 3600;
const REFERENCE_DATA_TAG = 'reference-data';

export const getCachedSpeciesSearchIndex = unstable_cache(
  () => getSpeciesSearchIndex(getPokemonDatabaseClient()),
  ['reference-data', 'species-search-index'],
  {
    tags: [REFERENCE_DATA_TAG, 'reference-data:species-search-index'],
    revalidate: REVALIDATE_SECONDS,
  },
);

export const getCachedNatures = unstable_cache(
  () => listNatures(getPokemonDatabaseClient()),
  ['reference-data', 'natures'],
  { tags: [REFERENCE_DATA_TAG, 'reference-data:natures'], revalidate: REVALIDATE_SECONDS },
);

export const getCachedItems = unstable_cache(
  () => listItems(getPokemonDatabaseClient()),
  ['reference-data', 'items'],
  { tags: [REFERENCE_DATA_TAG, 'reference-data:items'], revalidate: REVALIDATE_SECONDS },
);

export const getCachedVersionGroups = unstable_cache(
  () => listVersionGroups(getPokemonDatabaseClient()),
  ['reference-data', 'version-groups'],
  { tags: [REFERENCE_DATA_TAG, 'reference-data:version-groups'], revalidate: REVALIDATE_SECONDS },
);
