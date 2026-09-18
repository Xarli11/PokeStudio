import { type SupabaseClient, createClient } from '@supabase/supabase-js';

import type { Database } from './types';

export type PokeLabDatabaseClient = SupabaseClient<Database>;

export interface SupabasePublicConfig {
  url: string;
  /** Publishable key (`sb_publishable_...`) — safe in browser code, RLS-governed. */
  publishableKey: string;
}

export interface SupabaseSecretConfig extends SupabasePublicConfig {
  /** Secret key (`sb_secret_...`) — server-only, bypasses Row Level Security. */
  secretKey: string;
}

/**
 * PokeLab's Supabase identity/storage boundary (docs/architecture/ARCHITECTURE.md, docs/engineering/DATABASE.md).
 * Client code should call this instead of constructing `@supabase/supabase-js`
 * clients directly, so the provider can be swapped without touching call sites.
 */
export function createPublicDatabaseClient(config: SupabasePublicConfig): PokeLabDatabaseClient {
  return createClient<Database>(config.url, config.publishableKey);
}

/**
 * Secret-key client. Must only be constructed in trusted server contexts —
 * the secret key bypasses Row Level Security (docs/engineering/SECURITY.md, docs/engineering/DATABASE.md
 * "Supabase API keys").
 */
export function createServiceDatabaseClient(config: SupabaseSecretConfig): PokeLabDatabaseClient {
  return createClient<Database>(config.url, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
