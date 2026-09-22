import { describe, expect, it } from 'vitest';

import type { ComparablePokemonForm, Item, Nature } from '@pokestudio/database';

import type { BuildGameCapabilities } from '@/lib/build-game-capabilities';

import {
  clampAdvancedConfig,
  createDefaultAdvancedConfig,
  effectiveTeraType,
  isAdvancedConfigValid,
  isDefaultAdvancedConfig,
  revalidateAdvancedConfigForCapabilities,
  revalidateAdvancedConfigForForm,
  summarizeAdvancedConfig,
  type DamageAdvancedConfig,
} from './damage-advanced';

const STATS = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
const MAX_IVS = {
  hp: 31,
  attack: 31,
  defense: 31,
  specialAttack: 31,
  specialDefense: 31,
  speed: 31,
};

const MODERN_CAPABILITIES: BuildGameCapabilities = {
  versionGroupSlug: 'scarlet-violet',
  generation: 9,
  abilities: true,
  natures: true,
  heldItems: true,
  modernEvsIvs: true,
  tera: true,
  dynamax: false,
  megaEvolution: false,
  zMoves: false,
  specialRuleset: null,
  statModel: 'modern',
  fullyValidated: true,
  teamAnalysisSupported: true,
};

const GEN1_CAPABILITIES: BuildGameCapabilities = {
  versionGroupSlug: 'red-blue',
  generation: 1,
  abilities: false,
  natures: false,
  heldItems: false,
  modernEvsIvs: false,
  tera: false,
  dynamax: false,
  megaEvolution: false,
  zMoves: false,
  specialRuleset: null,
  statModel: 'legacy-gen1',
  fullyValidated: false,
  teamAnalysisSupported: false,
};

const GARCHOMP_FORM: ComparablePokemonForm = {
  formSlug: 'garchomp',
  speciesSlug: 'garchomp',
  nationalDexNumber: 445,
  speciesName: { en: 'Garchomp', es: 'Garchomp' },
  formName: { en: 'Garchomp', es: 'Garchomp' },
  isDefaultForm: true,
  types: ['dragon', 'ground'],
  baseStats: STATS,
  abilities: [
    { slug: 'sand-veil', nameEn: 'Sand Veil', isHidden: false, slot: 1 },
    { slug: 'rough-skin', nameEn: 'Rough Skin', isHidden: false, slot: 2 },
  ],
};

describe('createDefaultAdvancedConfig', () => {
  it("matches Simple Mode's own fixed assumptions (task §1/§7)", () => {
    const config = createDefaultAdvancedConfig();
    expect(config.level).toBe(100);
    expect(config.evs).toEqual(STATS);
    expect(config.ivs).toEqual(MAX_IVS);
    expect(config.abilitySlug).toBeNull();
    expect(config.itemSlug).toBeNull();
    expect(config.natureSlug).toBeNull();
    expect(config.teraEnabled).toBe(false);
    expect(config.teraType).toBeNull();
    expect(isDefaultAdvancedConfig(config)).toBe(true);
  });
});

describe('effectiveTeraType', () => {
  it('is null whenever Terastallize is off, even with a type picked (task §11)', () => {
    const config: DamageAdvancedConfig = {
      ...createDefaultAdvancedConfig(),
      teraEnabled: false,
      teraType: 'ground',
    };
    expect(effectiveTeraType(config)).toBeNull();
  });

  it('is the picked type once Terastallize is on', () => {
    const config: DamageAdvancedConfig = {
      ...createDefaultAdvancedConfig(),
      teraEnabled: true,
      teraType: 'ground',
    };
    expect(effectiveTeraType(config)).toBe('ground');
  });
});

describe('clampAdvancedConfig', () => {
  it('clamps level/EVs/IVs to their real ranges (task §18)', () => {
    const config: DamageAdvancedConfig = {
      ...createDefaultAdvancedConfig(),
      level: 999,
      evs: { ...STATS, attack: 999 },
      ivs: { ...MAX_IVS, attack: -5 },
    };
    const clamped = clampAdvancedConfig(config);
    expect(clamped.level).toBe(100);
    expect(clamped.evs.attack).toBe(252);
    expect(clamped.ivs.attack).toBe(0);
  });
});

describe('revalidateAdvancedConfigForCapabilities', () => {
  it('nulls out ability/nature/item/tera for a game without them, but preserves EVs/IVs (task §15)', () => {
    const config: DamageAdvancedConfig = {
      level: 50,
      abilitySlug: 'sand-veil',
      itemSlug: 'life-orb',
      natureSlug: 'jolly',
      evs: { ...STATS, attack: 200 },
      ivs: { ...MAX_IVS, attack: 0 },
      teraEnabled: true,
      teraType: 'ground',
    };
    const revalidated = revalidateAdvancedConfigForCapabilities(config, GEN1_CAPABILITIES);
    expect(revalidated.abilitySlug).toBeNull();
    expect(revalidated.natureSlug).toBeNull();
    expect(revalidated.itemSlug).toBeNull();
    expect(revalidated.teraEnabled).toBe(false);
    expect(revalidated.teraType).toBeNull();
    // EVs/IVs survive in memory (task: "no destruyas... si podemos preservarlos").
    expect(revalidated.evs.attack).toBe(200);
    expect(revalidated.ivs.attack).toBe(0);
    expect(revalidated.level).toBe(50);
  });

  it('is a no-op for a fully modern game', () => {
    const config: DamageAdvancedConfig = {
      ...createDefaultAdvancedConfig(),
      abilitySlug: 'sand-veil',
      teraEnabled: true,
      teraType: 'ground',
    };
    expect(revalidateAdvancedConfigForCapabilities(config, MODERN_CAPABILITIES)).toEqual(config);
  });
});

describe('revalidateAdvancedConfigForForm', () => {
  it("resets ability when it no longer belongs to the new form's list (task §14)", () => {
    const config: DamageAdvancedConfig = {
      ...createDefaultAdvancedConfig(),
      abilitySlug: 'flash-fire',
      evs: { ...STATS, speed: 252 },
      teraEnabled: true,
      teraType: 'ground',
    };
    const revalidated = revalidateAdvancedConfigForForm(config, GARCHOMP_FORM);
    expect(revalidated.abilitySlug).toBeNull();
    // Everything else — including Tera, deliberately unrelated to species identity — survives.
    expect(revalidated.evs.speed).toBe(252);
    expect(revalidated.teraEnabled).toBe(true);
    expect(revalidated.teraType).toBe('ground');
  });

  it('keeps a still-valid ability untouched', () => {
    const config: DamageAdvancedConfig = {
      ...createDefaultAdvancedConfig(),
      abilitySlug: 'sand-veil',
    };
    expect(revalidateAdvancedConfigForForm(config, GARCHOMP_FORM).abilitySlug).toBe('sand-veil');
  });

  it('is a no-op when no form is loaded yet', () => {
    const config: DamageAdvancedConfig = {
      ...createDefaultAdvancedConfig(),
      abilitySlug: 'sand-veil',
    };
    expect(revalidateAdvancedConfigForForm(config, null)).toBe(config);
  });
});

describe('isAdvancedConfigValid', () => {
  it('accepts the default config', () => {
    expect(
      isAdvancedConfigValid(createDefaultAdvancedConfig(), MODERN_CAPABILITIES, GARCHOMP_FORM),
    ).toBe(true);
  });

  it('rejects a total EV investment over 510 (task §9/§18)', () => {
    const config: DamageAdvancedConfig = {
      ...createDefaultAdvancedConfig(),
      evs: { hp: 252, attack: 252, defense: 252, specialAttack: 0, specialDefense: 0, speed: 0 },
    };
    expect(isAdvancedConfigValid(config, MODERN_CAPABILITIES, GARCHOMP_FORM)).toBe(false);
  });

  it('rejects an ability not on the selected form (task §7/§18)', () => {
    const config: DamageAdvancedConfig = {
      ...createDefaultAdvancedConfig(),
      abilitySlug: 'flash-fire',
    };
    expect(isAdvancedConfigValid(config, MODERN_CAPABILITIES, GARCHOMP_FORM)).toBe(false);
  });

  it("rejects a mechanic the current game's capabilities don't allow", () => {
    const config: DamageAdvancedConfig = { ...createDefaultAdvancedConfig(), natureSlug: 'jolly' };
    expect(isAdvancedConfigValid(config, GEN1_CAPABILITIES, null)).toBe(false);
  });

  it('rejects a level outside 1-100', () => {
    const config: DamageAdvancedConfig = { ...createDefaultAdvancedConfig(), level: 0 };
    expect(isAdvancedConfigValid(config, MODERN_CAPABILITIES, null)).toBe(false);
  });
});

describe('summarizeAdvancedConfig', () => {
  const base = {
    locale: 'en' as const,
    nature: undefined as Nature | undefined,
    abilityName: undefined as string | undefined,
    item: undefined as Item | undefined,
    statAbbr: {
      hp: 'HP',
      attack: 'Atk',
      defense: 'Def',
      specialAttack: 'SpA',
      specialDefense: 'SpD',
      speed: 'Spe',
    },
    teraSummaryTemplate: 'Tera {type}',
    typeLabels: { ground: 'Ground' } as Record<string, string>,
  };

  it('a default config summarizes to just the level — no wall of "no X" tokens (task §22)', () => {
    expect(
      summarizeAdvancedConfig({ ...base, config: createDefaultAdvancedConfig() } as never),
    ).toEqual(['Lv. 100']);
  });

  it('a customized config lists only the non-default fields, EVs/IVs abbreviated', () => {
    const config: DamageAdvancedConfig = {
      level: 50,
      abilitySlug: 'rough-skin',
      itemSlug: 'life-orb',
      natureSlug: 'jolly',
      evs: { hp: 0, attack: 252, defense: 0, specialAttack: 0, specialDefense: 4, speed: 252 },
      ivs: MAX_IVS,
      teraEnabled: true,
      teraType: 'ground',
    };
    const tokens = summarizeAdvancedConfig({
      ...base,
      config,
      nature: {
        slug: 'jolly',
        nameEn: 'Jolly',
        increasedStat: 'speed',
        decreasedStat: 'special-attack',
      },
      abilityName: 'Rough Skin',
      item: { slug: 'life-orb', nameEn: 'Life Orb', category: 'held' },
    } as never);

    expect(tokens).toEqual([
      'Lv. 50',
      '252 Atk / 4 SpD / 252 Spe',
      'Jolly',
      'Rough Skin',
      'Life Orb',
      'Tera Ground',
    ]);
  });
});
