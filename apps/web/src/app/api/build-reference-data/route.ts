import { getSpeciesSearchIndex, listItems, listNatures } from '@pokestudio/database';

import { getPokemonDatabaseClient } from '@/lib/pokemon-database';
import type { BuildReferenceData } from '@/lib/build-reference-data';

// Reads `request.url`'s search params per request — never prerendered.
export const dynamic = 'force-dynamic';

/**
 * The Team Editor's deferred reference data (Fase 2B.2), split out of
 * `/build/[teamId]`'s initial render — see `@/lib/build-reference-data`.
 * Public reference data only: the same `getSpeciesSearchIndex`/
 * `listNatures`/`listItems` queries `/pokemon` and `/compare` already
 * expose, through the same public (RLS-governed) client. No service role,
 * no secrets, no user/team state — this is a GET a browser could safely
 * cache indefinitely for a fixed release.
 *
 * Versioned by `?v=<POKESTUDIO_RELEASE_SHA>` (the same, non-secret SHA
 * `/api/health` already exposes — set as a plain Worker environment
 * variable at deploy time, see `scripts/ci/release.mjs`). Only a request
 * whose `v` matches the *currently running* release gets a long, immutable
 * browser cache: the URL itself is then content-versioned by deploy, so
 * that cache can never go stale. Any other request — no `v`, a stale `v`
 * from a tab that's had a deploy happen underneath it, or local dev where
 * `POKESTUDIO_RELEASE_SHA` isn't set — gets the current data with
 * `no-store`, never immutable data under the wrong version's URL.
 *
 * This only configures the browser's own HTTP cache. It does not claim (and
 * has not been verified to enable) Cloudflare edge/CDN caching — a Worker
 * response's `Cache-Control` header alone does not populate Cloudflare's
 * CDN cache for a dynamic route without an explicit Cache API call, which
 * this does not use.
 */
export async function GET(request: Request): Promise<Response> {
  const currentSha = process.env.POKESTUDIO_RELEASE_SHA;
  const requestedVersion = new URL(request.url).searchParams.get('v');

  const client = getPokemonDatabaseClient();
  const [searchIndex, natures, items] = await Promise.all([
    getSpeciesSearchIndex(client),
    listNatures(client),
    listItems(client),
  ]);

  const body: BuildReferenceData = { searchIndex, natures, items };
  const isCurrentVersion = Boolean(currentSha) && requestedVersion === currentSha;

  return Response.json(body, {
    headers: {
      'Cache-Control': isCurrentVersion ? 'public, max-age=31536000, immutable' : 'no-store',
    },
  });
}
