/**
 * Full Pokédex ingestion (Phase 1B).
 *
 * upstream (PokéAPI, cached) → fetch → normalize → validate → persist (Postgres)
 *
 * Fetches every supported species and every form under it (varieties +
 * cosmetic sub-forms), normalizes into the PokeStudio species/form model
 * (ADR-0010), validates dataset invariants, and upserts into Postgres by
 * upstream identity (idempotent — safe to re-run). Prints a classification
 * audit and performance report on completion.
 *
 * Run with: pnpm --filter @pokestudio/pokemon-data ingest
 * Options:  --limit=N        only the first N species (fast dev iteration)
 *           --concurrency=N  requests in flight per fetch phase (default 12)
 *           --no-cache       bypass the on-disk raw-response cache
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role: RLS
 * only allows anon reads on these tables — ingestion writes need to bypass
 * it, same as any other write path in this repo, SECURITY.md).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import { buildAuditReport, formatAuditReport } from '../src/audit';
import { createFileCache } from '../src/cache';
import { createPokeApiClient } from '../src/pokeapi-client';
import { persistDataset, type IngestClient, type IngestSchema } from '../src/persist';
import { fetchAndNormalize } from '../src/pipeline';
import type { NormalizedDataset } from '../src/types';
import { validateExploreDataset } from '../src/validate';

function parseArgs(argv: string[]) {
  const limitFlag = argv.find((arg) => arg.startsWith('--limit='));
  const concurrencyFlag = argv.find((arg) => arg.startsWith('--concurrency='));
  return {
    limit: limitFlag ? Number.parseInt(limitFlag.split('=')[1]!, 10) : undefined,
    concurrency: concurrencyFlag ? Number.parseInt(concurrencyFlag.split('=')[1]!, 10) : 12,
    noCache: argv.includes('--no-cache'),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      '[ingest] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n' +
        '  Start local Supabase first: pnpm --filter @pokestudio/database db:start',
    );
    process.exitCode = 1;
    return;
  }

  const cacheDir = path.join(
    fileURLToPath(new URL('.', import.meta.url)),
    '..',
    '.cache',
    'pokeapi',
  );
  const cache = args.noCache ? undefined : createFileCache(cacheDir);
  const api = createPokeApiClient({ cache });

  console.warn('[ingest] Fetching + normalizing (species -> varieties -> forms)...');
  const result = await fetchAndNormalize(api, { limit: args.limit, concurrency: args.concurrency });
  console.warn(
    `[ingest]   ${result.species.length} species, ${result.varietyCount} varieties, ${result.formJobCount} forms.`,
  );

  if (result.normalizationFailures.length > 0) {
    console.error(`[ingest] ${result.normalizationFailures.length} species failed to normalize:`);
    for (const failure of result.normalizationFailures.slice(0, 20)) {
      console.error(`  [${failure.speciesName}] ${failure.error}`);
    }
    process.exitCode = 1;
    return;
  }

  const dataset: NormalizedDataset = {
    provenance: {
      sourceId: 'pokeapi',
      sourceUrl: 'https://pokeapi.co/api/v2',
      license: 'BSD-3-Clause (PokéAPI data license)',
      fetchedAt: new Date().toISOString(),
      importerVersion: '1.0.0-phase-1b',
    },
    species: result.species,
    forms: result.forms,
  };

  console.warn('[ingest] Validating...');
  const issues = validateExploreDataset(dataset);
  if (issues.length > 0) {
    console.error(
      `[ingest] Validation failed with ${issues.length} issue(s) — nothing was written:`,
    );
    for (const issue of issues.slice(0, 30)) {
      console.error(`  [${issue.recordId}] ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.warn('[ingest] Persisting to Postgres...');
  const serviceClient: IngestClient = createClient<IngestSchema>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const persistStartedAt = Date.now();
  const persistResult = await persistDataset(serviceClient, dataset);
  const persistDurationMs = Date.now() - persistStartedAt;

  const totalDurationMs = Date.now() - startedAt;

  const audit = buildAuditReport({
    dataset,
    localizationNotes: result.localizationNotes,
    validationIssues: [],
  });
  console.warn('');
  console.warn(formatAuditReport(audit));
  console.warn('');
  console.warn('=== Performance ===');
  console.warn(`Upstream requests made (network, not cache hits): ${api.requestCount()}`);
  console.warn(`Fetch stage duration: ${(result.fetchDurationMs / 1000).toFixed(1)}s`);
  console.warn(
    `Persist stage duration: ${(persistDurationMs / 1000).toFixed(1)}s (${persistResult.batches} batch(es))`,
  );
  console.warn(`Total duration: ${(totalDurationMs / 1000).toFixed(1)}s`);
  console.warn(
    `Species upserted: ${persistResult.speciesUpserted}, forms upserted: ${persistResult.formsUpserted}`,
  );
}

main().catch((error: unknown) => {
  console.error('[ingest] Fatal error:', error);
  process.exitCode = 1;
});
