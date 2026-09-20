import { describe, expect, it } from 'vitest';

import { createPublicDatabaseClient } from '../src/client';
import {
  getAbilityBySlug,
  getDefaultVersionGroup,
  getEvolutionFamily,
  getFormLearnsetAllVersionGroups,
  getFormsBySlugs,
  getMoveBySlug,
  getMoveLearners,
  getPokemonForAbility,
  getSpeciesBySlug,
  getSpeciesSearchIndex,
  listAbilities,
  listItems,
  listMovesPage,
  listNatures,
  listSpecies,
  listVersionGroups,
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
 * Requires a reachable Supabase instance seeded via full ingestion (normally the Raspberry Pi,
 * `pnpm ingest:pi` — CLAUDE.md §21). Skipped automatically when SUPABASE_URL is not set (see
 * rls.integration.test.ts).
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

    it('listVersionGroups returns every real version group newest-first, excluding "champions" (niche-method only)', async () => {
      const versionGroups = await listVersionGroups(client());
      expect(versionGroups.length).toBeGreaterThan(1);
      expect(versionGroups.map((vg) => vg.slug)).not.toContain('champions');
      expect(versionGroups[0]!.slug).toBe('scarlet-violet');
      for (let i = 1; i < versionGroups.length; i++) {
        const prev = versionGroups[i - 1]!;
        const curr = versionGroups[i]!;
        expect(prev.generation * 1000 + prev.displayOrder).toBeGreaterThanOrEqual(
          curr.generation * 1000 + curr.displayOrder,
        );
      }
    });

    // Fase 2A perf (version_group_with_learnset_data view, migration
    // 20260920213419): the three real cases the view's `EXISTS` filter must
    // tell apart, all present in the live dataset rather than seeded —
    // "champions" already covers "has rows, but none via level-up" above;
    // "the-crown-tundra" (a real DLC pack with zero pokemon_form_move rows
    // at all, not yet ingested at the moves level) covers "no rows
    // whatsoever"; "scarlet-violet" covers the real, included case.
    it('listVersionGroups excludes a version group with zero pokemon_form_move rows at all', async () => {
      const versionGroups = await listVersionGroups(client());
      expect(versionGroups.map((vg) => vg.slug)).not.toContain('the-crown-tundra');
    });

    it('listVersionGroups includes a real version group with level-up rows', async () => {
      const versionGroups = await listVersionGroups(client());
      expect(versionGroups.map((vg) => vg.slug)).toContain('scarlet-violet');
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

    it("getMoveBySlug returns Growl's exact stat change (-1 Attack), not a vague description", async () => {
      const growl = await getMoveBySlug(client(), 'growl');
      expect(growl).not.toBeNull();
      expect(growl!.statChanges).toEqual([{ stat: 'attack', change: -1 }]);
    });

    it("getMoveBySlug returns Shell Smash's 5 stat changes in PokéAPI's original order", async () => {
      const shellSmash = await getMoveBySlug(client(), 'shell-smash');
      expect(shellSmash).not.toBeNull();
      expect(shellSmash!.statChanges).toEqual([
        { stat: 'defense', change: -1 },
        { stat: 'special-defense', change: -1 },
        { stat: 'attack', change: 2 },
        { stat: 'special-attack', change: 2 },
        { stat: 'speed', change: 2 },
      ]);
    });

    it('getMoveBySlug returns an empty statChanges array for a move with no stat effect', async () => {
      const tackle = await getMoveBySlug(client(), 'tackle');
      expect(tackle).not.toBeNull();
      expect(tackle!.statChanges).toEqual([]);
    });

    it('listMovesPage paginates the full ~937-move roster without duplicates', async () => {
      const page = await listMovesPage(client(), { page: 1, pageSize: 20 });
      expect(page.items).toHaveLength(20);
      expect(page.totalCount).toBeGreaterThan(900);
      expect(new Set(page.items.map((m) => m.slug)).size).toBe(20);
    });

    it("getFormLearnsetAllVersionGroups returns null for a form that doesn't exist", async () => {
      expect(await getFormLearnsetAllVersionGroups(client(), 'does-not-exist')).toBeNull();
    });

    it('getFormLearnsetAllVersionGroups returns Bulbasaur learning Tackle, with moves/version-groups normalized (not repeated per entry)', async () => {
      const result = await getFormLearnsetAllVersionGroups(client(), 'bulbasaur');
      expect(result).not.toBeNull();
      expect(result!.entries.length).toBeGreaterThan(0);
      expect(result!.entries.every((e) => e.level >= 0)).toBe(true);
      expect(result!.moves.some((m) => m.slug === 'tackle')).toBe(true);
      expect(result!.versionGroups.some((vg) => vg.slug === 'scarlet-violet')).toBe(true);
      // Normalized, not duplicated: each move/version-group appears exactly
      // once in its own array regardless of how many entries reference it.
      expect(new Set(result!.moves.map((m) => m.slug)).size).toBe(result!.moves.length);
      expect(new Set(result!.versionGroups.map((vg) => vg.slug)).size).toBe(
        result!.versionGroups.length,
      );
      // Every entry references a real move/version-group from the normalized arrays.
      const moveSlugs = new Set(result!.moves.map((m) => m.slug));
      const versionGroupSlugs = new Set(result!.versionGroups.map((vg) => vg.slug));
      expect(result!.entries.every((e) => moveSlugs.has(e.moveSlug))).toBe(true);
      expect(result!.entries.every((e) => versionGroupSlugs.has(e.versionGroupSlug))).toBe(true);
      // Newest-first.
      for (let i = 1; i < result!.versionGroups.length; i++) {
        const prev = result!.versionGroups[i - 1]!;
        const curr = result!.versionGroups[i]!;
        const prevRank = prev.generation * 1000 + prev.displayOrder;
        const currRank = curr.generation * 1000 + curr.displayOrder;
        expect(prevRank).toBeGreaterThanOrEqual(currRank);
      }
    });

    it('getFormLearnsetAllVersionGroups pages past the 1000-row PostgREST cap (Mew: 2700+ raw rows across all version groups)', async () => {
      const result = await getFormLearnsetAllVersionGroups(client(), 'mew');
      expect(result).not.toBeNull();
      expect(result!.entries.length).toBeGreaterThan(1000);
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

    it('listMovesPage filters by search text (case-insensitive substring, either locale)', async () => {
      const page = await listMovesPage(client(), {
        page: 1,
        pageSize: 20,
        filters: { search: 'thunder' },
      });
      expect(page.totalCount).toBeGreaterThan(0);
      expect(page.items.every((m) => m.nameEn.toLowerCase().includes('thunder'))).toBe(true);
    });

    it('listMovesPage filters by type', async () => {
      const page = await listMovesPage(client(), {
        page: 1,
        pageSize: 50,
        filters: { type: 'electric' },
      });
      expect(page.totalCount).toBeGreaterThan(0);
      expect(page.items.every((m) => m.type === 'electric')).toBe(true);
    });

    it('listMovesPage filters by damage class', async () => {
      const page = await listMovesPage(client(), {
        page: 1,
        pageSize: 50,
        filters: { damageClass: 'status' },
      });
      expect(page.totalCount).toBeGreaterThan(0);
      expect(page.items.every((m) => m.damageClass === 'status')).toBe(true);
    });

    it('listMovesPage sorts by power descending', async () => {
      const page = await listMovesPage(client(), {
        page: 1,
        pageSize: 20,
        filters: { sortBy: 'power', sortDirection: 'desc' },
      });
      const powers = page.items.map((m) => m.power ?? 0);
      for (let i = 1; i < powers.length; i++) {
        expect(powers[i - 1]!).toBeGreaterThanOrEqual(powers[i]!);
      }
    });
  },
);

describe.skipIf(!hasLocalSupabase)(
  'ability/search-index queries against the full ingested dataset (Phase 1C.3)',
  () => {
    const client = () =>
      createPublicDatabaseClient({ url: supabaseUrl!, publishableKey: publishableKey! });

    it('getSpeciesSearchIndex returns every species plus every non-default form as an alias', async () => {
      const index = await getSpeciesSearchIndex(client());
      expect(index.items.length).toBeGreaterThan(1000);
      expect(new Set(index.items.map((i) => i.slug)).size).toBe(index.items.length);
      expect(index.items.every((i) => i.types.length >= 1 && i.types.length <= 2)).toBe(true);
      // Meowth's regional forms ("Alolan Meowth", "Galarian Meowth") must resolve back to
      // the species "meowth", never become their own index entries (task §6).
      const meowthAliases = index.aliases.filter((a) => a.speciesSlug === 'meowth');
      expect(meowthAliases.length).toBeGreaterThanOrEqual(2);
      expect(index.items.some((i) => i.slug === 'meowth-alola')).toBe(false);
      // Every alias carries its own form's types (Search UX v2 §2), not the
      // default form's — needed to honestly caption a form-match card.
      expect(index.aliases.every((a) => a.types.length >= 1 && a.types.length <= 2)).toBe(true);
      // Base stats (Milestone 2, Stage 2A — Explore Pro stat sorting) are
      // present and real (never all-zero/placeholder) for every item.
      const bulbasaur = index.items.find((i) => i.slug === 'bulbasaur');
      expect(bulbasaur?.baseStats).toEqual({
        hp: 45,
        attack: 49,
        defense: 49,
        specialAttack: 65,
        specialDefense: 65,
        speed: 45,
      });
      // Form-level identity (Milestone 2, Stage 2A — Compare): every item
      // and alias carries its own form's stable slug, not just the species'.
      expect(bulbasaur?.formSlug).toBe('bulbasaur');
      expect(meowthAliases.every((a) => a.formSlug.length > 0)).toBe(true);
      expect(new Set(meowthAliases.map((a) => a.formSlug)).size).toBe(meowthAliases.length);
    });

    it('getFormsBySlugs resolves distinct forms of the same species independently (Meowth vs Alolan Meowth)', async () => {
      const forms = await getFormsBySlugs(client(), ['meowth', 'meowth-alola']);
      expect(forms).toHaveLength(2);
      const meowth = forms.find((f) => f.formSlug === 'meowth');
      const alolan = forms.find((f) => f.formSlug === 'meowth-alola');
      expect(meowth?.speciesSlug).toBe('meowth');
      expect(alolan?.speciesSlug).toBe('meowth');
      expect(meowth?.types).toEqual(['normal']);
      expect(alolan?.types).toEqual(['dark']);
      expect(meowth?.isDefaultForm).toBe(true);
      expect(alolan?.isDefaultForm).toBe(false);
      expect(meowth?.abilities.length).toBeGreaterThan(0);
    });

    it('getFormsBySlugs silently drops unknown slugs instead of erroring', async () => {
      const forms = await getFormsBySlugs(client(), ['bulbasaur', 'this-form-does-not-exist']);
      expect(forms.map((f) => f.formSlug)).toEqual(['bulbasaur']);
    });

    it('getFormsBySlugs returns [] for an empty input without a request', async () => {
      expect(await getFormsBySlugs(client(), [])).toEqual([]);
    });

    it('listAbilities returns all 313+ abilities, alphabetically, with 313/313 PokeStudio-owned Spanish coverage available', async () => {
      const abilities = await listAbilities(client());
      expect(abilities.length).toBeGreaterThanOrEqual(313);
      const names = abilities.map((a) => a.nameEn);
      expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
    });

    it('getAbilityBySlug returns null for an unknown slug', async () => {
      expect(await getAbilityBySlug(client(), 'does-not-exist')).toBeNull();
    });

    it('getAbilityBySlug returns Overgrow with its English effect', async () => {
      const overgrow = await getAbilityBySlug(client(), 'overgrow');
      expect(overgrow).not.toBeNull();
      expect(overgrow!.nameEn).toBe('Overgrow');
      expect(overgrow!.effectEn).toBeTruthy();
    });

    it('getPokemonForAbility returns null for an unknown ability', async () => {
      expect(
        await getPokemonForAbility(client(), 'does-not-exist', { page: 1, pageSize: 10 }),
      ).toBeNull();
    });

    it('getPokemonForAbility(Chlorophyll) includes species-oriented results with no duplicate species', async () => {
      const page = await getPokemonForAbility(client(), 'chlorophyll', { page: 1, pageSize: 200 });
      expect(page).not.toBeNull();
      expect(page!.totalCount).toBeGreaterThan(0);
      const slugs = page!.items.map((i) => i.speciesSlug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('getPokemonForAbility(Levitate) — a heavily shared ability — paginates correctly', async () => {
      const page = await getPokemonForAbility(client(), 'levitate', { page: 1, pageSize: 5 });
      expect(page).not.toBeNull();
      expect(page!.totalCount).toBeGreaterThan(5);
      expect(page!.items.length).toBe(5);
      expect(page!.totalPages).toBeGreaterThan(1);
    });

    it('listNatures returns exactly 25 natures, 5 of them neutral (Milestone 2, Stage 2.0)', async () => {
      const natures = await listNatures(client());
      expect(natures).toHaveLength(25);
      const neutral = natures.filter(
        (n) => n.increasedStat === undefined && n.decreasedStat === undefined,
      );
      expect(neutral).toHaveLength(5);
      const adamant = natures.find((n) => n.slug === 'adamant');
      expect(adamant?.increasedStat).toBe('attack');
      expect(adamant?.decreasedStat).toBe('special-attack');
    });

    it('listItems returns only the "holdable" subset, e.g. Leftovers, not the full item catalog', async () => {
      const items = await listItems(client());
      expect(items.length).toBeGreaterThan(100);
      expect(items.length).toBeLessThan(300);
      const leftovers = items.find((i) => i.slug === 'leftovers');
      expect(leftovers).toBeDefined();
      expect(leftovers?.nameEn).toBe('Leftovers');
      // A key item (never holdable) must not have been ingested.
      expect(items.some((i) => i.slug === 'bike-voucher')).toBe(false);
    });
  },
);

describe.skipIf(hasLocalSupabase)('species/form queries (no local Supabase)', () => {
  it.skip('set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY against a reachable Supabase instance to run this suite', () => {
    // Normally the Raspberry Pi (pnpm db:pi:check) — see CLAUDE.md §21.
  });
});
