import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ComparablePokemonForm,
  MoveSummary,
  SpeciesSearchAlias,
  SpeciesSearchItem,
  VersionGroupSummary,
} from '@pokestudio/database';
import type { DamageCalculationResult } from '@pokestudio/damage';

import {
  calculateDamageAction,
  fetchAttackerReferenceData,
  fetchDefenderReferenceData,
} from '@/app/[locale]/battle/damage/actions';

import { DamageLab, type DamageLabLabels } from './damage-lab';

vi.mock('@/app/[locale]/battle/damage/actions', () => ({
  fetchAttackerReferenceData: vi.fn(),
  fetchDefenderReferenceData: vi.fn(),
  calculateDamageAction: vi.fn(),
}));

const mockFetchAttacker = vi.mocked(fetchAttackerReferenceData);
const mockFetchDefender = vi.mocked(fetchDefenderReferenceData);
const mockCalculate = vi.mocked(calculateDamageAction);

afterEach(cleanup);
beforeEach(() => {
  mockFetchAttacker.mockReset();
  mockFetchDefender.mockReset();
  mockCalculate.mockReset();
});

const STATS = { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 };

const SEARCH_INDEX: { items: SpeciesSearchItem[]; aliases: SpeciesSearchAlias[] } = {
  items: [
    {
      slug: 'garchomp',
      formSlug: 'garchomp',
      nationalDexNumber: 445,
      name: { en: 'Garchomp', es: 'Garchomp' },
      types: ['dragon', 'ground'],
      baseStats: STATS,
    },
    {
      slug: 'heatran',
      formSlug: 'heatran',
      nationalDexNumber: 485,
      name: { en: 'Heatran', es: 'Heatran' },
      types: ['fire', 'steel'],
      baseStats: STATS,
    },
  ],
  aliases: [],
};

const VERSION_GROUPS: VersionGroupSummary[] = [
  { slug: 'scarlet-violet', generation: 9, displayOrder: 2 },
  { slug: 'sword-shield', generation: 8, displayOrder: 1 },
];

const GARCHOMP_FORM: ComparablePokemonForm = {
  formSlug: 'garchomp',
  speciesSlug: 'garchomp',
  nationalDexNumber: 445,
  speciesName: { en: 'Garchomp', es: 'Garchomp' },
  formName: { en: 'Garchomp', es: 'Garchomp' },
  isDefaultForm: true,
  types: ['dragon', 'ground'],
  baseStats: STATS,
  abilities: [],
};

const HEATRAN_FORM: ComparablePokemonForm = {
  formSlug: 'heatran',
  speciesSlug: 'heatran',
  nationalDexNumber: 485,
  speciesName: { en: 'Heatran', es: 'Heatran' },
  formName: { en: 'Heatran', es: 'Heatran' },
  isDefaultForm: true,
  types: ['fire', 'steel'],
  baseStats: STATS,
  abilities: [],
};

const EARTHQUAKE: MoveSummary = {
  slug: 'earthquake',
  nameEn: 'Earthquake',
  type: 'ground',
  damageClass: 'physical',
  power: 100,
  accuracy: 100,
  pp: 10,
  priority: 0,
};

const DIG: MoveSummary = {
  slug: 'dig',
  nameEn: 'Dig',
  type: 'ground',
  damageClass: 'physical',
  power: 80,
  accuracy: 100,
  pp: 10,
  priority: 0,
};

const RESULT: DamageCalculationResult = {
  distribution: {
    kind: 'rolls',
    rolls: [184, 187, 190, 193, 196, 199, 202, 205, 208, 211, 214, 216, 219, 222, 225, 228],
  },
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

const LABELS: DamageLabLabels = {
  gameLabel: 'Game',
  generationOptionTemplate: 'Generation {number}',
  attackerLabel: 'Attacker',
  defenderLabel: 'Defender',
  moveLabel: 'Move',
  noMoveSelected: 'No move selected',
  selectMoveLabel: 'Select move',
  changeMoveTemplate: 'Change {name}',
  noLegalMoves: 'No damaging moves are learnable in this game.',
  calculateLabel: 'Calculate',
  calculatingLabel: 'Calculating…',
  assumptionsTemplate:
    'Lv. {level} · {evs} EVs · {ivs} IVs · Neutral nature · No ability · No item',
  resultHeading: 'Result',
  pokemonSlot: {
    selectPokemonLabel: 'Select Pokémon',
    changeLabel: 'Change',
    changePokemonTemplate: 'Change {name}',
    cancelLabel: 'Cancel',
    multipleFormsMatchTemplate: '{count} forms match',
    ambiguousHint: 'Type more of the name to pick one form.',
    noResultsLabel: 'No Pokémon match your search.',
  },
  movePicker: {
    searchLabel: 'Search moves',
    noResultsLabel: 'No moves match your search.',
    typeFilterLabel: 'Type',
    allTypesLabel: 'All types',
    damageClassFilterLabel: 'Damage class',
    allDamageClassesLabel: 'All damage classes',
    damageClassLabels: { physical: 'Physical', special: 'Special', status: 'Status' },
    noPowerLabel: '—',
    alreadySelectedLabel: 'Already selected',
    cancelLabel: 'Cancel',
  },
  result: {
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
  },
  errors: {
    'unknown-form': "That Pokémon isn't available for this calculation.",
    'unsupported-form': "This form isn't supported for damage calculations yet.",
    'unknown-move': "That move isn't available for this calculation.",
    'unknown-ability': "That ability isn't available for this calculation.",
    'unknown-item': "That item isn't available for this calculation.",
    'unknown-nature': "That nature isn't available for this calculation.",
    naturesNotAvailableInGeneration: "This game doesn't have natures.",
    'level-out-of-range': 'Level must be between 1 and 100.',
    'ev-out-of-range': 'EVs must be between 0 and 252.',
    'iv-out-of-range': 'IVs must be between 0 and 31.',
    'generation-out-of-range': "This game isn't supported.",
    unknown: 'Something went wrong calculating this. Try again.',
  },
};

const TYPE_LABELS: Record<string, string> = {
  dragon: 'Dragon',
  ground: 'Ground',
  fire: 'Fire',
  steel: 'Steel',
};

function renderDamageLab() {
  return render(
    <DamageLab
      locale="en"
      searchIndex={SEARCH_INDEX}
      versionGroups={VERSION_GROUPS}
      defaultVersionGroupSlug="scarlet-violet"
      typeLabels={TYPE_LABELS as never}
      labels={LABELS}
    />,
  );
}

async function selectAttacker(name: RegExp = /Garchomp/) {
  const inputs = await screen.findAllByRole('combobox', { name: 'Select Pokémon' });
  const attackerInput = inputs[0]!;
  fireEvent.change(attackerInput, { target: { value: 'garchomp' } });
  fireEvent.click(await screen.findByRole('option', { name }));
}

async function selectDefender(name: RegExp = /Heatran/) {
  const inputs = await screen.findAllByRole('combobox', { name: 'Select Pokémon' });
  const defenderInput = inputs[inputs.length - 1]!;
  fireEvent.change(defenderInput, { target: { value: 'heatran' } });
  fireEvent.click(await screen.findByRole('option', { name }));
}

/**
 * Clicking "Calculate" the instant it appears in the DOM races the async
 * attacker/defender reference-data fetches: the button exists (and is
 * findable) well before `canCalculate` flips true, so an un-awaited click
 * lands on a still-disabled native button and silently does nothing. Wait
 * for it to actually enable first.
 */
async function clickCalculate() {
  await waitFor(() =>
    expect((screen.getByRole('button', { name: 'Calculate' }) as HTMLButtonElement).disabled).toBe(
      false,
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Calculate' }));
}

describe('DamageLab', () => {
  it('Calculate is disabled until game + attacker + move + defender are all resolved', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    mockFetchDefender.mockResolvedValue(HEATRAN_FORM);
    renderDamageLab();

    expect((screen.getByRole('button', { name: 'Calculate' }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    await selectAttacker();
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Calculate' }) as HTMLButtonElement).disabled,
      ).toBe(true),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Select move' }));
    fireEvent.click(await screen.findByRole('option', { name: /Earthquake/ }));
    expect((screen.getByRole('button', { name: 'Calculate' }) as HTMLButtonElement).disabled).toBe(
      true,
    ); // no defender yet

    await selectDefender();
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Calculate' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
  });

  it('attacker selection shows its real identity (name/types/sprite), never a raw slug', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab();
    await selectAttacker();

    expect(await screen.findByText('Garchomp')).not.toBeNull();
    expect(screen.getByText('Dragon')).not.toBeNull();
    expect(screen.getByText('Ground')).not.toBeNull();
    expect(screen.queryByText('garchomp')).toBeNull();
    const sprite = document.querySelector('img[alt=""]');
    expect(sprite).not.toBeNull(); // decorative alt="" — task §25/§21
  });

  it('defender selection resolves independently, without ever fetching a learnset for it', async () => {
    mockFetchDefender.mockResolvedValue(HEATRAN_FORM);
    renderDamageLab();
    await selectDefender();

    expect(await screen.findByText('Heatran')).not.toBeNull();
    expect(mockFetchAttacker).not.toHaveBeenCalled();
  });

  it('only the attacker’s legal moves for the selected game are offered', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE, DIG] });
    renderDamageLab();
    await selectAttacker();

    fireEvent.click(await screen.findByRole('button', { name: 'Select move' }));
    expect(await screen.findByRole('option', { name: /Earthquake/ })).not.toBeNull();
    expect(screen.getByRole('option', { name: /Dig/ })).not.toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /Earthquake/ }));
    expect(await screen.findByRole('button', { name: 'Change Earthquake' })).not.toBeNull();
  });

  it('no legal (damage) moves shows an honest empty state, not a broken picker', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [] });
    renderDamageLab();
    await selectAttacker();

    expect(await screen.findByText('No damaging moves are learnable in this game.')).not.toBeNull();
  });

  it('changing the game re-resolves the attacker’s moves and clears a move that’s no longer legal, without clearing the Pokémon selections', async () => {
    mockFetchAttacker.mockImplementation(
      async (_formSlug, versionGroupSlug) =>
        versionGroupSlug === 'scarlet-violet'
          ? { form: GARCHOMP_FORM, moves: [EARTHQUAKE] }
          : { form: GARCHOMP_FORM, moves: [DIG] }, // Earthquake not legal in this fixture's other game
    );
    mockFetchDefender.mockResolvedValue(HEATRAN_FORM);
    renderDamageLab();
    await selectAttacker();
    await selectDefender();

    fireEvent.click(await screen.findByRole('button', { name: 'Select move' }));
    fireEvent.click(await screen.findByRole('option', { name: /Earthquake/ }));
    expect(await screen.findByRole('button', { name: 'Change Earthquake' })).not.toBeNull();

    fireEvent.change(screen.getByRole('combobox', { name: 'Game' }), {
      target: { value: 'sword-shield' },
    });

    // The move is cleared (no longer legal) — the Pokémon stays selected, so
    // the slot falls back to its "pick a move" button, not the pre-Pokémon
    // "No move selected" placeholder (that only shows before any attacker is
    // chosen at all).
    await waitFor(() => expect(screen.getByRole('button', { name: 'Select move' })).not.toBeNull());
    // ...but the Pokémon selections are untouched.
    expect(screen.getByText('Garchomp')).not.toBeNull();
    expect(screen.getByText('Heatran')).not.toBeNull();
  });

  it('shows the fixed Simple Mode assumptions line', () => {
    renderDamageLab();
    expect(
      screen.getByText('Lv. 100 · 0 EVs · 31 IVs · Neutral nature · No ability · No item'),
    ).not.toBeNull();
  });

  it('shows a pending state while calculating, without a native alert, and disables the button', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    mockFetchDefender.mockResolvedValue(HEATRAN_FORM);
    let resolveCalc!: (value: Awaited<ReturnType<typeof calculateDamageAction>>) => void;
    mockCalculate.mockReturnValue(
      new Promise((resolve) => {
        resolveCalc = resolve;
      }),
    );
    renderDamageLab();
    await selectAttacker();
    fireEvent.click(await screen.findByRole('button', { name: 'Select move' }));
    fireEvent.click(await screen.findByRole('option', { name: /Earthquake/ }));
    await selectDefender();

    await clickCalculate();
    expect(
      ((await screen.findByRole('button', { name: 'Calculating…' })) as HTMLButtonElement).disabled,
    ).toBe(true);

    resolveCalc({ ok: true, result: RESULT });
    expect(
      ((await screen.findByRole('button', { name: 'Calculate' })) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('a successful calculation renders the HP range and percent from the structured result, not a parsed string', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    mockFetchDefender.mockResolvedValue(HEATRAN_FORM);
    mockCalculate.mockResolvedValue({ ok: true, result: RESULT });
    renderDamageLab();
    await selectAttacker();
    fireEvent.click(await screen.findByRole('button', { name: 'Select move' }));
    fireEvent.click(await screen.findByRole('option', { name: /Earthquake/ }));
    await selectDefender();
    await clickCalculate();

    expect(await screen.findByText('184–228 HP')).not.toBeNull();
    expect(screen.getByText('78.3–97%')).not.toBeNull();
    expect(screen.getByText('Guaranteed 2HKO')).not.toBeNull();
    expect(screen.getByText('Super effective')).not.toBeNull();
    expect(screen.getByText('STAB')).not.toBeNull();
  });

  it('a partial KO chance renders the percentage copy', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    mockFetchDefender.mockResolvedValue(HEATRAN_FORM);
    mockCalculate.mockResolvedValue({
      ok: true,
      result: { ...RESULT, ko: { chance: 0.375, hitsToKo: 1 } },
    });
    renderDamageLab();
    await selectAttacker();
    fireEvent.click(await screen.findByRole('button', { name: 'Select move' }));
    fireEvent.click(await screen.findByRole('option', { name: /Earthquake/ }));
    await selectDefender();
    await clickCalculate();

    expect(await screen.findByText('37.5% chance to 1HKO')).not.toBeNull();
  });

  it('immunity renders a structured zero result — no fake KO copy, effectiveness labeled Immune', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    mockFetchDefender.mockResolvedValue(HEATRAN_FORM);
    mockCalculate.mockResolvedValue({
      ok: true,
      result: {
        ...RESULT,
        distribution: { kind: 'fixed', damage: 0 },
        minDamage: 0,
        maxDamage: 0,
        minPercent: 0,
        maxPercent: 0,
        ko: { chance: undefined, hitsToKo: undefined },
        effectiveness: 'immune',
        isSTAB: false,
      },
    });
    renderDamageLab();
    await selectAttacker();
    fireEvent.click(await screen.findByRole('button', { name: 'Select move' }));
    fireEvent.click(await screen.findByRole('option', { name: /Earthquake/ }));
    await selectDefender();
    await clickCalculate();

    expect(await screen.findByText('0–0 HP')).not.toBeNull();
    expect(screen.getByText('Immune')).not.toBeNull();
    expect(screen.queryByText(/HKO/)).toBeNull();
  });

  it('a structured action error is shown localized — never the raw error code', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    mockFetchDefender.mockResolvedValue(HEATRAN_FORM);
    mockCalculate.mockResolvedValue({ ok: false, code: 'unknown-form', side: 'attacker' });
    renderDamageLab();
    await selectAttacker();
    fireEvent.click(await screen.findByRole('button', { name: 'Select move' }));
    fireEvent.click(await screen.findByRole('option', { name: /Earthquake/ }));
    await selectDefender();
    await clickCalculate();

    expect(
      await screen.findByText("That Pokémon isn't available for this calculation."),
    ).not.toBeNull();
    expect(screen.queryByText('unknown-form')).toBeNull();
    expect(screen.queryByText(/unknown/i)).toBeNull();
  });
});
