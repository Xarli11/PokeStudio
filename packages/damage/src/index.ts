import { Generations, Move, Pokemon, calculate } from '@smogon/calc';
import type { GenerationNum } from '@smogon/calc';

/**
 * PokeStudio damage-domain boundary (ADR-0004).
 *
 * Application and UI code must call this module, never `@smogon/calc` directly.
 * This keeps the upstream dependency swappable and lets PokeStudio attach its
 * own explanation/UI layer above a trusted formula base.
 */

/** Pokémon generation, 1-9. Mirrors `@smogon/calc`'s GenerationNum without re-exporting it. */
export type PokemonGeneration = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface DamageCombatant {
  species: string;
  level?: number;
  item?: string;
  ability?: string;
  nature?: string;
  evs?: Partial<Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
  ivs?: Partial<Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
  boosts?: Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
}

export interface DamageCalculationInput {
  generation: PokemonGeneration;
  attacker: DamageCombatant;
  defender: DamageCombatant;
  move: string;
}

export interface DamageCalculationResult {
  /** Damage roll range in HP points (16 rolls, ascending). */
  minDamage: number;
  maxDamage: number;
  /** Human-readable explanation from the upstream formula (audit trail, not LLM output). */
  description: string;
  /** KO chance summary when computable (e.g. "guaranteed 2HKO"). */
  koChanceText: string | undefined;
}

/** Drops undefined-valued keys so optional fields aren't forwarded as explicit `undefined`. */
function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/**
 * Collapses a roll set into its [min, max] HP range. Multi-hit moves report
 * `number[][]` (one roll array per hit count); this spike flattens all rolls
 * rather than modeling per-hit-count totals separately.
 */
function damageRangeOf(damage: number | number[] | number[][]): [number, number] {
  const flat = Array.isArray(damage) ? damage.flat() : [damage];
  return [Math.min(...flat), Math.max(...flat)];
}

export function calculateDamage(input: DamageCalculationInput): DamageCalculationResult {
  const gen = Generations.get(input.generation as GenerationNum);

  const attacker = new Pokemon(
    gen,
    input.attacker.species,
    omitUndefined({
      level: input.attacker.level,
      item: input.attacker.item,
      ability: input.attacker.ability,
      nature: input.attacker.nature,
      evs: input.attacker.evs,
      ivs: input.attacker.ivs,
      boosts: input.attacker.boosts,
    }),
  );

  const defender = new Pokemon(
    gen,
    input.defender.species,
    omitUndefined({
      level: input.defender.level,
      item: input.defender.item,
      ability: input.defender.ability,
      nature: input.defender.nature,
      evs: input.defender.evs,
      ivs: input.defender.ivs,
      boosts: input.defender.boosts,
    }),
  );

  const move = new Move(gen, input.move);

  const result = calculate(gen, attacker, defender, move);
  const [minDamage, maxDamage] = damageRangeOf(result.damage);

  // err: false — zero-damage matchups (immunities, status moves) are valid
  // results, not exceptional; @smogon/calc throws by default instead.
  return {
    minDamage,
    maxDamage,
    description: result.fullDesc('%', false),
    koChanceText: result.kochance(false).text,
  };
}
