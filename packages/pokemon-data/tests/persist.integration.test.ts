import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { persistDataset, type IngestClient, type IngestSchema } from '../src/persist';
import type { NormalizedDataset } from '../src/types';

/**
 * Proves the identity-based upsert is idempotent and update-in-place
 * (Phase 1B §3/§18) against a real Supabase instance. Uses a
 * dedicated fake `source_id` ("pokestudio-test") so it never touches real
 * ingested PokéAPI rows, and cleans up after itself.
 *
 * Requires a reachable Supabase instance with migrations applied — normally the Raspberry Pi
 * (`pnpm db:pi:migrate`; CLAUDE.md §21). Skipped automatically when SUPABASE_URL is not set (see
 * packages/database's *.integration.test.ts for the same pattern).
 */
const supabaseUrl = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const hasLocalSupabase = Boolean(supabaseUrl && secretKey);

const TEST_SOURCE_ID = 'pokestudio-test';

function makeDataset(
  overrides: {
    speciesName?: string;
    formName?: string;
    abilityName?: string;
    includeSecondSpecies?: boolean;
    includeMoves?: boolean;
    moveName?: string;
    learnsetLevel?: number;
  } = {},
): NormalizedDataset {
  const secondSpecies = overrides.includeSecondSpecies
    ? [
        {
          slug: 'testmon-evo',
          nationalDexNumber: 90002,
          name: { en: 'Testmon Evo', es: 'Testmon Evo' },
          source: { sourceId: TEST_SOURCE_ID, externalId: 'species-90002' },
        },
      ]
    : [];
  const secondForm = overrides.includeSecondSpecies
    ? [
        {
          slug: 'testmon-evo',
          speciesSlug: 'testmon-evo',
          name: { en: 'Testmon Evo', es: 'Testmon Evo' },
          isDefault: true,
          category: 'default' as const,
          types: ['normal'] as const,
          baseStats: {
            hp: 2,
            attack: 2,
            defense: 2,
            specialAttack: 2,
            specialDefense: 2,
            speed: 2,
          },
          source: { sourceId: TEST_SOURCE_ID, externalId: 'form-90002' },
          pokeapiPokemonId: 90002,
        },
      ]
    : [];

  return {
    provenance: {
      sourceId: TEST_SOURCE_ID,
      sourceUrl: 'https://example.invalid',
      license: 'test-fixture',
      fetchedAt: new Date(0).toISOString(),
      importerVersion: 'test',
    },
    species: [
      {
        slug: 'testmon',
        nationalDexNumber: 90001,
        name: { en: overrides.speciesName ?? 'Testmon', es: overrides.speciesName ?? 'Testmon' },
        source: { sourceId: TEST_SOURCE_ID, externalId: 'species-90001' },
      },
      ...secondSpecies,
    ],
    forms: [
      {
        slug: 'testmon',
        speciesSlug: 'testmon',
        name: { en: overrides.formName ?? 'Testmon', es: overrides.formName ?? 'Testmon' },
        isDefault: true,
        category: 'default',
        types: ['normal'],
        baseStats: { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 },
        source: { sourceId: TEST_SOURCE_ID, externalId: 'form-90001' },
        pokeapiPokemonId: 90001,
      },
      ...secondForm,
    ],
    abilities: [
      {
        slug: 'testability',
        nameEn: overrides.abilityName ?? 'Test Ability',
        nameEs: 'Habilidad de Prueba',
        effectEn: 'Does a test thing.',
        source: { sourceId: TEST_SOURCE_ID, externalId: 'ability-90001' },
      },
    ],
    formAbilities: [{ formSlug: 'testmon', abilitySlug: 'testability', slot: 1, isHidden: false }],
    moves: overrides.includeMoves
      ? [
          {
            slug: 'testmove',
            nameEn: overrides.moveName ?? 'Test Move',
            nameEs: 'Movimiento de Prueba',
            type: 'normal',
            damageClass: 'physical',
            power: 40,
            accuracy: 100,
            pp: 35,
            priority: 0,
            target: 'selected-pokemon',
            generation: 1,
            ailment: 'none',
            category: 'damage',
            drain: 0,
            healing: 0,
            critRate: 0,
            ailmentChance: 0,
            flinchChance: 0,
            statChance: 0,
            statChanges: [{ stat: 'attack' as const, change: -1 }],
            source: { sourceId: TEST_SOURCE_ID, externalId: 'move-90001' },
          },
        ]
      : [],
    versionGroups: overrides.includeMoves
      ? [
          {
            slug: 'testversion',
            generation: 1,
            displayOrder: 1,
            source: { sourceId: TEST_SOURCE_ID, externalId: 'version-group-90001' },
          },
        ]
      : [],
    learnMethods: overrides.includeMoves
      ? [{ slug: 'level-up', source: { sourceId: TEST_SOURCE_ID, externalId: 'method-90001' } }]
      : [],
    learnsetEntries: overrides.includeMoves
      ? [
          {
            formSlug: 'testmon',
            moveSlug: 'testmove',
            versionGroupSlug: 'testversion',
            learnMethodSlug: 'level-up',
            level: overrides.learnsetLevel ?? 1,
          },
        ]
      : [],
    machines: overrides.includeMoves
      ? [
          {
            moveSlug: 'testmove',
            versionGroupSlug: 'testversion',
            itemSlug: 'tm90',
            source: { sourceId: TEST_SOURCE_ID, externalId: 'machine-90001' },
          },
        ]
      : [],
    evolutions: overrides.includeSecondSpecies
      ? [
          {
            chainExternalId: 'chain-90001',
            fromSpeciesSlug: 'testmon',
            toSpeciesSlug: 'testmon-evo',
            trigger: 'level-up',
            minLevel: 16,
            needsOverworldRain: false,
            turnUpsideDown: false,
            raw: { trigger: { name: 'level-up' }, min_level: 16 },
            source: { sourceId: TEST_SOURCE_ID, externalId: 'chain-90001:testmon-evo:0' },
          },
        ]
      : [],
    // Pre-existing gap found 2026-09-16: `NormalizedDataset.natures`/`.items`
    // were added (Milestone 2) without updating this fixture, so every test
    // using it threw at runtime (`dataset.natures.map` on undefined) despite
    // `tsc --noEmit` passing — this file is outside tsconfig.json's
    // `include` (src/scripts only), so the missing required properties were
    // never type-checked. This fixture doesn't exercise natures/items, so
    // empty arrays are correct here, not a placeholder.
    natures: [],
    items: [],
  };
}

describe.skipIf(!hasLocalSupabase)('persistDataset idempotency', () => {
  let client: IngestClient;

  async function cleanUp() {
    await client.from('species_evolution').delete().eq('source_id', TEST_SOURCE_ID);
    await client.from('pokemon_form_ability').delete().eq('source_id', TEST_SOURCE_ID);
    await client.from('pokemon_form_move').delete().eq('source_id', TEST_SOURCE_ID);
    await client.from('machine').delete().eq('source_id', TEST_SOURCE_ID);
    await client.from('ability').delete().eq('source_id', TEST_SOURCE_ID);
    await client.from('move').delete().eq('source_id', TEST_SOURCE_ID);
    await client.from('version_group').delete().eq('source_id', TEST_SOURCE_ID);
    await client.from('move_learn_method').delete().eq('source_id', TEST_SOURCE_ID);
    await client.from('pokemon_form').delete().eq('source_id', TEST_SOURCE_ID);
    await client.from('species').delete().eq('source_id', TEST_SOURCE_ID);
  }

  beforeAll(async () => {
    client = createClient<IngestSchema>(supabaseUrl!, secretKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await cleanUp();
  });

  afterAll(async () => {
    await cleanUp();
  });

  it('a fresh ingestion inserts exactly one species and one form', async () => {
    const result = await persistDataset(client, makeDataset());
    expect(result.speciesUpserted).toBe(1);
    expect(result.formsUpserted).toBe(1);

    const { data } = await client
      .from('species')
      .select('id, slug')
      .eq('source_id', TEST_SOURCE_ID);
    expect(data).toHaveLength(1);
  });

  it('running ingestion again does not duplicate rows, and updates fields in place', async () => {
    const { data: before } = await client
      .from('species')
      .select('id, slug')
      .eq('source_id', TEST_SOURCE_ID);
    const originalId = before![0]!.id;

    await persistDataset(client, makeDataset({ speciesName: 'Testmon Renamed' }));

    const { data: after } = await client
      .from('species')
      .select('id, slug, name_en')
      .eq('source_id', TEST_SOURCE_ID);
    expect(after).toHaveLength(1); // still exactly one row, not two
    expect(after![0]!.id).toBe(originalId); // same row, updated in place
    expect(after![0]!.slug).toBe('testmon'); // slug preserved, never rewritten
    expect(after![0]!.name_en).toBe('Testmon Renamed'); // other fields do refresh

    const { data: forms } = await client
      .from('pokemon_form')
      .select('id')
      .eq('source_id', TEST_SOURCE_ID);
    expect(forms).toHaveLength(1); // form side is idempotent too
  });

  it('a fresh ingestion writes exactly one ability and one form/ability link', async () => {
    await persistDataset(client, makeDataset());

    const { data: abilities } = await client
      .from('ability')
      .select('id, slug')
      .eq('source_id', TEST_SOURCE_ID);
    expect(abilities).toHaveLength(1);

    const { data: links } = await client
      .from('pokemon_form_ability')
      .select('id')
      .eq('source_id', TEST_SOURCE_ID);
    expect(links).toHaveLength(1);
  });

  it('running ingestion again does not duplicate the ability or the form/ability link', async () => {
    const { data: before } = await client
      .from('ability')
      .select('id')
      .eq('source_id', TEST_SOURCE_ID);
    const originalAbilityId = before![0]!.id;

    await persistDataset(client, makeDataset({ abilityName: 'Test Ability Renamed' }));

    const { data: after } = await client
      .from('ability')
      .select('id, slug, name_en')
      .eq('source_id', TEST_SOURCE_ID);
    expect(after).toHaveLength(1); // still exactly one row, not two
    expect(after![0]!.id).toBe(originalAbilityId); // same row, updated in place
    expect(after![0]!.slug).toBe('testability'); // slug preserved
    expect(after![0]!.name_en).toBe('Test Ability Renamed'); // other fields refresh

    const { data: links } = await client
      .from('pokemon_form_ability')
      .select('id')
      .eq('source_id', TEST_SOURCE_ID);
    expect(links).toHaveLength(1); // link side is idempotent too (delete+reinsert per run)
  });

  it('a fresh ingestion writes exactly one evolution edge for a two-species family', async () => {
    const result = await persistDataset(client, makeDataset({ includeSecondSpecies: true }));
    expect(result.evolutionsWritten).toBe(1);

    const { data: species } = await client
      .from('species')
      .select('id, slug')
      .eq('source_id', TEST_SOURCE_ID);
    const testmonId = species!.find((s) => s.slug === 'testmon')!.id;

    const { data: evolutions } = await client
      .from('species_evolution')
      .select('id, from_species_id, to_species_id')
      .eq('source_id', TEST_SOURCE_ID);
    expect(evolutions).toHaveLength(1);
    expect(evolutions![0]!.from_species_id).toBe(testmonId);
  });

  it('running ingestion again does not duplicate the evolution edge', async () => {
    await persistDataset(client, makeDataset({ includeSecondSpecies: true }));
    await persistDataset(client, makeDataset({ includeSecondSpecies: true }));

    const { data: evolutions } = await client
      .from('species_evolution')
      .select('id')
      .eq('source_id', TEST_SOURCE_ID);
    expect(evolutions).toHaveLength(1); // delete+reinsert per run, never accumulates
  });

  it('removing the evolution edge from the dataset removes it on the next run', async () => {
    await persistDataset(client, makeDataset({ includeSecondSpecies: true }));
    await persistDataset(client, makeDataset({ includeSecondSpecies: false }));

    const { data: evolutions } = await client
      .from('species_evolution')
      .select('id')
      .eq('source_id', TEST_SOURCE_ID);
    expect(evolutions).toHaveLength(0);
  });

  it('a fresh ingestion writes exactly one move, version group, learn method, learnset entry and machine', async () => {
    const result = await persistDataset(client, makeDataset({ includeMoves: true }));
    expect(result.movesUpserted).toBe(1);
    expect(result.versionGroupsUpserted).toBe(1);
    expect(result.learnMethodsUpserted).toBe(1);
    expect(result.learnsetEntriesWritten).toBe(1);
    expect(result.machinesUpserted).toBe(1);

    const { data: moves } = await client
      .from('move')
      .select('id, slug')
      .eq('source_id', TEST_SOURCE_ID);
    expect(moves).toHaveLength(1);
    const { data: learnset } = await client
      .from('pokemon_form_move')
      .select('id, level')
      .eq('source_id', TEST_SOURCE_ID);
    expect(learnset).toHaveLength(1);
    expect(learnset![0]!.level).toBe(1);
  });

  it('running ingestion again does not duplicate the move, and updates fields in place', async () => {
    const { data: before } = await client.from('move').select('id').eq('source_id', TEST_SOURCE_ID);
    const originalMoveId = before![0]!.id;

    await persistDataset(
      client,
      makeDataset({ includeMoves: true, moveName: 'Test Move Renamed' }),
    );

    const { data: after } = await client
      .from('move')
      .select('id, slug, name_en')
      .eq('source_id', TEST_SOURCE_ID);
    expect(after).toHaveLength(1); // still exactly one row, not two
    expect(after![0]!.id).toBe(originalMoveId); // same row, updated in place
    expect(after![0]!.slug).toBe('testmove'); // slug preserved
    expect(after![0]!.name_en).toBe('Test Move Renamed'); // other fields refresh
  });

  it('the same (form,move,version-group,method) at two different levels produces two learnset rows, not a collapsed one', async () => {
    // Real mechanic (docs/adr/0013): re-running with a second, different-level
    // learnset entry for the identical (form,move,version-group,method) must
    // add a row, not silently replace it — level is part of the natural key.
    await persistDataset(client, makeDataset({ includeMoves: true, learnsetLevel: 1 }));
    const dataset = makeDataset({ includeMoves: true, learnsetLevel: 1 });
    dataset.learnsetEntries.push({
      formSlug: 'testmon',
      moveSlug: 'testmove',
      versionGroupSlug: 'testversion',
      learnMethodSlug: 'level-up',
      level: 8,
    });
    const result = await persistDataset(client, dataset);
    expect(result.learnsetEntriesWritten).toBe(2);

    const { data: learnset } = await client
      .from('pokemon_form_move')
      .select('level')
      .eq('source_id', TEST_SOURCE_ID);
    expect(learnset!.map((r) => r.level).sort()).toEqual([1, 8]);
  });

  it('running learnset ingestion again does not duplicate rows (delete+reinsert per source_id)', async () => {
    await persistDataset(client, makeDataset({ includeMoves: true }));
    await persistDataset(client, makeDataset({ includeMoves: true }));

    const { data: learnset } = await client
      .from('pokemon_form_move')
      .select('id')
      .eq('source_id', TEST_SOURCE_ID);
    expect(learnset).toHaveLength(1); // delete+reinsert per run, never accumulates
  });

  it('clears and re-inserts pokemon_form_move across multiple batches, including a short final one', async () => {
    // DELETE_ID_BATCH_SIZE is 100 (src/persist.ts) — 250 distinct-level rows
    // forces the clear loop through two full batches plus a short final one
    // (100, 100, 50), on both the initial clear and the idempotent re-run's.
    const bulkRowCount = 250;
    const dataset = makeDataset({ includeMoves: true });
    dataset.learnsetEntries = Array.from({ length: bulkRowCount }, (_, i) => ({
      formSlug: 'testmon',
      moveSlug: 'testmove',
      versionGroupSlug: 'testversion',
      learnMethodSlug: 'level-up',
      level: i + 1,
    }));

    const first = await persistDataset(client, dataset);
    expect(first.learnsetEntriesWritten).toBe(bulkRowCount);
    const { data: afterFirst } = await client
      .from('pokemon_form_move')
      .select('id')
      .eq('source_id', TEST_SOURCE_ID);
    expect(afterFirst).toHaveLength(bulkRowCount);

    const second = await persistDataset(client, dataset);
    expect(second.learnsetEntriesWritten).toBe(bulkRowCount);
    const { data: afterSecond } = await client
      .from('pokemon_form_move')
      .select('id')
      .eq('source_id', TEST_SOURCE_ID);
    expect(afterSecond).toHaveLength(bulkRowCount); // cleared and reinserted, never accumulated
  });

  it("a source_id-scoped clear never touches another source_id's rows", async () => {
    const OTHER_SOURCE_ID = 'pokestudio-test-other-source';

    await client.from('data_sources').upsert(
      {
        source_id: OTHER_SOURCE_ID,
        source_url: 'https://example.invalid',
        license: 'test-fixture',
        fetched_at: new Date(0).toISOString(),
        importer_version: 'test',
      },
      { onConflict: 'source_id' },
    );
    const { data: formRow } = await client
      .from('pokemon_form')
      .select('id')
      .eq('source_id', TEST_SOURCE_ID)
      .eq('slug', 'testmon')
      .single();
    const { data: moveRow } = await client
      .from('move')
      .select('id')
      .eq('source_id', TEST_SOURCE_ID)
      .eq('slug', 'testmove')
      .single();
    const { data: versionGroupRow } = await client
      .from('version_group')
      .select('id')
      .eq('source_id', TEST_SOURCE_ID)
      .eq('slug', 'testversion')
      .single();

    // A decoy row under a different source_id, referencing the same
    // already-ingested form/move/version-group internal ids — source_id is
    // pure provenance here, independent of which rows it points at.
    const { error: decoyInsertError } = await client.from('pokemon_form_move').insert({
      pokemon_form_id: formRow!.id,
      move_id: moveRow!.id,
      version_group_id: versionGroupRow!.id,
      learn_method: 'level-up',
      level: 999,
      source_id: OTHER_SOURCE_ID,
    });
    expect(decoyInsertError).toBeNull();

    await persistDataset(client, makeDataset({ includeMoves: true }));

    const { data: otherSourceRows } = await client
      .from('pokemon_form_move')
      .select('id')
      .eq('source_id', OTHER_SOURCE_ID);
    expect(otherSourceRows).toHaveLength(1); // untouched by TEST_SOURCE_ID's clear+reinsert

    await client.from('pokemon_form_move').delete().eq('source_id', OTHER_SOURCE_ID);
    await client.from('data_sources').delete().eq('source_id', OTHER_SOURCE_ID);
  });
});

describe.skipIf(hasLocalSupabase)('persistDataset idempotency (no local Supabase)', () => {
  it.skip('set SUPABASE_URL and SUPABASE_SECRET_KEY against a reachable Supabase instance to run this suite', () => {
    // Normally the Raspberry Pi (pnpm db:pi:migrate) — see CLAUDE.md §21.
  });
});
