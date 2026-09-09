import { describe, expect, it } from 'vitest';

import { isTheme } from './theme';

describe('isTheme', () => {
  it('accepts known themes', () => {
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('light')).toBe(true);
  });

  it('rejects unknown or missing values', () => {
    expect(isTheme('solarized')).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
});
