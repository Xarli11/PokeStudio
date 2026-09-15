import { describe, expect, it } from 'vitest';

import { computeDefensiveMatchups } from './type-matchup';

describe('computeDefensiveMatchups', () => {
  it('finds a double weakness (4x) for a dual-type form (Dragonite: Dragon/Flying vs Ice)', () => {
    const result = computeDefensiveMatchups(['dragon', 'flying']);
    expect(result.doubleWeak).toContain('ice');
  });

  it('finds a double resistance (0.25x) for a dual-type form (Charizard: Fire/Flying vs Grass)', () => {
    const result = computeDefensiveMatchups(['fire', 'flying']);
    expect(result.doubleResist).toContain('grass');
  });

  it('reports an immunity (Normal vs Ghost)', () => {
    const result = computeDefensiveMatchups(['normal']);
    expect(result.immune).toContain('ghost');
  });

  it('reports a single weakness (2x) for a mono-type form', () => {
    const result = computeDefensiveMatchups(['grass']);
    expect(result.weak).toContain('fire');
    expect(result.weak).toContain('flying');
    expect(result.weak).toContain('ice');
    expect(result.weak).toContain('poison');
    expect(result.weak).toContain('bug');
  });

  it('reports a single resistance (0.5x) for a mono-type form', () => {
    const result = computeDefensiveMatchups(['grass']);
    expect(result.resist).toContain('water');
    expect(result.resist).toContain('electric');
    expect(result.resist).toContain('grass');
    expect(result.resist).toContain('ground');
  });

  it('omits neutral (1x) attacking types entirely', () => {
    const result = computeDefensiveMatchups(['normal']);
    const allListed = [
      ...result.doubleWeak,
      ...result.weak,
      ...result.resist,
      ...result.doubleResist,
      ...result.immune,
    ];
    // Normal is 1x (neutral) against itself.
    expect(allListed).not.toContain('normal');
  });

  it('never lists the same attacking type in two different tiers', () => {
    const result = computeDefensiveMatchups(['steel', 'fairy']);
    const allListed = [
      ...result.doubleWeak,
      ...result.weak,
      ...result.resist,
      ...result.doubleResist,
      ...result.immune,
    ];
    expect(new Set(allListed).size).toBe(allListed.length);
  });
});
