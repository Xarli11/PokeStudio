import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ComparablePokemonForm,
  Item,
  MoveSummary,
  Nature,
  SpeciesSearchAlias,
  SpeciesSearchItem,
  VersionGroupSummary,
} from '@pokestudio/database';
import type { DamageCalculationResult } from '@pokestudio/damage';

import {
  calculateDamageAction,
  fetchAdvancedReferenceData,
  fetchAttackerReferenceData,
  fetchDefenderReferenceData,
  fetchFormSupportedVersionGroups,
} from '@/app/[locale]/battle/damage/actions';
import { LOCALE_CHANGE_EVENT } from '@/lib/locale-navigation';
import { loadTeamDraft } from '@/lib/team-storage';
import type { TeamDraft } from '@/lib/team-draft';

import { DamageLab, type DamageLabLabels } from './damage-lab';

vi.mock('@/app/[locale]/battle/damage/actions', () => ({
  fetchAttackerReferenceData: vi.fn(),
  fetchDefenderReferenceData: vi.fn(),
  fetchAdvancedReferenceData: vi.fn(),
  fetchFormSupportedVersionGroups: vi.fn(),
  calculateDamageAction: vi.fn(),
}));

vi.mock('@/lib/team-storage', () => ({ loadTeamDraft: vi.fn() }));

const mockFetchAttacker = vi.mocked(fetchAttackerReferenceData);
const mockFetchDefender = vi.mocked(fetchDefenderReferenceData);
const mockFetchAdvancedReferenceData = vi.mocked(fetchAdvancedReferenceData);
const mockFetchFormSupportedVersionGroups = vi.mocked(fetchFormSupportedVersionGroups);
const mockCalculate = vi.mocked(calculateDamageAction);
const mockLoadTeamDraft = vi.mocked(loadTeamDraft);

const JOLLY: Nature = {
  slug: 'jolly',
  nameEn: 'Jolly',
  increasedStat: 'speed',
  decreasedStat: 'special-attack',
};
const LIFE_ORB: Item = { slug: 'life-orb', nameEn: 'Life Orb', category: 'held-item' };

afterEach(cleanup);
beforeEach(() => {
  mockFetchAttacker.mockReset();
  mockFetchDefender.mockReset();
  mockFetchAdvancedReferenceData.mockReset();
  mockFetchAdvancedReferenceData.mockResolvedValue({ natures: [JOLLY], items: [LIFE_ORB] });
  mockFetchFormSupportedVersionGroups.mockReset();
  // Default: the seeded form is supported in every fixture version group,
  // so the ordinary case (a form that's fine in the default game) never
  // triggers a game switch — tests that specifically want the "unsupported
  // in the default game" fallback override this per-test.
  mockFetchFormSupportedVersionGroups.mockResolvedValue(VERSION_GROUPS);
  mockCalculate.mockReset();
  mockLoadTeamDraft.mockReset();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/en/battle/damage');
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
      pokeapiPokemonId: 445,
    },
    {
      slug: 'heatran',
      formSlug: 'heatran',
      nationalDexNumber: 485,
      name: { en: 'Heatran', es: 'Heatran' },
      types: ['fire', 'steel'],
      baseStats: STATS,
      pokeapiPokemonId: 485,
    },
    // Representative alternate-form fixture (same shape/values as
    // compare-view.test.tsx's MEOWTH/MEOWTH_ALOLA_ALIAS pair) — Explore →
    // Damage Lab must carry the *exact* form, never collapse an alternate
    // form's seed back to its base species.
    {
      slug: 'meowth',
      formSlug: 'meowth',
      nationalDexNumber: 52,
      name: { en: 'Meowth', es: 'Meowth' },
      types: ['normal'],
      baseStats: STATS,
      pokeapiPokemonId: 52,
    },
  ],
  aliases: [
    {
      name: { en: 'Alolan Meowth', es: 'Meowth de Alola' },
      speciesSlug: 'meowth',
      types: ['dark'],
      formSlug: 'meowth-alola',
      pokeapiPokemonId: 10102,
    },
  ],
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
  abilities: [
    { slug: 'sand-veil', nameEn: 'Sand Veil', isHidden: false, slot: 1 },
    { slug: 'rough-skin', nameEn: 'Rough Skin', isHidden: false, slot: 2 },
  ],
  pokeapiPokemonId: 445,
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
  abilities: [{ slug: 'flash-fire', nameEn: 'Flash Fire', isHidden: false, slot: 1 }],
  pokeapiPokemonId: 485,
};

const MEOWTH_ALOLA_FORM: ComparablePokemonForm = {
  formSlug: 'meowth-alola',
  speciesSlug: 'meowth',
  nationalDexNumber: 52,
  speciesName: { en: 'Meowth', es: 'Meowth' },
  formName: { en: 'Alolan Meowth', es: 'Meowth de Alola' },
  isDefaultForm: false,
  types: ['dark'],
  baseStats: STATS,
  abilities: [{ slug: 'pickpocket', nameEn: 'Pickpocket', isHidden: false, slot: 1 }],
  pokeapiPokemonId: 10102,
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
  inputsChangedLabel: 'Inputs changed',
  recalculateLabel: 'Recalculate',
  attackerReferenceError: "Couldn't load the attacker's data.",
  defenderReferenceError: "Couldn't load the defender's data.",
  retry: 'Retry',
  resultHeading: 'Result',
  importBanner: {
    importedFromBuildLabel: 'Imported from Team Builder',
    importedMemberTeamTemplate: '{member} · {team}',
    backToTeamLabel: 'Back to team',
    teamNotFoundWarning:
      "We couldn't find that saved team on this device. You can still use Damage Lab normally.",
    memberNotFoundWarning: "We couldn't find that Pokémon on the team.",
    gameNotAvailableWarning:
      "This team's game isn't available here yet — showing the default game instead.",
  },
  advancedPanel: {
    advancedLabel: 'Advanced',
    levelLabel: 'Level',
    natureLabel: 'Nature',
    natureNeutralOption: 'Neutral',
    natureModifierTemplate: '+{increased} / −{decreased}',
    abilityLabel: 'Ability',
    noAbilitySelected: 'Choose an ability',
    hiddenAbilityMarker: '(Hidden)',
    itemLabel: 'Held item',
    noItemSelected: 'No item',
    itemSearchLabel: 'Search items…',
    itemSearchNoResults: 'No items match your search.',
    cancelLabel: 'Cancel',
    evsLabel: 'EVs',
    evsRemainingTemplate: '{count} EVs remaining',
    evsMaxTemplate: '{total} / {max}',
    evsOverLimitTemplate: '{count} EVs over the limit',
    ivsLabel: 'IVs',
    legacyStatsUnavailableTemplate: "Stat calculation for {game} isn't implemented yet.",
    historicalMechanicsNoteTemplate: "PokeStudio hasn't fully validated {game}'s mechanics yet.",
    teraTypeLabel: 'Tera Type',
    noTeraType: 'None',
    terastallizeLabel: 'Terastallize',
    teraSummaryTemplate: 'Tera {type}',
    criticalLabel: 'Critical hit',
    loadingReferenceData: 'Loading…',
    referenceDataErrorLabel: "Couldn't load the advanced options.",
    retryLabel: 'Retry',
    statAbbr: {
      hp: 'HP',
      attack: 'Atk',
      defense: 'Def',
      specialAttack: 'SpA',
      specialDefense: 'SpD',
      speed: 'Spe',
    },
  },
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

const STAT_LABELS = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  specialAttack: 'Sp. Atk',
  specialDefense: 'Sp. Def',
  speed: 'Speed',
};

function renderDamageLab(
  versionGroups: VersionGroupSummary[] = VERSION_GROUPS,
  importParams?: { teamId: string; memberId: string },
  exploreAttackerFormSlug?: string | null,
) {
  return render(
    <DamageLab
      locale="en"
      searchIndex={SEARCH_INDEX}
      versionGroups={versionGroups}
      defaultVersionGroupSlug="scarlet-violet"
      typeLabels={TYPE_LABELS as never}
      statLabels={STAT_LABELS}
      teamId={importParams?.teamId ?? null}
      memberId={importParams?.memberId ?? null}
      exploreAttackerFormSlug={exploreAttackerFormSlug ?? null}
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

  it("shows each side's own compact summary, defaulting to just the level (task §22)", () => {
    renderDamageLab();
    // Both attacker and defender start at Simple Mode's defaults — the
    // summary omits every field that's still at its default (task: "no
    // quiero un párrafo enorme"), so each shows only "Lv. 100".
    expect(screen.getAllByText('Lv. 100')).toHaveLength(2);
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

async function selectAttackerMoveAndDefender() {
  await selectAttacker();
  fireEvent.click(await screen.findByRole('button', { name: 'Select move' }));
  fireEvent.click(await screen.findByRole('option', { name: /Earthquake/ }));
  await selectDefender();
}

const RED_BLUE: VersionGroupSummary = { slug: 'red-blue', generation: 1, displayOrder: 0 };

describe('DamageLab Advanced', () => {
  it('is collapsed by default and opens independently per side (task §2/§29)', async () => {
    renderDamageLab();
    expect(screen.queryByRole('spinbutton', { name: 'Level' })).toBeNull();
    const advancedButtons = screen.getAllByRole('button', { name: /Advanced/ });
    expect(advancedButtons).toHaveLength(2);

    fireEvent.click(advancedButtons[0]!);
    expect(await screen.findByRole('spinbutton', { name: 'Level' })).not.toBeNull();
    expect(screen.getAllByRole('spinbutton', { name: 'Level' })).toHaveLength(1);

    fireEvent.click(advancedButtons[1]!);
    await waitFor(() =>
      expect(screen.getAllByRole('spinbutton', { name: 'Level' })).toHaveLength(2),
    );
  });

  it('Level is editable, clamps to 1-100, and only affects that combatant (task §5/§29)', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    mockFetchDefender.mockResolvedValue(HEATRAN_FORM);
    mockCalculate.mockResolvedValue({ ok: true, result: RESULT });
    renderDamageLab();
    await selectAttackerMoveAndDefender();

    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    const levelInput = await screen.findByRole('spinbutton', { name: 'Level' });
    fireEvent.change(levelInput, { target: { value: '999' } });
    expect((levelInput as HTMLInputElement).value).toBe('100');
    fireEvent.change(levelInput, { target: { value: '50' } });
    expect((levelInput as HTMLInputElement).value).toBe('50');

    await clickCalculate();
    const request = mockCalculate.mock.calls[0]![0];
    expect(request.attacker.level).toBe(50);
    expect(request.defender.level).toBe(100); // untouched
  });

  it('Nature defaults to neutral, is selectable, and reaches the calculation (task §6/§29)', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    mockFetchDefender.mockResolvedValue(HEATRAN_FORM);
    mockCalculate.mockResolvedValue({ ok: true, result: RESULT });
    renderDamageLab();
    await selectAttackerMoveAndDefender();

    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    const natureSelect = await screen.findByRole('combobox', { name: 'Nature' });
    expect((natureSelect as HTMLSelectElement).value).toBe('');
    fireEvent.change(natureSelect, { target: { value: 'jolly' } });

    await clickCalculate();
    expect(mockCalculate.mock.calls[0]![0].attacker.natureSlug).toBe('jolly');
  });

  it('Nature is unavailable in a generation that has none (task §6/§18)', async () => {
    renderDamageLab([...VERSION_GROUPS, RED_BLUE]);
    fireEvent.change(screen.getByRole('combobox', { name: 'Game' }), {
      target: { value: 'red-blue' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'Level' })).not.toBeNull());
    expect(screen.queryByRole('combobox', { name: 'Nature' })).toBeNull();
  });

  it("Ability defaults to none, offers only the selected form's abilities, and a Pokémon swap invalidates one that no longer applies (task §7/§14/§29)", async () => {
    mockFetchAttacker.mockImplementation(async (formSlug) =>
      formSlug === 'garchomp'
        ? { form: GARCHOMP_FORM, moves: [EARTHQUAKE] }
        : { form: HEATRAN_FORM, moves: [EARTHQUAKE] },
    );
    renderDamageLab();
    await selectAttacker();
    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);

    const abilitySelect = await screen.findByRole('combobox', { name: 'Ability' });
    expect((abilitySelect as HTMLSelectElement).value).toBe('');
    expect(screen.getByRole('option', { name: 'Sand Veil' })).not.toBeNull();
    expect(screen.getByRole('option', { name: 'Rough Skin' })).not.toBeNull();
    fireEvent.change(abilitySelect, { target: { value: 'sand-veil' } });
    expect((abilitySelect as HTMLSelectElement).value).toBe('sand-veil');

    // Swap the attacker to a Pokémon without a "Sand Veil" ability.
    fireEvent.click(screen.getByRole('button', { name: 'Change Garchomp' }));
    const swapInput = (await screen.findAllByRole('combobox', { name: 'Select Pokémon' }))[0]!;
    fireEvent.change(swapInput, { target: { value: 'heatran' } });
    fireEvent.click(await screen.findByRole('option', { name: /Heatran/ }));

    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Ability' }) as HTMLSelectElement).value).toBe(
        '',
      ),
    );
  });

  it('Item defaults to none, is selectable through search, and reaches the calculation — no bare hundreds-of-items select (task §8/§29)', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    mockFetchDefender.mockResolvedValue(HEATRAN_FORM);
    mockCalculate.mockResolvedValue({ ok: true, result: RESULT });
    renderDamageLab();
    await selectAttackerMoveAndDefender();

    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    expect(await screen.findByRole('button', { name: 'Held item No item' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Held item No item' }));

    const searchInput = await screen.findByRole('combobox', { name: 'Search items…' });
    fireEvent.change(searchInput, { target: { value: 'life' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Life Orb' }));
    expect(await screen.findByRole('button', { name: 'Held item Life Orb' })).not.toBeNull();

    await clickCalculate();
    expect(mockCalculate.mock.calls[0]![0].attacker.itemSlug).toBe('life-orb');
  });

  it('EVs are editable per stat, capped by the 510 total, and reach the calculation (task §9/§29)', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    mockFetchDefender.mockResolvedValue(HEATRAN_FORM);
    mockCalculate.mockResolvedValue({ ok: true, result: RESULT });
    renderDamageLab();
    await selectAttackerMoveAndDefender();

    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    const attackEv = (await screen.findAllByRole('spinbutton', { name: 'Attack' }))[0]!;
    fireEvent.change(attackEv, { target: { value: '999' } });
    expect((attackEv as HTMLInputElement).value).toBe('252'); // per-stat cap

    fireEvent.change(attackEv, { target: { value: '252' } });
    const speedEv = screen.getAllByRole('spinbutton', { name: 'Speed' })[0]!;
    fireEvent.change(speedEv, { target: { value: '252' } });
    const specialDefenseEv = screen.getAllByRole('spinbutton', { name: 'Sp. Def' })[0]!;
    fireEvent.change(specialDefenseEv, { target: { value: '10' } });
    // 252 + 252 = 504 already spent — only 6 of the requested 10 fit the 510
    // team-wide budget (task: prevent the invalid total, never redistribute
    // the other fields).
    expect((specialDefenseEv as HTMLInputElement).value).toBe('6');

    await clickCalculate();
    expect(mockCalculate.mock.calls[0]![0].attacker.evs).toEqual({
      hp: 0,
      attack: 252,
      defense: 0,
      specialAttack: 0,
      specialDefense: 6,
      speed: 252,
    });
  });

  it('IVs are editable per stat within 0-31 (task §10/§29)', async () => {
    renderDamageLab();
    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    const attackIv = (await screen.findAllByRole('spinbutton', { name: 'Attack' }))[1]!;
    expect((attackIv as HTMLInputElement).value).toBe('31');
    fireEvent.change(attackIv, { target: { value: '99' } });
    expect((attackIv as HTMLInputElement).value).toBe('31'); // clamped to the max
    fireEvent.change(attackIv, { target: { value: '0' } });
    expect((attackIv as HTMLInputElement).value).toBe('0');
  });

  it('Tera is absent for a game without it, and off by default where it exists (task §11/§29)', async () => {
    renderDamageLab();
    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    expect(await screen.findByRole('checkbox', { name: 'Terastallize' })).not.toBeNull();
    expect(
      (screen.getByRole('checkbox', { name: 'Terastallize' }) as HTMLInputElement).checked,
    ).toBe(false);
    expect(screen.queryByRole('combobox', { name: 'Tera Type' })).toBeNull();

    fireEvent.change(screen.getByRole('combobox', { name: 'Game' }), {
      target: { value: 'sword-shield' },
    });
    await waitFor(() =>
      expect(screen.queryByRole('checkbox', { name: 'Terastallize' })).toBeNull(),
    );
  });

  it('enabling Terastallize reveals the type picker and sends the chosen type; disabling sends null even though a type was picked (task §11/§29)', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    mockFetchDefender.mockResolvedValue(HEATRAN_FORM);
    mockCalculate.mockResolvedValue({ ok: true, result: RESULT });
    renderDamageLab();
    await selectAttackerMoveAndDefender();

    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Terastallize' }));
    const teraTypeSelect = await screen.findByRole('combobox', { name: 'Tera Type' });
    fireEvent.change(teraTypeSelect, { target: { value: 'ground' } });

    await clickCalculate();
    expect(mockCalculate.mock.calls[0]![0].attacker.teraType).toBe('ground');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Terastallize' }));
    await clickCalculate();
    expect(mockCalculate.mock.calls[1]![0].attacker.teraType).toBeNull();
  });

  it('Critical hit defaults to false, only the attacker offers it, and true reaches the calculation (task §12/§29)', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    mockFetchDefender.mockResolvedValue(HEATRAN_FORM);
    mockCalculate.mockResolvedValue({ ok: true, result: RESULT });
    renderDamageLab();
    await selectAttackerMoveAndDefender();

    const advancedButtons = screen.getAllByRole('button', { name: /Advanced/ });
    fireEvent.click(advancedButtons[0]!);
    const criticalCheckbox = await screen.findByRole('checkbox', { name: 'Critical hit' });
    expect((criticalCheckbox as HTMLInputElement).checked).toBe(false);
    fireEvent.click(criticalCheckbox);

    fireEvent.click(advancedButtons[1]!);
    await waitFor(() =>
      expect(screen.getAllByRole('checkbox', { name: 'Critical hit' })).toHaveLength(1),
    );

    await clickCalculate();
    expect(mockCalculate.mock.calls[0]![0].isCritical).toBe(true);
  });

  it('switching to a game without a mechanic clears that field, and switching back preserves EV investment (task §15/§29)', async () => {
    mockFetchAttacker.mockImplementation(async () => ({
      form: GARCHOMP_FORM,
      moves: [EARTHQUAKE],
    }));
    renderDamageLab([...VERSION_GROUPS, RED_BLUE]);
    await selectAttacker();

    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    const abilitySelect = await screen.findByRole('combobox', { name: 'Ability' });
    fireEvent.change(abilitySelect, { target: { value: 'sand-veil' } });
    const attackEv = (await screen.findAllByRole('spinbutton', { name: 'Attack' }))[0]!;
    fireEvent.change(attackEv, { target: { value: '200' } });

    fireEvent.change(screen.getByRole('combobox', { name: 'Game' }), {
      target: { value: 'red-blue' },
    });
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Ability' })).toBeNull());
    expect(screen.getByText(/isn't implemented yet/)).not.toBeNull();

    fireEvent.change(screen.getByRole('combobox', { name: 'Game' }), {
      target: { value: 'scarlet-violet' },
    });
    await waitFor(() =>
      expect(
        (screen.getAllByRole('spinbutton', { name: 'Attack' })[0] as HTMLInputElement).value,
      ).toBe('200'),
    );
    // Ability was explicitly nulled by the game switch (task §15) — unlike
    // EVs, never silently restored just because the mechanic exists again.
    expect((screen.getByRole('combobox', { name: 'Ability' }) as HTMLSelectElement).value).toBe('');
  });

  it('editing an Advanced field after a result marks it stale and offers Recalculate without discarding the visible result (task §20)', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    mockFetchDefender.mockResolvedValue(HEATRAN_FORM);
    mockCalculate.mockResolvedValue({ ok: true, result: RESULT });
    renderDamageLab();
    await selectAttackerMoveAndDefender();
    await clickCalculate();
    expect(await screen.findByText('184–228 HP')).not.toBeNull();
    expect(screen.queryByText('Inputs changed')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    const levelInput = await screen.findByRole('spinbutton', { name: 'Level' });
    fireEvent.change(levelInput, { target: { value: '50' } });

    expect(await screen.findByText('Inputs changed')).not.toBeNull();
    expect(screen.getByText('184–228 HP')).not.toBeNull(); // still visible, not cleared

    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
    await waitFor(() => expect(screen.queryByText('Inputs changed')).toBeNull());
  });
});

describe('Advanced reference-data resilience (production incident, task §2/§11)', () => {
  it('goes loading → success and shows the real fields', async () => {
    renderDamageLab();
    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    expect(screen.getByText('Loading…')).not.toBeNull();
    expect(await screen.findByRole('combobox', { name: 'Nature' })).not.toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('a rejected fetch does NOT leave the panel loading forever — it shows a localized inline error with Retry', async () => {
    mockFetchAdvancedReferenceData.mockReset();
    mockFetchAdvancedReferenceData.mockRejectedValueOnce(new Error('500'));
    renderDamageLab();

    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    expect(await screen.findByText("Couldn't load the advanced options.")).not.toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).not.toBeNull();
  });

  it('Retry calls the action again and success clears the error', async () => {
    mockFetchAdvancedReferenceData.mockReset();
    mockFetchAdvancedReferenceData.mockRejectedValueOnce(new Error('500'));
    mockFetchAdvancedReferenceData.mockResolvedValueOnce({ natures: [JOLLY], items: [LIFE_ORB] });
    renderDamageLab();

    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    await screen.findByRole('button', { name: 'Retry' });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('combobox', { name: 'Nature' })).not.toBeNull();
    expect(screen.queryByText("Couldn't load the advanced options.")).toBeNull();
    expect(mockFetchAdvancedReferenceData).toHaveBeenCalledTimes(2);
  });

  it("attacker and defender share one fetch — opening both doesn't request natures/items twice", async () => {
    renderDamageLab();
    const advancedButtons = screen.getAllByRole('button', { name: /Advanced/ });

    fireEvent.click(advancedButtons[0]!);
    await screen.findByRole('combobox', { name: 'Nature' });
    fireEvent.click(advancedButtons[1]!);
    await waitFor(() =>
      expect(screen.getAllByRole('combobox', { name: 'Nature' })).toHaveLength(2),
    );

    expect(mockFetchAdvancedReferenceData).toHaveBeenCalledTimes(1);
  });

  it('opening both panels in the same tick does not start two concurrent requests (task §10)', async () => {
    renderDamageLab();
    const advancedButtons = screen.getAllByRole('button', { name: /Advanced/ });

    // Both clicks fire before React has committed the first `loading` state
    // update — the request guard must still be synchronous, not read from
    // (async-batched) state.
    fireEvent.click(advancedButtons[0]!);
    fireEvent.click(advancedButtons[1]!);

    await waitFor(() =>
      expect(screen.getAllByRole('combobox', { name: 'Nature' })).toHaveLength(2),
    );
    expect(mockFetchAdvancedReferenceData).toHaveBeenCalledTimes(1);
  });
});

type AttackerFetchResult = Awaited<ReturnType<typeof fetchAttackerReferenceData>>;
type DefenderFetchResult = Awaited<ReturnType<typeof fetchDefenderReferenceData>>;

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('Attacker/defender reference-data resilience (task §11)', () => {
  it('attacker success: identity resolves and the move picker becomes usable', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab();
    await selectAttacker();

    expect(await screen.findByRole('button', { name: 'Select move' })).not.toBeNull();
    expect(screen.queryByText("Couldn't load the attacker's data.")).toBeNull();
  });

  it('a rejected attacker fetch does NOT leave the move slot on "…" forever — it shows a localized inline error with Retry', async () => {
    mockFetchAttacker.mockRejectedValueOnce(new Error('500'));
    renderDamageLab();
    await selectAttacker();

    expect(await screen.findByText("Couldn't load the attacker's data.")).not.toBeNull();
    expect(screen.queryByText('…')).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).not.toBeNull();
  });

  it('attacker Retry re-invokes fetchAttackerReferenceData and clears the error on success', async () => {
    mockFetchAttacker.mockRejectedValueOnce(new Error('500'));
    mockFetchAttacker.mockResolvedValueOnce({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab();
    await selectAttacker();
    await screen.findByText("Couldn't load the attacker's data.");

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('button', { name: 'Select move' })).not.toBeNull();
    expect(screen.queryByText("Couldn't load the attacker's data.")).toBeNull();
    expect(mockFetchAttacker).toHaveBeenCalledTimes(2);
  });

  it('a rejected defender fetch shows a localized inline error with Retry', async () => {
    mockFetchDefender.mockRejectedValueOnce(new Error('500'));
    renderDamageLab();
    await selectDefender();

    expect(await screen.findByText("Couldn't load the defender's data.")).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).not.toBeNull();
  });

  it('defender Retry re-invokes fetchDefenderReferenceData and clears the error on success', async () => {
    mockFetchDefender.mockRejectedValueOnce(new Error('500'));
    mockFetchDefender.mockResolvedValueOnce(HEATRAN_FORM);
    renderDamageLab();
    await selectDefender();
    await screen.findByText("Couldn't load the defender's data.");

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() =>
      expect(screen.queryByText("Couldn't load the defender's data.")).toBeNull(),
    );
    expect(mockFetchDefender).toHaveBeenCalledTimes(2);
  });

  it('a stale (late) attacker response never overwrites a newer Pokémon selection (task §5)', async () => {
    const garchompFetch = deferred<AttackerFetchResult>();
    mockFetchAttacker.mockImplementation(async (formSlug: string) =>
      formSlug === 'garchomp' ? garchompFetch.promise : { form: HEATRAN_FORM, moves: [EARTHQUAKE] },
    );
    renderDamageLab();
    await selectAttacker(); // Garchomp — request left pending

    // Swap the attacker to Heatran before Garchomp's request resolves.
    fireEvent.click(screen.getByRole('button', { name: 'Change Garchomp' }));
    const swapInput = (await screen.findAllByRole('combobox', { name: 'Select Pokémon' }))[0]!;
    fireEvent.change(swapInput, { target: { value: 'heatran' } });
    fireEvent.click(await screen.findByRole('option', { name: /Heatran/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Select move' }));
    expect(await screen.findByRole('option', { name: /Earthquake/ })).not.toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /Earthquake/ }));

    // Garchomp's stale response arrives late — must not resurrect its data.
    garchompFetch.resolve({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });

    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    const abilitySelect = await screen.findByRole('combobox', { name: 'Ability' });
    const optionValues = Array.from((abilitySelect as HTMLSelectElement).options).map(
      (option) => option.value,
    );
    expect(optionValues).toContain('flash-fire'); // Heatran's own ability
    expect(optionValues).not.toContain('sand-veil'); // Garchomp's — must never appear
  });

  it('a stale (late) defender response never overwrites a newer Pokémon selection (task §5)', async () => {
    const heatranFetch = deferred<DefenderFetchResult>();
    mockFetchDefender.mockImplementation(async (formSlug: string) =>
      formSlug === 'heatran' ? heatranFetch.promise : GARCHOMP_FORM,
    );
    renderDamageLab();
    await selectDefender(); // Heatran — request left pending

    fireEvent.click(screen.getByRole('button', { name: 'Change Heatran' }));
    const inputs = await screen.findAllByRole('combobox', { name: 'Select Pokémon' });
    const swapInput = inputs[inputs.length - 1]!; // defender's own picker, not attacker's still-open one
    fireEvent.change(swapInput, { target: { value: 'garchomp' } });
    fireEvent.click(await screen.findByRole('option', { name: /Garchomp/ }));

    heatranFetch.resolve(HEATRAN_FORM);

    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[1]!);
    const abilitySelect = await screen.findByRole('combobox', { name: 'Ability' });
    const optionValues = Array.from((abilitySelect as HTMLSelectElement).options).map(
      (option) => option.value,
    );
    expect(optionValues).toContain('sand-veil'); // Garchomp's own ability
    expect(optionValues).not.toContain('flash-fire'); // Heatran's — must never appear
  });

  it("switching the game while the attacker's reference data is loading doesn't leave it stuck loading, and the stale game's response never overwrites the new one (task §6)", async () => {
    const scarletVioletFetch = deferred<AttackerFetchResult>();
    mockFetchAttacker.mockImplementation(async (_formSlug: string, versionGroupSlug: string) =>
      versionGroupSlug === 'scarlet-violet'
        ? scarletVioletFetch.promise
        : { form: GARCHOMP_FORM, moves: [DIG] },
    );
    renderDamageLab();
    await selectAttacker(); // scarlet-violet request left pending

    fireEvent.change(screen.getByRole('combobox', { name: 'Game' }), {
      target: { value: 'sword-shield' },
    });

    // sword-shield's own request resolves right away — never stuck on "…".
    expect(await screen.findByRole('button', { name: 'Select move' })).not.toBeNull();

    // The stale scarlet-violet response arrives late.
    scarletVioletFetch.resolve({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });

    fireEvent.click(screen.getByRole('button', { name: 'Select move' }));
    expect(await screen.findByRole('option', { name: /Dig/ })).not.toBeNull();
    expect(screen.queryByRole('option', { name: /Earthquake/ })).toBeNull();
  });
});

const IMPORTED_EVS = {
  hp: 0,
  attack: 252,
  defense: 0,
  specialAttack: 0,
  specialDefense: 4,
  speed: 252,
};
const IMPORTED_IVS = {
  hp: 31,
  attack: 31,
  defense: 31,
  specialAttack: 31,
  specialDefense: 31,
  speed: 31,
};

const GARCHOMP_TEAM_MEMBER = {
  id: 'member-1',
  formSlug: 'garchomp',
  nickname: '',
  level: 50,
  abilitySlug: 'rough-skin',
  itemSlug: 'life-orb',
  teraType: 'ground' as const,
  natureSlug: 'jolly',
  evs: IMPORTED_EVS,
  ivs: IMPORTED_IVS,
  moveSlugs: ['protect', 'swords-dance', 'earthquake', 'dragon-claw'],
};

function makeTeamDraft(overrides: Partial<TeamDraft> = {}): TeamDraft {
  return {
    schemaVersion: 1,
    id: 'team-1',
    name: 'My Team',
    versionGroupSlug: 'scarlet-violet',
    members: [GARCHOMP_TEAM_MEMBER],
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Build → Damage Lab import (task §30)', () => {
  it('with no team/member query params, Damage Lab behaves normally — no localStorage read at all (task §1/§23)', () => {
    renderDamageLab();
    expect(mockLoadTeamDraft).not.toHaveBeenCalled();
    expect(screen.queryByText('Imported from Team Builder')).toBeNull();
  });

  it("imports the team's game, the attacker's identity, level, EVs, IVs, ability, nature and item (task §2-§9)", async () => {
    mockLoadTeamDraft.mockReturnValue(makeTeamDraft());
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab(VERSION_GROUPS, { teamId: 'team-1', memberId: 'member-1' });

    expect(await screen.findByText('Imported from Team Builder')).not.toBeNull();
    expect(screen.getByText('Garchomp · My Team')).not.toBeNull();
    expect((screen.getByRole('combobox', { name: 'Game' }) as HTMLSelectElement).value).toBe(
      'scarlet-violet',
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    expect((await screen.findByRole('spinbutton', { name: 'Level' })).getAttribute('value')).toBe(
      '50',
    );
    expect((screen.getByRole('combobox', { name: 'Ability' }) as HTMLSelectElement).value).toBe(
      'rough-skin',
    );
    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Nature' }) as HTMLSelectElement).value).toBe(
        'jolly',
      ),
    );
    expect(
      (screen.getAllByRole('spinbutton', { name: 'Attack' })[0] as HTMLInputElement).value,
    ).toBe('252');
    expect(
      (screen.getAllByRole('spinbutton', { name: 'Attack' })[1] as HTMLInputElement).value,
    ).toBe('31');
  });

  it('imports the Tera Type but leaves Terastallize off (task §10)', async () => {
    mockLoadTeamDraft.mockReturnValue(makeTeamDraft());
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab(VERSION_GROUPS, { teamId: 'team-1', memberId: 'member-1' });

    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    const teraCheckbox = (await screen.findByRole('checkbox', {
      name: 'Terastallize',
    })) as HTMLInputElement;
    expect(teraCheckbox.checked).toBe(false);

    fireEvent.click(teraCheckbox);
    expect((screen.getByRole('combobox', { name: 'Tera Type' }) as HTMLSelectElement).value).toBe(
      'ground',
    );
  });

  it('critical hit is false after import — TeamDraft has no such concept (task §11)', async () => {
    mockLoadTeamDraft.mockReturnValue(makeTeamDraft());
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab(VERSION_GROUPS, { teamId: 'team-1', memberId: 'member-1' });

    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    expect(
      ((await screen.findByRole('checkbox', { name: 'Critical hit' })) as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("auto-selects the first set move that's a legal damaging move for this game (task §12)", async () => {
    mockLoadTeamDraft.mockReturnValue(makeTeamDraft());
    // Only Earthquake is a legal damaging move here — Protect/Swords Dance
    // are status (never present in fetchAttackerReferenceData's own
    // already-filtered list) and Dragon Claw isn't legal in this fixture.
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab(VERSION_GROUPS, { teamId: 'team-1', memberId: 'member-1' });

    expect(await screen.findByRole('button', { name: 'Change Earthquake' })).not.toBeNull();
  });

  it('no move is selected when every set move is unavailable (all status, or illegal for this game) (task §12)', async () => {
    mockLoadTeamDraft.mockReturnValue(makeTeamDraft());
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [DIG] }); // none of the set's 4 moves
    renderDamageLab(VERSION_GROUPS, { teamId: 'team-1', memberId: 'member-1' });

    await screen.findByText('Garchomp · My Team');
    expect(await screen.findByRole('button', { name: 'Select move' })).not.toBeNull();
  });

  it('the imported move preference is applied only once — a later manual move change is never overwritten (task §13)', async () => {
    mockLoadTeamDraft.mockReturnValue(makeTeamDraft());
    mockFetchAttacker.mockImplementation(async (_formSlug: string, versionGroupSlug: string) =>
      versionGroupSlug === 'scarlet-violet'
        ? { form: GARCHOMP_FORM, moves: [EARTHQUAKE, DIG] }
        : { form: GARCHOMP_FORM, moves: [EARTHQUAKE, DIG] },
    );
    renderDamageLab(VERSION_GROUPS, { teamId: 'team-1', memberId: 'member-1' });

    expect(await screen.findByRole('button', { name: 'Change Earthquake' })).not.toBeNull();

    // Manually change the move.
    fireEvent.click(screen.getByRole('button', { name: 'Change Earthquake' }));
    fireEvent.click(await screen.findByRole('option', { name: /Dig/ }));
    expect(await screen.findByRole('button', { name: 'Change Dig' })).not.toBeNull();

    // Trigger another attacker-reference reload (a game switch) — the
    // already-consumed import preference must not reassert Earthquake.
    fireEvent.change(screen.getByRole('combobox', { name: 'Game' }), {
      target: { value: 'sword-shield' },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change Dig' })).not.toBeNull());
  });

  it("changing the attacker after import is never re-overwritten by the old team member's data (task §13)", async () => {
    mockLoadTeamDraft.mockReturnValue(makeTeamDraft());
    mockFetchAttacker.mockImplementation(async (formSlug: string) =>
      formSlug === 'garchomp'
        ? { form: GARCHOMP_FORM, moves: [EARTHQUAKE] }
        : { form: HEATRAN_FORM, moves: [EARTHQUAKE] },
    );
    renderDamageLab(VERSION_GROUPS, { teamId: 'team-1', memberId: 'member-1' });
    await screen.findByRole('button', { name: 'Change Earthquake' });

    fireEvent.click(screen.getByRole('button', { name: 'Change Garchomp' }));
    const inputs = await screen.findAllByRole('combobox', { name: 'Select Pokémon' });
    fireEvent.change(inputs[0]!, { target: { value: 'heatran' } });
    fireEvent.click(await screen.findByRole('option', { name: /Heatran/ }));

    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    const abilitySelect = await screen.findByRole('combobox', { name: 'Ability' });
    // Heatran's own ability list — never Garchomp's imported "Rough Skin".
    expect((abilitySelect as HTMLSelectElement).value).toBe('');
    const optionValues = Array.from((abilitySelect as HTMLSelectElement).options).map(
      (option) => option.value,
    );
    expect(optionValues).toContain('flash-fire');
    expect(optionValues).not.toContain('rough-skin');
  });

  it('team not found: shows a discrete warning, Damage Lab stays fully usable (task §19)', async () => {
    mockLoadTeamDraft.mockReturnValue(null);
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab(VERSION_GROUPS, { teamId: 'ghost-team', memberId: 'member-1' });

    expect(
      await screen.findByText(
        "We couldn't find that saved team on this device. You can still use Damage Lab normally.",
      ),
    ).not.toBeNull();
    await selectAttacker();
    expect(await screen.findByText('Garchomp')).not.toBeNull();
  });

  it('member not found: shows a discrete warning naming the team, Damage Lab stays fully usable (task §19)', async () => {
    mockLoadTeamDraft.mockReturnValue(makeTeamDraft());
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab(VERSION_GROUPS, { teamId: 'team-1', memberId: 'ghost-member' });

    expect(await screen.findByText("We couldn't find that Pokémon on the team.")).not.toBeNull();
    await selectAttacker();
    expect(await screen.findByText('Garchomp')).not.toBeNull();
  });

  it('an imported nature/item slug auto-loads Advanced reference data and never shows a raw slug (task §16)', async () => {
    mockLoadTeamDraft.mockReturnValue(makeTeamDraft());
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab(VERSION_GROUPS, { teamId: 'team-1', memberId: 'member-1' });

    await waitFor(() => expect(mockFetchAdvancedReferenceData).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    // The collapsed-panel summary (and the select's own resolved option)
    // must show real names, never the raw slugs 'jolly'/'life-orb'. "Jolly"
    // is a substring of both (the summary line, and the nature <select>'s
    // composed "Jolly (+Speed / −Sp. Atk)" option label), never the exact
    // text content of one node — a regex matcher, not an exact string.
    await waitFor(() => expect(screen.getAllByText(/Jolly/).length).toBeGreaterThan(0));
    expect(screen.getAllByText('Life Orb').length).toBeGreaterThan(0);
    expect(screen.queryByText('jolly')).toBeNull();
    expect(screen.queryByText('life-orb')).toBeNull();
  });

  it("capability revalidation still applies — an imported nature isn't forced into a game that has none (task §14/§15)", async () => {
    mockLoadTeamDraft.mockReturnValue(makeTeamDraft({ versionGroupSlug: 'red-blue' }));
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab([...VERSION_GROUPS, RED_BLUE], { teamId: 'team-1', memberId: 'member-1' });

    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Game' }) as HTMLSelectElement).value).toBe(
        'red-blue',
      ),
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Advanced/ })[0]!);
    await screen.findByRole('spinbutton', { name: 'Level' });
    // Gen I has no natures at all — the field must not render, regardless
    // of what the imported set had configured.
    expect(screen.queryByRole('combobox', { name: 'Nature' })).toBeNull();
  });

  it('a remount (e.g. a hard refresh of the same URL) can import again (task §21)', async () => {
    mockLoadTeamDraft.mockReturnValue(makeTeamDraft());
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });

    const first = renderDamageLab(VERSION_GROUPS, { teamId: 'team-1', memberId: 'member-1' });
    expect(await screen.findByText('Garchomp · My Team')).not.toBeNull();
    first.unmount();

    renderDamageLab(VERSION_GROUPS, { teamId: 'team-1', memberId: 'member-1' });
    expect(await screen.findByText('Garchomp · My Team')).not.toBeNull();
    expect(mockLoadTeamDraft).toHaveBeenCalledTimes(2);
  });
});

/** Simulates the real effect of clicking `LocaleSwitcher`: dispatch the handoff event, then a genuine unmount + fresh mount at the new URL — never a `rerender`, which would trivially "preserve" state via the same component instance's own `useState`. */
function switchLocale(view: ReturnType<typeof renderDamageLab>, targetUrl: string): void {
  window.dispatchEvent(new CustomEvent(LOCALE_CHANGE_EVENT, { detail: targetUrl }));
  view.unmount();
  window.history.replaceState({}, '', targetUrl);
}

describe('Damage Lab locale-switch state preservation', () => {
  it('restores attacker, defender, move, game, both Advanced configurations and critical hit across a real unmount/remount (task §16 review)', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    mockFetchDefender.mockResolvedValue(HEATRAN_FORM);
    const view = renderDamageLab();
    await selectAttackerMoveAndDefender();
    fireEvent.change(screen.getByRole('combobox', { name: 'Game' }), {
      target: { value: 'sword-shield' },
    });

    const advancedButtons = screen.getAllByRole('button', { name: /Advanced/ });
    fireEvent.click(advancedButtons[0]!);
    fireEvent.change(await screen.findByRole('spinbutton', { name: 'Level' }), {
      target: { value: '50' },
    });
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Critical hit' }));
    fireEvent.click(advancedButtons[1]!);
    const defenderLevel = (await screen.findAllByRole('spinbutton', { name: 'Level' }))[1]!;
    fireEvent.change(defenderLevel, { target: { value: '77' } });

    switchLocale(view, '/es/battle/damage');
    renderDamageLab();

    // Game survives.
    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Game' }) as HTMLSelectElement).value).toBe(
        'sword-shield',
      ),
    );
    // Both Pokémon survive (identity resolved, not stuck on the picker).
    expect(await screen.findByText('Garchomp')).not.toBeNull();
    expect(await screen.findByText('Heatran')).not.toBeNull();
    // The selected move survives.
    expect(screen.getByRole('button', { name: /Earthquake/ })).not.toBeNull();
    // Both Advanced configs and critical hit survive.
    const restoredAdvanced = screen.getAllByRole('button', { name: /Advanced/ });
    fireEvent.click(restoredAdvanced[0]!);
    expect(
      ((await screen.findByRole('spinbutton', { name: 'Level' })) as HTMLInputElement).value,
    ).toBe('50');
    expect(
      (screen.getByRole('checkbox', { name: 'Critical hit' }) as HTMLInputElement).checked,
    ).toBe(true);
    fireEvent.click(restoredAdvanced[1]!);
    const restoredDefenderLevel = (
      await screen.findAllByRole('spinbutton', { name: 'Level' })
    )[1] as HTMLInputElement;
    expect(restoredDefenderLevel.value).toBe('77');
  });

  it('a corrupted sessionStorage handoff is harmless — Damage Lab initializes normally, no crash', async () => {
    sessionStorage.setItem('pokestudio:damage-locale-handoff', '{not valid json at all');
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });

    renderDamageLab();

    // No crash, and a completely ordinary, unimported Damage Lab: default
    // game, no attacker selected yet, picker usable as normal.
    expect((screen.getByRole('combobox', { name: 'Game' }) as HTMLSelectElement).value).toBe(
      'scarlet-violet',
    );
    await selectAttacker();
    expect(await screen.findByText('Garchomp')).not.toBeNull();
  });
});

describe('Damage Lab locale-switch × Build import interaction (review finding)', () => {
  it('a manual attacker change after Build import survives a locale switch, and the import banner does not resurrect the original member (review §11/§2)', async () => {
    mockLoadTeamDraft.mockReturnValue(makeTeamDraft());
    mockFetchAttacker.mockImplementation(async (formSlug: string) =>
      formSlug === 'garchomp'
        ? { form: GARCHOMP_FORM, moves: [EARTHQUAKE] }
        : { form: HEATRAN_FORM, moves: [EARTHQUAKE] },
    );
    const params = { teamId: 'team-1', memberId: 'member-1' };
    const view = renderDamageLab(VERSION_GROUPS, params);

    // Initial import: Garchomp, banner names it.
    expect(await screen.findByText('Garchomp · My Team')).not.toBeNull();

    // Manually swap the attacker to Heatran.
    fireEvent.click(screen.getByRole('button', { name: 'Change Garchomp' }));
    const swapInput = (await screen.findAllByRole('combobox', { name: 'Select Pokémon' }))[0]!;
    fireEvent.change(swapInput, { target: { value: 'heatran' } });
    fireEvent.click(await screen.findByRole('option', { name: /Heatran/ }));
    await screen.findByText('Heatran');

    switchLocale(view, '/es/battle/damage?team=team-1&member=member-1');
    renderDamageLab(VERSION_GROUPS, params);

    // Heatran survives — the original Garchomp import is never reapplied.
    expect(await screen.findByText('Heatran')).not.toBeNull();
    expect(screen.queryByText('Garchomp')).toBeNull();

    // The banner must not claim "Garchomp" any more — the review's exact
    // finding: the state guard alone wasn't enough, the banner needs it too.
    expect(screen.queryByText('Garchomp · My Team')).toBeNull();
    expect(screen.queryByText(/Garchomp/)).toBeNull();
  });

  it('a manually changed move/game after Build import both survive a locale switch without reimporting', async () => {
    mockLoadTeamDraft.mockReturnValue(makeTeamDraft());
    mockFetchAttacker.mockImplementation(async (_formSlug: string, versionGroupSlug: string) =>
      versionGroupSlug === 'scarlet-violet'
        ? { form: GARCHOMP_FORM, moves: [EARTHQUAKE, DIG] }
        : { form: GARCHOMP_FORM, moves: [EARTHQUAKE, DIG] },
    );
    const params = { teamId: 'team-1', memberId: 'member-1' };
    const view = renderDamageLab(VERSION_GROUPS, params);
    await screen.findByRole('button', { name: 'Change Earthquake' });

    // Manual move change.
    fireEvent.click(screen.getByRole('button', { name: 'Change Earthquake' }));
    fireEvent.click(await screen.findByRole('option', { name: /Dig/ }));
    await screen.findByRole('button', { name: 'Change Dig' });

    // Manual game change.
    fireEvent.change(screen.getByRole('combobox', { name: 'Game' }), {
      target: { value: 'sword-shield' },
    });
    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Game' }) as HTMLSelectElement).value).toBe(
        'sword-shield',
      ),
    );

    switchLocale(view, '/es/battle/damage?team=team-1&member=member-1');
    renderDamageLab(VERSION_GROUPS, params);

    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Game' }) as HTMLSelectElement).value).toBe(
        'sword-shield',
      ),
    );
    expect(await screen.findByRole('button', { name: /Dig/ })).not.toBeNull();
  });
});

describe('Explore → Damage Lab attacker seed (Phase 3 roadmap, attacker-only)', () => {
  it('seeds the exact form as attacker, resolved through the existing attacker-fetch pipeline', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab(VERSION_GROUPS, undefined, 'garchomp');

    expect(await screen.findByText('Garchomp')).not.toBeNull();
    expect(mockFetchAttacker).toHaveBeenCalledWith('garchomp', 'scarlet-violet');
  });

  it('an alternate form does not collapse to its base species', async () => {
    mockFetchAttacker.mockResolvedValue({ form: MEOWTH_ALOLA_FORM, moves: [] });
    renderDamageLab(VERSION_GROUPS, undefined, 'meowth-alola');

    expect(await screen.findByText('Alolan Meowth')).not.toBeNull();
    // Exact-text match — never collapsed down to the bare species name.
    expect(screen.queryByText('Meowth')).toBeNull();
    expect(mockFetchAttacker).toHaveBeenCalledWith('meowth-alola', 'scarlet-violet');
  });

  it('leaves the defender at its normal default (picker, not a resolved identity)', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab(VERSION_GROUPS, undefined, 'garchomp');

    await screen.findByText('Garchomp');
    expect(mockFetchDefender).not.toHaveBeenCalled();
    expect(screen.getAllByRole('combobox', { name: 'Select Pokémon' })).toHaveLength(1);
  });

  it('leaves the move at its normal default — no move preference to auto-apply', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE, DIG] });
    renderDamageLab(VERSION_GROUPS, undefined, 'garchomp');

    await screen.findByText('Garchomp');
    // Attacker moves resolved (Earthquake/Dig legal) but no move chosen —
    // the ordinary "pick one" trigger, never an auto-selected move.
    expect(await screen.findByRole('button', { name: 'Select move' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Earthquake/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Dig/ })).toBeNull();
  });

  it('never shows the Team Builder import banner for an Explore-seeded attacker', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab(VERSION_GROUPS, undefined, 'garchomp');

    await screen.findByText('Garchomp');
    expect(screen.queryByText('Imported from Team Builder')).toBeNull();
    expect(screen.queryByText(/· My Team/)).toBeNull();
  });

  it('a malformed/unknown Explore seed is ignored safely — Damage Lab loads with its normal empty attacker state', async () => {
    renderDamageLab(VERSION_GROUPS, undefined, 'not-a-real-form-slug');

    expect(mockFetchAttacker).not.toHaveBeenCalled();
    expect(screen.getAllByRole('combobox', { name: 'Select Pokémon' })).toHaveLength(2);
    expect(screen.queryByText('Imported from Team Builder')).toBeNull();
  });

  it('a valid Build team/member import takes precedence over an Explore attacker seed present in the same URL', async () => {
    mockLoadTeamDraft.mockReturnValue(makeTeamDraft()); // imports Garchomp (member-1)
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab(VERSION_GROUPS, { teamId: 'team-1', memberId: 'member-1' }, 'heatran');

    expect(await screen.findByText('Imported from Team Builder')).not.toBeNull();
    expect(mockFetchAttacker).toHaveBeenCalledWith('garchomp', 'scarlet-violet');
    expect(mockFetchAttacker).not.toHaveBeenCalledWith('heatran', expect.anything());
  });

  it('an Explore seed still applies when the Build params in the same URL do not resolve to a real member', async () => {
    mockLoadTeamDraft.mockReturnValue(null); // team-not-found
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab(VERSION_GROUPS, { teamId: 'ghost-team', memberId: 'member-1' }, 'garchomp');

    expect(await screen.findByText('Garchomp')).not.toBeNull();
    expect(screen.queryByText('Imported from Team Builder')).toBeNull();
    expect(mockFetchAttacker).toHaveBeenCalledWith('garchomp', 'scarlet-violet');
  });

  it('an Explore-seeded attacker survives a locale switch through the existing locale handoff, with no import banner reappearing', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    const view = renderDamageLab(VERSION_GROUPS, undefined, 'garchomp');
    await screen.findByText('Garchomp');

    switchLocale(view, '/es/battle/damage');
    renderDamageLab();

    expect(await screen.findByText('Garchomp')).not.toBeNull();
    expect(screen.queryByText('Imported from Team Builder')).toBeNull();
  });

  it('resolves the seeded form to its real sprite — the same production PokéAPI family Explore already uses, via its exact-form id', async () => {
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab(VERSION_GROUPS, undefined, 'garchomp');

    await screen.findByText('Garchomp');
    const img = document.querySelector('img[alt=""]') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toBe(
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/445.png',
    );
  });

  it('resolves an alternate-form seed to its own exact sprite, never a PokéSprite/box URL and never the base species', async () => {
    mockFetchAttacker.mockResolvedValue({ form: MEOWTH_ALOLA_FORM, moves: [] });
    renderDamageLab(VERSION_GROUPS, undefined, 'meowth-alola');

    await screen.findByText('Alolan Meowth');
    const img = document.querySelector('img[alt=""]') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toBe(
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10102.png',
    );
    expect(img.src).not.toContain('pokesprite');
    expect(img.src).not.toContain('/52.png');
  });

  it('the selected alternate-form name is not truncated — a normal name like "Alolan Meowth" stays fully readable', async () => {
    mockFetchAttacker.mockResolvedValue({ form: MEOWTH_ALOLA_FORM, moves: [] });
    renderDamageLab(VERSION_GROUPS, undefined, 'meowth-alola');

    const nameEl = await screen.findByText('Alolan Meowth');
    expect(nameEl.className).not.toContain('truncate');
  });
});

describe('Explore → Damage Lab compatible-game fallback (Phase 3 roadmap)', () => {
  it('keeps the default game when the seeded form is supported there', async () => {
    mockFetchFormSupportedVersionGroups.mockResolvedValue(VERSION_GROUPS); // includes scarlet-violet
    mockFetchAttacker.mockResolvedValue({ form: GARCHOMP_FORM, moves: [EARTHQUAKE] });
    renderDamageLab(VERSION_GROUPS, undefined, 'garchomp');

    await screen.findByText('Garchomp');
    expect((screen.getByRole('combobox', { name: 'Game' }) as HTMLSelectElement).value).toBe(
      'scarlet-violet',
    );
    expect(mockFetchAttacker).toHaveBeenCalledWith('garchomp', 'scarlet-violet');
  });

  it('automatically switches to the most recent version group the form actually supports when the default game does not support it, and preserves the exact form', async () => {
    // Only sword-shield (the older of the two fixture games) has data for
    // this form — the exact shape a Mega Evolution/older-game-only form
    // seed produces against Damage Lab's modern default game.
    mockFetchFormSupportedVersionGroups.mockResolvedValue([
      VERSION_GROUPS.find((vg) => vg.slug === 'sword-shield')!,
    ]);
    mockFetchAttacker.mockResolvedValue({ form: MEOWTH_ALOLA_FORM, moves: [] });
    renderDamageLab(VERSION_GROUPS, undefined, 'meowth-alola');

    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Game' }) as HTMLSelectElement).value).toBe(
        'sword-shield',
      ),
    );
    // Exact form preserved through the switch — never collapsed to the
    // base species, never silently dropped.
    expect(await screen.findByText('Alolan Meowth')).not.toBeNull();
    expect(mockFetchAttacker).toHaveBeenCalledWith('meowth-alola', 'sword-shield');
    expect(mockFetchAttacker).not.toHaveBeenCalledWith('meowth-alola', 'scarlet-violet');
  });

  it('stays on the default game (and never crashes) when the form has no learnset data for any Damage Lab game at all', async () => {
    mockFetchFormSupportedVersionGroups.mockResolvedValue([]);
    mockFetchAttacker.mockResolvedValue({ form: MEOWTH_ALOLA_FORM, moves: [] });
    renderDamageLab(VERSION_GROUPS, undefined, 'meowth-alola');

    expect(await screen.findByText('Alolan Meowth')).not.toBeNull();
    expect((screen.getByRole('combobox', { name: 'Game' }) as HTMLSelectElement).value).toBe(
      'scarlet-violet',
    );
    expect(screen.queryByText('No damaging moves are learnable in this game.')).not.toBeNull();
  });

  it('the automatic game switch happens once and does not override a later manual game change', async () => {
    mockFetchFormSupportedVersionGroups.mockResolvedValue([
      VERSION_GROUPS.find((vg) => vg.slug === 'sword-shield')!,
    ]);
    mockFetchAttacker.mockResolvedValue({ form: MEOWTH_ALOLA_FORM, moves: [] });
    renderDamageLab(VERSION_GROUPS, undefined, 'meowth-alola');

    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Game' }) as HTMLSelectElement).value).toBe(
        'sword-shield',
      ),
    );

    // Manual change back to the other game, after the automatic switch has
    // already landed.
    fireEvent.change(screen.getByRole('combobox', { name: 'Game' }), {
      target: { value: 'scarlet-violet' },
    });
    expect((screen.getByRole('combobox', { name: 'Game' }) as HTMLSelectElement).value).toBe(
      'scarlet-violet',
    );

    // Give any stray effect a chance to fire, then confirm the manual
    // choice was never reverted.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((screen.getByRole('combobox', { name: 'Game' }) as HTMLSelectElement).value).toBe(
      'scarlet-violet',
    );
  });

  it('locale handoff preserves the automatically selected game and the exact form', async () => {
    mockFetchFormSupportedVersionGroups.mockResolvedValue([
      VERSION_GROUPS.find((vg) => vg.slug === 'sword-shield')!,
    ]);
    mockFetchAttacker.mockResolvedValue({ form: MEOWTH_ALOLA_FORM, moves: [] });
    const view = renderDamageLab(VERSION_GROUPS, undefined, 'meowth-alola');

    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Game' }) as HTMLSelectElement).value).toBe(
        'sword-shield',
      ),
    );
    await screen.findByText('Alolan Meowth');

    switchLocale(view, '/es/battle/damage');
    renderDamageLab();

    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Game' }) as HTMLSelectElement).value).toBe(
        'sword-shield',
      ),
    );
    expect(await screen.findByText('Alolan Meowth')).not.toBeNull();
  });
});
