import { describe, expect, it } from 'vitest';

import { needsSlugCanonicalization } from './entity-slug';

describe('needsSlugCanonicalization', () => {
  it('is false for an already-lowercase slug', () => {
    expect(needsSlugCanonicalization('mew')).toBe(false);
    expect(needsSlugCanonicalization('meowth-alola')).toBe(false);
  });

  it('is true for any uppercase variant', () => {
    expect(needsSlugCanonicalization('MEW')).toBe(true);
    expect(needsSlugCanonicalization('Mew')).toBe(true);
    expect(needsSlugCanonicalization('mEw')).toBe(true);
    expect(needsSlugCanonicalization('TACKLE')).toBe(true);
    expect(needsSlugCanonicalization('OVERGROW')).toBe(true);
  });
});
