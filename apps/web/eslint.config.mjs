// @ts-check
import { FlatCompat } from '@eslint/eslintrc';

import { baseConfig } from '../../packages/config/eslint-base.mjs';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...baseConfig,
  ...compat.extends('next/core-web-vitals'),
  {
    ignores: [
      '.next/**',
      '.open-next/**',
      '.wrangler/**',
      '*.config.mjs',
      '*.config.ts',
      'next-env.d.ts',
    ],
  },
];
