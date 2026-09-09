import { describe, expect, it } from 'vitest';

import { assertValidSlug, classifyForm, detectRegionLabel, pickPrimaryForm } from './classify';

describe('assertValidSlug', () => {
  it('accepts lowercase kebab-case slugs', () => {
    expect(() => assertValidSlug('rotom-heat', 'test')).not.toThrow();
    expect(() => assertValidSlug('unown-a', 'test')).not.toThrow();
  });

  it('rejects anything else', () => {
    expect(() => assertValidSlug('Rotom Heat', 'test')).toThrow(/Invalid slug/);
    expect(() => assertValidSlug('rotom_heat', 'test')).toThrow(/Invalid slug/);
    expect(() => assertValidSlug('', 'test')).toThrow(/Invalid slug/);
  });
});

describe('detectRegionLabel', () => {
  it('detects known region suffixes', () => {
    expect(detectRegionLabel('meowth-alola')).toBe('Alola');
    expect(detectRegionLabel('meowth-galar')).toBe('Galar');
    expect(detectRegionLabel('wooper-paldea')).toBe('Paldea');
    expect(detectRegionLabel('growlithe-hisui')).toBe('Hisui');
  });

  it('returns undefined for non-regional names', () => {
    expect(detectRegionLabel('rotom-heat')).toBeUndefined();
    expect(detectRegionLabel('charizard-mega-x')).toBeUndefined();
    expect(detectRegionLabel('bulbasaur')).toBeUndefined();
  });
});

describe('pickPrimaryForm', () => {
  it('picks the form whose name matches the pokemon exactly', () => {
    const forms = [{ name: 'bulbasaur', is_default: true }];
    expect(pickPrimaryForm(forms, 'bulbasaur')).toBe(forms[0]);
  });

  it('falls back to API order when no name matches and every form claims is_default (Vivillon shape)', () => {
    const forms = [
      { name: 'vivillon-meadow', is_default: true },
      { name: 'vivillon-polar', is_default: true },
    ];
    expect(pickPrimaryForm(forms, 'vivillon')).toBe(forms[0]);
  });

  it('falls back to the single is_default form when no name matches but exactly one is flagged (Xerneas shape)', () => {
    // Neither form is named plain "xerneas" — Active/Neutral Forme are both
    // decorated names. Only "neutral" carries is_default: true upstream.
    const forms = [
      { name: 'xerneas-active', is_default: false },
      { name: 'xerneas-neutral', is_default: true },
    ];
    expect(pickPrimaryForm(forms, 'xerneas')).toBe(forms[1]);
  });

  it('throws for an empty forms array', () => {
    expect(() => pickPrimaryForm([], 'whatever')).toThrow(/no forms/);
  });
});

describe('classifyForm', () => {
  it('classifies the primary form of the default variety as default', () => {
    expect(
      classifyForm({
        isDefaultVariety: true,
        isPrimaryForm: true,
        isMega: false,
        isBattleOnly: false,
        regionLabel: undefined,
        mechanicallyDifferentFromDefault: false,
      }),
    ).toBe('default');
  });

  it('classifies mega/battle-only forms as battle regardless of other signals', () => {
    expect(
      classifyForm({
        isDefaultVariety: false,
        isPrimaryForm: true,
        isMega: true,
        isBattleOnly: false,
        regionLabel: undefined,
        mechanicallyDifferentFromDefault: true,
      }),
    ).toBe('battle');
    expect(
      classifyForm({
        isDefaultVariety: false,
        isPrimaryForm: true,
        isMega: false,
        isBattleOnly: true,
        regionLabel: 'Alola', // battle-only takes priority even if (hypothetically) region-suffixed
        mechanicallyDifferentFromDefault: true,
      }),
    ).toBe('battle');
  });

  it('classifies a region-suffixed variety as regional', () => {
    expect(
      classifyForm({
        isDefaultVariety: false,
        isPrimaryForm: true,
        isMega: false,
        isBattleOnly: false,
        regionLabel: 'Galar',
        mechanicallyDifferentFromDefault: true,
      }),
    ).toBe('regional');
  });

  it('classifies a mechanically different, unflagged, non-regional variety as battle (Rotom appliance formes)', () => {
    // Rotom-Heat: not is_mega/is_battle_only, not region-suffixed, but its
    // types differ from base Rotom — PokéAPI gives no other signal for this.
    expect(
      classifyForm({
        isDefaultVariety: false,
        isPrimaryForm: true,
        isMega: false,
        isBattleOnly: false,
        regionLabel: undefined,
        mechanicallyDifferentFromDefault: true,
      }),
    ).toBe('battle');
  });

  it('falls back to cosmetic only when nothing differs mechanically (cosmetic sub-forms)', () => {
    expect(
      classifyForm({
        isDefaultVariety: true,
        isPrimaryForm: false, // a non-canonical Vivillon pattern of the default variety
        isMega: false,
        isBattleOnly: false,
        regionLabel: undefined,
        mechanicallyDifferentFromDefault: false, // cosmetic sub-forms share their variety's types/stats
      }),
    ).toBe('cosmetic');
  });
});
