import { type SupabaseClient, createClient } from '@supabase/supabase-js';

import type { Database } from './types';

export type PokeStudioDatabaseClient = SupabaseClient<Database>;

export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

export interface SupabaseServiceConfig extends SupabasePublicConfig {
  serviceRoleKey: string;
}

/**
 * PokeStudio's Supabase identity/storage boundary (ARCHITECTURE.md, DATABASE.md).
 * Client code should call this instead of constructing `@supabase/supabase-js`
 * clients directly, so the provider can be swapped without touching call sites.
 */
export function createPublicDatabaseClient(config: SupabasePublicConfig): PokeStudioDatabaseClient {
  return createClient<Database>(config.url, config.anonKey);
}

/**
 * Service-role client. Must only be constructed in trusted server contexts —
 * the service role key bypasses Row Level Security (SECURITY.md).
 */
export function createServiceDatabaseClient(
  config: SupabaseServiceConfig,
): PokeStudioDatabaseClient {
  return createClient<Database>(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
