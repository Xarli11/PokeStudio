import { describe, expect, it } from 'vitest';

import { defaultLocale, getDictionary, isLocale, locales } from './index';

describe('i18n dictionaries', () => {
  it('every locale resolves to a dictionary with matching keys', () => {
    const referenceKeys = Object.keys(getDictionary(defaultLocale)).sort();

    for (const locale of locales) {
      expect(Object.keys(getDictionary(locale)).sort()).toEqual(referenceKeys);
    }
  });

  it('rejects unknown locale strings', () => {
    expect(isLocale('fr')).toBe(false);
    expect(isLocale('es')).toBe(true);
  });
});
