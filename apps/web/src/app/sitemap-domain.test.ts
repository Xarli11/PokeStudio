import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listAbilities, listMovesPage, listSpecies } from '@pokestudio/database';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';
import sitemap from './sitemap';
import robots from './robots';

vi.mock('@pokestudio/database', () => ({
  listAbilities: vi.fn(),
  listMovesPage: vi.fn(),
  listSpecies: vi.fn(),
}));
vi.mock('@/lib/pokemon-database', () => ({ getPokemonDatabaseClient: vi.fn() }));
vi.mock('@/lib/observability', () => ({ captureException: vi.fn() }));

beforeEach(() => {
  vi.mocked(getPokemonDatabaseClient).mockReset();
  vi.mocked(listSpecies).mockResolvedValue([{ slug: 'mew' }] as Awaited<
    ReturnType<typeof listSpecies>
  >);
  vi.mocked(listMovesPage).mockResolvedValue({ items: [{ slug: 'tackle' }] } as Awaited<
    ReturnType<typeof listMovesPage>
  >);
  vi.mocked(listAbilities).mockResolvedValue([{ slug: 'overgrow' }] as Awaited<
    ReturnType<typeof listAbilities>
  >);
});

describe('public domain discovery', () => {
  it('advertises an absolute sitemap URL in robots.txt', () => {
    expect(robots().sitemap).toBe('https://pokestudio.pro/sitemap.xml');
  });

  it('uses the final origin for all index and database-backed sitemap entries', async () => {
    const entries = await sitemap();
    expect(entries).toHaveLength(16);
    expect(entries.every(({ url }) => new URL(url).origin === 'https://pokestudio.pro')).toBe(true);
    for (const locale of ['en', 'es']) {
      for (const path of [
        '',
        '/pokemon',
        '/moves',
        '/abilities',
        '/compare',
        '/pokemon/mew',
        '/moves/tackle',
        '/abilities/overgrow',
      ]) {
        expect(entries.map(({ url }) => url)).toContain(`https://pokestudio.pro/${locale}${path}`);
      }
    }
    expect(entries.every(({ url }) => !url.includes('?') && !url.includes('/build/'))).toBe(true);
  });

  it('retains the final origin in the credential-free fallback', async () => {
    vi.mocked(getPokemonDatabaseClient).mockImplementation(() => {
      throw new Error('No credentials');
    });
    const entries = await sitemap();
    expect(entries).toHaveLength(10);
    expect(entries.every(({ url }) => new URL(url).origin === 'https://pokestudio.pro')).toBe(true);
  });
});
