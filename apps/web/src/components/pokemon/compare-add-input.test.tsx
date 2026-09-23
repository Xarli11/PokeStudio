import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SpeciesSearchAlias, SpeciesSearchItem } from '@pokestudio/database';

import { CompareAddInput } from './compare-add-input';

afterEach(cleanup);

const TYPE_LABELS: Record<string, string> = { fire: 'Fire', flying: 'Flying' };

const LABELS = {
  searchLabel: 'Search Pokémon by name or #…',
  searchPlaceholder: 'Search Pokémon by name or #…',
  multipleFormsMatchTemplate: '{count} forms match',
  ambiguousHint: 'Type more of the name to pick one form.',
  noResultsLabel: 'No Pokémon match your search.',
};

// Deliberately longer than any real single-word species name — the exact
// kind of string that used to collapse to "Ch..."/"C..." (visual review)
// once the dex number and two type badges shared its row.
const LONG_NAME_ITEM: SpeciesSearchItem = {
  slug: 'charizard-mega-y',
  formSlug: 'charizard-mega-y',
  nationalDexNumber: 6,
  name: { en: 'Charizard Mega Evolution Y Form', es: 'Charizard Megaevolución Y' },
  types: ['fire', 'flying'],
  baseStats: { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 },
  pokeapiPokemonId: 10035,
};

function renderInput(searchIndex: { items: SpeciesSearchItem[]; aliases: SpeciesSearchAlias[] }) {
  const onAdd = vi.fn();
  render(
    <CompareAddInput
      locale="en"
      searchIndex={searchIndex}
      typeLabels={TYPE_LABELS}
      onAdd={onAdd}
      searchLabel={LABELS.searchLabel}
      searchPlaceholder={LABELS.searchPlaceholder}
      multipleFormsMatchTemplate={LABELS.multipleFormsMatchTemplate}
      ambiguousHintLabel={LABELS.ambiguousHint}
      noResultsLabel={LABELS.noResultsLabel}
    />,
  );
  return { onAdd };
}

describe('CompareAddInput result row (visual review — names collapsing to "Ch...")', () => {
  it('renders a long name in full, not truncated to a couple characters', () => {
    renderInput({ items: [LONG_NAME_ITEM], aliases: [] });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'charizard mega' } });

    const option = screen.getByRole('option', { name: /Charizard Mega Evolution Y Form/ });
    expect(option.textContent).toContain('Charizard Mega Evolution Y Form');
  });

  it('gives the name its own row so it never competes with type badges for width', () => {
    renderInput({ items: [LONG_NAME_ITEM], aliases: [] });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'charizard mega' } });

    const option = screen.getByRole('option', { name: /Charizard Mega Evolution Y Form/ });
    const nameEl = screen.getByText('Charizard Mega Evolution Y Form');
    const badgeEls = option.querySelectorAll('[class*="rounded-full"]');
    // Name and badges are structurally siblings-of-siblings (separate rows),
    // never inside the same flex row competing for width.
    expect(nameEl.parentElement).not.toBe(badgeEls[0]?.parentElement);
  });

  it('still selects the long-named form on click', () => {
    const { onAdd } = renderInput({ items: [LONG_NAME_ITEM], aliases: [] });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'charizard mega' } });
    fireEvent.click(screen.getByRole('option', { name: /Charizard Mega Evolution Y Form/ }));
    expect(onAdd).toHaveBeenCalledWith('charizard-mega-y');
  });
});
