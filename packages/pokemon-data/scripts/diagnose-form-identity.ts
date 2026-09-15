/**
 * pokemon_form identity health check — read-only, writes nothing.
 *
 * Built for a suspected "external_id drift" issue
 * (docs/engineering/DATA_SOURCES.md "pokemon_form external_id drift") that
 * turned out to be a false alarm: the original audit compared PokéAPI's
 * `pokemon` (variety) resource id against this project's stored
 * `pokemon_form.external_id`, which has always come from the distinct
 * `pokemon-form` resource id instead. Once compared correctly (as this
 * script does, via the real ingestion pipeline), there was no drift at
 * all — confirmed 2026-09-16 against the live Pi data. Kept as a reusable
 * health check for the next time this is worth re-verifying (e.g. before
 * a Cloud DEV ingestion, or after a large upstream PokéAPI content drop).
 *
 * Fetches the current upstream PokéAPI dataset (same fetch → normalize
 * pipeline `ingest.ts`/`audit.ts` use) and compares it against the current
 * Pi `pokemon_form` rows by slug, reporting — without writing anything:
 *
 * - how many existing rows' external_id has drifted upstream (same slug,
 *   different external_id) — note: current ingestion upserts on
 *   `(source_id, external_id)`, so a real drift here would make the next
 *   ingest INSERT a duplicate row rather than update the existing one;
 *   this script only detects that risk, it does not change how ingestion
 *   resolves it
 * - how many are already settled (external_id unchanged)
 * - how many are genuinely NEW upstream forms (no matching slug at all)
 * - how many currently-stored rows are missing from the fresh fetch
 *   (expected ~0 — PokéAPI has never removed content this project has
 *   observed)
 * - whether the freshly fetched dataset itself has any slug collisions
 *   (it shouldn't — `pokemon_form.slug` is already a real UNIQUE
 *   constraint — but this would surface it clearly if it ever did)
 *
 * Run with: pnpm --filter @pokestudio/pokemon-data diagnose-form-identity
 * Options:  --limit=N        only the first N species (fast dev iteration)
 *           --concurrency=N  requests in flight per fetch phase (default 12)
 * Always bypasses the on-disk cache — the whole point is comparing against
 * *today's* upstream state, not a stale cached one.
 *
 * Requires SUPABASE_URL / SUPABASE_SECRET_KEY (read-only use of the secret
 * key here — no writes — same env convention as ingest.ts).
 */
import { createClient } from '@supabase/supabase-js';

import { createPokeApiClient } from '../src/pokeapi-client';
import { fetchAndNormalize } from '../src/pipeline';
import type { IngestClient, IngestSchema } from '../src/persist';

function parseArgs(argv: string[]) {
  const limitFlag = argv.find((arg) => arg.startsWith('--limit='));
  const concurrencyFlag = argv.find((arg) => arg.startsWith('--concurrency='));
  return {
    limit: limitFlag ? Number.parseInt(limitFlag.split('=')[1]!, 10) : undefined,
    concurrency: concurrencyFlag ? Number.parseInt(concurrencyFlag.split('=')[1]!, 10) : 12,
  };
}

const PAGE_SIZE = 1000;

async function selectAllPokemonForms(
  client: IngestClient,
): Promise<{ slug: string; external_id: string }[]> {
  const rows: { slug: string; external_id: string }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await client
      .from('pokemon_form')
      .select('slug, external_id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    console.error(
      '[diagnose-form-identity] Missing SUPABASE_URL / SUPABASE_SECRET_KEY.\n' +
        '  Normal development targets the Raspberry Pi (CLAUDE.md §21).',
    );
    process.exitCode = 1;
    return;
  }

  const client: IngestClient = createClient<IngestSchema>(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.warn('[diagnose-form-identity] Reading current pokemon_form rows from Pi...');
  const existingRows = await selectAllPokemonForms(client);
  const existingBySlug = new Map(existingRows.map((row) => [row.slug, row.external_id]));

  console.warn(
    '[diagnose-form-identity] Fetching + normalizing fresh upstream data (no cache — this is the whole point)...',
  );
  const api = createPokeApiClient({}); // no cache option passed → always network, never disk
  const result = await fetchAndNormalize(api, { limit: args.limit, concurrency: args.concurrency });

  const freshSlugs = new Set<string>();
  const slugCollisions: string[] = [];
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  const sampleUpdated: { slug: string; from: string; to: string }[] = [];

  for (const form of result.forms) {
    if (freshSlugs.has(form.slug)) slugCollisions.push(form.slug);
    freshSlugs.add(form.slug);

    const existingExternalId = existingBySlug.get(form.slug);
    if (existingExternalId === undefined) {
      newCount++;
    } else if (existingExternalId !== form.source.externalId) {
      updatedCount++;
      if (sampleUpdated.length < 15) {
        sampleUpdated.push({
          slug: form.slug,
          from: existingExternalId,
          to: form.source.externalId,
        });
      }
    } else {
      unchangedCount++;
    }
  }

  const missingUpstream = existingRows.filter((row) => !freshSlugs.has(row.slug));

  console.warn('');
  console.warn('=== pokemon_form identity diagnostic ===');
  console.warn(`Current Pi rows:        ${existingRows.length}`);
  console.warn(`Freshly fetched forms:  ${result.forms.length}`);
  console.warn(`  -> unchanged:         ${unchangedCount}`);
  console.warn(`  -> will UPDATE:       ${updatedCount} (external_id drifted, same slug)`);
  console.warn(`  -> genuinely NEW:     ${newCount} (no matching slug in Pi yet)`);
  console.warn(
    `Missing upstream:       ${missingUpstream.length} (Pi rows absent from the fresh fetch)`,
  );
  console.warn(`Slug collisions in fresh dataset: ${slugCollisions.length} (must be 0)`);
  if (sampleUpdated.length > 0) {
    console.warn('');
    console.warn('Sample of drifted external_ids:');
    for (const entry of sampleUpdated) {
      console.warn(`  ${entry.slug}: ${entry.from} -> ${entry.to}`);
    }
  }
  if (missingUpstream.length > 0) {
    console.warn('');
    console.warn('Rows missing from the fresh fetch (first 15):');
    for (const row of missingUpstream.slice(0, 15)) {
      console.warn(`  ${row.slug} (external_id ${row.external_id})`);
    }
  }
  if (slugCollisions.length > 0) {
    console.error('');
    console.error('FATAL: the freshly fetched dataset has internal slug collisions — this');
    console.error('breaks the comparison in this script and would violate the existing');
    console.error('pokemon_form.slug UNIQUE constraint on ingest. Investigate before ingesting.');
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('[diagnose-form-identity] Fatal error:', error);
  process.exitCode = 1;
});
