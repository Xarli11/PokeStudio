import { describe, expect, it } from 'vitest';

import { normalizeForm, normalizeSpecies, resolveFormName } from './normalize';
import type { PokeApiPokemon, PokeApiPokemonForm, PokeApiPokemonSpecies } from './pokeapi-client';

// Fixtures below are literal captures of real PokéAPI responses (fetched
// 2026-09-09) — normalization is tested against fixture data, never a live
// network call (ROADMAP.md: "source fixtures can be tested without
// repeatedly calling the live API").

const bulbasaurSpecies: PokeApiPokemonSpecies = {
  id: 1,
  names: [
    { name: 'Bulbasaur', language: { name: 'en', url: '' } },
    { name: 'Bulbasaur', language: { name: 'es', url: '' } },
  ],
  varieties: [{ is_default: true, pokemon: { name: 'bulbasaur', url: '' } }],
};

const bulbasaurPokemon: PokeApiPokemon = {
  id: 1,
  name: 'bulbasaur',
  types: [
    { slot: 1, type: { name: 'grass', url: '' } },
    { slot: 2, type: { name: 'poison', url: '' } },
  ],
  stats: [
    { base_stat: 45, stat: { name: 'hp', url: '' } },
    { base_stat: 49, stat: { name: 'attack', url: '' } },
    { base_stat: 49, stat: { name: 'defense', url: '' } },
    { base_stat: 65, stat: { name: 'special-attack', url: '' } },
    { base_stat: 65, stat: { name: 'special-defense', url: '' } },
    { base_stat: 45, stat: { name: 'speed', url: '' } },
  ],
  forms: [{ name: 'bulbasaur', url: 'https://pokeapi.co/api/v2/pokemon-form/1/' }],
};

const rotomHeatPokemon: PokeApiPokemon = {
  id: 10008,
  name: 'rotom-heat',
  types: [
    { slot: 1, type: { name: 'electric', url: '' } },
    { slot: 2, type: { name: 'fire', url: '' } },
  ],
  stats: [
    { base_stat: 50, stat: { name: 'hp', url: '' } },
    { base_stat: 65, stat: { name: 'attack', url: '' } },
    { base_stat: 107, stat: { name: 'defense', url: '' } },
    { base_stat: 105, stat: { name: 'special-attack', url: '' } },
    { base_stat: 107, stat: { name: 'special-defense', url: '' } },
    { base_stat: 86, stat: { name: 'speed', url: '' } },
  ],
  forms: [{ name: 'rotom-heat', url: 'https://pokeapi.co/api/v2/pokemon-form/10058/' }],
};

// Full name present for en, missing for es — form_names carries the real
// full name for both languages for this form group ("battle").
const rotomHeatForm: PokeApiPokemonForm = {
  names: [{ name: 'Heat Rotom', language: { name: 'en', url: '' } }],
  form_names: [
    { name: 'Heat Rotom', language: { name: 'en', url: '' } },
    { name: 'Rotom Calor', language: { name: 'es', url: '' } },
  ],
};

const meowthAlolaPokemon: PokeApiPokemon = {
  id: 10107,
  name: 'meowth-alola',
  types: [{ slot: 1, type: { name: 'dark', url: '' } }],
  stats: [
    { base_stat: 40, stat: { name: 'hp', url: '' } },
    { base_stat: 35, stat: { name: 'attack', url: '' } },
    { base_stat: 35, stat: { name: 'defense', url: '' } },
    { base_stat: 50, stat: { name: 'special-attack', url: '' } },
    { base_stat: 40, stat: { name: 'special-defense', url: '' } },
    { base_stat: 90, stat: { name: 'speed', url: '' } },
  ],
  forms: [{ name: 'meowth-alola', url: 'https://pokeapi.co/api/v2/pokemon-form/10209/' }],
};

// Full name present for en; es is missing from *both* `names` and
// `form_names` (form_names.es is a generic "Forma de Alola" descriptor
// shared across species, not "Meowth de Alola") — this is the case the
// regional composition rule exists for.
const meowthAlolaForm: PokeApiPokemonForm = {
  names: [{ name: 'Alolan Meowth', language: { name: 'en', url: '' } }],
  form_names: [
    { name: 'Alolan Form', language: { name: 'en', url: '' } },
    { name: 'Forma de Alola', language: { name: 'es', url: '' } },
  ],
};

describe('normalizeSpecies', () => {
  it('normalizes a species using the PokeStudio-declared slug, not PokéAPI naming', () => {
    const species = normalizeSpecies({
      species: bulbasaurSpecies,
      slug: 'bulbasaur',
      sourceId: 'pokeapi',
    });
    expect(species).toEqual({
      slug: 'bulbasaur',
      nationalDexNumber: 1,
      name: { en: 'Bulbasaur', es: 'Bulbasaur' },
      source: { sourceId: 'pokeapi', externalId: '1' },
    });
  });
});

describe('normalizeForm', () => {
  it('uses the species name for a default form (a simple single-form species)', () => {
    const form = normalizeForm({
      pokemon: bulbasaurPokemon,
      form: undefined,
      slug: 'bulbasaur',
      speciesSlug: 'bulbasaur',
      speciesName: { en: 'Bulbasaur', es: 'Bulbasaur' },
      isDefault: true,
      category: 'default',
      sourceId: 'pokeapi',
    });
    expect(form.name).toEqual({ en: 'Bulbasaur', es: 'Bulbasaur' });
    expect(form.types).toEqual(['grass', 'poison']);
    expect(form.baseStats).toEqual({
      hp: 45,
      attack: 49,
      defense: 49,
      specialAttack: 65,
      specialDefense: 65,
      speed: 45,
    });
    expect(form.source).toEqual({ sourceId: 'pokeapi', externalId: '1' });
  });

  it('resolves a battle-relevant form name from form_names when `names` lacks Spanish (Rotom)', () => {
    const form = normalizeForm({
      pokemon: rotomHeatPokemon,
      form: rotomHeatForm,
      slug: 'rotom-heat',
      speciesSlug: 'rotom',
      speciesName: { en: 'Rotom', es: 'Rotom' },
      isDefault: false,
      category: 'battle',
      sourceId: 'pokeapi',
    });
    expect(form.name).toEqual({ en: 'Heat Rotom', es: 'Rotom Calor' });
    expect(form.types).toEqual(['electric', 'fire']);
    // Rotom formes share base stats with the default form — only typing differs.
    expect(form.baseStats.hp).toBe(50);
  });

  it('composes a regional form name from the species name + region when PokéAPI has no full Spanish name (Meowth)', () => {
    const form = normalizeForm({
      pokemon: meowthAlolaPokemon,
      form: meowthAlolaForm,
      slug: 'meowth-alola',
      speciesSlug: 'meowth',
      speciesName: { en: 'Meowth', es: 'Meowth' },
      isDefault: false,
      category: 'regional',
      regionLabel: 'Alola',
      sourceId: 'pokeapi',
    });
    expect(form.name).toEqual({ en: 'Alolan Meowth', es: 'Meowth de Alola' });
    expect(form.types).toEqual(['dark']);
    // Regional Meowth genuinely differs in base stats from Kantonian Meowth —
    // the reason types/stats live on the form, not the species (ADR-0010).
    expect(form.baseStats).toEqual({
      hp: 40,
      attack: 35,
      defense: 35,
      specialAttack: 50,
      specialDefense: 40,
      speed: 90,
    });
  });

  it('throws for a non-default form with no `form` payload', () => {
    expect(() =>
      normalizeForm({
        pokemon: rotomHeatPokemon,
        form: undefined,
        slug: 'rotom-heat',
        speciesSlug: 'rotom',
        speciesName: { en: 'Rotom', es: 'Rotom' },
        isDefault: false,
        category: 'battle',
        sourceId: 'pokeapi',
      }),
    ).toThrow(/required for non-default form/);
  });
});

describe('resolveFormName', () => {
  it('requires a regionLabel for regional forms', () => {
    expect(() =>
      resolveFormName({
        form: meowthAlolaForm,
        category: 'regional',
        speciesName: { en: 'Meowth', es: 'Meowth' },
      }),
    ).toThrow(/regionLabel is required/);
  });
});
