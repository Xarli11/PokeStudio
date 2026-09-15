import { describe, expect, it } from 'vitest';

import { groupVersionGroupsByGeneration, versionGroupDisplayName } from './version-group-label';

describe('versionGroupDisplayName', () => {
  it('returns a known game name for a mapped slug', () => {
    expect(versionGroupDisplayName('scarlet-violet')).toBe('Scarlet / Violet');
    expect(versionGroupDisplayName('sword-shield')).toBe('Sword / Shield');
  });

  it('falls back to a humanized slug for an unmapped version group, rather than blocking', () => {
    expect(versionGroupDisplayName('some-future-game')).toBe('Some Future Game');
  });
});

describe('groupVersionGroupsByGeneration', () => {
  it('groups consecutive same-generation entries, preserving input order', () => {
    const groups = groupVersionGroupsByGeneration([
      { slug: 'scarlet-violet', generation: 9, displayOrder: 1 },
      { slug: 'sword-shield', generation: 8, displayOrder: 1 },
      { slug: 'the-crown-tundra', generation: 8, displayOrder: 3 },
      { slug: 'emerald', generation: 3, displayOrder: 3 },
    ]);
    expect(groups).toEqual([
      {
        generation: 9,
        versionGroups: [{ slug: 'scarlet-violet', generation: 9, displayOrder: 1 }],
      },
      {
        generation: 8,
        versionGroups: [
          { slug: 'sword-shield', generation: 8, displayOrder: 1 },
          { slug: 'the-crown-tundra', generation: 8, displayOrder: 3 },
        ],
      },
      { generation: 3, versionGroups: [{ slug: 'emerald', generation: 3, displayOrder: 3 }] },
    ]);
  });

  it('returns an empty list for an empty input', () => {
    expect(groupVersionGroupsByGeneration([])).toEqual([]);
  });
});
