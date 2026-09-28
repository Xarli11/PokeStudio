import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DamageCalculationResult } from '@pokestudio/damage';
import type { PokemonType } from '@pokestudio/pokemon-data';

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
  explanation: [{ kind: 'type-effectiveness', multiplier: 2, tier: 'super-effective' }],
  debugDescription: 'Garchomp Earthquake vs. Heatran: 184-228 (78.3 - 97.0%) -- guaranteed 2HKO',
};

const TYPE_LABELS: Record<PokemonType, string> = {
  normal: 'Normal',
  fire: 'Fire',
  water: 'Water',
  electric: 'Electric',
  grass: 'Grass',
  ice: 'Ice',
  fighting: 'Fighting',
  poison: 'Poison',
  ground: 'Ground',
  flying: 'Flying',
  psychic: 'Psychic',
  bug: 'Bug',
  rock: 'Rock',
  ghost: 'Ghost',
  dragon: 'Dragon',
  dark: 'Dark',
  steel: 'Steel',
  fairy: 'Fairy',
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
  explanationLabel: 'How this damage is calculated',
  debugDescriptionLabel: 'Upstream calculation trace (debug)',
  teraSummaryTemplate: 'Tera {type}',
  explanation: {
    typeEffectivenessLabel: 'Type effectiveness',
    typeEffectivenessValueTemplate: '×{multiplier} · {tier}',
    stabDescription: "The attacker shares the move's type",
    criticalDescription: 'Applied',
    multiHitLabel: 'Multiple hits',
    multiHitValueTemplate: '{count} hits',
    attackerItemDescription: "Attacker's item",
    attackerAbilityDescription: "Attacker's ability",
    attackerTeraDescription: "Attacker's Terastallization",
    defenderItemDescription: "Defender's item",
    defenderAbilityDescription: "Defender's ability",
    defenderTeraDescription: "Defender's Terastallization",
  },
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
  explanationLabel: 'Cómo se calcula',
  explanation: {
    ...LABELS_EN.explanation,
    typeEffectivenessLabel: 'Eficacia de tipo',
    stabDescription: 'El atacante comparte el tipo del movimiento',
    criticalDescription: 'Aplicado',
    multiHitLabel: 'Golpes múltiples',
    multiHitValueTemplate: '{count} golpes',
    attackerItemDescription: 'Objeto del atacante',
    attackerAbilityDescription: 'Habilidad del atacante',
    attackerTeraDescription: 'Teracristalización del atacante',
    defenderItemDescription: 'Objeto del defensor',
    defenderAbilityDescription: 'Habilidad del defensor',
    defenderTeraDescription: 'Teracristalización del defensor',
  },
};

describe('DamageResult — Spanish KO copy (visual review: no unexplained HKO jargon)', () => {
  it('renders a guaranteed 2HKO as natural language, plural', () => {
    render(
      <DamageResult result={BASE_RESULT} locale="es" labels={LABELS_ES} typeLabels={TYPE_LABELS} />,
    );
    expect(screen.getByText('KO garantizado en 2 golpes')).not.toBeNull();
    expect(screen.queryByText(/HKO/)).toBeNull();
  });

  it('renders a guaranteed 1HKO as natural language, singular', () => {
    const result: DamageCalculationResult = {
      ...BASE_RESULT,
      ko: { chance: 1, hitsToKo: 1 },
    };
    render(
      <DamageResult result={result} locale="es" labels={LABELS_ES} typeLabels={TYPE_LABELS} />,
    );
    expect(screen.getByText('KO garantizado en 1 golpe')).not.toBeNull();
  });

  it('renders a chance-based KO as natural language', () => {
    const result: DamageCalculationResult = {
      ...BASE_RESULT,
      ko: { chance: 0.375, hitsToKo: 1 },
    };
    render(
      <DamageResult result={result} locale="es" labels={LABELS_ES} typeLabels={TYPE_LABELS} />,
    );
    expect(screen.getByText(/37,5% de probabilidad de KO en 1 golpe/)).not.toBeNull();
  });

  it('renders a possible (unresolved-chance) KO as natural language, plural', () => {
    const result: DamageCalculationResult = {
      ...BASE_RESULT,
      ko: { chance: undefined, hitsToKo: 3 },
    };
    render(
      <DamageResult result={result} locale="es" labels={LABELS_ES} typeLabels={TYPE_LABELS} />,
    );
    expect(screen.getByText('Posible KO en 3 golpes')).not.toBeNull();
  });

  it('keeps established competitive shorthand in English', () => {
    render(
      <DamageResult result={BASE_RESULT} locale="en" labels={LABELS_EN} typeLabels={TYPE_LABELS} />,
    );
    expect(screen.getByText('Guaranteed 2HKO')).not.toBeNull();
  });
});

describe('DamageResult — "How this damage is calculated" disclosure (Phase 3 roadmap: explanation trace)', () => {
  it('is available for an ordinary result, in production, even with no optional modifier active (task §8/§14)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(
      <DamageResult result={BASE_RESULT} locale="en" labels={LABELS_EN} typeLabels={TYPE_LABELS} />,
    );
    expect(screen.getByText(/How this damage is calculated/)).not.toBeNull();
  });

  it('surfaces neutral effectiveness inside the explanation even though the headline neutral badge stays hidden (task §15)', () => {
    const result: DamageCalculationResult = {
      ...BASE_RESULT,
      effectiveness: 'neutral',
      isSTAB: false,
      explanation: [{ kind: 'type-effectiveness', multiplier: 1, tier: 'neutral' }],
    };
    render(
      <DamageResult result={result} locale="en" labels={LABELS_EN} typeLabels={TYPE_LABELS} />,
    );
    // The neutral badge above the disclosure stays hidden…
    expect(screen.queryByText('Effective')).toBeNull();
    // …but the explanation row is still there once opened.
    const button = screen.getByText(/How this damage is calculated/);
    fireEvent.click(button);
    expect(screen.getByText('Type effectiveness')).not.toBeNull();
    expect(screen.getByText('×1 · Effective')).not.toBeNull();
  });

  it('localizes factor labels ES/EN (task §16)', () => {
    const result: DamageCalculationResult = {
      ...BASE_RESULT,
      explanation: [
        { kind: 'type-effectiveness', multiplier: 2, tier: 'super-effective' },
        { kind: 'stab' },
      ],
    };
    render(
      <DamageResult result={result} locale="es" labels={LABELS_ES} typeLabels={TYPE_LABELS} />,
    );
    const button = screen.getByText(/Cómo se calcula/);
    fireEvent.click(button);
    expect(screen.getByText('Eficacia de tipo')).not.toBeNull();
    expect(screen.getByText('El atacante comparte el tipo del movimiento')).not.toBeNull();
  });

  it('resolves an attacker item to its PokeStudio-localized display name, not the raw slug (task §17)', () => {
    const result: DamageCalculationResult = {
      ...BASE_RESULT,
      explanation: [{ kind: 'attacker-item', slug: 'choice-band' }],
    };
    render(
      <DamageResult
        result={result}
        locale="en"
        labels={LABELS_EN}
        typeLabels={TYPE_LABELS}
        items={[{ slug: 'choice-band', nameEn: 'Choice Band', category: 'choice' }]}
      />,
    );
    const button = screen.getByText(/How this damage is calculated/);
    fireEvent.click(button);
    expect(screen.getByText('Choice Band')).not.toBeNull();
  });

  it('falls back to a readable slug rendering when the item list has not loaded yet — never a raw upstream English name', () => {
    const result: DamageCalculationResult = {
      ...BASE_RESULT,
      explanation: [{ kind: 'attacker-item', slug: 'choice-band' }],
    };
    render(
      <DamageResult result={result} locale="en" labels={LABELS_EN} typeLabels={TYPE_LABELS} />,
    );
    const button = screen.getByText(/How this damage is calculated/);
    fireEvent.click(button);
    expect(screen.getByText('Choice Band')).not.toBeNull();
  });

  it('never shows the debug trace in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(
      <DamageResult result={BASE_RESULT} locale="en" labels={LABELS_EN} typeLabels={TYPE_LABELS} />,
    );
    const button = screen.getByText(/How this damage is calculated/);
    fireEvent.click(button);
    expect(screen.queryByText(/Upstream calculation trace/)).toBeNull();
  });

  it('keeps the development-only debug trace available, clearly separated from the structured explanation', () => {
    vi.stubEnv('NODE_ENV', 'development');
    render(
      <DamageResult result={BASE_RESULT} locale="en" labels={LABELS_EN} typeLabels={TYPE_LABELS} />,
    );
    const button = screen.getByText(/How this damage is calculated/);
    fireEvent.click(button);
    expect(screen.getByText(/Upstream calculation trace \(debug\)/)).not.toBeNull();
  });

  it('exposes real multi-hit content in the explanation', () => {
    const result: DamageCalculationResult = {
      ...BASE_RESULT,
      distribution: { kind: 'multi-hit', rollSets: [[10, 12]] },
      modifiers: { ...BASE_RESULT.modifiers, hits: 3 },
      explanation: [
        { kind: 'type-effectiveness', multiplier: 2, tier: 'super-effective' },
        { kind: 'multi-hit', hits: 3 },
      ],
    };
    render(
      <DamageResult result={result} locale="en" labels={LABELS_EN} typeLabels={TYPE_LABELS} />,
    );
    const button = screen.getByText(/How this damage is calculated/);
    fireEvent.click(button);
    expect(screen.getByText('3 hits')).not.toBeNull();
  });

  it('the disclosure trigger is a native, accessible button with correct aria-expanded state (task §20)', () => {
    render(
      <DamageResult result={BASE_RESULT} locale="en" labels={LABELS_EN} typeLabels={TYPE_LABELS} />,
    );
    const button = screen.getByRole('button', { name: /How this damage is calculated/ });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });
});
