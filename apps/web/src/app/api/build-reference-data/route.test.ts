import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Item, Nature, SpeciesSearchAlias, SpeciesSearchItem } from '@pokestudio/database';

const getSpeciesSearchIndex = vi.fn();
const listNatures = vi.fn();
const listItems = vi.fn();

vi.mock('@pokestudio/database', () => ({
  getSpeciesSearchIndex: (...args: unknown[]) => getSpeciesSearchIndex(...args),
  listNatures: (...args: unknown[]) => listNatures(...args),
  listItems: (...args: unknown[]) => listItems(...args),
}));
vi.mock('@/lib/pokemon-database', () => ({
  getPokemonDatabaseClient: () => 'fake-client',
}));

const FAKE_SEARCH_INDEX: { items: SpeciesSearchItem[]; aliases: SpeciesSearchAlias[] } = {
  items: [
    {
      slug: 'bulbasaur',
      formSlug: 'bulbasaur',
      nationalDexNumber: 1,
      name: { en: 'Bulbasaur', es: 'Bulbasaur' },
      types: ['grass', 'poison'],
      baseStats: {
        hp: 45,
        attack: 49,
        defense: 49,
        specialAttack: 65,
        specialDefense: 65,
        speed: 45,
      },
      pokeapiPokemonId: 1,
    },
  ],
  aliases: [],
};
const FAKE_NATURES: Nature[] = [
  {
    slug: 'adamant',
    nameEn: 'Adamant',
    nameEs: 'Firme',
    increasedStat: 'attack',
    decreasedStat: 'special-attack',
  },
];
const FAKE_ITEMS: Item[] = [
  { slug: 'leftovers', nameEn: 'Leftovers', nameEs: 'Restos', category: 'held-items' },
];

beforeEach(() => {
  getSpeciesSearchIndex.mockReset().mockResolvedValue(FAKE_SEARCH_INDEX);
  listNatures.mockReset().mockResolvedValue(FAKE_NATURES);
  listItems.mockReset().mockResolvedValue(FAKE_ITEMS);
  vi.unstubAllEnvs();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function callRoute(url: string) {
  const { GET } = await import('./route');
  return GET(new Request(url));
}

describe('GET /api/build-reference-data', () => {
  it('returns exactly searchIndex/natures/items — no private/user data, no extra fields', async () => {
    const response = await callRoute('https://pokestudio.pro/api/build-reference-data');
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(['items', 'natures', 'searchIndex']);
    expect(body.searchIndex).toEqual(FAKE_SEARCH_INDEX);
    expect(body.natures).toEqual(FAKE_NATURES);
    expect(body.items).toEqual(FAKE_ITEMS);
  });

  it('runs the three queries concurrently (Promise.all), not sequentially', async () => {
    // Each mock is independently controllable; if they ran sequentially,
    // natures/items would only be called after searchIndex's promise
    // settles. Deferring searchIndex and asserting the other two were
    // already invoked proves they were started together.
    let resolveSearchIndex!: (value: typeof FAKE_SEARCH_INDEX) => void;
    getSpeciesSearchIndex.mockReturnValue(new Promise((resolve) => (resolveSearchIndex = resolve)));

    const { GET } = await import('./route');
    const pending = GET(new Request('https://pokestudio.pro/api/build-reference-data'));
    // GET's synchronous body (up to its `await Promise.all(...)`) has already
    // run by the time the awaited import resolves and GET returns its
    // pending promise — no extra tick needed.
    expect(listNatures).toHaveBeenCalled();
    expect(listItems).toHaveBeenCalled();

    resolveSearchIndex(FAKE_SEARCH_INDEX);
    await pending;
  });

  it('uses long, immutable caching when ?v matches the current release SHA', async () => {
    vi.stubEnv('POKESTUDIO_RELEASE_SHA', 'sha-current');
    const response = await callRoute(
      'https://pokestudio.pro/api/build-reference-data?v=sha-current',
    );
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
  });

  it('never serves immutable caching for a version-mismatched request (stale tab after a deploy)', async () => {
    vi.stubEnv('POKESTUDIO_RELEASE_SHA', 'sha-new');
    const response = await callRoute('https://pokestudio.pro/api/build-reference-data?v=sha-old');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    // Still serves the CURRENT data, not a 404/redirect loop, so a stale tab keeps working.
    const body = await response.json();
    expect(body.searchIndex).toEqual(FAKE_SEARCH_INDEX);
  });

  it('never serves immutable caching for a request with no ?v at all', async () => {
    vi.stubEnv('POKESTUDIO_RELEASE_SHA', 'sha-current');
    const response = await callRoute('https://pokestudio.pro/api/build-reference-data');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('falls back to no-store when POKESTUDIO_RELEASE_SHA is unset (local dev) — no invented SHA', async () => {
    const response = await callRoute('https://pokestudio.pro/api/build-reference-data?v=anything');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json();
    expect(body.searchIndex).toEqual(FAKE_SEARCH_INDEX);
  });
});
