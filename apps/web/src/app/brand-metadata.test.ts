import { describe, expect, it, vi } from 'vitest';

vi.mock('@pokelab/database', () => ({
  listSpecies: vi.fn(async () => [{ slug: 'bulbasaur' }]),
  listMovesPage: vi.fn(async () => ({ items: [{ slug: 'tackle' }] })),
  listAbilities: vi.fn(async () => [{ slug: 'overgrow' }]),
}));
vi.mock('@/lib/pokemon-database', () => ({ getPokemonDatabaseClient: () => ({}) }));

import { generateMetadata } from './[locale]/page';
import robots from './robots';
import sitemap from './sitemap';

describe('PokeLab public identity', () => {
  for (const locale of ['en', 'es']) {
    it(`sets a localized canonical and social URL for ${locale}`, async () => {
      const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });
      expect(metadata.metadataBase?.origin).toBe('https://pokelab.com');
      expect(metadata.alternates?.canonical).toBe(`/${locale}`);
      expect(metadata.openGraph).toMatchObject({
        siteName: 'PokeLab',
        url: `https://pokelab.com/${locale}`,
      });
    });
  }
  it('keeps sitemap and robots on the canonical domain, including entity routes', async () => {
    const entries = await sitemap();
    expect(entries.every(({ url }) => new URL(url).origin === 'https://pokelab.com')).toBe(true);
    expect(entries.map(({ url }) => url)).toContain('https://pokelab.com/es/pokemon/bulbasaur');
    expect(robots().sitemap).toBe('https://pokelab.com/sitemap.xml');
  });
});
