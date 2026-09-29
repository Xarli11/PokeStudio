import { PRNG } from 'pokemon-showdown';

/**
 * Series seeds. No PokeStudio RNG: the simulator's own PRNG derives one seed per game from the
 * series seed, so a series is reproducible from a single value.
 */
type SimulatorSeed = NonNullable<ConstructorParameters<typeof PRNG>[0]>;

/** A fresh series seed from the simulator (its default, sodium-based generator). */
export const generateSeed = (): string => PRNG.generateSeed();

/** One `gen5,…` seed per possible game of the series, derived deterministically. */
export function deriveGameSeeds(seriesSeed: string, count: number): string[] {
  const prng = new PRNG(seriesSeed as SimulatorSeed);
  return Array.from(
    { length: count },
    () =>
      `gen5,${Array.from({ length: 4 }, () =>
        prng.random(0x10000).toString(16).padStart(4, '0'),
      ).join('')}`,
  );
}
