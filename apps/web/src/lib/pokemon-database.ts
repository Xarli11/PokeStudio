import { createPublicDatabaseClient, type PokeStudioDatabaseClient } from '@pokestudio/database';

/**
 * Server-only accessor for the Pokémon reference-data database client.
 * Import only from Server Components/route handlers — never from a
 * `'use client'` module (CLAUDE.md §11/§15: least privilege, no secrets in
 * the client bundle). Uses the public anon key: species/form reference data
 * is public-read by RLS policy, so no service-role key is needed here.
 */
let cachedClient: PokeStudioDatabaseClient | undefined;

export function getPokemonDatabaseClient(): PokeStudioDatabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. Start the local ' +
        'Supabase stack (pnpm --filter @pokestudio/database db:start) and copy .env.example to .env.local.',
    );
  }

  cachedClient = createPublicDatabaseClient({ url, anonKey });
  return cachedClient;
}
