/**
 * Full Pokédex ingestion (Phase 1B).
 *
 * upstream (PokéAPI, cached) → fetch → normalize → validate → persist (Postgres)
 *
 * Fetches every supported species and every form under it (varieties +
 * cosmetic sub-forms), normalizes into the PokeLab species/form model
 * (ADR-0010), validates dataset invariants, and upserts into Postgres by
 * upstream identity (idempotent — safe to re-run). Prints a classification
 * audit and performance report on completion.
 *
 * Run with: pnpm --filter @pokelab/pokemon-data ingest
 * Options:  --limit=N        only the first N species (fast dev iteration)
 *           --concurrency=N  requests in flight per fetch phase (default 12)
 *           --no-cache       bypass the on-disk raw-response cache
 *
 * Requires SUPABASE_URL and SUPABASE_SECRET_KEY (the secret key bypasses
 * RLS — only publishable/anon reads are allowed on these tables otherwise,
 * and ingestion writes need to bypass that, same as any other write path in
 * this repo, docs/engineering/SECURITY.md). Accepts either Supabase's current secret-key
 * format (`sb_secret_...`) or a legacy `service_role` JWT — both are valid
 * bearer tokens here; see docs/engineering/DATABASE.md "Supabase API keys".
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import { buildAuditReport, formatAuditReport } from '../src/audit';
import { createFileCache } from '../src/cache';
import { withIngestLock } from '../src/ingest-lock';
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

/**
 * Describes the *shape* of a Supabase key for a diagnostic log line —
 * never the key itself. Helps catch a misconfigured/wrong-format key (the
 * "Invalid API key" failure this script exists to avoid) before spending a
 * fetch/normalize pass finding out at the persist step.
 */
function describeKeySecretShape(key: string): string {
  if (key.startsWith('sb_secret_')) return 'modern secret key (sb_secret_...)';
  if (key.startsWith('sb_publishable_')) return 'publishable key (wrong key type for ingestion!)';
  if (key.startsWith('eyJ')) return 'legacy JWT (service_role, presumably)';
  return 'unrecognized format';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();

  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    console.error(
      '[ingest] Missing SUPABASE_URL / SUPABASE_SECRET_KEY.\n' +
        '  Normal development targets the Raspberry Pi — run: pnpm ingest:pi\n' +
        '  (see CLAUDE.md §21 "Local Development Database" and .env.example).',
    );
    process.exitCode = 1;
    return;
  }
  console.warn(`[ingest] Using ${describeKeySecretShape(secretKey)} for ${supabaseUrl}`);

  await withIngestLock(process.env.INGEST_LOCK_DB_URL, () =>
    runIngest(supabaseUrl, secretKey, args, startedAt),
  );
}

async function runIngest(
  supabaseUrl: string,
  secretKey: string,
  args: ReturnType<typeof parseArgs>,
  startedAt: number,
): Promise<void> {
  const cacheDir = path.join(
    fileURLToPath(new URL('.', import.meta.url)),
    '..',
    '.cache',
    'pokeapi',
  );
  const cache = args.noCache ? undefined : createFileCache(cacheDir);
  const api = createPokeApiClient({ cache });

  console.warn(
    '[ingest] Fetching + normalizing (species -> varieties -> forms -> abilities/evolution chains)...',
  );
  const result = await fetchAndNormalize(api, { limit: args.limit, concurrency: args.concurrency });
  console.warn(
    `[ingest]   ${result.species.length} species, ${result.varietyCount} varieties, ${result.formJobCount} forms, ` +
      `${result.abilities.length} abilities, ${result.evolutions.length} evolution edges.`,
  );
  console.warn(
    `[ingest]   ${result.moves.length} moves, ${result.versionGroups.length} version groups, ` +
      `${result.learnMethods.length} learn methods, ${result.learnsetEntries.length} learnset entries, ` +
      `${result.machines.length} machines.`,
  );
  console.warn(`[ingest]   ${result.natures.length} natures, ${result.items.length} held items.`);

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
  const serviceClient: IngestClient = createClient<IngestSchema>(supabaseUrl, secretKey, {
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
  console.warn(
    `Abilities upserted: ${persistResult.abilitiesUpserted}, form/ability links written: ` +
      `${persistResult.formAbilitiesWritten}, evolution edges written: ${persistResult.evolutionsWritten}`,
  );
  console.warn(
    `Moves upserted: ${persistResult.movesUpserted}, version groups upserted: ${persistResult.versionGroupsUpserted}, ` +
      `learn methods upserted: ${persistResult.learnMethodsUpserted}, learnset entries written: ` +
      `${persistResult.learnsetEntriesWritten}, machines upserted: ${persistResult.machinesUpserted}, ` +
      `move stat changes written: ${persistResult.moveStatChangesWritten}`,
  );
  console.warn(
    `Natures upserted: ${persistResult.naturesUpserted}, items upserted: ${persistResult.itemsUpserted}`,
  );
}

main().catch((error: unknown) => {
  console.error('[ingest] Fatal error:', error);
  process.exitCode = 1;
});
