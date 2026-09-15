import { describe, expect, it } from 'vitest';

import {
  GAME_ERA_SUPPORTED_VERSION_GROUPS,
  getPokemonSprite,
  resolveSprite,
} from './pokemon-sprite';

describe('getPokemonSprite', () => {
  it('resolves a known default-form species by national Dex number', () => {
    const url = getPokemonSprite({
      formSlug: 'pikachu',
      speciesSlug: 'pikachu',
      nationalDexNumber: 25,
      isDefaultForm: true,
    });
    expect(url).toBe(
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png',
    );
  });

  it('resolves Mew and Garchomp too — no species-specific special-casing', () => {
    expect(
      getPokemonSprite({
        formSlug: 'mew',
        speciesSlug: 'mew',
        nationalDexNumber: 151,
        isDefaultForm: true,
      }),
    ).toContain('/151.png');
    expect(
      getPokemonSprite({
        formSlug: 'garchomp',
        speciesSlug: 'garchomp',
        nationalDexNumber: 445,
        isDefaultForm: true,
      }),
    ).toContain('/445.png');
  });

  it('falls back to undefined for a non-default form — no incorrect sprite guessed', () => {
    const url = getPokemonSprite({
      formSlug: 'meowth-alola',
      speciesSlug: 'meowth',
      nationalDexNumber: 52,
      isDefaultForm: false,
    });
    expect(url).toBeUndefined();
  });

  it('falls back to undefined for an invalid/missing Dex number', () => {
    expect(
      getPokemonSprite({
        formSlug: 'x',
        speciesSlug: 'x',
        nationalDexNumber: 0,
        isDefaultForm: true,
      }),
    ).toBeUndefined();
  });

  it('accepts a versionGroupSlug argument without changing the result today (future generation-aware resolution)', () => {
    const withoutVersion = getPokemonSprite({
      formSlug: 'pikachu',
      speciesSlug: 'pikachu',
      nationalDexNumber: 25,
      isDefaultForm: true,
    });
    const withVersion = getPokemonSprite({
      formSlug: 'pikachu',
      speciesSlug: 'pikachu',
      nationalDexNumber: 25,
      isDefaultForm: true,
      versionGroupSlug: 'red-blue',
    });
    expect(withVersion).toBe(withoutVersion);
  });

  it('resolves a distinct shiny variant URL', () => {
    const url = getPokemonSprite({
      formSlug: 'pikachu',
      speciesSlug: 'pikachu',
      nationalDexNumber: 25,
      isDefaultForm: true,
      variant: 'shiny',
    });
    expect(url).toContain('/shiny/25.png');
  });
});

describe('resolveSprite (Sprite Lab strategy resolution)', () => {
  it('defaults to the "modern" strategy, matching getPokemonSprite exactly', () => {
    const request = {
      formSlug: 'pikachu',
      speciesSlug: 'pikachu',
      nationalDexNumber: 25,
      isDefaultForm: true,
    };
    expect(resolveSprite(request)).toEqual({
      url: getPokemonSprite(request),
      sourceKind: 'modern',
    });
  });

  it('"modern": reports unavailable for a non-default form, never a wrong image', () => {
    expect(
      resolveSprite({
        formSlug: 'meowth-alola',
        speciesSlug: 'meowth',
        nationalDexNumber: 52,
        isDefaultForm: false,
        strategy: 'modern',
      }),
    ).toEqual({ url: undefined, sourceKind: 'unavailable' });
  });

  it('"box": resolves a URL by form slug for a species within PokéSprite\'s audited coverage', () => {
    const resolution = resolveSprite({
      formSlug: 'rotom-wash',
      speciesSlug: 'rotom',
      nationalDexNumber: 479,
      isDefaultForm: false,
      strategy: 'box',
    });
    expect(resolution.sourceKind).toBe('box');
    expect(resolution.url).toContain('/rotom-wash.png');
  });

  it('"box": reports unavailable for any Generation IX species — audited zero coverage', () => {
    const resolution = resolveSprite({
      formSlug: 'sprigatito',
      speciesSlug: 'sprigatito',
      nationalDexNumber: 906, // first Gen IX species
      isDefaultForm: true,
      strategy: 'box',
    });
    expect(resolution).toEqual({ url: undefined, sourceKind: 'unavailable' });
  });

  it('"game-era": resolves Pikachu in Red/Blue (Generation I species, Generation I game)', () => {
    const resolution = resolveSprite({
      formSlug: 'pikachu',
      speciesSlug: 'pikachu',
      nationalDexNumber: 25,
      isDefaultForm: true,
      strategy: 'game-era',
      versionGroupSlug: 'red-blue',
    });
    expect(resolution.sourceKind).toBe('game-era');
    expect(resolution.url).toContain('/versions/generation-i/red-blue/25.png');
  });

  it('"game-era": never invents a Garchomp sprite for Red/Blue — Garchomp postdates Generation I', () => {
    const resolution = resolveSprite({
      formSlug: 'garchomp',
      speciesSlug: 'garchomp',
      nationalDexNumber: 445,
      isDefaultForm: true,
      strategy: 'game-era',
      versionGroupSlug: 'red-blue',
    });
    expect(resolution).toEqual({ url: undefined, sourceKind: 'unavailable' });
  });

  it('"game-era": resolves the same Garchomp in Platinum (its own Generation IV) and in Scarlet/Violet', () => {
    const request = {
      formSlug: 'garchomp',
      speciesSlug: 'garchomp',
      nationalDexNumber: 445,
      isDefaultForm: true,
      strategy: 'game-era' as const,
    };
    expect(resolveSprite({ ...request, versionGroupSlug: 'platinum' }).sourceKind).toBe('game-era');
    expect(resolveSprite({ ...request, versionGroupSlug: 'scarlet-violet' }).sourceKind).toBe(
      'game-era',
    );
  });

  it('"game-era": reports unavailable for a version group with no audited sprite folder (e.g. Sword/Shield)', () => {
    const resolution = resolveSprite({
      formSlug: 'garchomp',
      speciesSlug: 'garchomp',
      nationalDexNumber: 445,
      isDefaultForm: true,
      strategy: 'game-era',
      versionGroupSlug: 'sword-shield',
    });
    expect(resolution).toEqual({ url: undefined, sourceKind: 'unavailable' });
  });

  it('"game-era": reports unavailable when no versionGroupSlug is given at all', () => {
    const resolution = resolveSprite({
      formSlug: 'pikachu',
      speciesSlug: 'pikachu',
      nationalDexNumber: 25,
      isDefaultForm: true,
      strategy: 'game-era',
    });
    expect(resolution).toEqual({ url: undefined, sourceKind: 'unavailable' });
  });
});

describe('resolveSprite: "showdown" strategy (final visual review, Showdown/Smogon audit)', () => {
  it('resolves a static "gen5"-style URL by exact form slug', () => {
    const resolution = resolveSprite({
      formSlug: 'pikachu',
      speciesSlug: 'pikachu',
      nationalDexNumber: 25,
      isDefaultForm: true,
      strategy: 'showdown',
    });
    expect(resolution).toEqual({
      url: 'https://play.pokemonshowdown.com/sprites/gen5/pikachu.png',
      sourceKind: 'showdown',
    });
  });

  it('resolves non-default forms by their own slug too (unlike "modern")', () => {
    const resolution = resolveSprite({
      formSlug: 'rotom-wash',
      speciesSlug: 'rotom',
      nationalDexNumber: 479,
      isDefaultForm: false,
      strategy: 'showdown',
    });
    expect(resolution.sourceKind).toBe('showdown');
    expect(resolution.url).toContain('/gen5/rotom-wash.png');
  });

  it('resolves a Generation IX species too — no hardcoded generation cutoff (unlike "box")', () => {
    const resolution = resolveSprite({
      formSlug: 'sprigatito',
      speciesSlug: 'sprigatito',
      nationalDexNumber: 906,
      isDefaultForm: true,
      strategy: 'showdown',
    });
    expect(resolution.sourceKind).toBe('showdown');
    expect(resolution.url).toContain('/gen5/sprigatito.png');
  });
});

describe('GAME_ERA_SUPPORTED_VERSION_GROUPS', () => {
  it('lists only version groups with a real, audited sprite folder', () => {
    expect(GAME_ERA_SUPPORTED_VERSION_GROUPS).toContain('red-blue');
    expect(GAME_ERA_SUPPORTED_VERSION_GROUPS).toContain('scarlet-violet');
    // Deliberately unmapped — no separate upstream folder exists for these.
    expect(GAME_ERA_SUPPORTED_VERSION_GROUPS).not.toContain('sword-shield');
    expect(GAME_ERA_SUPPORTED_VERSION_GROUPS).not.toContain('sun-moon');
    expect(GAME_ERA_SUPPORTED_VERSION_GROUPS).not.toContain('black-2-white-2');
  });
});
