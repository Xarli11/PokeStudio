import { describe, expect, it } from 'vitest';

import { createPublicDatabaseClient } from '../src/client';

/**
 * RLS proof for the Phase 1A reference schema (DATABASE.md "RLS" section,
 * ADR-0010).
 *
 * Requires a running local Supabase instance (`pnpm --filter @pokestudio/database db:start`,
 * which needs Docker). Skipped automatically when SUPABASE_URL is not set — CI/local
 * environments without Docker still get a green run, but this test is the executable
 * spec for the RLS guarantee and must be run before shipping further Explore data.
 */
const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const hasLocalSupabase = Boolean(supabaseUrl && publishableKey);

describe.skipIf(!hasLocalSupabase)('species/pokemon_form reference data RLS', () => {
  it('species is readable by the anonymous role', async () => {
    const client = createPublicDatabaseClient({
      url: supabaseUrl!,
      publishableKey: publishableKey!,
    });
    const { data, error } = await client.from('species').select('id').limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('rejects anonymous writes to species', async () => {
    const client = createPublicDatabaseClient({
      url: supabaseUrl!,
      publishableKey: publishableKey!,
    });
    const { error } = await client.from('species').insert({
      slug: 'should-fail',
      national_dex_number: 9999,
      name_en: 'x',
      name_es: 'x',
      source_id: 'pokeapi',
      external_id: '9999',
    });
    expect(error).not.toBeNull();
  });

  it('pokemon_form is readable by the anonymous role', async () => {
    const client = createPublicDatabaseClient({
      url: supabaseUrl!,
      publishableKey: publishableKey!,
    });
    const { data, error } = await client.from('pokemon_form').select('id').limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('rejects anonymous writes to pokemon_form', async () => {
    const client = createPublicDatabaseClient({
      url: supabaseUrl!,
      publishableKey: publishableKey!,
    });
    const { data: species } = await client.from('species').select('id').limit(1).single();
    const { error } = await client.from('pokemon_form').insert({
      species_id: species!.id,
      slug: 'should-fail',
      name_en: 'x',
      name_es: 'x',
      form_category: 'default',
      types: ['normal'],
      base_stats: { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 },
      source_id: 'pokeapi',
      external_id: '9999',
    });
    expect(error).not.toBeNull();
  });
});

describe.skipIf(!hasLocalSupabase)(
  'ability/pokemon_form_ability/species_evolution reference data RLS',
  () => {
    it('ability is readable by the anonymous role', async () => {
      const client = createPublicDatabaseClient({
        url: supabaseUrl!,
        publishableKey: publishableKey!,
      });
      const { data, error } = await client.from('ability').select('id').limit(1);
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('rejects anonymous writes to ability', async () => {
      const client = createPublicDatabaseClient({
        url: supabaseUrl!,
        publishableKey: publishableKey!,
      });
      const { error } = await client.from('ability').insert({
        slug: 'should-fail',
        name_en: 'x',
        name_es: null,
        effect_en: null,
        effect_es: null,
        source_id: 'pokeapi',
        external_id: '999999',
      });
      expect(error).not.toBeNull();
    });

    it('pokemon_form_ability is readable by the anonymous role', async () => {
      const client = createPublicDatabaseClient({
        url: supabaseUrl!,
        publishableKey: publishableKey!,
      });
      const { data, error } = await client.from('pokemon_form_ability').select('id').limit(1);
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('rejects anonymous writes to pokemon_form_ability', async () => {
      const client = createPublicDatabaseClient({
        url: supabaseUrl!,
        publishableKey: publishableKey!,
      });
      const { data: form } = await client.from('pokemon_form').select('id').limit(1).single();
      const { data: ability } = await client.from('ability').select('id').limit(1).single();
      const { error } = await client.from('pokemon_form_ability').insert({
        pokemon_form_id: form!.id,
        ability_id: ability!.id,
        slot: 99,
        is_hidden: false,
        source_id: 'pokeapi',
      });
      expect(error).not.toBeNull();
    });

    it('species_evolution is readable by the anonymous role', async () => {
      const client = createPublicDatabaseClient({
        url: supabaseUrl!,
        publishableKey: publishableKey!,
      });
      const { data, error } = await client.from('species_evolution').select('id').limit(1);
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('rejects anonymous writes to species_evolution', async () => {
      const client = createPublicDatabaseClient({
        url: supabaseUrl!,
        publishableKey: publishableKey!,
      });
      const { data: species } = await client.from('species').select('id').limit(2);
      const { error } = await client.from('species_evolution').insert({
        from_species_id: species![0]!.id,
        to_species_id: species![1]!.id,
        evolution_chain_external_id: 'should-fail',
        trigger: 'level-up',
        needs_overworld_rain: false,
        turn_upside_down: false,
        raw_condition: {},
        source_id: 'pokeapi',
      });
      expect(error).not.toBeNull();
    });
  },
);

describe.skipIf(hasLocalSupabase)(
  'species/pokemon_form reference data RLS (no local Supabase)',
  () => {
    it.skip('set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY against a running local Supabase instance to run this suite', () => {
      // See db:start in packages/database/package.json.
    });
  },
);
