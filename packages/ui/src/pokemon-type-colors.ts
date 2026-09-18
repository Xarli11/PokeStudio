/**
 * Semantic accent colors for Pokémon types (CSS custom property names).
 * Used to color a badge/cell inline — never as the PokeLab brand palette.
 * Full 18-type set (extended here now that Explore data ships, Phase 1A).
 */
export const pokemonTypeColorVar = {
  normal: '--ps-type-normal',
  fire: '--ps-type-fire',
  water: '--ps-type-water',
  electric: '--ps-type-electric',
  grass: '--ps-type-grass',
  ice: '--ps-type-ice',
  fighting: '--ps-type-fighting',
  poison: '--ps-type-poison',
  ground: '--ps-type-ground',
  flying: '--ps-type-flying',
  psychic: '--ps-type-psychic',
  bug: '--ps-type-bug',
  rock: '--ps-type-rock',
  ghost: '--ps-type-ghost',
  dragon: '--ps-type-dragon',
  dark: '--ps-type-dark',
  steel: '--ps-type-steel',
  fairy: '--ps-type-fairy',
} as const;

export type PokemonTypeWithColor = keyof typeof pokemonTypeColorVar;
