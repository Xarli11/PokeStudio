import { describe, expect, it } from 'vitest';

import type { AbilityListItem } from '@pokelab/database';

import { filterAbilities } from './ability-search';

const ITEMS: AbilityListItem[] = [
  { slug: 'overgrow', nameEn: 'Overgrow', nameEs: 'Espesura', effectEn: 'Powers up Grass moves.' },
  {
    slug: 'chlorophyll',
    nameEn: 'Chlorophyll',
    nameEs: 'Clorofila',
    effectEn: 'Boosts Speed in harsh sunlight.',
  },
  {
    slug: 'levitate',
    nameEn: 'Levitate',
    nameEs: undefined,
    effectEn: 'Gives full immunity to Ground moves.',
  },
];

describe('filterAbilities', () => {
  it('returns nothing for an empty query', () => {
    expect(filterAbilities(ITEMS, '')).toEqual([]);
  });

  it('matches the English name, case-insensitively', () => {
    expect(filterAbilities(ITEMS, 'OVERGROW').map((a) => a.slug)).toEqual(['overgrow']);
  });

  it('matches the Spanish name', () => {
    expect(filterAbilities(ITEMS, 'clorofila').map((a) => a.slug)).toEqual(['chlorophyll']);
  });

  it('is substring, not exact-match', () => {
    expect(filterAbilities(ITEMS, 'grow').map((a) => a.slug)).toEqual(['overgrow']);
    expect(filterAbilities(ITEMS, 'phyll').map((a) => a.slug)).toEqual(['chlorophyll']);
  });

  it('never throws for an ability with no Spanish name', () => {
    expect(filterAbilities(ITEMS, 'levitate').map((a) => a.slug)).toEqual(['levitate']);
  });

  it('returns empty when nothing matches', () => {
    expect(filterAbilities(ITEMS, 'zzz-not-an-ability')).toEqual([]);
  });
});
