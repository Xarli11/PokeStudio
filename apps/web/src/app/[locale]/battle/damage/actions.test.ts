import { describe, expect, it, vi } from 'vitest';

import type * as PokestudioDatabase from '@pokestudio/database';
import type { ComparablePokemonForm, Item, MoveSummary, Nature } from '@pokestudio/database';

const getFormsBySlugs =
  vi.fn<(client: unknown, slugs: string[]) => Promise<ComparablePokemonForm[]>>();
const getFormLearnsetForVersionGroup =
  vi.fn<(client: unknown, formSlug: string, versionGroupSlug: string) => Promise<MoveSummary[]>>();
const listNatures = vi.fn<(client: unknown) => Promise<Nature[]>>();
const listItems = vi.fn<(client: unknown) => Promise<Item[]>>();

vi.mock('@pokestudio/database', async (importOriginal) => {
  const actual = await importOriginal<typeof PokestudioDatabase>();
  return {
    ...actual,
    getFormsBySlugs: (client: unknown, slugs: string[]) => getFormsBySlugs(client, slugs),
    getFormLearnsetForVersionGroup: (client: unknown, formSlug: string, versionGroupSlug: string) =>
      getFormLearnsetForVersionGroup(client, formSlug, versionGroupSlug),
    listNatures: (client: unknown) => listNatures(client),
    listItems: (client: unknown) => listItems(client),
  };
});

vi.mock('@/lib/pokemon-database', () => ({
  getPokemonDatabaseClient: () => ({}),
}));

const {
  fetchAttackerReferenceData,
  fetchDefenderReferenceData,
  fetchAdvancedReferenceData,
  calculateDamageAction,
} = await import('./actions');

const GARCHOMP_FORM: ComparablePokemonForm = {
  formSlug: 'garchomp',
  speciesSlug: 'garchomp',
  nationalDexNumber: 445,
  speciesName: { en: 'Garchomp', es: 'Garchomp' },
  formName: { en: 'Garchomp', es: 'Garchomp' },
  isDefaultForm: true,
  types: ['dragon', 'ground'],
  baseStats: {
    hp: 108,
    attack: 130,
    defense: 95,
    specialAttack: 80,
    specialDefense: 85,
    speed: 102,
  },
  abilities: [{ slug: 'rough-skin', nameEn: 'Rough Skin', isHidden: false, slot: 1 }],
};

const FERROTHORN_FORM: ComparablePokemonForm = {
  formSlug: 'ferrothorn',
  speciesSlug: 'ferrothorn',
  nationalDexNumber: 598,
  speciesName: { en: 'Ferrothorn', es: 'Ferrothorn' },
  formName: { en: 'Ferrothorn', es: 'Ferrothorn' },
  isDefaultForm: true,
  types: ['grass', 'steel'],
  baseStats: {
    hp: 74,
    attack: 94,
    defense: 131,
    specialAttack: 54,
    specialDefense: 116,
    speed: 20,
  },
  abilities: [{ slug: 'iron-barbs', nameEn: 'Iron Barbs', isHidden: false, slot: 1 }],
};

describe('fetchAttackerReferenceData', () => {
  it("filters out status moves — Simple Mode's move picker never offers non-damaging moves (task §11)", async () => {
    getFormsBySlugs.mockResolvedValue([GARCHOMP_FORM]);
    getFormLearnsetForVersionGroup.mockResolvedValue([
      {
        slug: 'earthquake',
        nameEn: 'Earthquake',
        type: 'ground',
        damageClass: 'physical',
        power: 100,
        accuracy: 100,
        pp: 10,
        priority: 0,
      },
      {
        slug: 'swords-dance',
        nameEn: 'Swords Dance',
        type: 'normal',
        damageClass: 'status',
        pp: 20,
        priority: 0,
      },
      {
        slug: 'dragon-rage',
        nameEn: 'Dragon Rage',
        type: 'dragon',
        damageClass: 'special',
        accuracy: 100,
        pp: 10,
        priority: 0,
      },
    ]);

    const data = await fetchAttackerReferenceData('garchomp', 'scarlet-violet');

    expect(data.form).toEqual(GARCHOMP_FORM);
    const slugs = data.moves.map((move) => move.slug);
    expect(slugs).toContain('earthquake');
    // Dragon Rage is a real fixed-damage move with no `power` field at all —
    // must still survive the filter (task §11: never filter on `power`).
    expect(slugs).toContain('dragon-rage');
    expect(slugs).not.toContain('swords-dance');
  });
});

describe('fetchDefenderReferenceData', () => {
  it('never fetches a learnset for the defender (task §10)', async () => {
    getFormsBySlugs.mockResolvedValue([FERROTHORN_FORM]);
    getFormLearnsetForVersionGroup.mockClear();

    const form = await fetchDefenderReferenceData('ferrothorn');

    expect(form).toEqual(FERROTHORN_FORM);
    expect(getFormLearnsetForVersionGroup).not.toHaveBeenCalled();
  });
});

describe('fetchAdvancedReferenceData', () => {
  it('fetches natures and items only — never the species search index (task §16)', async () => {
    const jolly: Nature = {
      slug: 'jolly',
      nameEn: 'Jolly',
      increasedStat: 'speed',
      decreasedStat: 'special-attack',
    };
    const lifeOrb: Item = { slug: 'life-orb', nameEn: 'Life Orb', category: 'held' };
    listNatures.mockResolvedValue([jolly]);
    listItems.mockResolvedValue([lifeOrb]);

    const data = await fetchAdvancedReferenceData();

    expect(data).toEqual({ natures: [jolly], items: [lifeOrb] });
  });
});

const SIMPLE_MODE_STATS = {
  hp: 0,
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
};
const SIMPLE_MODE_IVS = {
  hp: 31,
  attack: 31,
  defense: 31,
  specialAttack: 31,
  specialDefense: 31,
  speed: 31,
};

function combatant(formSlug: string, speciesSlug: string) {
  return {
    formSlug,
    speciesSlug,
    level: 100,
    abilitySlug: null,
    itemSlug: null,
    natureSlug: null,
    evs: SIMPLE_MODE_STATS,
    ivs: SIMPLE_MODE_IVS,
    teraType: null,
  };
}

describe('calculateDamageAction', () => {
  it("builds Simple Mode's fixed-assumption input and returns the real calculateDamage result", async () => {
    const response = await calculateDamageAction({
      generation: 9,
      attacker: combatant('garchomp', 'garchomp'),
      defender: combatant('ferrothorn', 'ferrothorn'),
      moveSlug: 'earthquake',
      isCritical: false,
    });

    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error('unreachable');
    expect(response.result.minDamage).toBe(108);
    expect(response.result.maxDamage).toBe(127);
    expect(response.result.defenderMaxHp).toBe(289);
    expect(response.result.ko).toEqual({ chance: 1, hitsToKo: 3 });
  });

  it('maps an unknown form to a structured error with the correct side — never a raw exception', async () => {
    const response = await calculateDamageAction({
      generation: 9,
      attacker: combatant('not-a-real-pokemon-xyz', 'not-a-real-pokemon-xyz'),
      defender: combatant('ferrothorn', 'ferrothorn'),
      moveSlug: 'earthquake',
      isCritical: false,
    });

    expect(response).toEqual({ ok: false, code: 'unknown-form', side: 'attacker' });
    // No raw upstream/internal string anywhere in the response.
    expect(Object.keys(response)).toEqual(['ok', 'code', 'side']);
  });

  it('maps an unknown move to a structured error', async () => {
    const response = await calculateDamageAction({
      generation: 9,
      attacker: combatant('garchomp', 'garchomp'),
      defender: combatant('ferrothorn', 'ferrothorn'),
      moveSlug: 'not-a-real-move-xyz',
      isCritical: false,
    });

    expect(response).toEqual({ ok: false, code: 'unknown-move', side: undefined });
  });

  it('carries a full Advanced configuration through to the damage domain (task §17)', async () => {
    const response = await calculateDamageAction({
      generation: 9,
      attacker: {
        formSlug: 'garchomp',
        speciesSlug: 'garchomp',
        level: 50,
        abilitySlug: 'rough-skin',
        itemSlug: null,
        natureSlug: null,
        evs: { hp: 0, attack: 252, defense: 0, specialAttack: 0, specialDefense: 4, speed: 252 },
        ivs: SIMPLE_MODE_IVS,
        teraType: null,
      },
      defender: combatant('ferrothorn', 'ferrothorn'),
      moveSlug: 'earthquake',
      isCritical: true,
    });

    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error('unreachable');
    expect(response.result.modifiers.isCritical).toBe(true);
  });
});
