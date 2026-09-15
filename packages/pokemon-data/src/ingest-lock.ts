import { Client } from 'pg';

/**
 * Guards against two ingestion runs mutating the same database
 * concurrently (2026-09-15 incident: two `ingest:cloud-dev` invocations
 * raced, each independently clearing and re-inserting `pokemon_form_move`).
 *
 * The ingestion pipeline itself talks to Postgres exclusively through
 * PostgREST (`@supabase/supabase-js`), which is stateless — every call may
 * land on a different pooled connection, so a session-scoped
 * `pg_advisory_lock` can't be held across the pipeline's many separate
 * requests that way. This opens one dedicated, short-lived `pg` connection
 * purely to hold the advisory lock for the run's duration; all actual data
 * reads/writes still go through the existing PostgREST client, unchanged.
 *
 * Postgres releases a session-level advisory lock automatically when its
 * holding connection closes — including on a crash/kill — so no separate
 * cleanup step or lock row is needed.
 */
const INGEST_LOCK_KEY = 'pokestudio:pokemon-data:ingest';

export class IngestLockedError extends Error {
  constructor() {
    super(
      'Another ingestion is already running against this database ' +
        '(advisory lock held). Refusing to start a second concurrent ingest.',
    );
    this.name = 'IngestLockedError';
  }
}

/**
 * Runs `fn` while holding a Postgres advisory lock on `dbUrl`. If the lock
 * is already held (a concurrent ingest is in progress), rejects immediately
 * with `IngestLockedError` instead of running `fn`. If `dbUrl` is not
 * provided, runs `fn` unprotected (with a warning) — callers that don't
 * have a direct Postgres connection string available (tests, ad-hoc script
 * usage) still work, just without this protection.
 */
export async function withIngestLock<T>(
  dbUrl: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!dbUrl) {
    console.warn(
      '[ingest-lock] No direct database URL provided — running without concurrent-ingest protection.',
    );
    return fn();
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ acquired: boolean }>(
      'select pg_try_advisory_lock(hashtext($1)) as acquired',
      [INGEST_LOCK_KEY],
    );
    if (!rows[0]?.acquired) {
      throw new IngestLockedError();
    }
    return await fn();
  } finally {
    // Best-effort explicit unlock so the lock frees immediately on normal
    // completion or a thrown error; if the process dies before this runs,
    // closing (or the OS closing) this connection releases it regardless.
    try {
      await client.query('select pg_advisory_unlock(hashtext($1))', [INGEST_LOCK_KEY]);
    } catch {
      // Connection may already be broken — closing it below still releases
      // the lock server-side once Postgres notices the session is gone.
    }
    await client.end();
  }
}
