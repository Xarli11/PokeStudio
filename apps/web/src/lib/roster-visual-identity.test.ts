import { describe, expect, it } from 'vitest';

import type { SpeciesSearchAlias, SpeciesSearchItem } from '@pokestudio/database';

import { resolveRosterVisualIdentity } from './roster-visual-identity';

const STATS = { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 };

const ITEMS: SpeciesSearchItem[] = [
  {
    slug: 'garchomp',
    nationalDexNumber: 445,
    name: { en: 'Garchomp', es: 'Garchomp' },
    types: ['dragon', 'ground'],
    baseStats: STATS,
    formSlug: 'garchomp',
    pokeapiPokemonId: 445,
  },
  {
    slug: 'meowth',
    nationalDexNumber: 52,
    name: { en: 'Meowth', es: 'Meowth' },
    types: ['normal'],
    baseStats: STATS,
    formSlug: 'meowth',
    pokeapiPokemonId: 52,
  },
];

// Real Pokédex form: Alolan Meowth is Dark-type, not Normal like the default form.
const ALIASES: SpeciesSearchAlias[] = [
  {
    name: { en: 'Alolan Meowth', es: 'Meowth de Alola' },
    speciesSlug: 'meowth',
    types: ['dark'],
    formSlug: 'meowth-alola',
    pokeapiPokemonId: 10102,
  },
];

const SEARCH_INDEX = { items: ITEMS, aliases: ALIASES };

describe('resolveRosterVisualIdentity', () => {
  it('resolves a default form from its SpeciesSearchItem', () => {
    expect(resolveRosterVisualIdentity(SEARCH_INDEX, 'garchomp')).toEqual({
      formSlug: 'garchomp',
      speciesSlug: 'garchomp',
      nationalDexNumber: 445,
      isDefaultForm: true,
      displayName: { en: 'Garchomp', es: 'Garchomp' },
      types: ['dragon', 'ground'],
      pokeapiPokemonId: 445,
    });
  });

  it('resolves a non-default form from its SpeciesSearchAlias, using the alias types not the species default', () => {
    expect(resolveRosterVisualIdentity(SEARCH_INDEX, 'meowth-alola')).toEqual({
      formSlug: 'meowth-alola',
      speciesSlug: 'meowth',
      nationalDexNumber: 52,
      isDefaultForm: false,
      displayName: { en: 'Alolan Meowth', es: 'Meowth de Alola' },
      types: ['dark'],
      pokeapiPokemonId: 10102,
    });
  });

  it('returns undefined for a formSlug not present in either items or aliases', () => {
    expect(resolveRosterVisualIdentity(SEARCH_INDEX, 'missingno')).toBeUndefined();
  });

  it('returns undefined for an alias whose owning species is missing from items (defensive, should not happen for a real index)', () => {
    const orphanAlias: SpeciesSearchAlias = {
      name: { en: 'Orphan Form', es: 'Forma Huérfana' },
      speciesSlug: 'not-in-items',
      types: ['normal'],
      formSlug: 'orphan-form',
      pokeapiPokemonId: 9999,
    };
    const index = { items: ITEMS, aliases: [orphanAlias] };
    expect(resolveRosterVisualIdentity(index, 'orphan-form')).toBeUndefined();
  });
});
