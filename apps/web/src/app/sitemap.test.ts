import { describe, expect, it } from 'vitest';

import { listAbilities, listSpecies, listMovesPage } from '@pokelab/database';
import { locales } from '@pokelab/i18n';

import { getPokemonDatabaseClient } from '@/lib/pokemon-database';

import sitemap from './sitemap';

/**
 * Proves the sitemap's URL count/shape against the real, fully-ingested
 * dataset (Phase 1C.3 §17/§24) — in particular that ability detail pages are
 * now included, and that no URL (species/move/ability slug) is ever
 * uppercase, which would create a second, duplicate-content indexable page
 * for the same entity (task §13/§17: "canonical Pokémon/Move/Ability
 * metadata must always use lowercase slug... do not add uppercase slug
 * variants").
 *
 * Requires a reachable Supabase instance seeded via full ingestion (normally
 * the Raspberry Pi, `pnpm ingest:pi` — CLAUDE.md §21). Skipped automatically
 * when the app's own Supabase env vars are not set (same gating convention
 * as `packages/database`'s `*.integration.test.ts`).
 */
const hasLocalSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

describe.skipIf(!hasLocalSupabase)('sitemap', () => {
  it('includes exactly 2 locales × (home + pokemon index + species + compare shell + moves index + moves + abilities index + abilities)', async () => {
    const client = getPokemonDatabaseClient();
    const [species, movesPage, abilities] = await Promise.all([
      listSpecies(client),
      listMovesPage(client, { page: 1, pageSize: 1000 }),
      listAbilities(client),
    ]);

    const entries = await sitemap();
    const expectedCount =
      locales.length *
      (1 + 1 + species.length + 1 + 1 + movesPage.totalCount + 1 + abilities.length);
    expect(entries.length).toBe(expectedCount);
  });

  it('includes the Compare shell but no per-comparison query-state URL (no sitemap cardinality explosion)', async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain('https://pokelab.com/en/compare');
    expect(urls).toContain('https://pokelab.com/es/compare');
    expect(urls.every((url) => !url.includes('compare?'))).toBe(true);
  });

  it('never contains an uppercase slug segment (no duplicate-case indexable pages)', async () => {
    const entries = await sitemap();
    for (const entry of entries) {
      expect(entry.url).toBe(entry.url.toLowerCase());
    }
  });

  it('contains no duplicate URLs', async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('includes ability detail pages for both locales', async () => {
    const entries = await sitemap();
    const urls = new Set(entries.map((entry) => entry.url));
    expect(urls.has('https://pokelab.com/en/abilities/overgrow')).toBe(true);
    expect(urls.has('https://pokelab.com/es/abilities/overgrow')).toBe(true);
    expect(urls.has('https://pokelab.com/en/abilities')).toBe(true);
  });
});
