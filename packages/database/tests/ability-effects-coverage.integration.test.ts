import { describe, expect, it } from 'vitest';

import { abilityEffectsEs } from '@pokestudio/i18n';

import { createPublicDatabaseClient } from '../src/client';

/**
 * Proves the PokeStudio-owned Spanish ability-effect dataset
 * (packages/i18n/src/ability-effects-es.ts, Phase 1C.2b) actually covers
 * every real, currently-ingested ability — 313/313 against the live
 * dataset, not just an internal self-consistency check (see
 * packages/i18n/src/ability-effects-es.test.ts for that). "No orphan
 * keys" here means no translation key for an ability that doesn't (or no
 * longer) exists in the database — a stale/renamed slug would show up here.
 *
 * Requires a reachable Supabase instance seeded via full ingestion (normally the Raspberry Pi,
 * `pnpm ingest:pi` — CLAUDE.md §21). Skipped automatically when SUPABASE_URL is not set (see
 * rls.integration.test.ts).
 */
const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const hasLocalSupabase = Boolean(supabaseUrl && publishableKey);

describe.skipIf(!hasLocalSupabase)(
  'abilityEffectsEs coverage against the live ability table',
  () => {
    const client = () =>
      createPublicDatabaseClient({ url: supabaseUrl!, publishableKey: publishableKey! });

    it('translates every currently-ingested ability, with no orphan keys either way', async () => {
      const result = await client()
        .from('ability')
        .select('slug')
        .order('slug', { ascending: true });
      if (result.error) throw new Error(`ability slugs failed: ${result.error.message}`);

      const dbSlugs = new Set(result.data.map((row) => row.slug));
      const translatedSlugs = new Set(Object.keys(abilityEffectsEs));

      const missing = [...dbSlugs].filter((slug) => !translatedSlugs.has(slug));
      const orphaned = [...translatedSlugs].filter((slug) => !dbSlugs.has(slug));

      expect(missing, `abilities with no Spanish translation: ${missing.join(', ')}`).toEqual([]);
      expect(
        orphaned,
        `translation keys for abilities no longer in the database: ${orphaned.join(', ')}`,
      ).toEqual([]);
      expect(dbSlugs.size).toBe(313);
    });
  },
);

describe.skipIf(hasLocalSupabase)('abilityEffectsEs coverage (no local Supabase)', () => {
  it.skip('set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY against a reachable Supabase instance to run this suite', () => {
    // Normally the Raspberry Pi (pnpm db:pi:check) — see CLAUDE.md §21.
  });
});
