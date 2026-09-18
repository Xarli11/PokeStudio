import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * On-disk raw-response cache, keyed by URL (Phase 1B, §7/§8).
 *
 * Ingesting the full Pokédex means several thousand upstream requests.
 * Caching each raw response by URL — mirroring the API's own path shape —
 * means a second ingestion run (idempotency testing, a normalization bugfix,
 * an audit re-run) reads from disk instead of re-hitting PokéAPI. Raw
 * upstream JSON stays clearly separate from normalized PokeLab data: nothing
 * here is ever read directly by the web app or committed as product data.
 */
export interface RawCache {
  get: (url: string) => Promise<unknown | undefined>;
  set: (url: string, value: unknown) => Promise<void>;
}

function cacheFilePath(cacheDir: string, url: string): string {
  // Cache files mirror the API path (e.g. pokemon-species/1 -> pokemon-species/1.json),
  // so the cache is human-browsable, not just an opaque hash store.
  const relativePath = url.replace(/^https?:\/\/[^/]+\/api\/v2\//, '').replace(/\/$/, '');
  return path.join(cacheDir, `${relativePath}.json`);
}

export function createFileCache(cacheDir: string): RawCache {
  return {
    async get(url) {
      try {
        const raw = await readFile(cacheFilePath(cacheDir, url), 'utf-8');
        return JSON.parse(raw) as unknown;
      } catch {
        return undefined;
      }
    },
    async set(url, value) {
      const filePath = cacheFilePath(cacheDir, url);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(value), 'utf-8');
    },
  };
}

/** In-memory only — used by tests so nothing touches disk. */
export function createMemoryCache(): RawCache {
  const store = new Map<string, unknown>();
  return {
    async get(url) {
      return store.get(url);
    },
    async set(url, value) {
      store.set(url, value);
    },
  };
}
