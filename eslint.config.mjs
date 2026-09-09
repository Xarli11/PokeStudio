// @ts-check
import { baseConfig } from './packages/config/eslint-base.mjs';

export default [
  ...baseConfig,
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
      'research/python/**',
      '**/*.config.js',
    ],
  },
];
