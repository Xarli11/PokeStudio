import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DamageCalculationResult } from '@pokestudio/damage';

import { DamageResult, type DamageResultLabels } from './damage-result';

afterEach(cleanup);
afterEach(() => {
  vi.unstubAllEnvs();
});

const BASE_RESULT: DamageCalculationResult = {
  distribution: { kind: 'rolls', rolls: [184, 228] },
  minDamage: 184,
  maxDamage: 228,
  defenderMaxHp: 235,
  minPercent: 78.29787234042553,
  maxPercent: 97.02127659574468,
  ko: { chance: 1, hitsToKo: 2 },
  effectiveness: 'super-effective',
  isSTAB: true,
  modifiers: {
    isCritical: false,
    isBurned: false,
    isProtected: false,
    weather: undefined,
    terrain: undefined,
    isReflect: false,
    isLightScreen: false,
    isAuroraVeil: false,
    isHelpingHand: false,
    isFriendGuard: false,
    isBattery: false,
    isPowerSpot: false,
    ruinAbilityActive: undefined,
    isDefenderDynamaxed: false,
    hits: undefined,
  },
  debugDescription: 'Garchomp Earthquake vs. Heatran: 184-228 (78.3 - 97.0%) -- guaranteed 2HKO',
};

const LABELS_EN: DamageResultLabels = {
  hpRangeTemplate: '{min}–{max} HP',
  percentRangeTemplate: '{min}–{max}%',
  effectiveness: {
    immune: 'Immune',
    'not-very-effective': 'Not very effective',
    neutral: 'Effective',
    'super-effective': 'Super effective',
  },
  stabLabel: 'STAB',
  criticalLabel: 'Critical hit',
  koGuaranteedTemplate: 'Guaranteed {hits}HKO',
  koChanceTemplate: '{chance}% chance to {hits}HKO',
  koPossibleTemplate: 'Possible {hits}HKO',
  koHitWordSingular: 'hit',
  koHitWordPlural: 'hits',
  koNoDamage: 'No damage this calculation.',
  detailsLabel: 'Details',
  debugDescriptionLabel: 'Upstream calculation trace (debug)',
  modifiers: {
    hitsTemplate: '{count} hits',
    burned: 'Burned',
    protected: 'Protected',
    defenderDynamaxed: 'Defender Dynamaxed',
    weather: {
      sand: 'Sandstorm',
      sun: 'Harsh sunlight',
      rain: 'Rain',
      hail: 'Hail',
      snow: 'Snow',
      'harsh-sunshine': 'Extremely harsh sunlight',
      'heavy-rain': 'Heavy rain',
      'strong-winds': 'Strong winds',
    },
    terrain: {
      electric: 'Electric Terrain',
      grassy: 'Grassy Terrain',
      psychic: 'Psychic Terrain',
      misty: 'Misty Terrain',
    },
    reflect: 'Reflect',
    lightScreen: 'Light Screen',
    auroraVeil: 'Aurora Veil',
    helpingHand: 'Helping Hand',
    friendGuard: 'Friend Guard',
    battery: 'Battery',
    powerSpot: 'Power Spot',
    ruinAbility: {
      sword: 'Sword of Ruin',
      beads: 'Beads of Ruin',
      tablets: 'Tablets of Ruin',
      vessel: 'Vessel of Ruin',
    },
  },
};

const LABELS_ES: DamageResultLabels = {
  ...LABELS_EN,
  criticalLabel: 'Golpe crítico',
  koGuaranteedTemplate: 'KO garantizado en {hits} {hitWord}',
  koChanceTemplate: '{chance}% de probabilidad de KO en {hits} {hitWord}',
  koPossibleTemplate: 'Posible KO en {hits} {hitWord}',
  koHitWordSingular: 'golpe',
  koHitWordPlural: 'golpes',
  detailsLabel: 'Detalles',
};

describe('DamageResult — Spanish KO copy (visual review: no unexplained HKO jargon)', () => {
  it('renders a guaranteed 2HKO as natural language, plural', () => {
    render(<DamageResult result={BASE_RESULT} locale="es" labels={LABELS_ES} />);
    expect(screen.getByText('KO garantizado en 2 golpes')).not.toBeNull();
    expect(screen.queryByText(/HKO/)).toBeNull();
  });

  it('renders a guaranteed 1HKO as natural language, singular', () => {
    const result: DamageCalculationResult = {
      ...BASE_RESULT,
      ko: { chance: 1, hitsToKo: 1 },
    };
    render(<DamageResult result={result} locale="es" labels={LABELS_ES} />);
    expect(screen.getByText('KO garantizado en 1 golpe')).not.toBeNull();
  });

  it('renders a chance-based KO as natural language', () => {
    const result: DamageCalculationResult = {
      ...BASE_RESULT,
      ko: { chance: 0.375, hitsToKo: 1 },
    };
    render(<DamageResult result={result} locale="es" labels={LABELS_ES} />);
    expect(screen.getByText(/37,5% de probabilidad de KO en 1 golpe/)).not.toBeNull();
  });

  it('renders a possible (unresolved-chance) KO as natural language, plural', () => {
    const result: DamageCalculationResult = {
      ...BASE_RESULT,
      ko: { chance: undefined, hitsToKo: 3 },
    };
    render(<DamageResult result={result} locale="es" labels={LABELS_ES} />);
    expect(screen.getByText('Posible KO en 3 golpes')).not.toBeNull();
  });

  it('keeps established competitive shorthand in English', () => {
    render(<DamageResult result={BASE_RESULT} locale="en" labels={LABELS_EN} />);
    expect(screen.getByText('Guaranteed 2HKO')).not.toBeNull();
  });
});

describe('DamageResult — Details disclosure (visual review: was expanding to nothing)', () => {
  it('hides the Details control in production when no modifier is active', () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(<DamageResult result={BASE_RESULT} locale="en" labels={LABELS_EN} />);
    expect(screen.queryByText('Details')).toBeNull();
  });

  it('shows the Details control and the debug trace outside production, even with no modifier active', () => {
    vi.stubEnv('NODE_ENV', 'development');
    render(<DamageResult result={BASE_RESULT} locale="en" labels={LABELS_EN} />);
    const button = screen.getByText(/Details/);
    fireEvent.click(button);
    expect(screen.getByText(/Upstream calculation trace \(debug\)/)).not.toBeNull();
  });

  it('shows real modifier content in Details, in production, when a modifier is actually active', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const result: DamageCalculationResult = {
      ...BASE_RESULT,
      distribution: { kind: 'multi-hit', rollSets: [[10, 12]] },
      modifiers: { ...BASE_RESULT.modifiers, hits: 3 },
    };
    render(<DamageResult result={result} locale="en" labels={LABELS_EN} />);
    const button = screen.getByText(/Details/);
    fireEvent.click(button);
    expect(screen.getByText('3 hits')).not.toBeNull();
    // The debug trace itself must still never appear in production.
    expect(screen.queryByText(/Upstream calculation trace/)).toBeNull();
  });
});
