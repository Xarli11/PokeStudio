import { describe, expect, it } from 'vitest';

import { defaultLocale, getDictionary, isLocale, locales } from './index';

/** Every nested key path in a dictionary object, e.g. "battle.damageLab.errors.unknownForm" — a plain top-level `Object.keys` comparison would miss a mismatch buried inside a nested section like `battle.damageLab.modifiers`. */
function deepKeyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    deepKeyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('i18n dictionaries', () => {
  it('every locale resolves to a dictionary with matching keys (deep, not just top-level)', () => {
    const referenceKeys = deepKeyPaths(getDictionary(defaultLocale)).sort();

    for (const locale of locales) {
      expect(deepKeyPaths(getDictionary(locale)).sort()).toEqual(referenceKeys);
    }
  });

  it('rejects unknown locale strings', () => {
    expect(isLocale('fr')).toBe(false);
    expect(isLocale('es')).toBe(true);
  });
});
