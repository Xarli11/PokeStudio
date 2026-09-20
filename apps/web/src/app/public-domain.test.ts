import { describe, expect, it, vi } from 'vitest';
import type { Metadata } from 'next';
import type * as Database from '@pokestudio/database';

import { generateMetadata as home } from './[locale]/page';
import { generateMetadata as pokemon } from './[locale]/pokemon/page';
import { generateMetadata as species } from './[locale]/pokemon/[slug]/page';
import { generateMetadata as moves } from './[locale]/moves/page';
import { generateMetadata as move } from './[locale]/moves/[slug]/page';
import { generateMetadata as abilities } from './[locale]/abilities/page';
import { generateMetadata as ability } from './[locale]/abilities/[slug]/page';
import { generateMetadata as compare } from './[locale]/compare/page';
import { generateMetadata as build } from './[locale]/build/page';
import { generateMetadata as team } from './[locale]/build/[teamId]/page';

// Metadata contracts must run without credentials or a seeded database.
vi.mock('@pokestudio/database', async (importOriginal) => ({
  ...(await importOriginal<typeof Database>()),
  listSpeciesPage: vi.fn(async () => ({ items: [], totalCount: 1025 })),
  listMovesPage: vi.fn(async () => ({ items: [], totalCount: 937 })),
}));
vi.mock('@/lib/pokemon-database', () => ({
  getPokemonDatabaseClient: vi.fn(() => ({})),
  getCachedAbilitiesList: vi.fn(async () => []),
  getCachedSpeciesBySlug: vi.fn(async () => ({
    name: { en: 'Mew', es: 'Mew' },
    forms: [{}],
  })),
  getCachedMoveBySlug: vi.fn(async () => ({ nameEn: 'Tackle', nameEs: 'Placaje' })),
  getCachedAbilityBySlug: vi.fn(async () => ({ nameEn: 'Overgrow', nameEs: 'Espesura' })),
}));

const pages = [
  { path: '', generate: home },
  { path: '/pokemon', generate: pokemon },
  { path: '/pokemon/mew', generate: species, slug: 'MEW' },
  { path: '/moves', generate: moves },
  { path: '/moves/tackle', generate: move, slug: 'TACKLE' },
  { path: '/abilities', generate: abilities },
  { path: '/abilities/overgrow', generate: ability, slug: 'OVERGROW' },
  { path: '/compare', generate: compare },
  { path: '/build', generate: build },
];

function absolute(value: unknown, metadata: Metadata) {
  return new URL(String(value), metadata.metadataBase!).href;
}

describe.each(['en', 'es'])('public metadata (%s)', (locale) => {
  it.each(pages)(
    'publishes the final canonical, language and social URLs for $path',
    async (page) => {
      const metadata = await page.generate({
        params: Promise.resolve({ locale, slug: page.slug ?? '' }),
      });
      expect(metadata.metadataBase?.href).toBe('https://pokestudio.pro/');
      expect(absolute(metadata.alternates?.canonical, metadata)).toBe(
        `https://pokestudio.pro/${locale}${page.path}`,
      );
      for (const language of ['en', 'es'] as const) {
        expect(absolute(metadata.alternates?.languages?.[language], metadata)).toBe(
          `https://pokestudio.pro/${language}${page.path}`,
        );
      }
      expect(absolute(metadata.openGraph?.url, metadata)).toBe(
        `https://pokestudio.pro/${locale}${page.path}`,
      );
    },
  );

  it('retains the PokeStudio brand on the homepage', async () => {
    const metadata = await home({ params: Promise.resolve({ locale }) });
    expect(metadata.title).toContain('PokeStudio');
  });

  it('keeps local team editors non-indexable and without a public canonical', async () => {
    const metadata = await team({ params: Promise.resolve({ locale, teamId: 'saved-team' }) });
    expect(metadata.robots).toMatchObject({ index: false });
    expect(metadata.alternates?.canonical).toBeUndefined();
  });
});
