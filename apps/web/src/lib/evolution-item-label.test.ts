import { describe, expect, it } from 'vitest';

import { localizedItemName } from './evolution-item-label';

describe('localizedItemName', () => {
  it('returns the real official Spanish name for a classic evolution stone', () => {
    expect(localizedItemName('water-stone', 'es')).toBe('Piedra Agua');
    expect(localizedItemName('thunder-stone', 'es')).toBe('Piedra Trueno');
    expect(localizedItemName('dawn-stone', 'es')).toBe('Piedra Alba');
  });

  it('returns undefined (never a guess) for an item outside the confidently-known set', () => {
    expect(localizedItemName('prism-scale', 'es')).toBeUndefined();
    expect(localizedItemName('kings-rock', 'es')).toBeUndefined();
  });

  it('returns undefined for English — the caller falls back to the humanized slug either way', () => {
    expect(localizedItemName('water-stone', 'en')).toBeUndefined();
  });
});
