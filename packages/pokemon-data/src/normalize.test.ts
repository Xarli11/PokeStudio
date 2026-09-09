import { describe, expect, it } from 'vitest';

import { normalizeSpeciesGroup, type RawSpeciesGroup } from './normalize';
import type { PokeApiPokemon, PokeApiPokemonForm } from './pokeapi-client';

// Fixtures below are literal captures of real PokéAPI responses — normalization
// is tested against fixture data, never a live network call (§18: "Mock/fixture
// the source boundary for deterministic unit tests").

function pokemon(
  overrides: Partial<PokeApiPokemon> & { id: number; name: string },
): PokeApiPokemon {
  return {
    types: [{ slot: 1, type: { name: 'normal', url: '' } }],
    stats: [
      { base_stat: 45, stat: { name: 'hp', url: '' } },
      { base_stat: 49, stat: { name: 'attack', url: '' } },
      { base_stat: 49, stat: { name: 'defense', url: '' } },
      { base_stat: 65, stat: { name: 'special-attack', url: '' } },
      { base_stat: 65, stat: { name: 'special-defense', url: '' } },
      { base_stat: 45, stat: { name: 'speed', url: '' } },
    ],
    forms: [],
    ...overrides,
  };
}

function form(
  overrides: Partial<PokeApiPokemonForm> & { id: number; name: string },
): PokeApiPokemonForm {
  return {
    form_name: '',
    is_default: true,
    is_battle_only: false,
    is_mega: false,
    names: [],
    form_names: [],
    ...overrides,
  };
}

describe('normalizeSpeciesGroup', () => {
  it('normalizes a simple single-form species (Bulbasaur)', () => {
    const group: RawSpeciesGroup = {
      species: {
        id: 1,
        name: 'bulbasaur',
        names: [
          { name: 'Bulbasaur', language: { name: 'en', url: '' } },
          { name: 'Bulbasaur', language: { name: 'es', url: '' } },
        ],
        varieties: [{ is_default: true, pokemon: { name: 'bulbasaur', url: '' } }],
      },
      varieties: [
        {
          isDefaultVariety: true,
          pokemon: pokemon({
            id: 1,
            name: 'bulbasaur',
            types: [
              { slot: 1, type: { name: 'grass', url: '' } },
              { slot: 2, type: { name: 'poison', url: '' } },
            ],
          }),
          forms: [form({ id: 1, name: 'bulbasaur' })],
        },
      ],
    };

    const { species, forms } = normalizeSpeciesGroup(group, 'pokeapi');
    expect(species).toEqual({
      slug: 'bulbasaur',
      nationalDexNumber: 1,
      name: { en: 'Bulbasaur', es: 'Bulbasaur' },
      source: { sourceId: 'pokeapi', externalId: '1' },
    });
    expect(forms).toHaveLength(1);
    expect(forms[0]).toMatchObject({
      slug: 'bulbasaur',
      isDefault: true,
      category: 'default',
      types: ['grass', 'poison'],
      name: { en: 'Bulbasaur', es: 'Bulbasaur' },
    });
  });

  it('normalizes a battle-form family as separate varieties sharing base stats (Rotom)', () => {
    const speciesName = { en: 'Rotom', es: 'Rotom' };
    const group: RawSpeciesGroup = {
      species: {
        id: 479,
        name: 'rotom',
        names: [
          { name: 'Rotom', language: { name: 'en', url: '' } },
          { name: 'Rotom', language: { name: 'es', url: '' } },
        ],
        varieties: [
          { is_default: true, pokemon: { name: 'rotom', url: '' } },
          { is_default: false, pokemon: { name: 'rotom-heat', url: '' } },
        ],
      },
      varieties: [
        {
          isDefaultVariety: true,
          pokemon: pokemon({
            id: 479,
            name: 'rotom',
            types: [
              { slot: 1, type: { name: 'electric', url: '' } },
              { slot: 2, type: { name: 'ghost', url: '' } },
            ],
          }),
          forms: [form({ id: 479, name: 'rotom' })],
        },
        {
          isDefaultVariety: false,
          pokemon: pokemon({
            id: 10008,
            name: 'rotom-heat',
            types: [
              { slot: 1, type: { name: 'electric', url: '' } },
              { slot: 2, type: { name: 'fire', url: '' } },
            ],
          }),
          forms: [
            form({
              id: 10058,
              name: 'rotom-heat',
              names: [{ name: 'Heat Rotom', language: { name: 'en', url: '' } }],
              form_names: [{ name: 'Rotom Calor', language: { name: 'es', url: '' } }],
            }),
          ],
        },
      ],
    };

    const { forms } = normalizeSpeciesGroup(group, 'pokeapi');
    expect(forms).toHaveLength(2);
    const bySlug = Object.fromEntries(forms.map((f) => [f.slug, f]));
    expect(bySlug.rotom).toMatchObject({ isDefault: true, category: 'default', name: speciesName });
    expect(bySlug['rotom-heat']).toMatchObject({
      isDefault: false,
      category: 'battle',
      types: ['electric', 'fire'],
      name: { en: 'Heat Rotom', es: 'Rotom Calor' },
    });
  });

  it('composes a regional form name when PokéAPI has no full Spanish name (Meowth)', () => {
    const group: RawSpeciesGroup = {
      species: {
        id: 52,
        name: 'meowth',
        names: [
          { name: 'Meowth', language: { name: 'en', url: '' } },
          { name: 'Meowth', language: { name: 'es', url: '' } },
        ],
        varieties: [
          { is_default: true, pokemon: { name: 'meowth', url: '' } },
          { is_default: false, pokemon: { name: 'meowth-alola', url: '' } },
        ],
      },
      varieties: [
        {
          isDefaultVariety: true,
          pokemon: pokemon({ id: 52, name: 'meowth' }),
          forms: [form({ id: 52, name: 'meowth' })],
        },
        {
          isDefaultVariety: false,
          pokemon: pokemon({
            id: 10107,
            name: 'meowth-alola',
            types: [{ slot: 1, type: { name: 'dark', url: '' } }],
          }),
          forms: [
            form({
              id: 10209,
              name: 'meowth-alola',
              names: [{ name: 'Alolan Meowth', language: { name: 'en', url: '' } }],
              form_names: [{ name: 'Alolan Form', language: { name: 'en', url: '' } }],
            }),
          ],
        },
      ],
    };

    const { forms } = normalizeSpeciesGroup(group, 'pokeapi');
    const alola = forms.find((f) => f.slug === 'meowth-alola')!;
    expect(alola.category).toBe('regional');
    expect(alola.name).toEqual({ en: 'Alolan Meowth', es: 'Meowth de Alola' });
  });

  it('normalizes a cosmetic form family under one variety, picking exactly one default (Vivillon)', () => {
    const group: RawSpeciesGroup = {
      species: {
        id: 666,
        name: 'vivillon',
        names: [
          { name: 'Vivillon', language: { name: 'en', url: '' } },
          { name: 'Vivillon', language: { name: 'es', url: '' } },
        ],
        varieties: [{ is_default: true, pokemon: { name: 'vivillon', url: '' } }],
      },
      varieties: [
        {
          isDefaultVariety: true,
          pokemon: pokemon({ id: 666, name: 'vivillon' }),
          // Every Vivillon pattern form reports is_default: true at the
          // pokemon-form level — none of them are named plain "vivillon", so
          // pickPrimaryForm must fall back to the first in API order.
          forms: [
            form({
              id: 10059,
              name: 'vivillon-meadow',
              is_default: true,
              names: [{ name: 'Meadow Vivillon', language: { name: 'en', url: '' } }],
            }),
            form({
              id: 10060,
              name: 'vivillon-polar',
              is_default: true,
              names: [{ name: 'Polar Vivillon', language: { name: 'en', url: '' } }],
            }),
          ],
        },
      ],
    };

    const { forms } = normalizeSpeciesGroup(group, 'pokeapi');
    expect(forms).toHaveLength(2);
    const defaults = forms.filter((f) => f.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]!.slug).toBe('vivillon-meadow');
    expect(defaults[0]!.category).toBe('default');
    const polar = forms.find((f) => f.slug === 'vivillon-polar')!;
    expect(polar.isDefault).toBe(false);
    expect(polar.category).toBe('cosmetic');
    expect(polar.name.en).toBe('Polar Vivillon');
  });

  it('classifies a Mega form as battle even for a non-region-suffixed, non-default variety', () => {
    const group: RawSpeciesGroup = {
      species: {
        id: 6,
        name: 'charizard',
        names: [
          { name: 'Charizard', language: { name: 'en', url: '' } },
          { name: 'Charizard', language: { name: 'es', url: '' } },
        ],
        varieties: [
          { is_default: true, pokemon: { name: 'charizard', url: '' } },
          { is_default: false, pokemon: { name: 'charizard-mega-x', url: '' } },
        ],
      },
      varieties: [
        {
          isDefaultVariety: true,
          pokemon: pokemon({
            id: 6,
            name: 'charizard',
            types: [
              { slot: 1, type: { name: 'fire', url: '' } },
              { slot: 2, type: { name: 'flying', url: '' } },
            ],
          }),
          forms: [form({ id: 6, name: 'charizard' })],
        },
        {
          isDefaultVariety: false,
          pokemon: pokemon({
            id: 10034,
            name: 'charizard-mega-x',
            types: [
              { slot: 1, type: { name: 'fire', url: '' } },
              { slot: 2, type: { name: 'dragon', url: '' } },
            ],
          }),
          forms: [
            form({
              id: 10035,
              name: 'charizard-mega-x',
              is_mega: true,
              names: [{ name: 'Mega Charizard X', language: { name: 'en', url: '' } }],
            }),
          ],
        },
      ],
    };

    const { forms } = normalizeSpeciesGroup(group, 'pokeapi');
    const megaX = forms.find((f) => f.slug === 'charizard-mega-x')!;
    expect(megaX.category).toBe('battle');
    expect(megaX.types).toEqual(['fire', 'dragon']);
  });

  it('throws for a species with an invalid type count', () => {
    const group: RawSpeciesGroup = {
      species: {
        id: 999,
        name: 'test-mon',
        names: [
          { name: 'Test', language: { name: 'en', url: '' } },
          { name: 'Test', language: { name: 'es', url: '' } },
        ],
        varieties: [{ is_default: true, pokemon: { name: 'test-mon', url: '' } }],
      },
      varieties: [
        {
          isDefaultVariety: true,
          pokemon: pokemon({ id: 999, name: 'test-mon', types: [] }),
          forms: [form({ id: 999, name: 'test-mon' })],
        },
      ],
    };

    expect(() => normalizeSpeciesGroup(group, 'pokeapi')).toThrow(/1-2 types/);
  });
});
