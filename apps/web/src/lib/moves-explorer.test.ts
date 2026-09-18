import { describe, expect, it } from 'vitest';

import type { FormLearnsetAllEntry, VersionGroupSummary } from '@pokelab/database';

import {
  aggregateAllMoves,
  groupVersionGroupsByGeneration,
  pickDefaultVersionGroup,
  rowsForVersionGroup,
  summarizeGames,
  summarizeMethods,
  type VersionGroupInfo,
} from './moves-explorer';

function vg(slug: string, generation: number, displayOrder = 0): VersionGroupSummary {
  return { slug, generation, displayOrder };
}

function entry(overrides: Partial<FormLearnsetAllEntry> = {}): FormLearnsetAllEntry {
  return {
    moveSlug: 'tackle',
    versionGroupSlug: 'scarlet-violet',
    learnMethod: 'level-up',
    level: 1,
    ...overrides,
  };
}

describe('rowsForVersionGroup', () => {
  it('returns only entries for the requested version group, same granularity as one row per raw fact', () => {
    const entries = [
      entry({ moveSlug: 'tackle', versionGroupSlug: 'scarlet-violet', level: 1 }),
      entry({ moveSlug: 'growl', versionGroupSlug: 'sword-shield', level: 1 }),
      // Same move, two methods, same version group — two distinct rows (existing UX).
      entry({
        moveSlug: 'tackle',
        versionGroupSlug: 'scarlet-violet',
        learnMethod: 'machine',
        level: 0,
      }),
    ];
    const rows = rowsForVersionGroup(entries, 'scarlet-violet');
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.moveSlug === 'tackle')).toBe(true);
  });

  it('returns an empty array for a version group with no entries', () => {
    expect(rowsForVersionGroup([entry()], 'legends-za')).toEqual([]);
  });
});

describe('aggregateAllMoves', () => {
  const versionGroups = ['scarlet-violet', 'sword-shield'];

  it('deduplicates by move identity — one row per move regardless of how many entries reference it', () => {
    const entries = [
      entry({ moveSlug: 'tackle', versionGroupSlug: 'scarlet-violet', level: 1 }),
      entry({ moveSlug: 'tackle', versionGroupSlug: 'sword-shield', level: 3 }),
      entry({ moveSlug: 'growl', versionGroupSlug: 'scarlet-violet', level: 1 }),
    ];
    const rows = aggregateAllMoves(entries, versionGroups);
    expect(rows).toHaveLength(2);
  });

  it('aggregates every version group that grants the move, newest-first, never just one', () => {
    const entries = [
      entry({ moveSlug: 'tackle', versionGroupSlug: 'sword-shield', level: 3 }),
      entry({ moveSlug: 'tackle', versionGroupSlug: 'scarlet-violet', level: 1 }),
    ];
    const [row] = aggregateAllMoves(entries, versionGroups);
    expect(row!.versionGroupSlugs).toEqual(['scarlet-violet', 'sword-shield']);
  });

  it('collects every distinct level-up level across version groups instead of picking one arbitrarily', () => {
    const entries = [
      entry({
        moveSlug: 'tackle',
        versionGroupSlug: 'scarlet-violet',
        learnMethod: 'level-up',
        level: 1,
      }),
      entry({
        moveSlug: 'tackle',
        versionGroupSlug: 'sword-shield',
        learnMethod: 'level-up',
        level: 5,
      }),
    ];
    const [row] = aggregateAllMoves(entries, versionGroups);
    const levelUp = row!.methods.find((m) => m.learnMethod === 'level-up');
    expect(levelUp!.levels).toEqual([1, 5]);
  });

  it('aggregates multiple learn methods for the same move without inventing a single misleading one', () => {
    const entries = [
      entry({
        moveSlug: 'ancient-power',
        versionGroupSlug: 'scarlet-violet',
        learnMethod: 'machine',
        level: 0,
      }),
      entry({
        moveSlug: 'ancient-power',
        versionGroupSlug: 'sword-shield',
        learnMethod: 'tutor',
        level: 0,
      }),
    ];
    const [row] = aggregateAllMoves(entries, versionGroups);
    const methodSlugs = row!.methods.map((m) => m.learnMethod).sort();
    expect(methodSlugs).toEqual(['machine', 'tutor']);
  });

  it('never assigns levels to a non-level-up method', () => {
    const entries = [entry({ moveSlug: 'dig', learnMethod: 'machine', level: 0 })];
    const [row] = aggregateAllMoves(entries, versionGroups);
    expect(row!.methods).toEqual([{ learnMethod: 'machine', levels: [] }]);
  });
});

describe('pickDefaultVersionGroup', () => {
  it('picks the newest version group that has at least one level-up entry for this form', () => {
    const versionGroups = [vg('scarlet-violet', 9, 1), vg('sword-shield', 8, 1)];
    // scarlet-violet has data for this form, but only via a non-mainline method (no level-up) —
    // the real full-dataset "champions" finding (docs/adr/0013) this mirrors for a single form.
    const entries = [
      entry({ versionGroupSlug: 'scarlet-violet', learnMethod: 'tutor', level: 0 }),
      entry({ versionGroupSlug: 'sword-shield', learnMethod: 'level-up', level: 1 }),
    ];
    expect(pickDefaultVersionGroup(versionGroups, entries)).toBe('sword-shield');
  });

  it('falls back to the newest version group at all when none have a level-up entry', () => {
    const versionGroups = [vg('scarlet-violet', 9, 1), vg('sword-shield', 8, 1)];
    const entries = [entry({ versionGroupSlug: 'sword-shield', learnMethod: 'tutor', level: 0 })];
    expect(pickDefaultVersionGroup(versionGroups, entries)).toBe('scarlet-violet');
  });

  it('returns undefined for a form with no version groups at all', () => {
    expect(pickDefaultVersionGroup([], [])).toBeUndefined();
  });
});

function info(slug: string, name: string, generation: number): VersionGroupInfo {
  return { slug, name, generation };
}

const infoMap = new Map<string, VersionGroupInfo>([
  ['scarlet-violet', info('scarlet-violet', 'Scarlet / Violet', 9)],
  ['champions', info('champions', 'Champions', 9)],
  ['sword-shield', info('sword-shield', 'Sword / Shield', 8)],
  [
    'brilliant-diamond-shining-pearl',
    info('brilliant-diamond-shining-pearl', 'Brilliant Diamond / Shining Pearl', 8),
  ],
  ['sun-moon', info('sun-moon', 'Sun / Moon', 7)],
]);

describe('summarizeGames', () => {
  it('shows the single game name directly when there is only one', () => {
    expect(summarizeGames(['scarlet-violet'], infoMap)).toEqual({
      count: 1,
      singleName: 'Scarlet / Violet',
    });
  });

  it('summarizes multiple games in the same generation without a range', () => {
    const summary = summarizeGames(['scarlet-violet', 'champions'], infoMap);
    expect(summary).toEqual({ count: 2, minGeneration: 9, maxGeneration: 9 });
  });

  it('summarizes games spanning multiple generations as a range', () => {
    const summary = summarizeGames(['scarlet-violet', 'sword-shield', 'sun-moon'], infoMap);
    expect(summary).toEqual({ count: 3, minGeneration: 7, maxGeneration: 9 });
  });

  it('falls back to count-only when generation metadata is missing for every group', () => {
    expect(summarizeGames(['unknown-a', 'unknown-b'], new Map())).toEqual({ count: 2 });
  });
});

describe('groupVersionGroupsByGeneration', () => {
  it('groups contiguous same-generation entries under one generation, never repeated', () => {
    const groups = groupVersionGroupsByGeneration(
      [
        'scarlet-violet',
        'champions',
        'sword-shield',
        'brilliant-diamond-shining-pearl',
        'sun-moon',
      ],
      infoMap,
    );
    expect(groups).toEqual([
      { generation: 9, names: ['Scarlet / Violet', 'Champions'] },
      { generation: 8, names: ['Sword / Shield', 'Brilliant Diamond / Shining Pearl'] },
      { generation: 7, names: ['Sun / Moon'] },
    ]);
  });
});

describe('summarizeMethods', () => {
  it('prefers level-up as the primary method when present', () => {
    const { primary, otherCount } = summarizeMethods([
      { learnMethod: 'machine', levels: [] },
      { learnMethod: 'level-up', levels: [12] },
      { learnMethod: 'egg', levels: [] },
    ]);
    expect(primary.learnMethod).toBe('level-up');
    expect(otherCount).toBe(2);
  });

  it('falls back to the first method when there is no level-up', () => {
    const { primary, otherCount } = summarizeMethods([
      { learnMethod: 'machine', levels: [] },
      { learnMethod: 'tutor', levels: [] },
    ]);
    expect(primary.learnMethod).toBe('machine');
    expect(otherCount).toBe(1);
  });
});
