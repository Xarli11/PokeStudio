import { defineConfig } from 'vitest/config';

// Creating a battle loads the simulator's data on first use, which is slow on CI runners.
export default defineConfig({ test: { testTimeout: 30_000, hookTimeout: 30_000 } });
