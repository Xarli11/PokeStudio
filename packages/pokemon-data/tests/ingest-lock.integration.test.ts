import { describe, expect, it } from 'vitest';

import { IngestLockedError, withIngestLock } from '../src/ingest-lock';

/**
 * Proves the Postgres advisory lock actually prevents two ingestion runs
 * from mutating the same database concurrently (2026-09-15 incident: two
 * `ingest:cloud-dev` invocations raced, each independently clearing and
 * re-inserting `pokemon_form_move`).
 *
 * Requires a direct Postgres connection string — normally the Raspberry Pi
 * (CLAUDE.md §21). Skipped automatically when POKESTUDIO_PI_DB_URL is not
 * set, same pattern as tests/persist.integration.test.ts.
 */
const dbUrl = process.env.POKESTUDIO_PI_DB_URL;
const hasDirectPgUrl = Boolean(dbUrl);

describe.skipIf(!hasDirectPgUrl)('withIngestLock', () => {
  it('acquires the lock and returns fn`s result', async () => {
    const result = await withIngestLock(dbUrl, async () => 'done');
    expect(result).toBe('done');
  });

  it('rejects a concurrent call while the lock is held, then releases on completion', async () => {
    let resolveAcquired: () => void;
    const acquired = new Promise<void>((resolve) => {
      resolveAcquired = resolve;
    });
    let resolveRelease: () => void;
    const releaseSignal = new Promise<void>((resolve) => {
      resolveRelease = resolve;
    });

    const firstPromise = withIngestLock(dbUrl, async () => {
      resolveAcquired();
      await releaseSignal;
      return 'first';
    });

    await acquired;

    await expect(withIngestLock(dbUrl, async () => 'second')).rejects.toThrow(IngestLockedError);

    resolveRelease!();
    await expect(firstPromise).resolves.toBe('first');

    // Lock is free again after the first run completed normally.
    await expect(withIngestLock(dbUrl, async () => 'third')).resolves.toBe('third');
  });

  it('releases the lock even when fn throws, so later ingestion is not blocked', async () => {
    await expect(
      withIngestLock(dbUrl, async () => {
        throw new Error('simulated ingestion failure');
      }),
    ).rejects.toThrow('simulated ingestion failure');

    await expect(withIngestLock(dbUrl, async () => 'recovered')).resolves.toBe('recovered');
  });

  it('runs unprotected (no error) when no db url is provided', async () => {
    const result = await withIngestLock(undefined, async () => 'unprotected');
    expect(result).toBe('unprotected');
  });
});
