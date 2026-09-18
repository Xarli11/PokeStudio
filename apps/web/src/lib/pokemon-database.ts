import { cache } from 'react';

import {
  createPublicDatabaseClient,
  getAbilityBySlug,
  getMoveBySlug,
  getSpeciesBySlug,
  listAbilities,
  type PokeLabDatabaseClient,
} from '@pokelab/database';

/**
 * Server-only accessor for the Pokémon reference-data database client.
 * Import only from Server Components/route handlers — never from a
 * `'use client'` module (CLAUDE.md §11/§15: least privilege, no secrets in
 * the client bundle). Uses the publishable key: species/form reference data
 * is public-read by RLS policy, so no secret key is needed here.
 */
let cachedClient: PokeLabDatabaseClient | undefined;

export function getPokemonDatabaseClient(): PokeLabDatabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set. Copy ' +
        '.env.example to .env.local and point them at the Raspberry Pi Supabase instance ' +
        '(CLAUDE.md §21 "Local Development Database") — normal development does not run a ' +
        'local Supabase stack.',
    );
  }

  cachedClient = createPublicDatabaseClient({ url, publishableKey });
  return cachedClient;
}

/**
 * React `cache()`-wrapped versions of the queries every detail/index page's
 * `generateMetadata` fetches a second time (the page component itself needs
 * the same row) — Performance pass, measured: `getSpeciesBySlug` ran twice
 * per `/pokemon/[slug]` request, 15ms apart, before this. `cache()` scopes
 * memoization to one request's render (Next resets it per request), keyed
 * on these arguments; `getPokemonDatabaseClient()` returns the same
 * singleton every call, so the (client, slug) key matches between
 * `generateMetadata` and the page, collapsing two Supabase round trips into
 * one. Callers should prefer these over importing the raw query functions
 * directly for any route where the same lookup happens in both places.
 */
export const getCachedSpeciesBySlug = cache(getSpeciesBySlug);
export const getCachedMoveBySlug = cache(getMoveBySlug);
export const getCachedAbilityBySlug = cache(getAbilityBySlug);
export const getCachedAbilitiesList = cache(listAbilities);
