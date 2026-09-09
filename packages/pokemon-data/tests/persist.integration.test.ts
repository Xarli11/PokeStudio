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
  overrides: { speciesName?: string; formName?: string } = {},
): NormalizedDataset {
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
    ],
  };
}

describe.skipIf(!hasLocalSupabase)('persistDataset idempotency', () => {
  let client: IngestClient;

  beforeAll(async () => {
    client = createClient<IngestSchema>(supabaseUrl!, secretKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await client.from('pokemon_form').delete().eq('source_id', TEST_SOURCE_ID);
    await client.from('species').delete().eq('source_id', TEST_SOURCE_ID);
  });

  afterAll(async () => {
    await client.from('pokemon_form').delete().eq('source_id', TEST_SOURCE_ID);
    await client.from('species').delete().eq('source_id', TEST_SOURCE_ID);
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
});

describe.skipIf(hasLocalSupabase)('persistDataset idempotency (no local Supabase)', () => {
  it.skip('set SUPABASE_URL and SUPABASE_SECRET_KEY against a running local Supabase instance to run this suite', () => {
    // See db:start in packages/database/package.json.
  });
});
