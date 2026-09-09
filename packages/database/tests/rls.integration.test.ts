import { describe, expect, it } from 'vitest';

import { createPublicDatabaseClient } from '../src/client';

/**
 * RLS proof for the Phase 0 reference schema (DATABASE.md "RLS" section).
 *
 * Requires a running local Supabase instance (`pnpm --filter @pokestudio/database db:start`,
 * which needs Docker). Skipped automatically when SUPABASE_URL is not set — CI/local
 * environments without Docker still get a green run, but this test is the executable
 * spec for the RLS guarantee and must be run before shipping the real Explore schema.
 */
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const hasLocalSupabase = Boolean(supabaseUrl && anonKey);

describe.skipIf(!hasLocalSupabase)('species reference data RLS', () => {
  it('is readable by the anonymous role', async () => {
    const client = createPublicDatabaseClient({ url: supabaseUrl!, anonKey: anonKey! });
    const { data, error } = await client.from('species').select('id').limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('rejects anonymous writes', async () => {
    const client = createPublicDatabaseClient({ url: supabaseUrl!, anonKey: anonKey! });
    const { error } = await client.from('species').insert({
      id: 'should-fail',
      national_dex_number: 9999,
      name_en: 'x',
      name_es: 'x',
      types: ['normal'],
      base_stats: {},
      introduced_in_generation: 1,
      source_id: 'pokeapi',
    });
    expect(error).not.toBeNull();
  });
});

describe.skipIf(hasLocalSupabase)('species reference data RLS (no local Supabase)', () => {
  it.skip('set SUPABASE_URL and SUPABASE_ANON_KEY against a running local Supabase instance to run this suite', () => {
    // See db:start in packages/database/package.json.
  });
});
