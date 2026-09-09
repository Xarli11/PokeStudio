import { createPublicDatabaseClient, type PokeStudioDatabaseClient } from '@pokestudio/database';

/**
 * Server-only accessor for the Pokémon reference-data database client.
 * Import only from Server Components/route handlers — never from a
 * `'use client'` module (CLAUDE.md §11/§15: least privilege, no secrets in
 * the client bundle). Uses the publishable key: species/form reference data
 * is public-read by RLS policy, so no secret key is needed here.
 */
let cachedClient: PokeStudioDatabaseClient | undefined;

export function getPokemonDatabaseClient(): PokeStudioDatabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set. Start the ' +
        'local Supabase stack (pnpm --filter @pokestudio/database db:start) and copy .env.example to .env.local.',
    );
  }

  cachedClient = createPublicDatabaseClient({ url, publishableKey });
  return cachedClient;
}
