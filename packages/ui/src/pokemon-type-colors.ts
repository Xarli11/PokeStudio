/**
 * Semantic accent colors for Pokémon types (CSS custom property names).
 * Used to color a badge/cell inline — never as the PokeStudio brand palette.
 * Extended to the full 18-type set when Explore data ships.
 */
export const pokemonTypeColorVar = {
  fire: '--ps-type-fire',
  water: '--ps-type-water',
  grass: '--ps-type-grass',
  electric: '--ps-type-electric',
  psychic: '--ps-type-psychic',
  dragon: '--ps-type-dragon',
} as const;

export type PokemonTypeWithColor = keyof typeof pokemonTypeColorVar;
