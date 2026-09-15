/**
 * Ingestion audit, without writing anything (Phase 1B §6).
 *
 * Runs the same fetch → normalize pipeline as `ingest.ts` but stops before
 * persistence — useful for reviewing classification/localization/validation
 * quality before (or without) touching the database. Reads from the
 * on-disk cache when `ingest`/a previous `audit` run already populated it,
 * so this does not need the network or a running Supabase instance.
 *
 * Run with: pnpm --filter @pokestudio/pokemon-data audit
 * Options:  --limit=N        only the first N species
 *           --concurrency=N  requests in flight per fetch phase (default 12)
 *           --no-cache       bypass the on-disk raw-response cache
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildAuditReport, formatAuditReport } from '../src/audit';
import { createFileCache } from '../src/cache';
import { createPokeApiClient } from '../src/pokeapi-client';
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

  const cacheDir = path.join(
    fileURLToPath(new URL('.', import.meta.url)),
    '..',
    '.cache',
    'pokeapi',
  );
  const cache = args.noCache ? undefined : createFileCache(cacheDir);
  const api = createPokeApiClient({ cache });

  console.warn('[audit] Fetching + normalizing (species -> varieties -> forms)...');
  const result = await fetchAndNormalize(api, { limit: args.limit, concurrency: args.concurrency });

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
    abilities: result.abilities,
    formAbilities: result.formAbilities,
    evolutions: result.evolutions,
    moves: result.moves,
    versionGroups: result.versionGroups,
    learnMethods: result.learnMethods,
    learnsetEntries: result.learnsetEntries,
    machines: result.machines,
    natures: result.natures,
    items: result.items,
  };

  const issues = validateExploreDataset(dataset);
  const audit = buildAuditReport({
    dataset,
    localizationNotes: result.localizationNotes,
    validationIssues: issues,
  });

  console.warn('');
  console.warn(formatAuditReport(audit));
  if (result.normalizationFailures.length > 0) {
    console.warn('');
    console.warn(`Normalization failures: ${result.normalizationFailures.length}`);
    for (const failure of result.normalizationFailures.slice(0, 20)) {
      console.warn(`  [${failure.speciesName}] ${failure.error}`);
    }
  }
  console.warn('');
  console.warn(`Upstream requests made (network, not cache hits): ${api.requestCount()}`);
  console.warn(`Fetch duration: ${(result.fetchDurationMs / 1000).toFixed(1)}s`);

  if (issues.length > 0 || result.normalizationFailures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('[audit] Fatal error:', error);
  process.exitCode = 1;
});
