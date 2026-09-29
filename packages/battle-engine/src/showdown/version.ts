import { createRequire } from 'node:module';

/** The installed simulator's version, recorded in replays. */
export const SIMULATOR_VERSION: string = (
  createRequire(import.meta.url)('pokemon-showdown/package.json') as { version: string }
).version;
