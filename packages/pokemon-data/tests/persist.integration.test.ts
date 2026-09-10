import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { persistDataset, type IngestClient, type IngestSchema } from '../src/persist';
import type { NormalizedDataset } from '../src/types';

/**
 * Proves the identity-based upsert is idempotent and update-in-place
 * (Phase 1B §3/§18) against the real local Supabase instance. Uses a
 * dedicated fake `source_id` ("pokestudio-test") so it never touches real
 * ingested PokéAPI rows, and cleans up after itself.
 *
 * Requires a running local Supabase instance seeded via `db:reset`. Skipped
 * automatically when SUPABASE_URL is not set (see packages/database's
 * *.integration.test.ts for the same pattern).
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
  };
}

describe.skipIf(!hasLocalSupabase)('persistDataset idempotency', () => {
  let client: IngestClient;

  async function cleanUp() {
    await client.from('species_evolution').delete().eq('source_id', TEST_SOURCE_ID);
    await client.from('pokemon_form_ability').delete().eq('source_id', TEST_SOURCE_ID);
    await client.from('ability').delete().eq('source_id', TEST_SOURCE_ID);
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
});

describe.skipIf(hasLocalSupabase)('persistDataset idempotency (no local Supabase)', () => {
  it.skip('set SUPABASE_URL and SUPABASE_SECRET_KEY against a running local Supabase instance to run this suite', () => {
    // See db:start in packages/database/package.json.
  });
});
