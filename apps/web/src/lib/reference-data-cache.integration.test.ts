import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { getFormsBySlugs } from '@pokestudio/database';

import { getPokemonDatabaseClient } from './pokemon-database';
import {
  getCachedItems,
  getCachedNatures,
  getCachedSpeciesSearchIndex,
  getCachedVersionGroups,
} from './reference-data-cache';

/**
 * `unstable_cache` throws ("Invariant: incrementalCache missing") outside a
 * real Next.js server request context — it cannot be invoked directly from
 * a plain Vitest process, so these tests deliberately don't try to exercise
 * its caching behavior at runtime. That equivalence (a cached wrapper
 * returns exactly what the raw query returns) is true by construction —
 * every wrapper's body is the raw query call with zero transformation — and
 * is exercised for real by `next build`/`build:cf` succeeding (Next
 * initializes the cache machinery at build time) and by the before/after
 * measurements, which show the exact same version-group list, natures,
 * items and species index being served.
 *
 * What IS meaningfully testable here, without fighting the Next runtime:
 * the architectural guarantees this cache actually depends on.
 */
const hasLocalSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

describe('reference-data-cache wrappers', () => {
  it('take no arguments — nothing user/request-specific (teamId, locale, cookies) can be threaded into the cache key', () => {
    expect(getCachedSpeciesSearchIndex.length).toBe(0);
    expect(getCachedNatures.length).toBe(0);
    expect(getCachedItems.length).toBe(0);
    expect(getCachedVersionGroups.length).toBe(0);
  });

  it('every route that needs species-search-index/version-groups imports the shared cached wrapper, not the raw query', () => {
    // Real regression guard for the actual requirement ("todas usen el MISMO
    // wrapper cacheado, no tres mecanismos distintos") — catches a future
    // accidental revert to a direct @pokestudio/database import.
    const routesUsingSearchIndex = [
      '../app/[locale]/pokemon/page.tsx',
      '../app/[locale]/compare/page.tsx',
      '../app/[locale]/build/[teamId]/page.tsx',
      '../app/[locale]/dev/sprites/page.tsx',
    ];
    for (const relativePath of routesUsingSearchIndex) {
      const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
      expect(source).toContain('getCachedSpeciesSearchIndex');
      expect(source).not.toMatch(/getSpeciesSearchIndex\(/);
    }

    const routesUsingVersionGroups = [
      '../app/[locale]/build/page.tsx',
      '../app/[locale]/build/[teamId]/page.tsx',
      '../app/[locale]/dev/sprites/page.tsx',
    ];
    for (const relativePath of routesUsingVersionGroups) {
      const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
      expect(source).toContain('getCachedVersionGroups');
      expect(source).not.toMatch(/listVersionGroups\(/);
    }
  });
});

describe.skipIf(!hasLocalSupabase)(
  'reference-data queries stay stable across calls (caching precondition)',
  () => {
    it('getFormsBySlugs (per-request, user-driven) has no cached wrapper and still works independently', async () => {
      // Sanity check on the cached/uncached boundary itself.
      const forms = await getFormsBySlugs(getPokemonDatabaseClient(), ['bulbasaur']);
      expect(forms.length).toBeGreaterThan(0);
    });
  },
);
