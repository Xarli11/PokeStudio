import { describe, expect, it } from 'vitest';

import type {
  NormalizedAbility,
  NormalizedDataset,
  NormalizedEvolution,
  NormalizedForm,
  NormalizedFormAbility,
  NormalizedLearnMethod,
  NormalizedLearnsetEntry,
  NormalizedMachine,
  NormalizedMove,
  NormalizedSpecies,
  NormalizedVersionGroup,
} from './types';
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

function makeAbility(overrides: Partial<NormalizedAbility> = {}): NormalizedAbility {
  return {
    slug: 'overgrow',
    nameEn: 'Overgrow',
    nameEs: 'Espesura',
    effectEn: 'Powers up Grass-type moves when the Pokémon is in trouble.',
    source: { sourceId: 'pokeapi', externalId: '65' },
    ...overrides,
  };
}

function makeFormAbility(overrides: Partial<NormalizedFormAbility> = {}): NormalizedFormAbility {
  return {
    formSlug: 'bulbasaur',
    abilitySlug: 'overgrow',
    slot: 1,
    isHidden: false,
    ...overrides,
  };
}

function makeEvolution(overrides: Partial<NormalizedEvolution> = {}): NormalizedEvolution {
  return {
    chainExternalId: '1',
    fromSpeciesSlug: 'bulbasaur',
    toSpeciesSlug: 'ivysaur',
    trigger: 'level-up',
    minLevel: 16,
    needsOverworldRain: false,
    turnUpsideDown: false,
    raw: {},
    source: { sourceId: 'pokeapi', externalId: '1:ivysaur:0' },
    ...overrides,
  };
}

function makeMove(overrides: Partial<NormalizedMove> = {}): NormalizedMove {
  return {
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
    ...overrides,
  };
}

function makeVersionGroup(overrides: Partial<NormalizedVersionGroup> = {}): NormalizedVersionGroup {
  return {
    slug: 'red-blue',
    generation: 1,
    displayOrder: 1,
    source: { sourceId: 'pokeapi', externalId: '1' },
    ...overrides,
  };
}

function makeLearnMethod(overrides: Partial<NormalizedLearnMethod> = {}): NormalizedLearnMethod {
  return { slug: 'level-up', source: { sourceId: 'pokeapi', externalId: '1' }, ...overrides };
}

function makeLearnsetEntry(
  overrides: Partial<NormalizedLearnsetEntry> = {},
): NormalizedLearnsetEntry {
  return {
    formSlug: 'bulbasaur',
    moveSlug: 'tackle',
    versionGroupSlug: 'red-blue',
    learnMethodSlug: 'level-up',
    level: 1,
    ...overrides,
  };
}

function makeMachine(overrides: Partial<NormalizedMachine> = {}): NormalizedMachine {
  return {
    moveSlug: 'tackle',
    versionGroupSlug: 'red-blue',
    itemSlug: 'tm01',
    source: { sourceId: 'pokeapi', externalId: '1' },
    ...overrides,
  };
}

function makeDataset(
  species: NormalizedSpecies[],
  forms: NormalizedForm[],
  options: {
    abilities?: NormalizedAbility[];
    formAbilities?: NormalizedFormAbility[];
    evolutions?: NormalizedEvolution[];
    moves?: NormalizedMove[];
    versionGroups?: NormalizedVersionGroup[];
    learnMethods?: NormalizedLearnMethod[];
    learnsetEntries?: NormalizedLearnsetEntry[];
    machines?: NormalizedMachine[];
  } = {},
): NormalizedDataset {
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
    abilities: options.abilities ?? [],
    formAbilities: options.formAbilities ?? [],
    evolutions: options.evolutions ?? [],
    moves: options.moves ?? [],
    versionGroups: options.versionGroups ?? [],
    learnMethods: options.learnMethods ?? [],
    learnsetEntries: options.learnsetEntries ?? [],
    machines: options.machines ?? [],
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
          source: { sourceId: 'pokeapi', externalId: '10058' },
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

  it('flags an invalid national dex number', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies({ nationalDexNumber: 0 })], [makeForm()]),
    );
    expect(issues.some((issue) => issue.message.includes('Invalid national dex number'))).toBe(
      true,
    );
  });

  it('flags a form referencing an unknown species as an orphan', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm({ speciesSlug: 'missing-species' })]),
    );
    expect(issues.some((issue) => issue.message.includes('Orphan form'))).toBe(true);
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

  it('flags an unknown type value', () => {
    const issues = validateExploreDataset(
      // @ts-expect-error deliberately invalid at the type boundary, as would arrive from untrusted input
      makeDataset([makeSpecies()], [makeForm({ types: ['not-a-real-type'] })]),
    );
    expect(issues.some((issue) => issue.message.includes('Unknown type'))).toBe(true);
  });

  it('flags an unknown form category value', () => {
    const issues = validateExploreDataset(
      // @ts-expect-error deliberately invalid at the type boundary
      makeDataset([makeSpecies()], [makeForm({ category: 'mythical' })]),
    );
    expect(issues.some((issue) => issue.message.includes('Unknown form category'))).toBe(true);
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
    expect(issues.some((issue) => issue.message.includes('Base stat "hp"'))).toBe(true);
  });

  it('flags missing provenance', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies({ source: { sourceId: '', externalId: '' } })], [makeForm()]),
    );
    expect(issues.some((issue) => issue.message.includes('Missing provenance'))).toBe(true);
  });

  it('flags an external identity collision between two species', () => {
    const issues = validateExploreDataset(
      makeDataset(
        [
          makeSpecies(),
          makeSpecies({ slug: 'fake-duplicate', nationalDexNumber: 2 }), // same source/externalId as makeSpecies()
        ],
        [makeForm(), makeForm({ slug: 'fake-duplicate', speciesSlug: 'fake-duplicate' })],
      ),
    );
    expect(issues.some((issue) => issue.message.includes('External identity collision'))).toBe(
      true,
    );
  });

  it('accepts a well-formed ability shared by two forms', () => {
    const dataset = makeDataset(
      [
        makeSpecies(),
        makeSpecies({
          slug: 'ivysaur',
          nationalDexNumber: 2,
          source: { sourceId: 'pokeapi', externalId: '2' },
        }),
      ],
      [
        makeForm(),
        makeForm({
          slug: 'ivysaur',
          speciesSlug: 'ivysaur',
          source: { sourceId: 'pokeapi', externalId: '2' },
        }),
      ],
      {
        abilities: [makeAbility()],
        formAbilities: [
          makeFormAbility({ formSlug: 'bulbasaur' }),
          makeFormAbility({ formSlug: 'ivysaur' }),
        ],
      },
    );
    expect(validateExploreDataset(dataset)).toEqual([]);
  });

  it('accepts a hidden ability alongside two regular abilities', () => {
    const dataset = makeDataset([makeSpecies()], [makeForm()], {
      abilities: [
        makeAbility(),
        makeAbility({
          slug: 'chlorophyll',
          nameEn: 'Chlorophyll',
          source: { sourceId: 'pokeapi', externalId: '34' },
        }),
        makeAbility({
          slug: 'leaf-guard',
          nameEn: 'Leaf Guard',
          source: { sourceId: 'pokeapi', externalId: '102' },
        }),
      ],
      formAbilities: [
        makeFormAbility({ abilitySlug: 'overgrow', slot: 1, isHidden: false }),
        makeFormAbility({ abilitySlug: 'chlorophyll', slot: 2, isHidden: false }),
        makeFormAbility({ abilitySlug: 'leaf-guard', slot: 3, isHidden: true }),
      ],
    });
    expect(validateExploreDataset(dataset)).toEqual([]);
  });

  it('flags a duplicate ability slug', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm()], {
        abilities: [
          makeAbility(),
          makeAbility({ source: { sourceId: 'pokeapi', externalId: '99' } }),
        ],
      }),
    );
    expect(issues.some((issue) => issue.message.includes('Duplicate ability slug'))).toBe(true);
  });

  it('flags a form ability referencing an unknown ability', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm()], {
        formAbilities: [makeFormAbility({ abilitySlug: 'does-not-exist' })],
      }),
    );
    expect(
      issues.some((issue) => issue.message.includes('unknown ability slug "does-not-exist"')),
    ).toBe(true);
  });

  it('flags a form ability referencing an unknown form', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm()], {
        abilities: [makeAbility()],
        formAbilities: [makeFormAbility({ formSlug: 'does-not-exist' })],
      }),
    );
    expect(
      issues.some((issue) => issue.message.includes('unknown form slug "does-not-exist"')),
    ).toBe(true);
  });

  it('flags two abilities claiming the same slot on one form', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm()], {
        abilities: [
          makeAbility(),
          makeAbility({ slug: 'chlorophyll', source: { sourceId: 'pokeapi', externalId: '34' } }),
        ],
        formAbilities: [
          makeFormAbility({ abilitySlug: 'overgrow', slot: 1 }),
          makeFormAbility({ abilitySlug: 'chlorophyll', slot: 1 }),
        ],
      }),
    );
    expect(issues.some((issue) => issue.message.includes('Duplicate ability slot'))).toBe(true);
  });

  it('accepts a species with no evolution (Ditto shape — zero edges)', () => {
    const dataset = makeDataset(
      [makeSpecies({ slug: 'ditto', nationalDexNumber: 132 })],
      [makeForm({ slug: 'ditto', speciesSlug: 'ditto' })],
      { evolutions: [] },
    );
    expect(validateExploreDataset(dataset)).toEqual([]);
  });

  it('accepts a linear evolution chain', () => {
    const dataset = makeDataset(
      [
        makeSpecies(),
        makeSpecies({
          slug: 'ivysaur',
          nationalDexNumber: 2,
          source: { sourceId: 'pokeapi', externalId: '2' },
        }),
        makeSpecies({
          slug: 'venusaur',
          nationalDexNumber: 3,
          source: { sourceId: 'pokeapi', externalId: '3' },
        }),
      ],
      [
        makeForm(),
        makeForm({
          slug: 'ivysaur',
          speciesSlug: 'ivysaur',
          source: { sourceId: 'pokeapi', externalId: '2' },
        }),
        makeForm({
          slug: 'venusaur',
          speciesSlug: 'venusaur',
          source: { sourceId: 'pokeapi', externalId: '3' },
        }),
      ],
      {
        evolutions: [
          makeEvolution(),
          makeEvolution({
            fromSpeciesSlug: 'ivysaur',
            toSpeciesSlug: 'venusaur',
            minLevel: 32,
            source: { sourceId: 'pokeapi', externalId: '1:venusaur:0' },
          }),
        ],
      },
    );
    expect(validateExploreDataset(dataset)).toEqual([]);
  });

  it('accepts a branching evolution (Eevee shape)', () => {
    const dataset = makeDataset(
      [
        makeSpecies({
          slug: 'eevee',
          nationalDexNumber: 133,
          source: { sourceId: 'pokeapi', externalId: '133' },
        }),
        makeSpecies({
          slug: 'vaporeon',
          nationalDexNumber: 134,
          source: { sourceId: 'pokeapi', externalId: '134' },
        }),
        makeSpecies({
          slug: 'jolteon',
          nationalDexNumber: 135,
          source: { sourceId: 'pokeapi', externalId: '135' },
        }),
        makeSpecies({
          slug: 'flareon',
          nationalDexNumber: 136,
          source: { sourceId: 'pokeapi', externalId: '136' },
        }),
      ],
      [
        makeForm({
          slug: 'eevee',
          speciesSlug: 'eevee',
          source: { sourceId: 'pokeapi', externalId: '133' },
        }),
        makeForm({
          slug: 'vaporeon',
          speciesSlug: 'vaporeon',
          source: { sourceId: 'pokeapi', externalId: '134' },
        }),
        makeForm({
          slug: 'jolteon',
          speciesSlug: 'jolteon',
          source: { sourceId: 'pokeapi', externalId: '135' },
        }),
        makeForm({
          slug: 'flareon',
          speciesSlug: 'flareon',
          source: { sourceId: 'pokeapi', externalId: '136' },
        }),
      ],
      {
        evolutions: [
          makeEvolution({
            chainExternalId: '67',
            fromSpeciesSlug: 'eevee',
            toSpeciesSlug: 'vaporeon',
            trigger: 'use-item',
            minLevel: undefined,
            itemSlug: 'water-stone',
            source: { sourceId: 'pokeapi', externalId: '67:vaporeon:0' },
          }),
          makeEvolution({
            chainExternalId: '67',
            fromSpeciesSlug: 'eevee',
            toSpeciesSlug: 'jolteon',
            trigger: 'use-item',
            minLevel: undefined,
            itemSlug: 'thunder-stone',
            source: { sourceId: 'pokeapi', externalId: '67:jolteon:0' },
          }),
          makeEvolution({
            chainExternalId: '67',
            fromSpeciesSlug: 'eevee',
            toSpeciesSlug: 'flareon',
            trigger: 'use-item',
            minLevel: undefined,
            itemSlug: 'fire-stone',
            source: { sourceId: 'pokeapi', externalId: '67:flareon:0' },
          }),
        ],
      },
    );
    expect(validateExploreDataset(dataset)).toEqual([]);
  });

  it('accepts a multi-condition evolution edge (Feebas -> Milotic shape)', () => {
    const dataset = makeDataset(
      [
        makeSpecies({
          slug: 'feebas',
          nationalDexNumber: 349,
          source: { sourceId: 'pokeapi', externalId: '349' },
        }),
        makeSpecies({
          slug: 'milotic',
          nationalDexNumber: 350,
          source: { sourceId: 'pokeapi', externalId: '350' },
        }),
      ],
      [
        makeForm({
          slug: 'feebas',
          speciesSlug: 'feebas',
          source: { sourceId: 'pokeapi', externalId: '349' },
        }),
        makeForm({
          slug: 'milotic',
          speciesSlug: 'milotic',
          source: { sourceId: 'pokeapi', externalId: '350' },
        }),
      ],
      {
        evolutions: [
          makeEvolution({
            chainExternalId: '160',
            fromSpeciesSlug: 'feebas',
            toSpeciesSlug: 'milotic',
            trigger: 'level-up',
            minLevel: undefined,
            minBeauty: 170,
            source: { sourceId: 'pokeapi', externalId: '160:milotic:0' },
          }),
          makeEvolution({
            chainExternalId: '160',
            fromSpeciesSlug: 'feebas',
            toSpeciesSlug: 'milotic',
            trigger: 'trade',
            minLevel: undefined,
            heldItemSlug: 'prism-scale',
            source: { sourceId: 'pokeapi', externalId: '160:milotic:1' },
          }),
        ],
      },
    );
    expect(validateExploreDataset(dataset)).toEqual([]);
  });

  it('flags an evolution edge referencing an unknown species', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm()], {
        evolutions: [makeEvolution({ toSpeciesSlug: 'does-not-exist' })],
      }),
    );
    expect(
      issues.some((issue) => issue.message.includes('unknown species slug "does-not-exist"')),
    ).toBe(true);
  });

  it('flags an evolution edge with a missing trigger', () => {
    const issues = validateExploreDataset(
      makeDataset(
        [makeSpecies(), makeSpecies({ slug: 'ivysaur', nationalDexNumber: 2 })],
        [makeForm(), makeForm({ slug: 'ivysaur', speciesSlug: 'ivysaur' })],
        { evolutions: [makeEvolution({ trigger: '' })] },
      ),
    );
    expect(issues.some((issue) => issue.message.includes('Missing evolution trigger'))).toBe(true);
  });

  it('flags a self-referencing evolution edge', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm()], {
        evolutions: [makeEvolution({ fromSpeciesSlug: 'bulbasaur', toSpeciesSlug: 'bulbasaur' })],
      }),
    );
    expect(issues.some((issue) => issue.message.includes('cannot point a species to itself'))).toBe(
      true,
    );
  });
});

describe('validateExploreDataset — moves and learnsets', () => {
  it('accepts a valid move/learnset/machine dataset', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm()], {
        moves: [makeMove()],
        versionGroups: [makeVersionGroup()],
        learnMethods: [makeLearnMethod()],
        learnsetEntries: [makeLearnsetEntry()],
        machines: [makeMachine()],
      }),
    );
    expect(issues).toEqual([]);
  });

  it('flags a duplicate move slug', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm()], {
        moves: [makeMove(), makeMove({ source: { sourceId: 'pokeapi', externalId: '34' } })],
      }),
    );
    expect(issues.some((issue) => issue.message === 'Duplicate move slug.')).toBe(true);
  });

  it('flags an unknown move type and damage class', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm()], {
        moves: [makeMove({ type: 'nonsense' as never, damageClass: 'nonsense' as never })],
      }),
    );
    expect(issues.some((issue) => issue.message.includes('Unknown type'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('Unknown damage class'))).toBe(true);
  });

  it('flags out-of-range accuracy/power/pp', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm()], {
        moves: [makeMove({ accuracy: 150, power: -5, pp: 0 })],
      }),
    );
    expect(issues.some((issue) => issue.message.includes('Accuracy must be'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('Power must be'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('PP must be'))).toBe(true);
  });

  it('flags an unknown stat name and an out-of-range stat change', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm()], {
        moves: [
          makeMove({
            statChanges: [
              { stat: 'nonsense' as never, change: 1 },
              { stat: 'attack', change: 0 as never },
              { stat: 'defense', change: 7 },
            ],
          }),
        ],
      }),
    );
    expect(issues.some((issue) => issue.message.includes('Unknown stat'))).toBe(true);
    expect(issues.filter((issue) => issue.message.includes('Stat change must be')).length).toBe(2);
  });

  it('accepts a real multi-stat change (Growl: -1 Attack)', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm()], {
        moves: [makeMove({ statChanges: [{ stat: 'attack', change: -1 }] })],
      }),
    );
    expect(issues).toEqual([]);
  });

  it('flags a learnset entry referencing an unknown form, move, version group or method', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm()], {
        moves: [makeMove()],
        versionGroups: [makeVersionGroup()],
        learnMethods: [makeLearnMethod()],
        learnsetEntries: [
          makeLearnsetEntry({ formSlug: 'does-not-exist' }),
          makeLearnsetEntry({ moveSlug: 'does-not-exist' }),
          makeLearnsetEntry({ versionGroupSlug: 'does-not-exist' }),
          makeLearnsetEntry({ learnMethodSlug: 'does-not-exist' }),
        ],
      }),
    );
    expect(issues.some((i) => i.message.includes('unknown form "does-not-exist"'))).toBe(true);
    expect(issues.some((i) => i.message.includes('unknown move "does-not-exist"'))).toBe(true);
    expect(issues.some((i) => i.message.includes('unknown version group "does-not-exist"'))).toBe(
      true,
    );
    expect(issues.some((i) => i.message.includes('Unknown learn method "does-not-exist"'))).toBe(
      true,
    );
  });

  it('flags a negative level but allows the same key at two different levels', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm()], {
        moves: [makeMove()],
        versionGroups: [makeVersionGroup()],
        learnMethods: [makeLearnMethod()],
        learnsetEntries: [
          makeLearnsetEntry({ level: -1 }),
          makeLearnsetEntry({ level: 1 }),
          makeLearnsetEntry({ level: 8 }),
        ],
      }),
    );
    expect(issues.some((i) => i.message.includes('non-negative integer'))).toBe(true);
    expect(issues.some((i) => i.message === 'Duplicate learnset natural key.')).toBe(false);
  });

  it('flags a true duplicate learnset natural key', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm()], {
        moves: [makeMove()],
        versionGroups: [makeVersionGroup()],
        learnMethods: [makeLearnMethod()],
        learnsetEntries: [makeLearnsetEntry(), makeLearnsetEntry()],
      }),
    );
    expect(issues.some((i) => i.message === 'Duplicate learnset natural key.')).toBe(true);
  });

  it('flags a machine referencing an unknown move or version group', () => {
    const issues = validateExploreDataset(
      makeDataset([makeSpecies()], [makeForm()], {
        moves: [makeMove()],
        versionGroups: [makeVersionGroup()],
        machines: [makeMachine({ moveSlug: 'does-not-exist' })],
      }),
    );
    expect(issues.some((i) => i.message.includes('Orphan machine: unknown move'))).toBe(true);
  });
});
