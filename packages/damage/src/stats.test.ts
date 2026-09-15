import { describe, expect, it } from 'vitest';

import { calculateHpStat, calculateOtherStat, calculateStats, natureMultiplierFor } from './stats';

// Every expected value below is hand-computed from the real Gen III+
// formulas (never a snapshot):
//   HP    = floor(((2*base + iv + floor(ev/4)) * level) / 100) + level + 10
//   other = floor((floor(((2*base + iv + floor(ev/4)) * level) / 100) + 5) * natureMultiplier)

describe('calculateHpStat', () => {
  it('base=100, iv=31, ev=252, level=100 -> 404', () => {
    // inner = 2*100+31+63 = 294; floor(294*100/100)=294; +100+10 = 404
    expect(calculateHpStat({ base: 100, iv: 31, ev: 252, level: 100 })).toBe(404);
  });

  it('minimum realistic spread: base=1, iv=0, ev=0, level=1 -> 11', () => {
    // inner = 2; floor(2*1/100)=0; +1+10 = 11
    expect(calculateHpStat({ base: 1, iv: 0, ev: 0, level: 1 })).toBe(11);
  });

  it('level scaling: base=50, iv=0, ev=0, level=50 -> 110', () => {
    // inner = 100; floor(100*50/100)=50; +level(50)+10 = 110
    expect(calculateHpStat({ base: 50, iv: 0, ev: 0, level: 50 })).toBe(110);
  });
});

describe('calculateOtherStat', () => {
  it('base=100, iv=31, ev=252, level=100, neutral nature -> 299', () => {
    // inner=294; floor(294*100/100)+5=299; *1 = 299
    expect(
      calculateOtherStat({ base: 100, iv: 31, ev: 252, level: 100, natureMultiplier: 1 }),
    ).toBe(299);
  });

  it('same spread with a positive nature (+10%) -> 328', () => {
    // floor(299*1.1) = floor(328.9) = 328
    expect(
      calculateOtherStat({ base: 100, iv: 31, ev: 252, level: 100, natureMultiplier: 1.1 }),
    ).toBe(328);
  });

  it('same spread with a negative nature (-10%) -> 269', () => {
    // floor(299*0.9) = floor(269.1) = 269
    expect(
      calculateOtherStat({ base: 100, iv: 31, ev: 252, level: 100, natureMultiplier: 0.9 }),
    ).toBe(269);
  });

  it('level scaling: base=50, iv=0, ev=0, level=50, neutral -> 55', () => {
    // inner=100; floor(100*50/100)+5=55; *1 = 55
    expect(calculateOtherStat({ base: 50, iv: 0, ev: 0, level: 50, natureMultiplier: 1 })).toBe(55);
  });

  it('EV edge: 0, 1, 2 and 3 EVs all produce the same stat as 0 (floor(ev/4) truncates)', () => {
    const withEv = (ev: number) =>
      calculateOtherStat({ base: 100, iv: 0, ev, level: 100, natureMultiplier: 1 });
    expect(withEv(0)).toBe(205);
    expect(withEv(1)).toBe(205);
    expect(withEv(2)).toBe(205);
    expect(withEv(3)).toBe(205);
    // The 4th EV point is where it actually changes — confirms EVs are NOT
    // incorrectly rounded/rejected as non-multiples of 4 (task requirement).
    expect(withEv(4)).toBe(206);
  });

  it('IV edge: 0 vs 31 IV (max realistic spread) differ by the full range', () => {
    const withIv = (iv: number) =>
      calculateOtherStat({ base: 100, iv, ev: 0, level: 100, natureMultiplier: 1 });
    expect(withIv(0)).toBe(205);
    expect(withIv(31)).toBe(236);
  });
});

describe('natureMultiplierFor', () => {
  const jollyLikeNature = {
    increasedStat: 'speed' as const,
    decreasedStat: 'special-attack' as const,
  };

  it('returns 1.1 for the increased stat', () => {
    expect(natureMultiplierFor('speed', jollyLikeNature)).toBe(1.1);
  });

  it('returns 0.9 for the decreased stat', () => {
    expect(natureMultiplierFor('specialAttack', jollyLikeNature)).toBe(0.9);
  });

  it('returns 1 for an unaffected stat', () => {
    expect(natureMultiplierFor('defense', jollyLikeNature)).toBe(1);
  });

  it('returns 1 for every stat under a neutral nature', () => {
    const neutral = {};
    expect(natureMultiplierFor('attack', neutral)).toBe(1);
    expect(natureMultiplierFor('speed', neutral)).toBe(1);
  });

  it('always returns 1 for HP — natures never modify HP', () => {
    expect(natureMultiplierFor('hp', jollyLikeNature)).toBe(1);
    expect(natureMultiplierFor('hp', { increasedStat: 'attack', decreasedStat: 'defense' })).toBe(
      1,
    );
  });
});

describe('calculateStats (all 6 stats together)', () => {
  const baseStats = {
    hp: 100,
    attack: 100,
    defense: 100,
    specialAttack: 100,
    specialDefense: 100,
    speed: 100,
  };
  const maxSpread = {
    hp: 31,
    attack: 31,
    defense: 31,
    specialAttack: 31,
    specialDefense: 31,
    speed: 31,
  };
  const evSpread = {
    hp: 252,
    attack: 252,
    defense: 0,
    specialAttack: 0,
    specialDefense: 0,
    speed: 0,
  };

  it('computes HP via the HP formula and non-HP stats via the nature-adjusted formula', () => {
    const result = calculateStats({
      baseStats,
      ivs: maxSpread,
      evs: evSpread,
      level: 100,
      nature: { increasedStat: 'attack', decreasedStat: 'special-attack' },
    });

    // HP: inner=2*100+31+63=294; floor(294)=294; +100+10=404 (same as calculateHpStat test above)
    expect(result.hp).toBe(404);
    // Attack: ev=252 -> floor(252/4)=63; inner=294; +5=299; *1.1(increased)=floor(328.9)=328
    expect(result.attack).toBe(328);
    // Defense: ev=0, iv=31 -> inner=2*100+31+0=231; floor(231)=231; +5=236; neutral for defense=*1=236
    expect(result.defense).toBe(236);
    // Special Attack: same base numbers as Defense (iv=31, ev=0) but decreased -> floor(236*0.9)=floor(212.4)=212
    expect(result.specialAttack).toBe(212);
  });

  it('forces HP to exactly 1 when isShedinja is true, regardless of base/IV/EV/level', () => {
    const result = calculateStats({
      baseStats,
      ivs: maxSpread,
      evs: evSpread,
      level: 100,
      nature: {},
      isShedinja: true,
    });
    expect(result.hp).toBe(1);
    // Every other stat is unaffected by the Shedinja flag.
    expect(result.attack).toBeGreaterThan(1);
  });
});
