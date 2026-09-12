import { describe, expect, it } from 'vitest';

import { statTier, totalStatTier } from './stat-quality';

describe('statTier', () => {
  it('classifies low (0-49)', () => {
    expect(statTier(0)).toBe('low');
    expect(statTier(20)).toBe('low');
    expect(statTier(49)).toBe('low');
  });

  it('classifies average (50-79)', () => {
    expect(statTier(50)).toBe('average');
    expect(statTier(65)).toBe('average');
    expect(statTier(79)).toBe('average');
  });

  it('classifies good (80-109)', () => {
    expect(statTier(80)).toBe('good');
    expect(statTier(95)).toBe('good');
    expect(statTier(109)).toBe('good');
  });

  it('classifies excellent (110+)', () => {
    expect(statTier(110)).toBe('excellent');
    expect(statTier(150)).toBe('excellent');
    expect(statTier(255)).toBe('excellent');
  });
});

describe('totalStatTier', () => {
  it('classifies low (<320) — e.g. Magikarp (200)', () => {
    expect(totalStatTier(200)).toBe('low');
    expect(totalStatTier(319)).toBe('low');
  });

  it('classifies average (320-449) — e.g. Bulbasaur (318 rounds up conceptually), Pikachu (320)', () => {
    expect(totalStatTier(320)).toBe('average');
    expect(totalStatTier(400)).toBe('average');
    expect(totalStatTier(449)).toBe('average');
  });

  it('classifies good (450-549) — e.g. Venusaur (525)', () => {
    expect(totalStatTier(450)).toBe('good');
    expect(totalStatTier(525)).toBe('good');
    expect(totalStatTier(549)).toBe('good');
  });

  it('classifies excellent (550+) — e.g. Garchomp (600), Mewtwo (680)', () => {
    expect(totalStatTier(550)).toBe('excellent');
    expect(totalStatTier(600)).toBe('excellent');
    expect(totalStatTier(680)).toBe('excellent');
    expect(totalStatTier(1125)).toBe('excellent');
  });
});
