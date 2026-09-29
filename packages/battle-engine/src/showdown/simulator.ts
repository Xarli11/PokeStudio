import { createRequire } from 'node:module';

import type * as Simulator from 'pokemon-showdown';

/**
 * The single place that loads the simulator. `pokemon-showdown` is a CommonJS package whose named
 * exports Node's ESM loader cannot detect, so a plain `import { Dex } from 'pokemon-showdown'` works
 * under bundlers/vitest but fails when the engine runs directly on Node (the battle server). Loading
 * it with `createRequire` works everywhere Node does and keeps the types.
 */
const simulator = createRequire(import.meta.url)('pokemon-showdown') as typeof Simulator;

export const Battle: typeof Simulator.Battle = simulator.Battle;
export const Dex: typeof Simulator.Dex = simulator.Dex;
export const PRNG: typeof Simulator.PRNG = simulator.PRNG;
export const TeamValidator: typeof Simulator.TeamValidator = simulator.TeamValidator;
export const Teams: typeof Simulator.Teams = simulator.Teams;

export type Battle = InstanceType<typeof Simulator.Battle>;
export type Pokemon = InstanceType<typeof Simulator.Pokemon>;
export type PRNG = InstanceType<typeof Simulator.PRNG>;
