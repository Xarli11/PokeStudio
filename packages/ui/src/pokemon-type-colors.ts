/**
 * Semantic accent colors for Pokémon types (CSS custom property names).
 * Used to color a badge/cell inline — never as the PokeLab brand palette.
 * Full 18-type set (extended here now that Explore data ships, Phase 1A).
 */
export const pokemonTypeColorVar = {
  normal: '--pl-type-normal',
  fire: '--pl-type-fire',
  water: '--pl-type-water',
  electric: '--pl-type-electric',
  grass: '--pl-type-grass',
  ice: '--pl-type-ice',
  fighting: '--pl-type-fighting',
  poison: '--pl-type-poison',
  ground: '--pl-type-ground',
  flying: '--pl-type-flying',
  psychic: '--pl-type-psychic',
  bug: '--pl-type-bug',
  rock: '--pl-type-rock',
  ghost: '--pl-type-ghost',
  dragon: '--pl-type-dragon',
  dark: '--pl-type-dark',
  steel: '--pl-type-steel',
  fairy: '--pl-type-fairy',
} as const;

export type PokemonTypeWithColor = keyof typeof pokemonTypeColorVar;
