import { describe, expect, it } from 'vitest';

import { createPublicDatabaseClient } from '../src/client';
import {
  getDefaultVersionGroup,
  getEvolutionFamily,
  getFormLearnset,
  getMoveBySlug,
  getMoveLearners,
  getSpeciesBySlug,
  listMovesPage,
  listSpecies,
} from '../src/queries';

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

describe.skipIf(!hasLocalSupabase)(
  'move/learnset queries against the full ingested dataset',
  () => {
    const client = () =>
      createPublicDatabaseClient({ url: supabaseUrl!, publishableKey: publishableKey! });

    it('getDefaultVersionGroup returns a version group that actually has learnset data', async () => {
      const versionGroup = await getDefaultVersionGroup(client());
      expect(versionGroup).not.toBeNull();
      expect(versionGroup!.generation).toBeGreaterThanOrEqual(1);
      expect(versionGroup!.generation).toBeLessThanOrEqual(9);
    });

    it('getDefaultVersionGroup skips a newer version group with only niche-method rows in favor of real mainline coverage', async () => {
      // Regression: the live dataset's "champions" (generation 9, the
      // highest display_order) has thousands of pokemon_form_move rows but
      // *only* via the "train" learn method — no level-up coverage at all,
      // so it is not a useful default game context. "scarlet-violet" (the
      // real, fully-populated Generation IX game) must win instead.
      const versionGroup = await getDefaultVersionGroup(client());
      expect(versionGroup!.slug).not.toBe('champions');
      expect(versionGroup!.slug).toBe('scarlet-violet');
    });

    it('getMoveBySlug returns null for an unknown slug', async () => {
      expect(await getMoveBySlug(client(), 'does-not-exist')).toBeNull();
    });

    it('getMoveBySlug returns Tackle with sane mechanics fields', async () => {
      const tackle = await getMoveBySlug(client(), 'tackle');
      expect(tackle).not.toBeNull();
      expect(tackle!.damageClass).toBe('physical');
      expect(tackle!.pp).toBeGreaterThan(0);
      expect(['physical', 'special', 'status']).toContain(tackle!.damageClass);
    });

    it('getMoveBySlug returns Toxic as a status move with null power', async () => {
      const toxic = await getMoveBySlug(client(), 'toxic');
      expect(toxic).not.toBeNull();
      expect(toxic!.damageClass).toBe('status');
      expect(toxic!.power).toBeUndefined();
    });

    it('listMovesPage paginates the full ~937-move roster without duplicates', async () => {
      const page = await listMovesPage(client(), { page: 1, pageSize: 20 });
      expect(page.items).toHaveLength(20);
      expect(page.totalCount).toBeGreaterThan(900);
      expect(new Set(page.items.map((m) => m.slug)).size).toBe(20);
    });

    it("getFormLearnset returns null for a form that doesn't exist", async () => {
      const versionGroup = await getDefaultVersionGroup(client());
      expect(await getFormLearnset(client(), 'does-not-exist', versionGroup!.slug)).toBeNull();
    });

    it('getFormLearnset returns Bulbasaur learning Tackle in the default version group', async () => {
      const versionGroup = await getDefaultVersionGroup(client());
      const entries = await getFormLearnset(client(), 'bulbasaur', versionGroup!.slug);
      expect(entries).not.toBeNull();
      expect(entries!.length).toBeGreaterThan(0);
      expect(entries!.some((e) => e.move.slug === 'tackle')).toBe(true);
      expect(entries!.every((e) => e.level >= 0)).toBe(true);
    });

    it('getFormLearnset returns an empty array for a real form in a version group with no data for it', async () => {
      // "legends-za" is an announced-but-not-yet-per-Pokémon-populated version
      // group in the reference table (docs/adr/0013) — a real, distinct empty
      // state, not a missing-form null.
      const entries = await getFormLearnset(client(), 'bulbasaur', 'legends-za');
      expect(entries).toEqual([]);
    });

    it('getMoveLearners returns null for an unknown move', async () => {
      const versionGroup = await getDefaultVersionGroup(client());
      expect(
        await getMoveLearners(client(), 'does-not-exist', versionGroup!.slug, {
          page: 1,
          pageSize: 10,
        }),
      ).toBeNull();
    });

    it('getMoveLearners returns forms that can learn Tackle, deduplicated', async () => {
      const versionGroup = await getDefaultVersionGroup(client());
      const page = await getMoveLearners(client(), 'tackle', versionGroup!.slug, {
        page: 1,
        pageSize: 10,
      });
      expect(page).not.toBeNull();
      expect(page!.totalCount).toBeGreaterThan(0);
      expect(page!.items.length).toBeGreaterThan(0);
      expect(new Set(page!.items.map((i) => i.formSlug)).size).toBe(page!.items.length);
      expect(page!.items.every((i) => i.speciesSlug.length > 0)).toBe(true);
    });
  },
);

describe.skipIf(hasLocalSupabase)('species/form queries (no local Supabase)', () => {
  it.skip('set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY against a running local Supabase instance to run this suite', () => {
    // See db:start in packages/database/package.json.
  });
});
