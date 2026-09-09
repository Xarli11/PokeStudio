import { describe, expect, it } from 'vitest';

import { createPublicDatabaseClient } from '../src/client';
import { getSpeciesBySlug, listSpecies } from '../src/queries';

/**
 * Proves the domain-shaped query layer against the real, fully-ingested
 * Pokédex (Phase 1B — `pnpm --filter @pokestudio/pokemon-data ingest`),
 * not just the Phase 1A 3-species sample. In particular that `listSpecies`
 * doesn't silently truncate past PostgREST's default 1000-row page (found
 * during full ingestion — see `packages/pokemon-data/src/persist.ts`), and
 * that representative full-dataset edge cases (Rotom's battle forms,
 * Meowth's regional forms, Alcremie's 64-form cosmetic family, Xerneas'
 * two-state default-form quirk) come back correctly.
 *
 * Requires a running local Supabase instance seeded via full ingestion.
 * Skipped automatically when SUPABASE_URL is not set (see rls.integration.test.ts).
 */
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const hasLocalSupabase = Boolean(supabaseUrl && anonKey);

describe.skipIf(!hasLocalSupabase)('species/form queries against the full ingested dataset', () => {
  const client = () => createPublicDatabaseClient({ url: supabaseUrl!, anonKey: anonKey! });

  it('listSpecies returns the full species list, past the 1000-row PostgREST page cap', async () => {
    const species = await listSpecies(client());
    // The exact count grows as PokéAPI adds species — assert "a real full
    // dataset", not a magic number, but specifically confirm we're past the
    // page-cap threshold that exposed the pagination bug.
    expect(species.length).toBeGreaterThan(1000);
    expect(new Set(species.map((s) => s.slug)).size).toBe(species.length); // no duplicates
  });

  it('every species in the list has a default form with 1-2 types and 6 base stats', async () => {
    const species = await listSpecies(client());
    for (const item of species) {
      expect(item.defaultForm.types.length).toBeGreaterThanOrEqual(1);
      expect(item.defaultForm.types.length).toBeLessThanOrEqual(2);
      expect(Object.keys(item.defaultForm.baseStats)).toHaveLength(6);
    }
  });

  it('getSpeciesBySlug returns null for an unknown slug', async () => {
    expect(await getSpeciesBySlug(client(), 'does-not-exist')).toBeNull();
  });

  it('Rotom is one species with six related forms (Phase 1A/1B invariant, still holds at scale)', async () => {
    const rotom = await getSpeciesBySlug(client(), 'rotom');
    expect(rotom!.forms).toHaveLength(6);
    const heat = rotom!.forms.find((f) => f.slug === 'rotom-heat')!;
    expect(heat.category).toBe('battle');
    expect(heat.types).toEqual(['electric', 'fire']);
  });

  it('Meowth regional forms keep their own types/stats', async () => {
    const meowth = await getSpeciesBySlug(client(), 'meowth');
    const alola = meowth!.forms.find((f) => f.slug === 'meowth-alola')!;
    expect(alola.category).toBe('regional');
    expect(alola.types).toEqual(['dark']);
  });

  it('Alcremie — an unusually large cosmetic form family — returns intact', async () => {
    const alcremie = await getSpeciesBySlug(client(), 'alcremie');
    expect(alcremie).not.toBeNull();
    expect(alcremie!.forms.length).toBeGreaterThan(50);
    expect(alcremie!.forms.filter((f) => f.isDefault)).toHaveLength(1);
    // Cosmetic sub-forms share the same types/stats as the default form.
    const defaultForm = alcremie!.forms.find((f) => f.isDefault)!;
    const cosmeticForm = alcremie!.forms.find((f) => !f.isDefault)!;
    expect(cosmeticForm.types).toEqual(defaultForm.types);
    expect(cosmeticForm.baseStats).toEqual(defaultForm.baseStats);
  });

  it('Xerneas resolves its true default form despite neither form matching the species name', async () => {
    // Regression case for the pickPrimaryForm bug found during full
    // ingestion: PokéAPI's forms are "xerneas-active"/"xerneas-neutral",
    // neither named plain "xerneas"; only "neutral" is the real default.
    const xerneas = await getSpeciesBySlug(client(), 'xerneas');
    expect(xerneas!.forms).toHaveLength(2);
    const defaultForm = xerneas!.forms.find((f) => f.isDefault)!;
    expect(defaultForm.slug).toBe('xerneas-neutral');
    const active = xerneas!.forms.find((f) => f.slug === 'xerneas-active')!;
    expect(active.category).toBe('battle');
    expect(active.isDefault).toBe(false);
  });
});

describe.skipIf(hasLocalSupabase)('species/form queries (no local Supabase)', () => {
  it.skip('set SUPABASE_URL and SUPABASE_ANON_KEY against a running local Supabase instance to run this suite', () => {
    // See db:start in packages/database/package.json.
  });
});
