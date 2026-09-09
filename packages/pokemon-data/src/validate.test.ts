import { describe, expect, it } from 'vitest';

import type { NormalizedSpecies, ProvenancedDataset } from './types';
import { validateSpeciesDataset } from './validate';

function makeSpecies(overrides: Partial<NormalizedSpecies> = {}): NormalizedSpecies {
  return {
    id: 'pokestudio-species-1',
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
    introducedInGeneration: 1,
    ...overrides,
  };
}

function makeDataset(records: NormalizedSpecies[]): ProvenancedDataset<NormalizedSpecies> {
  return {
    provenance: {
      sourceId: 'pokeapi',
      sourceUrl: 'https://pokeapi.co/api/v2',
      license: 'BSD-3-Clause',
      fetchedAt: new Date(0).toISOString(),
      importerVersion: 'test',
    },
    records,
  };
}

describe('validateSpeciesDataset', () => {
  it('accepts a well-formed dataset', () => {
    expect(validateSpeciesDataset(makeDataset([makeSpecies()]))).toEqual([]);
  });

  it('flags duplicate ids', () => {
    const issues = validateSpeciesDataset(makeDataset([makeSpecies(), makeSpecies()]));
    expect(issues.some((issue) => issue.message.includes('Duplicate species id'))).toBe(true);
  });

  it('flags duplicate national dex numbers', () => {
    const issues = validateSpeciesDataset(
      makeDataset([makeSpecies(), makeSpecies({ id: 'pokestudio-species-2' })]),
    );
    expect(issues.some((issue) => issue.message.includes('Duplicate national dex number'))).toBe(
      true,
    );
  });

  it('flags an invalid type count', () => {
    const issues = validateSpeciesDataset(makeDataset([makeSpecies({ types: [] })]));
    expect(issues.some((issue) => issue.message.includes('1-2 types'))).toBe(true);
  });

  it('flags missing localized names', () => {
    const issues = validateSpeciesDataset(
      makeDataset([makeSpecies({ name: { en: 'Bulbasaur', es: '' } })]),
    );
    expect(issues.some((issue) => issue.message.includes('localized name'))).toBe(true);
  });

  it('flags non-positive base stats', () => {
    const issues = validateSpeciesDataset(
      makeDataset([
        makeSpecies({
          baseStats: {
            hp: 0,
            attack: 49,
            defense: 49,
            specialAttack: 65,
            specialDefense: 65,
            speed: 45,
          },
        }),
      ]),
    );
    expect(issues.some((issue) => issue.message.includes('Base stats must be positive'))).toBe(
      true,
    );
  });
});
