import { describe, expect, it } from 'vitest';

import {
  normalizeAbility,
  normalizeEvolutionChain,
  normalizeFormAbilities,
  normalizeFormMoves,
  normalizeLearnMethod,
  normalizeMachine,
  normalizeMove,
  normalizeSpeciesGroup,
  normalizeVersionGroup,
  parseGenerationSlug,
  type RawSpeciesGroup,
} from './normalize';
import type {
  PokeApiAbility,
  PokeApiEvolutionChain,
  PokeApiEvolutionDetail,
  PokeApiMachine,
  PokeApiMove,
  PokeApiMoveLearnMethod,
  PokeApiPokemon,
  PokeApiPokemonAbility,
  PokeApiPokemonForm,
  PokeApiPokemonMove,
  PokeApiVersionGroup,
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
    moves: [],
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

describe('parseGenerationSlug', () => {
  it('parses roman-numeral generation slugs 1-9', () => {
    expect(parseGenerationSlug('generation-i')).toBe(1);
    expect(parseGenerationSlug('generation-iv')).toBe(4);
    expect(parseGenerationSlug('generation-ix')).toBe(9);
  });

  it('throws for an unrecognized generation slug', () => {
    expect(() => parseGenerationSlug('generation-x')).toThrow(/Unrecognized generation slug/);
  });
});

describe('normalizeMove', () => {
  // Fixture shape is a literal capture of the real PokéAPI /move/85 (Thunderbolt) response.
  function move(overrides: Partial<PokeApiMove> & { id: number; name: string }): PokeApiMove {
    return {
      names: [
        { name: 'Thunderbolt', language: { name: 'en', url: '' } },
        { name: 'Rayo', language: { name: 'es', url: '' } },
      ],
      accuracy: 100,
      effect_chance: 10,
      pp: 15,
      priority: 0,
      power: 90,
      damage_class: { name: 'special', url: '' },
      effect_entries: [
        {
          effect: 'Inflicts regular damage.  Has a chance to paralyze the target.',
          short_effect: 'Has a chance to paralyze the target.',
          language: { name: 'en', url: '' },
        },
      ],
      generation: { name: 'generation-i', url: '' },
      meta: {
        ailment: { name: 'paralysis', url: '' },
        category: { name: 'damage-ailment', url: '' },
        min_hits: null,
        max_hits: null,
        min_turns: null,
        max_turns: null,
        drain: 0,
        healing: 0,
        crit_rate: 0,
        ailment_chance: 10,
        flinch_chance: 0,
        stat_chance: 0,
      },
      target: { name: 'selected-pokemon', url: '' },
      type: { name: 'electric', url: '' },
      machines: [],
      ...overrides,
    };
  }

  it('normalizes a damaging move with a secondary ailment chance (Thunderbolt)', () => {
    const normalized = normalizeMove({
      move: move({ id: 85, name: 'thunderbolt' }),
      sourceId: 'pokeapi',
    });
    expect(normalized).toEqual({
      slug: 'thunderbolt',
      nameEn: 'Thunderbolt',
      nameEs: 'Rayo',
      type: 'electric',
      damageClass: 'special',
      power: 90,
      accuracy: 100,
      pp: 15,
      priority: 0,
      target: 'selected-pokemon',
      generation: 1,
      effectEn: 'Has a chance to paralyze the target.',
      effectEs: undefined,
      effectChance: 10,
      ailment: 'paralysis',
      category: 'damage-ailment',
      minHits: undefined,
      maxHits: undefined,
      minTurns: undefined,
      maxTurns: undefined,
      drain: 0,
      healing: 0,
      critRate: 0,
      ailmentChance: 10,
      flinchChance: 0,
      statChance: 0,
      source: { sourceId: 'pokeapi', externalId: '85' },
    });
  });

  it('normalizes a status move with null power/effect_chance (Toxic)', () => {
    const normalized = normalizeMove({
      move: move({
        id: 92,
        name: 'toxic',
        power: null,
        accuracy: 90,
        effect_chance: null,
        damage_class: { name: 'status', url: '' },
        meta: {
          ailment: { name: 'poison', url: '' },
          category: { name: 'ailment', url: '' },
          min_hits: null,
          max_hits: null,
          min_turns: 15,
          max_turns: 15,
          drain: 0,
          healing: 0,
          crit_rate: 0,
          ailment_chance: 0,
          flinch_chance: 0,
          stat_chance: 0,
        },
      }),
      sourceId: 'pokeapi',
    });
    expect(normalized.power).toBeUndefined();
    expect(normalized.accuracy).toBe(90);
    expect(normalized.effectChance).toBeUndefined();
    expect(normalized.damageClass).toBe('status');
    expect(normalized.minTurns).toBe(15);
    expect(normalized.maxTurns).toBe(15);
  });

  it('leaves effectEs undefined — PokéAPI never publishes a Spanish move effect', () => {
    const normalized = normalizeMove({ move: move({ id: 1, name: 'pound' }), sourceId: 'pokeapi' });
    expect(normalized.effectEs).toBeUndefined();
  });

  it('leaves ailment/category undefined (not a guessed default) when the move has no meta block — a real, current gap for some very recent moves', () => {
    const noMeta = move({ id: 887, name: 'ivy-cudgel' });
    delete (noMeta as { meta?: unknown }).meta;
    const normalized = normalizeMove({ move: noMeta, sourceId: 'pokeapi' });
    expect(normalized.ailment).toBeUndefined();
    expect(normalized.category).toBeUndefined();
    expect(normalized.minHits).toBeUndefined();
    // Numeric modifier fields still default to 0 ("no known secondary
    // effect") even with no meta block — a reasonable domain default, not
    // invented data, unlike the ailment/category sentinels above.
    expect(normalized.drain).toBe(0);
    expect(normalized.ailmentChance).toBe(0);
  });

  it("collapses a Z-Move physical/special variant's double-dash suffix into a valid slug", () => {
    // Real PokéAPI shape: "Breakneck Blitz" exists as two records
    // ("breakneck-blitz--physical" / "breakneck-blitz--special") that share
    // one display name — not two separately-named in-game moves.
    const physical = normalizeMove({
      move: move({ id: 622, name: 'breakneck-blitz--physical' }),
      sourceId: 'pokeapi',
    });
    const special = normalizeMove({
      move: move({ id: 623, name: 'breakneck-blitz--special' }),
      sourceId: 'pokeapi',
    });
    expect(physical.slug).toBe('breakneck-blitz-physical');
    expect(special.slug).toBe('breakneck-blitz-special');
  });

  it('treats literal power/accuracy 0 the same as null — both mean "no fixed power"/"never misses" upstream', () => {
    // Real PokéAPI inconsistency found at full-dataset scale: some status
    // moves (power-shift, victory-dance, ...) encode "no power" as 0 instead
    // of null; a few moves (burning-bulwark, ...) do the same for accuracy.
    const normalized = normalizeMove({
      move: move({ id: 1, name: 'power-shift', power: 0, accuracy: 0 }),
      sourceId: 'pokeapi',
    });
    expect(normalized.power).toBeUndefined();
    expect(normalized.accuracy).toBeUndefined();
  });
});

describe('normalizeVersionGroup', () => {
  it('normalizes a version group with its generation and display order (Red/Blue)', () => {
    const versionGroup: PokeApiVersionGroup = {
      id: 1,
      name: 'red-blue',
      order: 3,
      generation: { name: 'generation-i', url: '' },
    };
    expect(normalizeVersionGroup({ versionGroup, sourceId: 'pokeapi' })).toEqual({
      slug: 'red-blue',
      generation: 1,
      displayOrder: 3,
      source: { sourceId: 'pokeapi', externalId: '1' },
    });
  });
});

describe('normalizeLearnMethod', () => {
  it('normalizes a learn method to its slug and provenance only (no label fields)', () => {
    const method: PokeApiMoveLearnMethod = { id: 1, name: 'level-up' };
    expect(normalizeLearnMethod({ method, sourceId: 'pokeapi' })).toEqual({
      slug: 'level-up',
      source: { sourceId: 'pokeapi', externalId: '1' },
    });
  });
});

describe('normalizeMachine', () => {
  it('normalizes a machine to its move/version-group/item-slug identity', () => {
    const machine: PokeApiMachine = {
      id: 1,
      item: { name: 'tm00', url: '' },
      version_group: { name: 'sword-shield', url: '' },
      move: { name: 'mega-punch', url: '' },
    };
    expect(normalizeMachine({ machine, sourceId: 'pokeapi' })).toEqual({
      moveSlug: 'mega-punch',
      versionGroupSlug: 'sword-shield',
      itemSlug: 'tm00',
      source: { sourceId: 'pokeapi', externalId: '1' },
    });
  });
});

describe('normalizeFormMoves', () => {
  it("sanitizes a Z-Move variant's raw double-dash name the same way normalizeMove sanitizes its canonical slug", () => {
    // Without this, a learnset entry referencing "breakneck-blitz--physical"
    // would never match the canonical move slug "breakneck-blitz-physical"
    // normalizeMove produces, and would be dropped as an orphan.
    const moves: PokeApiPokemonMove[] = [
      {
        move: { name: 'breakneck-blitz--physical', url: '' },
        version_group_details: [
          {
            level_learned_at: 0,
            version_group: { name: 'sun-moon', url: '' },
            move_learn_method: { name: 'machine', url: '' },
            order: null,
          },
        ],
      },
    ];
    expect(normalizeFormMoves('pikachu', moves)[0]?.moveSlug).toBe('breakneck-blitz-physical');
  });

  it('produces one entry per (move, version group, method, level) triple, level included in the key', () => {
    // Shape mirrors the real cached Bulbasaur "swords-dance" entry: the same
    // move learned via different methods across different version groups.
    const moves: PokeApiPokemonMove[] = [
      {
        move: { name: 'swords-dance', url: '' },
        version_group_details: [
          {
            level_learned_at: 0,
            version_group: { name: 'red-blue', url: '' },
            move_learn_method: { name: 'machine', url: '' },
            order: null,
          },
          {
            level_learned_at: 0,
            version_group: { name: 'emerald', url: '' },
            move_learn_method: { name: 'tutor', url: '' },
            order: null,
          },
        ],
      },
    ];
    expect(normalizeFormMoves('bulbasaur', moves)).toEqual([
      {
        formSlug: 'bulbasaur',
        moveSlug: 'swords-dance',
        versionGroupSlug: 'red-blue',
        learnMethodSlug: 'machine',
        level: 0,
        sortOrder: undefined,
      },
      {
        formSlug: 'bulbasaur',
        moveSlug: 'swords-dance',
        versionGroupSlug: 'emerald',
        learnMethodSlug: 'tutor',
        level: 0,
        sortOrder: undefined,
      },
    ]);
  });

  it('keeps two entries for the same (move, version group, method) at different levels — a real relearn mechanic', () => {
    // Mirrors the real cached Aromatisse case: odor-sleuth learned at both
    // level 1 (inherited on evolution) and level 8 in sun-moon.
    const moves: PokeApiPokemonMove[] = [
      {
        move: { name: 'odor-sleuth', url: '' },
        version_group_details: [
          {
            level_learned_at: 1,
            version_group: { name: 'sun-moon', url: '' },
            move_learn_method: { name: 'level-up', url: '' },
            order: 1,
          },
          {
            level_learned_at: 8,
            version_group: { name: 'sun-moon', url: '' },
            move_learn_method: { name: 'level-up', url: '' },
            order: 1,
          },
        ],
      },
    ];
    const entries = normalizeFormMoves('aromatisse', moves);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.level).sort()).toEqual([1, 8]);
  });

  it("associates every cosmetic sub-form under one variety with that variety's moveset", () => {
    const moves: PokeApiPokemonMove[] = [
      {
        move: { name: 'tackle', url: '' },
        version_group_details: [
          {
            level_learned_at: 1,
            version_group: { name: 'x-y', url: '' },
            move_learn_method: { name: 'level-up', url: '' },
            order: 1,
          },
        ],
      },
    ];
    expect(normalizeFormMoves('vivillon-meadow', moves)[0]?.formSlug).toBe('vivillon-meadow');
    expect(normalizeFormMoves('vivillon-polar', moves)[0]?.formSlug).toBe('vivillon-polar');
  });
});
