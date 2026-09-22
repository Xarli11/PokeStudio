import { describe, expect, it } from 'vitest';

import type { Item } from '@pokestudio/database';

import { itemDisplayName, searchItems } from './item-search';

const LIFE_ORB: Item = {
  slug: 'life-orb',
  nameEn: 'Life Orb',
  nameEs: 'Vidasfera',
  category: 'held',
};
const LEFTOVERS: Item = {
  slug: 'leftovers',
  nameEn: 'Leftovers',
  nameEs: 'Restos',
  category: 'held',
};
const LUM_BERRY: Item = {
  slug: 'lum-berry',
  nameEn: 'Lum Berry',
  nameEs: 'Zurcidera',
  category: 'held',
};

describe('itemDisplayName', () => {
  it('prefers the Spanish name in es, falls back to English when absent', () => {
    expect(itemDisplayName(LIFE_ORB, 'es')).toBe('Vidasfera');
    expect(itemDisplayName({ ...LIFE_ORB, nameEs: undefined }, 'es')).toBe('Life Orb');
  });
});

describe('searchItems', () => {
  const items = [LIFE_ORB, LEFTOVERS, LUM_BERRY];

  it('an empty query returns every item alphabetically', () => {
    expect(searchItems(items, '', 'en').map((i) => i.slug)).toEqual([
      'leftovers',
      'life-orb',
      'lum-berry',
    ]);
  });

  it('ranks an exact match first, then startsWith, then contains', () => {
    const results = searchItems(items, 'l', 'en');
    // All three start with "l" — alphabetical tie-break within the same rank.
    expect(results.map((i) => i.slug)).toEqual(['leftovers', 'life-orb', 'lum-berry']);
    expect(searchItems(items, 'orb', 'en').map((i) => i.slug)).toEqual(['life-orb']);
  });

  it('matches against the localized name too', () => {
    expect(searchItems(items, 'vidasfera', 'es').map((i) => i.slug)).toEqual(['life-orb']);
  });

  it('a query matching nothing returns an empty list', () => {
    expect(searchItems(items, 'xyz', 'en')).toEqual([]);
  });
});
