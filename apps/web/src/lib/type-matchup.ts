import { ALL_POKEMON_TYPES, getTypeEffectiveness } from '@pokestudio/pokemon-data';
import type { PokemonType } from '@pokestudio/pokemon-data';

/**
 * A form's defensive type profile against every attacking type (Milestone
 * 2, Stage 2A — Compare). Pure and testable, mirroring
 * `pokemon-search.ts`'s "derive everything from the shared domain module"
 * shape — the actual multiplier table lives once, in
 * `@pokestudio/pokemon-data`'s type chart, not duplicated here.
 *
 * Neutral (1x) attacking types are omitted entirely — Compare only needs to
 * call out what's actually notable about a form's defensive profile.
 */
export interface DefensiveTypeMatchups {
  doubleWeak: PokemonType[];
  weak: PokemonType[];
  resist: PokemonType[];
  doubleResist: PokemonType[];
  immune: PokemonType[];
}

export function computeDefensiveMatchups(
  defendingTypes: readonly PokemonType[],
): DefensiveTypeMatchups {
  const result: DefensiveTypeMatchups = {
    doubleWeak: [],
    weak: [],
    resist: [],
    doubleResist: [],
    immune: [],
  };

  for (const attackingType of ALL_POKEMON_TYPES) {
    const multiplier = getTypeEffectiveness(attackingType, defendingTypes);
    switch (multiplier) {
      case 4:
        result.doubleWeak.push(attackingType);
        break;
      case 2:
        result.weak.push(attackingType);
        break;
      case 0.5:
        result.resist.push(attackingType);
        break;
      case 0.25:
        result.doubleResist.push(attackingType);
        break;
      case 0:
        result.immune.push(attackingType);
        break;
      // 1 (neutral): deliberately omitted.
    }
  }

  return result;
}
