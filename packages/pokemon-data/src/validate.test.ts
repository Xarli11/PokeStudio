import { describe, expect, it } from 'vitest';

import type { ExploreDataset, NormalizedForm, NormalizedSpecies } from './types';
import { validateExploreDataset } from './validate';

function makeSpecies(overrides: Partial<NormalizedSpecies> = {}): NormalizedSpecies {
  return {
    slug: 'bulbasaur',
    nationalDexNumber: 1,
    name: { en: 'Bulbasaur', es: 'Bulbasaur' },
    source: { sourceId: 'pokeapi', externalId: '1' },
    ...overrides,
  };
}

function makeForm(overrides: Partial<NormalizedForm> = {}): NormalizedForm {
  return {
    slug: 'bulbasaur',
    speciesSlug: 'bulbasaur',
    name: { en: 'Bulbasaur', es: 'Bulbasaur' },
    isDefault: true,
    category: 'default',
    types: ['grass', 'poison'],
    baseStats: {
      hp: 45,
      attack: 49,
      defense: 49,
      specialAttack: 65,
      specialDefense: 65,
      speed: 45,
    },
    source: { sourceId: 'pokeapi', externalId: '1' },
    ...overrides,
  };
}

function makeDataset(species: NormalizedSpecies[], forms: NormalizedForm[]): ExploreDataset {
  return {
    provenance: {
      sourceId: 'pokeapi',
      sourceUrl: 'https://pokeapi.co/api/v2',
      license: 'BSD-3-Clause',
      fetchedAt: new Date(0).toISOString(),
      importerVersion: 'test',
    },
    species,
    forms,
  };
}

describe('validateExploreDataset', () => {
  it('accepts a well-formed single-form species', () => {
    expect(validateExploreDataset(makeDataset([makeSpecies()], [makeForm()]))).toEqual([]);
  });

  it('accepts a species with one default and multiple non-default forms (Rotom shape)', () => {
    const dataset = makeDataset(
      [makeSpecies({ slug: 'rotom', nationalDexNumber: 479, name: { en: 'Rotom', es: 'Rotom' } })],
      [
        makeForm({ slug: 'rotom', speciesSlug: 'rotom', isDefault: true, category: 'default' }),
        makeForm({
          slug: 'rotom-heat',
          speciesSlug: 'rotom',
          isDefault: false,
          category: 'battle',
          types: ['electric', 'fire'],
        }),
      ],
    );
    expect(validateExploreDataset(dataset)).toEqual([]);
  });

  it('flags duplicate species slugs', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies(), makeSpecies({ nationalDexNumber: 2 })], [makeForm()]),
    );
    expect(issues.some((issue) => issue.message.includes('Duplicate species slug'))).toBe(true);
  });

  it('flags duplicate national dex numbers', () => {
    const issues = validateExploreDataset(
      makeDataset(
        [makeSpecies(), makeSpecies({ slug: 'ivysaur' })],
        [makeForm(), makeForm({ slug: 'ivysaur', speciesSlug: 'ivysaur' })],
      ),
    );
    expect(issues.some((issue) => issue.message.includes('Duplicate national dex number'))).toBe(
      true,
    );
  });

  it('flags a form referencing an unknown species', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm({ speciesSlug: 'missing-species' })]),
    );
    expect(issues.some((issue) => issue.message.includes('unknown species slug'))).toBe(true);
  });

  it('flags a species with no default form', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm({ isDefault: false, category: 'regional' })]),
    );
    expect(issues.some((issue) => issue.message.includes('exactly one default form'))).toBe(true);
  });

  it('flags a species with more than one default form', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm({ slug: 'a' }), makeForm({ slug: 'b' })]),
    );
    expect(issues.some((issue) => issue.message.includes('exactly one default form'))).toBe(true);
  });

  it('flags an invalid type count', () => {
    const issues = validateExploreDataset(makeDataset([makeSpecies()], [makeForm({ types: [] })]));
    expect(issues.some((issue) => issue.message.includes('1-2 types'))).toBe(true);
  });

  it('flags missing localized names', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies({ name: { en: 'Bulbasaur', es: '' } })], [makeForm()]),
    );
    expect(issues.some((issue) => issue.message.includes('localized name'))).toBe(true);
  });

  it('flags non-positive base stats', () => {
    const issues = validateExploreDataset(
      makeDataset(
        [makeSpecies()],
        [
          makeForm({
            baseStats: {
              hp: 0,
              attack: 49,
              defense: 49,
              specialAttack: 65,
              specialDefense: 65,
              speed: 45,
            },
          }),
        ],
      ),
    );
    expect(issues.some((issue) => issue.message.includes('Base stats must be positive'))).toBe(
      true,
    );
  });
});
