import { describe, expect, it } from 'vitest';

import { createPublicDatabaseClient } from '../src/client';
import { getSpeciesBySlug, listSpecies } from '../src/queries';

/**
 * Proves the domain-shaped query layer against the real seeded Phase 1A
 * dataset (Bulbasaur/Rotom/Meowth) — in particular that the Rotom
 * meaningful-form model and the Meowth regional-form model come back
 * correctly through `listSpecies`/`getSpeciesBySlug` (Phase 1A Definition of
 * Done #10/#11).
 *
 * Requires a running local Supabase instance seeded via `db:reset`. Skipped
 * automatically when SUPABASE_URL is not set (see rls.integration.test.ts).
 */
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const hasLocalSupabase = Boolean(supabaseUrl && anonKey);

describe.skipIf(!hasLocalSupabase)('species/form queries against seeded data', () => {
  const client = () => createPublicDatabaseClient({ url: supabaseUrl!, anonKey: anonKey! });

  it('listSpecies returns all three seeded species with their default form', async () => {
    const species = await listSpecies(client());
    const slugs = species.map((s) => s.slug).sort();
    expect(slugs).toEqual(['bulbasaur', 'meowth', 'rotom']);

    const bulbasaur = species.find((s) => s.slug === 'bulbasaur')!;
    expect(bulbasaur.nationalDexNumber).toBe(1);
    expect(bulbasaur.name).toEqual({ en: 'Bulbasaur', es: 'Bulbasaur' });
    expect(bulbasaur.defaultForm.types).toEqual(['grass', 'poison']);

    // The default form shown on the index card must be the base/Kantonian
    // Meowth, not one of its regional forms.
    const meowth = species.find((s) => s.slug === 'meowth')!;
    expect(meowth.defaultForm.slug).toBe('meowth');
    expect(meowth.defaultForm.types).toEqual(['normal']);
  });

  it('getSpeciesBySlug returns null for an unknown slug', async () => {
    expect(await getSpeciesBySlug(client(), 'does-not-exist')).toBeNull();
  });

  it('Rotom is one species with six related forms, not separate species (Phase 1A DoD #10)', async () => {
    const rotom = await getSpeciesBySlug(client(), 'rotom');
    expect(rotom).not.toBeNull();
    expect(rotom!.name).toEqual({ en: 'Rotom', es: 'Rotom' });
    expect(rotom!.forms).toHaveLength(6);

    const bySlug = Object.fromEntries(rotom!.forms.map((f) => [f.slug, f]));
    expect(bySlug.rotom).toMatchObject({
      isDefault: true,
      category: 'default',
      types: ['electric', 'ghost'],
    });
    expect(bySlug['rotom-heat']).toMatchObject({
      isDefault: false,
      category: 'battle',
      types: ['electric', 'fire'],
    });
    expect(bySlug['rotom-wash']?.types).toEqual(['electric', 'water']);

    // All Rotom formes share base stats — only typing differs.
    for (const form of rotom!.forms) {
      expect(form.baseStats.hp).toBe(50);
    }
  });

  it('Meowth regional forms are related forms with their own types and stats (Phase 1A DoD #11)', async () => {
    const meowth = await getSpeciesBySlug(client(), 'meowth');
    expect(meowth).not.toBeNull();
    expect(meowth!.forms).toHaveLength(3);

    const bySlug = Object.fromEntries(meowth!.forms.map((f) => [f.slug, f]));
    expect(bySlug.meowth).toMatchObject({
      isDefault: true,
      category: 'default',
      types: ['normal'],
    });
    expect(bySlug['meowth-alola']).toMatchObject({
      isDefault: false,
      category: 'regional',
      types: ['dark'],
      name: { en: 'Alolan Meowth', es: 'Meowth de Alola' },
    });
    expect(bySlug['meowth-galar']).toMatchObject({
      isDefault: false,
      category: 'regional',
      types: ['steel'],
      name: { en: 'Galarian Meowth', es: 'Meowth de Galar' },
    });

    // Regional Meowth forms genuinely differ in base stats from Kantonian
    // Meowth — proves types/stats had to live on the form, not the species.
    expect(bySlug.meowth!.baseStats).not.toEqual(bySlug['meowth-alola']!.baseStats);
  });
});

describe.skipIf(hasLocalSupabase)('species/form queries (no local Supabase)', () => {
  it.skip('set SUPABASE_URL and SUPABASE_ANON_KEY against a running local Supabase instance to run this suite', () => {
    // See db:start in packages/database/package.json.
  });
});
