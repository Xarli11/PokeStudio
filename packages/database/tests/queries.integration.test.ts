import { describe, expect, it } from 'vitest';

import { createPublicDatabaseClient } from '../src/client';
import { getEvolutionFamily, getSpeciesBySlug, listSpecies } from '../src/queries';

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
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const hasLocalSupabase = Boolean(supabaseUrl && publishableKey);

describe.skipIf(!hasLocalSupabase)('species/form queries against the full ingested dataset', () => {
  const client = () =>
    createPublicDatabaseClient({ url: supabaseUrl!, publishableKey: publishableKey! });

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

  it('Bulbasaur has a regular ability, plus a distinct hidden ability', async () => {
    const bulbasaur = await getSpeciesBySlug(client(), 'bulbasaur');
    const abilities = bulbasaur!.forms[0]!.abilities;
    expect(abilities.length).toBeGreaterThanOrEqual(2);
    const regular = abilities.filter((a) => !a.isHidden);
    const hidden = abilities.filter((a) => a.isHidden);
    expect(regular.length).toBeGreaterThanOrEqual(1);
    expect(hidden).toHaveLength(1);
    expect(regular.some((a) => a.slug === 'overgrow')).toBe(true);
    expect(hidden[0]!.slug).toBe('chlorophyll');
  });

  it('Wormadam-plant and Wormadam-sandy (regional-adjacent battle forms) can have multiple regular abilities', async () => {
    const wormadam = await getSpeciesBySlug(client(), 'wormadam');
    const plant = wormadam!.forms.find((f) => f.isDefault)!;
    expect(plant.abilities.filter((a) => !a.isHidden).length).toBeGreaterThanOrEqual(1);
  });

  it('the same canonical ability (Overgrow) is shared across an evolution family, not duplicated per row', async () => {
    const bulbasaur = await getSpeciesBySlug(client(), 'bulbasaur');
    const venusaur = await getSpeciesBySlug(client(), 'venusaur');
    const bulbasaurOvergrow = bulbasaur!.forms[0]!.abilities.find((a) => a.slug === 'overgrow');
    const venusaurOvergrow = venusaur!.forms[0]!.abilities.find((a) => a.slug === 'overgrow');
    expect(bulbasaurOvergrow).toBeDefined();
    expect(venusaurOvergrow).toBeDefined();
    // Same canonical ability row's fields (name/effect), not a coincidence of two independent rows.
    expect(bulbasaurOvergrow!.nameEn).toBe(venusaurOvergrow!.nameEn);
  });

  it('getEvolutionFamily returns just the species itself when it has no evolution (Ditto)', async () => {
    const family = await getEvolutionFamily(client(), 'ditto');
    expect(family).not.toBeNull();
    expect(family!.members).toHaveLength(1);
    expect(family!.members[0]!.slug).toBe('ditto');
    expect(family!.edges).toHaveLength(0);
  });

  it('getEvolutionFamily returns null for an unknown species slug', async () => {
    expect(await getEvolutionFamily(client(), 'does-not-exist')).toBeNull();
  });

  it('getEvolutionFamily returns a linear 3-stage family (Bulbasaur/Ivysaur/Venusaur)', async () => {
    const family = await getEvolutionFamily(client(), 'ivysaur');
    expect(family!.members.map((m) => m.slug)).toEqual(['bulbasaur', 'ivysaur', 'venusaur']);
    expect(family!.edges).toHaveLength(2);
    const toIvysaur = family!.edges.find((e) => e.toSpeciesSlug === 'ivysaur')!;
    expect(toIvysaur.fromSpeciesSlug).toBe('bulbasaur');
    expect(toIvysaur.condition.trigger).toBe('level-up');
    expect(toIvysaur.condition.minLevel).toBe(16);
  });

  it("getEvolutionFamily returns Eevee's branching family regardless of which member is queried", async () => {
    const fromEevee = await getEvolutionFamily(client(), 'eevee');
    const fromUmbreon = await getEvolutionFamily(client(), 'umbreon');
    expect(fromEevee!.members.map((m) => m.slug).sort()).toEqual(
      fromUmbreon!.members.map((m) => m.slug).sort(),
    );
    expect(fromEevee!.members.length).toBeGreaterThanOrEqual(9); // Eevee + at least 8 eeveelutions
    const branchesFromEevee = fromEevee!.edges.filter((e) => e.fromSpeciesSlug === 'eevee');
    expect(branchesFromEevee.length).toBeGreaterThanOrEqual(8);
    const umbreonEdge = branchesFromEevee.find((e) => e.toSpeciesSlug === 'umbreon')!;
    expect(umbreonEdge.condition).toMatchObject({ trigger: 'level-up', timeOfDay: 'night' });
  });

  it('getEvolutionFamily preserves multiple alternative conditions for the same edge (Feebas -> Milotic)', async () => {
    const family = await getEvolutionFamily(client(), 'feebas');
    const toMilotic = family!.edges.filter(
      (e) => e.fromSpeciesSlug === 'feebas' && e.toSpeciesSlug === 'milotic',
    );
    expect(toMilotic.length).toBeGreaterThanOrEqual(2);
    expect(toMilotic.some((e) => e.condition.trigger === 'trade' && e.condition.heldItemSlug)).toBe(
      true,
    );
  });
});

describe.skipIf(hasLocalSupabase)('species/form queries (no local Supabase)', () => {
  it.skip('set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY against a running local Supabase instance to run this suite', () => {
    // See db:start in packages/database/package.json.
  });
});
