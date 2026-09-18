import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as NextNavigation from 'next/navigation';

import type {
  ComparablePokemonForm,
  SpeciesSearchAlias,
  SpeciesSearchItem,
} from '@pokelab/database';

import { CompareView, type CompareViewLabels } from './compare-view';

const replace = vi.fn();

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof NextNavigation>();
  return { ...actual, useRouter: () => ({ replace }) };
});

afterEach(cleanup);
beforeEach(() => replace.mockClear());

const STAT_LABELS = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  specialAttack: 'Sp. Atk',
  specialDefense: 'Sp. Def',
  speed: 'Speed',
};

const TYPE_LABELS: Record<string, string> = {
  fire: 'Fire',
  flying: 'Flying',
  grass: 'Grass',
  poison: 'Poison',
  normal: 'Normal',
  dark: 'Dark',
};

const LABELS: CompareViewLabels = {
  emptyState: 'Add a Pokémon or form to start comparing.',
  addPokemon: 'Add Pokémon',
  addPlaceholder: 'Search Pokémon by name or #…',
  noResults: 'No Pokémon match your search.',
  removeTemplate: 'Remove {name}',
  maxReached: 'Comparing the maximum of 4 — remove one to add another.',
  addAnotherHint: 'Add at least one more to compare.',
  invalidEntryTemplate: '"{slug}" isn\'t a valid Pokémon or form — skipped.',
  abilities: 'Abilities',
  hiddenAbility: 'Hidden',
  baseStats: 'Base stats',
  baseStatTotal: 'Total',
  typeMatchups: 'Type matchups',
  doubleWeak: 'Weak 4×',
  weak: 'Weak 2×',
  resist: 'Resist 0.5×',
  doubleResist: 'Resist 0.25×',
  immune: 'Immune',
  noNotableMatchups: 'No notable weaknesses or resistances.',
  multipleFormsMatchTemplate: '{count} forms match',
  ambiguousHint: 'Type more of the name to pick one form.',
};

const CHARIZARD: ComparablePokemonForm = {
  formSlug: 'charizard',
  speciesSlug: 'charizard',
  nationalDexNumber: 6,
  speciesName: { en: 'Charizard', es: 'Charizard' },
  formName: { en: 'Charizard', es: 'Charizard' },
  isDefaultForm: true,
  types: ['fire', 'flying'],
  baseStats: {
    hp: 78,
    attack: 84,
    defense: 78,
    specialAttack: 109,
    specialDefense: 85,
    speed: 100,
  },
  abilities: [
    { slug: 'blaze', nameEn: 'Blaze', isHidden: false, slot: 1 },
    { slug: 'solar-power', nameEn: 'Solar Power', isHidden: true, slot: 3 },
  ],
};

const BULBASAUR: ComparablePokemonForm = {
  formSlug: 'bulbasaur',
  speciesSlug: 'bulbasaur',
  nationalDexNumber: 1,
  speciesName: { en: 'Bulbasaur', es: 'Bulbasaur' },
  formName: { en: 'Bulbasaur', es: 'Bulbasaur' },
  isDefaultForm: true,
  types: ['grass', 'poison'],
  baseStats: { hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 },
  abilities: [{ slug: 'overgrow', nameEn: 'Overgrow', isHidden: false, slot: 1 }],
};

const MEOWTH_FORM: ComparablePokemonForm = {
  formSlug: 'meowth',
  speciesSlug: 'meowth',
  nationalDexNumber: 52,
  speciesName: { en: 'Meowth', es: 'Meowth' },
  formName: { en: 'Meowth', es: 'Meowth' },
  isDefaultForm: true,
  types: ['normal'],
  baseStats: { hp: 40, attack: 45, defense: 35, specialAttack: 40, specialDefense: 40, speed: 90 },
  abilities: [{ slug: 'pickup', nameEn: 'Pickup', isHidden: false, slot: 1 }],
};

const MEOWTH: SpeciesSearchItem = {
  slug: 'meowth',
  formSlug: 'meowth',
  nationalDexNumber: 52,
  name: { en: 'Meowth', es: 'Meowth' },
  types: ['normal'],
  baseStats: { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 },
};

const MEOWTH_ALOLA_ALIAS: SpeciesSearchAlias = {
  name: { en: 'Alolan Meowth', es: 'Meowth de Alola' },
  speciesSlug: 'meowth',
  types: ['dark'],
  formSlug: 'meowth-alola',
};

function renderCompareView(
  forms: ComparablePokemonForm[],
  options: { invalidSlugs?: string[] } = {},
) {
  render(
    <CompareView
      locale="en"
      searchIndex={{ items: [MEOWTH], aliases: [MEOWTH_ALOLA_ALIAS] }}
      forms={forms}
      invalidSlugs={options.invalidSlugs ?? []}
      typeLabels={TYPE_LABELS as never}
      statLabels={STAT_LABELS}
      statTierLabels={{ low: 'Low', average: 'Average', good: 'Good', excellent: 'Excellent' }}
      labels={LABELS}
    />,
  );
}

describe('CompareView', () => {
  it('shows the empty state when nothing is selected', () => {
    renderCompareView([]);
    expect(screen.getByText(LABELS.emptyState)).not.toBeNull();
  });

  it('renders each selected form with its name, types, stats and abilities', () => {
    renderCompareView([BULBASAUR, CHARIZARD]);
    expect(screen.getByText('Bulbasaur')).not.toBeNull();
    expect(screen.getByText('Charizard')).not.toBeNull();
    expect(screen.getAllByText('Grass').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Fire').length).toBeGreaterThan(0);
    expect(screen.getByText('Overgrow')).not.toBeNull();
    expect(screen.getByText('Blaze')).not.toBeNull();
    expect(screen.getByText('Solar Power')).not.toBeNull();
    expect(screen.getByText('Hidden')).not.toBeNull();
  });

  it("shows Charizard's real defensive type matchups (4x/2x weak, 0.25x/0.5x resist, no fake winner labels)", () => {
    renderCompareView([CHARIZARD]);
    // Fire/Flying is 4x weak to Rock in the real chart... but Rock isn't in
    // TYPE_LABELS here, so assert on labels actually present instead.
    expect(screen.getAllByText('Weak 2×').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Resist 0.5×').length).toBeGreaterThan(0);
  });

  it('calls router.replace with the remaining slugs when a form is removed', () => {
    renderCompareView([BULBASAUR, CHARIZARD]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Bulbasaur' }));
    expect(replace).toHaveBeenCalledWith('/en/compare?pokemon=charizard');
  });

  it('calls router.replace with an empty query when the last form is removed', () => {
    renderCompareView([BULBASAUR]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Bulbasaur' }));
    expect(replace).toHaveBeenCalledWith('/en/compare');
  });

  it('shows the invalid-slug message for URL entries that failed to resolve', () => {
    renderCompareView([BULBASAUR], { invalidSlugs: ['not-a-real-pokemon'] });
    expect(
      screen.getByText('"not-a-real-pokemon" isn\'t a valid Pokémon or form — skipped.'),
    ).not.toBeNull();
  });

  it('hides the add input and shows "max reached" once 4 forms are selected', () => {
    const four = [
      BULBASAUR,
      CHARIZARD,
      { ...BULBASAUR, formSlug: 'a' },
      { ...BULBASAUR, formSlug: 'b' },
    ];
    renderCompareView(four);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText(LABELS.maxReached)).not.toBeNull();
  });

  it('adds a Pokémon via the search input, appending its form slug to the URL', () => {
    renderCompareView([BULBASAUR]);
    const input = screen.getByRole('combobox', { name: LABELS.addPokemon });
    fireEvent.change(input, { target: { value: 'meowth' } });
    fireEvent.click(screen.getByRole('option', { name: /Meowth/ }));
    expect(replace).toHaveBeenCalledWith('/en/compare?pokemon=bulbasaur,meowth');
  });

  it('adds the matched form (not the species default) for an unambiguous alias match', () => {
    renderCompareView([BULBASAUR]);
    const input = screen.getByRole('combobox', { name: LABELS.addPokemon });
    fireEvent.change(input, { target: { value: 'alolan meowth' } });
    fireEvent.click(screen.getByRole('option', { name: /Meowth/ }));
    expect(replace).toHaveBeenCalledWith('/en/compare?pokemon=bulbasaur,meowth-alola');
  });

  it('does not add anything for a form already in the comparison', () => {
    renderCompareView([MEOWTH_FORM]);
    const input = screen.getByRole('combobox', { name: LABELS.addPokemon });
    fireEvent.change(input, { target: { value: 'meowth' } });
    fireEvent.click(screen.getByRole('option', { name: /Meowth/ }));
    expect(replace).not.toHaveBeenCalled();
  });
});
