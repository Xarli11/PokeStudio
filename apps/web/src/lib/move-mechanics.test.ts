import { describe, expect, it } from 'vitest';

import { getDictionary } from '@pokelab/i18n';

import {
  describeMoveMechanics,
  shouldShowMoveDescription,
  type MoveMechanicsInput,
} from './move-mechanics';

const en = getDictionary('en');
const es = getDictionary('es');

function move(overrides: Partial<MoveMechanicsInput> = {}): MoveMechanicsInput {
  return {
    target: 'selected-pokemon',
    category: 'damage',
    statChanges: [],
    statChance: 0,
    ailment: undefined,
    ailmentChance: 0,
    flinchChance: 0,
    drain: 0,
    healing: 0,
    minHits: undefined,
    maxHits: undefined,
    minTurns: undefined,
    maxTurns: undefined,
    critRate: 0,
    ...overrides,
  };
}

describe('describeMoveMechanics', () => {
  it('returns no lines for a plain status/damage move with no secondary mechanics', () => {
    expect(describeMoveMechanics(move(), en, 'en')).toEqual([]);
  });

  it('states a guaranteed -1 Defense stage change on the target (Growl-like debuff)', () => {
    const lines = describeMoveMechanics(
      move({
        target: 'selected-pokemon',
        category: 'net-good-stats',
        statChanges: [{ stat: 'defense', change: -1 }],
      }),
      en,
      'en',
    );
    expect(lines).toContain("Lowers the target's Defense by 1 stage.");
  });

  it('states a guaranteed +2 Attack stages change on the user (Swords Dance-like buff)', () => {
    const lines = describeMoveMechanics(
      move({
        target: 'user',
        category: 'net-good-stats',
        statChanges: [{ stat: 'attack', change: 2 }],
      }),
      en,
      'en',
    );
    expect(lines).toContain("Raises the user's Attack by 2 stages.");
  });

  it('resolves a "damage-raise" move to the user even though target is the opponent (Superpower-style)', () => {
    const lines = describeMoveMechanics(
      move({
        target: 'selected-pokemon',
        category: 'damage-raise',
        statChanges: [
          { stat: 'attack', change: -1 },
          { stat: 'defense', change: -1 },
        ],
      }),
      en,
      'en',
    );
    expect(lines).toContain("Lowers the user's Attack by 1 stage.");
    expect(lines).toContain("Lowers the user's Defense by 1 stage.");
  });

  it('preserves order for multiple stat changes (Shell Smash: 5 changes)', () => {
    const lines = describeMoveMechanics(
      move({
        target: 'user',
        category: 'unique',
        statChanges: [
          { stat: 'defense', change: -1 },
          { stat: 'special-defense', change: -1 },
          { stat: 'attack', change: 2 },
          { stat: 'special-attack', change: 2 },
          { stat: 'speed', change: 2 },
        ],
      }),
      en,
      'en',
    );
    expect(lines).toEqual([
      "Lowers the user's Defense by 1 stage.",
      "Lowers the user's Special Defense by 1 stage.",
      "Raises the user's Attack by 2 stages.",
      "Raises the user's Special Attack by 2 stages.",
      "Raises the user's Speed by 2 stages.",
    ]);
  });

  it('states an exact 30% ailment chance using the hand-verified burn phrasing', () => {
    const lines = describeMoveMechanics(move({ ailment: 'burn', ailmentChance: 30 }), en, 'en');
    expect(lines).toContain('Has a 30% chance to burn the target.');
  });

  it('states a 100% chance-based mechanic without rounding or dropping the number', () => {
    const lines = describeMoveMechanics(
      move({ ailment: 'paralysis', ailmentChance: 100 }),
      en,
      'en',
    );
    expect(lines).toContain('Has a 100% chance to paralyze the target.');
  });

  it('falls back to a generic, honest phrasing for an ailment with no hand-verified verb', () => {
    const lines = describeMoveMechanics(
      move({ ailment: 'leech-seed', ailmentChance: 100 }),
      en,
      'en',
    );
    expect(lines).toContain('Has a 100% chance to inflict Leech Seed on the target.');
  });

  it('states a guaranteed ailment (chance 0 = always happens on hit) without a percentage', () => {
    const lines = describeMoveMechanics(move({ ailment: 'poison', ailmentChance: 0 }), en, 'en');
    expect(lines).toContain('Poisons the target.');
  });

  it('states a 2–5 hit range explicitly', () => {
    const lines = describeMoveMechanics(move({ minHits: 2, maxHits: 5 }), en, 'en');
    expect(lines).toContain('Hits 2–5 times.');
  });

  it('states an exact hit count when min equals max', () => {
    const lines = describeMoveMechanics(move({ minHits: 2, maxHits: 2 }), en, 'en');
    expect(lines).toContain('Hits 2 times.');
  });

  it('states recoil damage (negative drain) distinctly from draining HP (positive drain)', () => {
    const recoilLines = describeMoveMechanics(move({ drain: -25 }), en, 'en');
    expect(recoilLines).toContain('The user takes recoil damage equal to 25% of the damage dealt.');

    const drainLines = describeMoveMechanics(move({ drain: 50 }), en, 'en');
    expect(drainLines).toContain('Restores 50% of the damage dealt as HP to the user.');
  });

  it('states healing (% of max HP) distinctly from drain (% of damage dealt)', () => {
    const lines = describeMoveMechanics(move({ healing: 50 }), en, 'en');
    expect(lines).toContain("Restores 50% of the user's maximum HP.");
  });

  it('states a flinch chance explicitly', () => {
    const lines = describeMoveMechanics(move({ flinchChance: 30 }), en, 'en');
    expect(lines).toContain('Has a 30% chance to make the target flinch.');
  });

  it('states an increased critical-hit ratio when crit_rate is nonzero (e.g. Slash)', () => {
    const lines = describeMoveMechanics(move({ critRate: 1 }), en, 'en');
    expect(lines).toContain('Has an increased critical-hit ratio.');
  });

  it('says nothing about crit rate for a normal-rate move', () => {
    const lines = describeMoveMechanics(move({ critRate: 0 }), en, 'en');
    expect(lines).toEqual([]);
  });

  it('preserves exact percentages and stage counts identically in Spanish (no rounding, no dropped numbers)', () => {
    const input = move({
      target: 'selected-pokemon',
      category: 'net-good-stats',
      statChanges: [{ stat: 'defense', change: -1 }],
      ailment: 'burn',
      ailmentChance: 30,
      healing: 50,
      minHits: 2,
      maxHits: 5,
    });
    const lines = describeMoveMechanics(input, es, 'es');
    expect(lines).toContain('Reduce la Defensa del objetivo en 1 nivel.');
    expect(lines).toContain('Tiene un 30 % de probabilidad de quemar al objetivo.');
    expect(lines).toContain('Recupera el 50 % de los PS máximos del usuario.');
    expect(lines).toContain('Golpea entre 2 y 5 veces.');
  });

  it('states flinch (amedrentar) distinctly from recoil (retroceso) in Spanish — no shared terminology between the two mechanics', () => {
    const flinchLines = describeMoveMechanics(move({ flinchChance: 30 }), es, 'es');
    expect(flinchLines).toContain('Tiene un 30 % de probabilidad de amedrentar al objetivo.');

    const recoilLines = describeMoveMechanics(move({ drain: -25 }), es, 'es');
    expect(recoilLines).toContain(
      'El usuario recibe daño de retroceso igual al 25 % del daño causado.',
    );
  });

  it('states an increased critical-hit ratio in Spanish', () => {
    const lines = describeMoveMechanics(move({ critRate: 1 }), es, 'es');
    expect(lines).toContain('Tiene una probabilidad de golpe crítico aumentada.');
  });
});

describe('shouldShowMoveDescription', () => {
  it('shows the description section when a real description exists, regardless of technical effects', () => {
    expect(shouldShowMoveDescription('Deals damage.', 0)).toBe(true);
    expect(shouldShowMoveDescription('Deals damage.', 3)).toBe(true);
  });

  it('hides the empty description section when technical effects carry the page instead — never a broken-looking empty block', () => {
    expect(shouldShowMoveDescription(undefined, 3)).toBe(false);
  });

  it('falls back to showing the honest "unavailable" message when there is truly nothing else to say', () => {
    expect(shouldShowMoveDescription(undefined, 0)).toBe(true);
  });
});
