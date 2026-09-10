import { describe, expect, it } from 'vitest';

import {
  normalizeAbility,
  normalizeEvolutionChain,
  normalizeFormAbilities,
  normalizeSpeciesGroup,
  type RawSpeciesGroup,
} from './normalize';
import type {
  PokeApiAbility,
  PokeApiEvolutionChain,
  PokeApiEvolutionDetail,
  PokeApiPokemon,
  PokeApiPokemonAbility,
  PokeApiPokemonForm,
} from './pokeapi-client';

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
    abilities: [],
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
        evolution_chain: { url: '' },
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
        evolution_chain: { url: '' },
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
        evolution_chain: { url: '' },
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
        evolution_chain: { url: '' },
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
        evolution_chain: { url: '' },
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
        evolution_chain: { url: '' },
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

  it('normalizes a variety with regular + hidden abilities into per-form ability links (Bulbasaur)', () => {
    const group: RawSpeciesGroup = {
      species: {
        id: 1,
        name: 'bulbasaur',
        names: [
          { name: 'Bulbasaur', language: { name: 'en', url: '' } },
          { name: 'Bulbasaur', language: { name: 'es', url: '' } },
        ],
        varieties: [{ is_default: true, pokemon: { name: 'bulbasaur', url: '' } }],
        evolution_chain: { url: '' },
      },
      varieties: [
        {
          isDefaultVariety: true,
          pokemon: pokemon({
            id: 1,
            name: 'bulbasaur',
            abilities: [
              { ability: { name: 'overgrow', url: '' }, is_hidden: false, slot: 1 },
              { ability: { name: 'chlorophyll', url: '' }, is_hidden: true, slot: 3 },
            ],
          }),
          forms: [form({ id: 1, name: 'bulbasaur' })],
        },
      ],
    };

    const { formAbilities } = normalizeSpeciesGroup(group, 'pokeapi');
    expect(formAbilities).toEqual([
      { formSlug: 'bulbasaur', abilitySlug: 'overgrow', slot: 1, isHidden: false },
      { formSlug: 'bulbasaur', abilitySlug: 'chlorophyll', slot: 3, isHidden: true },
    ]);
  });
});

describe('normalizeFormAbilities', () => {
  it("associates every cosmetic sub-form under one variety with that variety's abilities", () => {
    const abilities: PokeApiPokemonAbility[] = [
      { ability: { name: 'shield-dust', url: '' }, is_hidden: false, slot: 1 },
    ];
    expect(normalizeFormAbilities('vivillon-meadow', abilities)).toEqual([
      { formSlug: 'vivillon-meadow', abilitySlug: 'shield-dust', slot: 1, isHidden: false },
    ]);
    expect(normalizeFormAbilities('vivillon-polar', abilities)).toEqual([
      { formSlug: 'vivillon-polar', abilitySlug: 'shield-dust', slot: 1, isHidden: false },
    ]);
  });
});

describe('normalizeAbility', () => {
  function ability(
    overrides: Partial<PokeApiAbility> & { id: number; name: string },
  ): PokeApiAbility {
    return { names: [], effect_entries: [], ...overrides };
  }

  it('normalizes a well-localized ability (Overgrow)', () => {
    const normalized = normalizeAbility({
      sourceId: 'pokeapi',
      ability: ability({
        id: 65,
        name: 'overgrow',
        names: [
          { name: 'Overgrow', language: { name: 'en', url: '' } },
          { name: 'Espesura', language: { name: 'es', url: '' } },
        ],
        effect_entries: [
          {
            effect:
              'Powers up Grass-type moves by 50% when this Pokémon has 1/3 or less of its HP remaining.',
            short_effect: 'Powers up Grass-type moves when the Pokémon is in trouble.',
            language: { name: 'en', url: '' },
          },
        ],
      }),
    });

    expect(normalized).toEqual({
      slug: 'overgrow',
      nameEn: 'Overgrow',
      nameEs: 'Espesura',
      effectEn: 'Powers up Grass-type moves when the Pokémon is in trouble.',
      effectEs: undefined,
      source: { sourceId: 'pokeapi', externalId: '65' },
    });
  });

  it('leaves Spanish name/effect undefined rather than inventing a translation', () => {
    const normalized = normalizeAbility({
      sourceId: 'pokeapi',
      ability: ability({
        id: 999,
        name: 'test-ability',
        names: [{ name: 'Test Ability', language: { name: 'en', url: '' } }],
        effect_entries: [
          {
            effect: 'Does a thing.',
            short_effect: 'Does a thing.',
            language: { name: 'en', url: '' },
          },
        ],
      }),
    });

    expect(normalized.nameEs).toBeUndefined();
    expect(normalized.effectEs).toBeUndefined();
  });

  it('throws when the English name is missing', () => {
    expect(() =>
      normalizeAbility({ sourceId: 'pokeapi', ability: ability({ id: 1, name: 'no-en-name' }) }),
    ).toThrow(/Missing en name/);
  });
});

describe('normalizeEvolutionChain', () => {
  function evolutionDetail(
    overrides: Partial<PokeApiEvolutionDetail> = {},
  ): PokeApiEvolutionDetail {
    return {
      trigger: { name: 'level-up', url: '' },
      item: null,
      held_item: null,
      min_level: null,
      min_happiness: null,
      min_beauty: null,
      min_affection: null,
      time_of_day: '',
      known_move: null,
      known_move_type: null,
      location: null,
      gender: null,
      trade_species: null,
      party_species: null,
      party_type: null,
      relative_physical_stats: null,
      needs_overworld_rain: false,
      turn_upside_down: false,
      ...overrides,
    };
  }

  it('produces no edge for a chain root (a species with no evolution, e.g. Ditto)', () => {
    const chain: PokeApiEvolutionChain = {
      id: 91,
      chain: { species: { name: 'ditto', url: '' }, evolution_details: [], evolves_to: [] },
    };
    expect(normalizeEvolutionChain({ chain, sourceId: 'pokeapi' })).toEqual([]);
  });

  it('produces two edges for a linear 3-stage chain (Bulbasaur family)', () => {
    const chain: PokeApiEvolutionChain = {
      id: 1,
      chain: {
        species: { name: 'bulbasaur', url: '' },
        evolution_details: [],
        evolves_to: [
          {
            species: { name: 'ivysaur', url: '' },
            evolution_details: [evolutionDetail({ min_level: 16 })],
            evolves_to: [
              {
                species: { name: 'venusaur', url: '' },
                evolution_details: [evolutionDetail({ min_level: 32 })],
                evolves_to: [],
              },
            ],
          },
        ],
      },
    };

    const edges = normalizeEvolutionChain({ chain, sourceId: 'pokeapi' });
    expect(edges).toHaveLength(2);
    expect(edges[0]).toMatchObject({
      fromSpeciesSlug: 'bulbasaur',
      toSpeciesSlug: 'ivysaur',
      trigger: 'level-up',
      minLevel: 16,
    });
    expect(edges[1]).toMatchObject({
      fromSpeciesSlug: 'ivysaur',
      toSpeciesSlug: 'venusaur',
      trigger: 'level-up',
      minLevel: 32,
    });
    expect(edges.every((e) => e.chainExternalId === '1')).toBe(true);
  });

  it('produces a branching edge set for Eevee (8 stone/friendship/location evolutions)', () => {
    const chain: PokeApiEvolutionChain = {
      id: 67,
      chain: {
        species: { name: 'eevee', url: '' },
        evolution_details: [],
        evolves_to: [
          {
            species: { name: 'vaporeon', url: '' },
            evolution_details: [
              evolutionDetail({
                trigger: { name: 'use-item', url: '' },
                item: { name: 'water-stone', url: '' },
              }),
            ],
            evolves_to: [],
          },
          {
            species: { name: 'jolteon', url: '' },
            evolution_details: [
              evolutionDetail({
                trigger: { name: 'use-item', url: '' },
                item: { name: 'thunder-stone', url: '' },
              }),
            ],
            evolves_to: [],
          },
          {
            species: { name: 'umbreon', url: '' },
            evolution_details: [
              evolutionDetail({
                trigger: { name: 'level-up', url: '' },
                min_happiness: 220,
                time_of_day: 'night',
              }),
            ],
            evolves_to: [],
          },
        ],
      },
    };

    const edges = normalizeEvolutionChain({ chain, sourceId: 'pokeapi' });
    expect(edges).toHaveLength(3);
    expect(edges.every((e) => e.fromSpeciesSlug === 'eevee')).toBe(true);
    const umbreon = edges.find((e) => e.toSpeciesSlug === 'umbreon')!;
    expect(umbreon).toMatchObject({ trigger: 'level-up', minHappiness: 220, timeOfDay: 'night' });
    const vaporeon = edges.find((e) => e.toSpeciesSlug === 'vaporeon')!;
    expect(vaporeon).toMatchObject({ trigger: 'use-item', itemSlug: 'water-stone' });
  });

  it('produces two alternative-method edges for the same target (Feebas -> Milotic)', () => {
    const chain: PokeApiEvolutionChain = {
      id: 160,
      chain: {
        species: { name: 'feebas', url: '' },
        evolution_details: [],
        evolves_to: [
          {
            species: { name: 'milotic', url: '' },
            evolution_details: [
              evolutionDetail({ trigger: { name: 'level-up', url: '' }, min_beauty: 170 }),
              evolutionDetail({
                trigger: { name: 'trade', url: '' },
                held_item: { name: 'prism-scale', url: '' },
              }),
            ],
            evolves_to: [],
          },
        ],
      },
    };

    const edges = normalizeEvolutionChain({ chain, sourceId: 'pokeapi' });
    expect(edges).toHaveLength(2);
    expect(
      edges.every((e) => e.fromSpeciesSlug === 'feebas' && e.toSpeciesSlug === 'milotic'),
    ).toBe(true);
    expect(edges[0]).toMatchObject({ trigger: 'level-up', minBeauty: 170 });
    expect(edges[1]).toMatchObject({ trigger: 'trade', heldItemSlug: 'prism-scale' });
    // Distinct provenance per alternative, even though from/to are identical.
    expect(edges[0]!.source.externalId).not.toBe(edges[1]!.source.externalId);
  });

  it("handles Tyrogue's relative-physical-stats branching condition", () => {
    const chain: PokeApiEvolutionChain = {
      id: 138,
      chain: {
        species: { name: 'tyrogue', url: '' },
        evolution_details: [],
        evolves_to: [
          {
            species: { name: 'hitmonlee', url: '' },
            evolution_details: [evolutionDetail({ min_level: 20, relative_physical_stats: 1 })],
            evolves_to: [],
          },
          {
            species: { name: 'hitmonchan', url: '' },
            evolution_details: [evolutionDetail({ min_level: 20, relative_physical_stats: -1 })],
            evolves_to: [],
          },
          {
            species: { name: 'hitmontop', url: '' },
            evolution_details: [evolutionDetail({ min_level: 20, relative_physical_stats: 0 })],
            evolves_to: [],
          },
        ],
      },
    };

    const edges = normalizeEvolutionChain({ chain, sourceId: 'pokeapi' });
    expect(edges).toHaveLength(3);
    expect(edges.find((e) => e.toSpeciesSlug === 'hitmonlee')).toMatchObject({
      relativePhysicalStats: 1,
    });
    expect(edges.find((e) => e.toSpeciesSlug === 'hitmonchan')).toMatchObject({
      relativePhysicalStats: -1,
    });
    expect(edges.find((e) => e.toSpeciesSlug === 'hitmontop')).toMatchObject({
      relativePhysicalStats: 0,
    });
  });
});
