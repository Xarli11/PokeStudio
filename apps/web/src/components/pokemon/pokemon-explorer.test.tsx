import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as NextNavigation from 'next/navigation';

import type { SpeciesSearchAlias, SpeciesSearchItem } from '@pokestudio/database';

import { MAX_POKEMON_SUGGESTIONS } from '@/lib/pokemon-search';

import { PokemonExplorer } from './pokemon-explorer';

const push = vi.fn();

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof NextNavigation>();
  return { ...actual, useRouter: () => ({ push }) };
});

afterEach(cleanup);
beforeEach(() => push.mockClear());

// Irrelevant to this file's tests (all about search/combobox behavior, not
// stats/sorting) — one flat spread keeps every fixture's intent readable.
const STATS = { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 };

const ITEMS: SpeciesSearchItem[] = [
  {
    slug: 'bulbasaur',
    nationalDexNumber: 1,
    name: { en: 'Bulbasaur', es: 'Bulbasaur' },
    types: ['grass', 'poison'],
    baseStats: STATS,
    formSlug: 'bulbasaur',
  },
  {
    slug: 'pikachu',
    nationalDexNumber: 25,
    name: { en: 'Pikachu', es: 'Pikachu' },
    types: ['electric'],
    baseStats: STATS,
    formSlug: 'pikachu',
  },
  {
    slug: 'mewtwo',
    nationalDexNumber: 150,
    name: { en: 'Mewtwo', es: 'Mewtwo' },
    types: ['psychic'],
    baseStats: STATS,
    formSlug: 'mewtwo',
  },
  {
    slug: 'meowth',
    nationalDexNumber: 52,
    name: { en: 'Meowth', es: 'Meowth' },
    types: ['normal'],
    baseStats: STATS,
    formSlug: 'meowth',
  },
];

// Real Pokédex forms: Alolan Meowth is Dark-type, Galarian Meowth is
// Steel-type (species' own default is Normal).
const ALIASES: SpeciesSearchAlias[] = [
  {
    name: { en: 'Alolan Meowth', es: 'Meowth de Alola' },
    speciesSlug: 'meowth',
    types: ['dark'],
    formSlug: 'meowth-alola',
  },
  {
    name: { en: 'Galarian Meowth', es: 'Meowth de Galar' },
    speciesSlug: 'meowth',
    types: ['steel'],
    formSlug: 'meowth-galar',
  },
];

const TYPE_LABELS: Record<string, string> = {
  grass: 'Grass',
  poison: 'Poison',
  electric: 'Electric',
  psychic: 'Psychic',
  normal: 'Normal',
  dark: 'Dark',
  steel: 'Steel',
};

function renderExplorer(
  items: SpeciesSearchItem[] = ITEMS,
  aliases: SpeciesSearchAlias[] = ALIASES,
) {
  render(
    <PokemonExplorer
      locale="en"
      searchIndex={{ items, aliases }}
      defaultView={{ items, page: 1, totalPages: 1 }}
      typeLabels={TYPE_LABELS as never}
      searchLabel="Search"
      searchPlaceholder="Search Pokémon by name or #…"
      searchHelperTitle="Search by name or Pokédex number"
      searchHelperExample="Pikachu · Mew · #025"
      multipleFormsMatchTemplate="{count} forms match"
      resultCountTemplate="{count} of {total} Pokémon"
      noResultsLabel="No Pokémon match your search."
      clearSearchLabel="Clear search"
      pageLabelTemplate="Page {page} of {totalPages}"
      previousPageLabel="Previous"
      nextPageLabel="Next"
      filterLabels={{
        typeLabel: 'Type',
        allTypesLabel: 'All types',
        generationLabel: 'Generation',
        allGenerationsLabel: 'All generations',
        generationOptionTemplate: 'Generation {number}',
        sortByLabel: 'Sort',
        sortDexNumberLabel: 'Pokédex #',
        sortNameLabel: 'Name',
        sortBstLabel: 'Base stat total',
        statLabels: {
          hp: 'HP',
          attack: 'Attack',
          defense: 'Defense',
          specialAttack: 'Sp. Atk',
          specialDefense: 'Sp. Def',
          speed: 'Speed',
        },
        sortAscendingLabel: 'Ascending',
        sortDescendingLabel: 'Descending',
        clearFiltersLabel: 'Clear filters',
      }}
    />,
  );
}

function getInput() {
  return screen.getByRole('combobox', { name: 'Search' });
}

// The page now also renders native `<select>` filter/sort controls, whose
// `<option>` elements also carry an implicit ARIA "option" role — scope to
// the suggestion listbox so these queries stay unambiguous.
function getSuggestionOptions() {
  const listbox = screen.queryByRole('listbox');
  return listbox ? within(listbox).queryAllByRole('option') : [];
}

describe('PokemonExplorer search combobox', () => {
  it('shows no suggestion panel until the field is focused/typed into', () => {
    renderExplorer();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('shows a restrained helper panel on empty focus, not suggestions', () => {
    renderExplorer();
    fireEvent.focus(getInput());
    expect(screen.getByText('Search by name or Pokédex number')).not.toBeNull();
    expect(getSuggestionOptions()).toHaveLength(0);
  });

  it('shows ranked suggestions as the user types', () => {
    renderExplorer();
    fireEvent.change(getInput(), { target: { value: 'mew' } });
    const options = getSuggestionOptions();
    expect(options.map((o) => o.textContent)).toEqual([expect.stringContaining('Mewtwo')]);
  });

  it('caps the suggestion panel at MAX_POKEMON_SUGGESTIONS', () => {
    const manyItems: SpeciesSearchItem[] = Array.from({ length: 12 }, (_, i) => ({
      slug: `test-${i}`,
      nationalDexNumber: 900 + i,
      name: { en: `Testmon${i}`, es: `Testmon${i}` },
      types: ['normal'],
      baseStats: STATS,
      formSlug: `test-${i}`,
    }));
    renderExplorer(manyItems, []);
    fireEvent.change(getInput(), { target: { value: 'testmon' } });
    expect(getSuggestionOptions()).toHaveLength(MAX_POKEMON_SUGGESTIONS);
  });

  it('moves the active option with ArrowDown/ArrowUp and reflects it via aria-activedescendant', () => {
    renderExplorer();
    const input = getInput();
    fireEvent.change(input, { target: { value: 'e' } });
    const options = getSuggestionOptions();
    expect(options.length).toBeGreaterThan(1);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]!.id);
    expect(options[0]!.getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1]!.id);

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]!.id);
  });

  it('navigates to the highlighted suggestion on Enter and closes the panel', () => {
    renderExplorer();
    const input = getInput();
    fireEvent.change(input, { target: { value: 'pikachu' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(push).toHaveBeenCalledWith('/en/pokemon/pikachu');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('does nothing on Enter when no suggestion is highlighted', () => {
    renderExplorer();
    const input = getInput();
    fireEvent.change(input, { target: { value: 'pikachu' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();
  });

  it('closes the panel on Escape without clearing the query', () => {
    renderExplorer();
    const input = getInput();
    fireEvent.change(input, { target: { value: 'pikachu' } });
    expect(screen.queryByRole('listbox')).not.toBeNull();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect((input as HTMLInputElement).value).toBe('pikachu');
  });

  it('closes the suggestion panel on a mouse click of an option', () => {
    renderExplorer();
    const input = getInput();
    fireEvent.change(input, { target: { value: 'pikachu' } });
    const option = getSuggestionOptions()[0]!;
    fireEvent.click(option);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('attaches form context (the plain localized form name, no prefix) only for an unambiguous alias-driven match', () => {
    renderExplorer();
    const input = getInput();
    fireEvent.change(input, { target: { value: 'alolan meowth' } });
    // Shown in both the suggestion row and the grid card, plain, no prefix.
    expect(screen.getAllByText('Alolan Meowth').length).toBeGreaterThan(0);
  });

  it("honestly captions the grid card with the matched form's own name and types, not the default form's, when exactly one form alias matched", () => {
    renderExplorer();
    // "alola" matches only the Alolan Meowth alias, not the species name "Meowth".
    fireEvent.change(getInput(), { target: { value: 'alola' } });
    const card = screen.getByRole('link', { name: /Meowth/ });
    expect(card.textContent).toContain('Alolan Meowth');
    // The species' own default type (Normal) must not appear on this card —
    // only the matched Alolan form's type (Dark).
    expect(card.textContent).toContain('Dark');
    expect(card.textContent).not.toContain('Normal');
  });

  it('does not show a match caption or swap types when the species name itself matched', () => {
    renderExplorer();
    fireEvent.change(getInput(), { target: { value: 'meowth' } });
    expect(screen.queryByText(/forms match/)).toBeNull();
    expect(screen.queryByText('Alolan Meowth')).toBeNull();
    expect(screen.queryByText('Galarian Meowth')).toBeNull();
    const card = screen.getByRole('link', { name: /Meowth/ });
    expect(card.textContent).toContain('Normal');
  });

  it('does not arbitrarily pick one form when two of the same species\' aliases match equally — shows "N forms match" and keeps the default type/art instead', () => {
    renderExplorer();
    // "Alolan" and "Galarian" both end in "an", and both names end in
    // "Meowth" — "an meowth" ties between the two aliases, while the
    // species name "Meowth" alone doesn't contain "an" at all.
    fireEvent.change(getInput(), { target: { value: 'an meowth' } });
    expect(screen.getAllByText('2 forms match').length).toBeGreaterThan(0);
    // Never a duplicated species card, never one arbitrary form's type.
    expect(screen.getAllByRole('link', { name: /Meowth/ })).toHaveLength(1);
    const card = screen.getByRole('link', { name: /Meowth/ });
    expect(card.textContent).toContain('Normal');
    expect(card.textContent).not.toContain('Dark');
    expect(card.textContent).not.toContain('Steel');
  });

  it('narrows an ambiguous match to a single form once the query is specific enough', () => {
    renderExplorer();
    fireEvent.change(getInput(), { target: { value: 'an meowth' } });
    expect(screen.getAllByText('2 forms match').length).toBeGreaterThan(0);

    fireEvent.change(getInput(), { target: { value: 'galarian meowth' } });
    expect(screen.queryByText('2 forms match')).toBeNull();
    const card = screen.getByRole('link', { name: /Meowth/ });
    expect(card.textContent).toContain('Galarian Meowth');
    expect(card.textContent).toContain('Steel');
    expect(card.textContent).not.toContain('Normal');
  });

  it('clears the query, closes the panel, and refocuses the input via the clear button', () => {
    renderExplorer();
    const input = getInput();
    fireEvent.change(input, { target: { value: 'pikachu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect((input as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it('still filters the full Pokédex grid beneath the combobox by the same query', () => {
    renderExplorer();
    fireEvent.change(getInput(), { target: { value: 'meowth' } });
    expect(screen.getByText('1 of 4 Pokémon')).not.toBeNull();
    expect(screen.getAllByRole('link', { name: /Meowth/ }).length).toBeGreaterThan(0);
  });

  it('reflects aria-expanded true only while a panel is actually open', () => {
    renderExplorer();
    const input = getInput();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    fireEvent.focus(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('PokemonExplorer grid card sprites', () => {
  function cardSpriteSrc(name: RegExp): string | null {
    const card = screen.getByRole('link', { name });
    return card.querySelector('img')?.getAttribute('src') ?? null;
  }

  it("generates the default-form species' modern sprite URL from its own national Dex number in the default (unfiltered) grid", () => {
    renderExplorer();
    // Bulbasaur, dex #1, from the `defaultView` fixture (no search query).
    expect(cardSpriteSrc(/Bulbasaur/)).toContain('/1.png');
  });

  it('an alternate-form search match still shows the species’ own default-form sprite (task decision: modern strategy only resolves default forms) while context/types stay the matched form’s', () => {
    renderExplorer();
    fireEvent.change(getInput(), { target: { value: 'alola' } });
    const card = screen.getByRole('link', { name: /Meowth/ });
    // Meowth's own dex number (52) — never anything alias-specific (a
    // SpeciesSearchAlias carries no national Dex number of its own).
    expect(card.querySelector('img')?.getAttribute('src')).toContain('/52.png');
    // The alternate form's own name/types are unaffected by this — same
    // assertions as the non-sprite test above, kept here for the pairing.
    expect(card.textContent).toContain('Alolan Meowth');
    expect(card.textContent).toContain('Dark');
    expect(card.getAttribute('href')).toBe('/en/pokemon/meowth'); // species page, not a form page
  });

  it('an ambiguous alias match (several tied forms) still shows the species’ own default sprite', () => {
    renderExplorer();
    fireEvent.change(getInput(), { target: { value: 'an meowth' } });
    expect(cardSpriteSrc(/Meowth/)).toContain('/52.png');
  });

  it('decorative sprite <img> is present with alt="" — the card text already states the name', () => {
    renderExplorer();
    const card = screen.getByRole('link', { name: /Bulbasaur/ });
    expect(card.querySelector('img')?.getAttribute('alt')).toBe('');
  });
});
