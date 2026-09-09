import { describe, expect, it } from 'vitest';

import { buildAuditReport, formatAuditReport } from './audit';
import type { NormalizedDataset, NormalizedForm, NormalizedSpecies } from './types';

function species(overrides: Partial<NormalizedSpecies> = {}): NormalizedSpecies {
  return {
    slug: 'bulbasaur',
    nationalDexNumber: 1,
    name: { en: 'Bulbasaur', es: 'Bulbasaur' },
    source: { sourceId: 'pokeapi', externalId: '1' },
    ...overrides,
  };
}

function form(overrides: Partial<NormalizedForm> = {}): NormalizedForm {
  return {
    slug: 'bulbasaur',
    speciesSlug: 'bulbasaur',
    name: { en: 'Bulbasaur', es: 'Bulbasaur' },
    isDefault: true,
    category: 'default',
    types: ['grass'],
    baseStats: { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 },
    source: { sourceId: 'pokeapi', externalId: '1' },
    ...overrides,
  };
}

const dataset: NormalizedDataset = {
  provenance: {
    sourceId: 'pokeapi',
    sourceUrl: 'https://pokeapi.co/api/v2',
    license: 'BSD-3-Clause',
    fetchedAt: new Date(0).toISOString(),
    importerVersion: 'test',
  },
  species: [species(), species({ slug: 'rotom', nationalDexNumber: 479 })],
  forms: [
    form(),
    form({ slug: 'rotom', speciesSlug: 'rotom' }),
    form({ slug: 'rotom-heat', speciesSlug: 'rotom', isDefault: false, category: 'battle' }),
    form({ slug: 'rotom-wash', speciesSlug: 'rotom', isDefault: false, category: 'battle' }),
  ],
};

describe('buildAuditReport', () => {
  it('counts species/forms and groups by category', () => {
    const report = buildAuditReport({ dataset, localizationNotes: [], validationIssues: [] });
    expect(report.totalSpecies).toBe(2);
    expect(report.totalForms).toBe(4);
    expect(report.formsByCategory).toEqual({ default: 2, regional: 0, battle: 2, cosmetic: 0 });
    expect(report.speciesWithMultipleForms).toBe(1);
    expect(report.largestFormFamilies[0]).toEqual({ speciesSlug: 'rotom', formCount: 3 });
  });

  it('distinguishes regional-composed localization from genuine fallback gaps', () => {
    const report = buildAuditReport({
      dataset,
      localizationNotes: [
        { formSlug: 'rotom-heat', esSource: 'composed-regional' },
        { formSlug: 'rotom-wash', esSource: 'composed-fallback' },
      ],
      validationIssues: [],
    });
    expect(report.localization.composedRegional).toBe(1);
    expect(report.localization.composedFallback).toBe(1);
    expect(report.localization.fallbackFormSlugs).toEqual(['rotom-wash']);
  });

  it('surfaces validation issues', () => {
    const report = buildAuditReport({
      dataset,
      localizationNotes: [],
      validationIssues: [{ recordId: 'x', message: 'bad thing' }],
    });
    expect(report.validationIssueCount).toBe(1);
    expect(report.validationIssuesSample).toHaveLength(1);
  });
});

describe('formatAuditReport', () => {
  it('renders a human-readable, non-empty report', () => {
    const report = buildAuditReport({ dataset, localizationNotes: [], validationIssues: [] });
    const text = formatAuditReport(report);
    expect(text).toContain('Species: 2');
    expect(text).toContain('Forms: 4');
    expect(text).toContain('rotom: 3 forms');
  });
});
