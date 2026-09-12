import { describe, expect, it } from 'vitest';

import { versionGroupDisplayName } from './version-group-label';

describe('versionGroupDisplayName', () => {
  it('returns a known game name for a mapped slug', () => {
    expect(versionGroupDisplayName('scarlet-violet')).toBe('Scarlet / Violet');
    expect(versionGroupDisplayName('sword-shield')).toBe('Sword / Shield');
  });

  it('falls back to a humanized slug for an unmapped version group, rather than blocking', () => {
    expect(versionGroupDisplayName('some-future-game')).toBe('Some Future Game');
  });
});
