import { describe, expect, it } from 'vitest';

import type { SpeciesFormDetail } from '@pokestudio/database';

import { partitionOtherForms } from './form-grouping';

function makeForm(overrides: Partial<SpeciesFormDetail> = {}): SpeciesFormDetail {
  return {
    slug: 'alcremie',
    name: { en: 'Alcremie', es: 'Alcremie' },
    isDefault: true,
    category: 'default',
    types: ['fairy'],
    baseStats: {
      hp: 65,
      attack: 60,
      defense: 75,
      specialAttack: 110,
      specialDefense: 121,
      speed: 64,
    },
    abilities: [],
    ...overrides,
  };
}

describe('partitionOtherForms', () => {
  it('treats a mechanically-identical cosmetic form as a variant (Alcremie flavors)', () => {
    const defaultForm = makeForm();
    const cosmeticForm = makeForm({ slug: 'alcremie-ruby-cream', category: 'cosmetic' });

    const result = partitionOtherForms(defaultForm, [cosmeticForm]);
    expect(result.cosmeticVariants).toEqual([cosmeticForm]);
    expect(result.distinctForms).toEqual([]);
  });

  it('treats a mechanically-different form as distinct even if categorized cosmetic (defensive)', () => {
    const defaultForm = makeForm();
    const oddForm = makeForm({
      slug: 'alcremie-different-stats',
      category: 'cosmetic',
      baseStats: { ...defaultForm.baseStats, speed: 999 },
    });

    const result = partitionOtherForms(defaultForm, [oddForm]);
    expect(result.distinctForms).toEqual([oddForm]);
    expect(result.cosmeticVariants).toEqual([]);
  });

  it('treats a regional form as distinct (different types)', () => {
    const defaultForm = makeForm({ slug: 'meowth', types: ['normal'] });
    const regional = makeForm({ slug: 'meowth-alola', category: 'regional', types: ['dark'] });

    const result = partitionOtherForms(defaultForm, [regional]);
    expect(result.distinctForms).toEqual([regional]);
    expect(result.cosmeticVariants).toEqual([]);
  });

  it('treats a battle form as distinct (different base stats, same types)', () => {
    const defaultForm = makeForm({ slug: 'rotom', types: ['electric', 'ghost'] });
    const heat = makeForm({
      slug: 'rotom-heat',
      category: 'battle',
      types: ['electric', 'fire'],
      baseStats: { ...defaultForm.baseStats, specialAttack: 105 },
    });

    const result = partitionOtherForms(defaultForm, [heat]);
    expect(result.distinctForms).toEqual([heat]);
  });

  it('splits a large mixed family correctly (Alcremie-scale: many cosmetic variants, zero distinct)', () => {
    const defaultForm = makeForm();
    const variants = Array.from({ length: 63 }, (_, index) =>
      makeForm({ slug: `alcremie-variant-${index}`, category: 'cosmetic' }),
    );

    const result = partitionOtherForms(defaultForm, variants);
    expect(result.cosmeticVariants).toHaveLength(63);
    expect(result.distinctForms).toHaveLength(0);
  });
});
