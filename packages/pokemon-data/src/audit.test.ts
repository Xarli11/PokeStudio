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
  abilities: [
    {
      slug: 'overgrow',
      nameEn: 'Overgrow',
      nameEs: 'Espesura',
      effectEn: 'Powers up Grass-type moves in a pinch.',
      source: { sourceId: 'pokeapi', externalId: '65' },
    },
  ],
  formAbilities: [
    { formSlug: 'bulbasaur', abilitySlug: 'overgrow', slot: 1, isHidden: false },
    { formSlug: 'rotom', abilitySlug: 'overgrow', slot: 1, isHidden: false },
  ],
  evolutions: [],
  moves: [
    {
      slug: 'tackle',
      nameEn: 'Tackle',
      nameEs: 'Placaje',
      type: 'normal',
      damageClass: 'physical',
      power: 40,
      accuracy: 100,
      pp: 35,
      priority: 0,
      target: 'selected-pokemon',
      generation: 1,
      ailment: 'none',
      category: 'damage',
      drain: 0,
      healing: 0,
      critRate: 0,
      ailmentChance: 0,
      flinchChance: 0,
      statChance: 0,
      statChanges: [],
      source: { sourceId: 'pokeapi', externalId: '33' },
    },
  ],
  versionGroups: [
    {
      slug: 'red-blue',
      generation: 1,
      displayOrder: 1,
      source: { sourceId: 'pokeapi', externalId: '1' },
    },
  ],
  learnMethods: [{ slug: 'level-up', source: { sourceId: 'pokeapi', externalId: '1' } }],
  learnsetEntries: [
    {
      formSlug: 'bulbasaur',
      moveSlug: 'tackle',
      versionGroupSlug: 'red-blue',
      learnMethodSlug: 'level-up',
      level: 1,
    },
    {
      formSlug: 'rotom',
      moveSlug: 'tackle',
      versionGroupSlug: 'red-blue',
      learnMethodSlug: 'level-up',
      level: 1,
    },
    {
      formSlug: 'rotom',
      moveSlug: 'tackle',
      versionGroupSlug: 'red-blue',
      learnMethodSlug: 'level-up',
      level: 5,
    },
  ],
  machines: [],
  natures: [],
  items: [],
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

  it('counts moves/learnsets and finds the same key at multiple levels', () => {
    const report = buildAuditReport({ dataset, localizationNotes: [], validationIssues: [] });
    expect(report.moves.totalMoves).toBe(1);
    expect(report.moves.byDamageClass).toEqual({ physical: 1 });
    expect(report.learnsets.totalEntries).toBe(3);
    expect(report.learnsets.byLearnMethod).toEqual({ 'level-up': 3 });
    // rotom/tackle/red-blue/level-up appears at both level 1 and level 5 — a
    // real relearn mechanic (docs/adr/0013), not a duplicate to collapse.
    expect(report.learnsets.multiLevelKeyCount).toBe(1);
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
