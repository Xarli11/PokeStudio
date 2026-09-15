import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MoveSummary } from '@pokestudio/database';

import { MovePicker, type MovePickerLabels } from './move-picker';

afterEach(cleanup);

const TYPE_LABELS: Record<string, string> = {
  normal: 'Normal',
  fire: 'Fire',
  psychic: 'Psychic',
  fighting: 'Fighting',
};

const LABELS: MovePickerLabels = {
  searchLabel: "Search this form's moves…",
  noResultsLabel: 'No moves match these filters.',
  typeFilterLabel: 'Type',
  allTypesLabel: 'All types',
  damageClassFilterLabel: 'Category',
  allDamageClassesLabel: 'All categories',
  damageClassLabels: { physical: 'Physical', special: 'Special', status: 'Status' },
  noPowerLabel: '—',
  alreadySelectedLabel: 'Already on this Pokémon',
  cancelLabel: 'Cancel',
};

function move(overrides: Partial<MoveSummary> & Pick<MoveSummary, 'slug' | 'nameEn'>): MoveSummary {
  return { type: 'normal', damageClass: 'physical', pp: 15, priority: 0, ...overrides };
}

const PSYCHIC: MoveSummary = move({
  slug: 'psychic',
  nameEn: 'Psychic',
  nameEs: 'Psíquico',
  type: 'psychic',
  damageClass: 'special',
  power: 90,
});
const FLAMETHROWER: MoveSummary = move({
  slug: 'flamethrower',
  nameEn: 'Flamethrower',
  nameEs: 'Lanzallamas',
  type: 'fire',
  damageClass: 'special',
  power: 90,
});
const TACKLE: MoveSummary = move({
  slug: 'tackle',
  nameEn: 'Tackle',
  nameEs: 'Placaje',
  type: 'normal',
  damageClass: 'physical',
  power: 40,
});
const DETECT: MoveSummary = move({
  slug: 'detect',
  nameEn: 'Detect',
  nameEs: 'Detección',
  type: 'fighting',
  damageClass: 'status',
});

const MOVES = [PSYCHIC, FLAMETHROWER, TACKLE, DETECT];

function renderPicker(
  options: {
    locale?: 'en' | 'es';
    selectedMoveSlugs?: string[];
    onSelect?: (slug: string) => void;
    onClose?: () => void;
  } = {},
) {
  const onSelect = options.onSelect ?? vi.fn();
  const onClose = options.onClose ?? vi.fn();
  render(
    <MovePicker
      locale={options.locale ?? 'en'}
      moves={MOVES}
      typeLabels={TYPE_LABELS as never}
      selectedMoveSlugs={options.selectedMoveSlugs ?? []}
      labels={LABELS}
      onSelect={onSelect}
      onClose={onClose}
    />,
  );
  return { onSelect, onClose };
}

function getSearchInput() {
  return screen.getByRole('combobox', { name: "Search this form's moves…" });
}

// The Type/Category filters are native `<select>`s whose `<option>`
// elements also carry an implicit ARIA "option" role — scope to the
// picker's own listbox so these queries stay unambiguous.
function getMoveOptions() {
  return within(screen.getByRole('listbox')).queryAllByRole('option');
}

function getMoveOption(name: RegExp) {
  return within(screen.getByRole('listbox')).getByRole('option', { name });
}

describe('MovePicker', () => {
  it('shows every legal move when the search is empty', () => {
    renderPicker();
    expect(getMoveOptions()).toHaveLength(4);
  });

  it('finds a move by its localized (Spanish) name', () => {
    renderPicker({ locale: 'es' });
    fireEvent.change(getSearchInput(), { target: { value: 'lanzallamas' } });
    const options = getMoveOptions();
    expect(options).toHaveLength(1);
    expect(options[0]!.textContent).toContain('Lanzallamas'); // localized name shown, not the English source name
  });

  it('finds a move by its English/source name', () => {
    renderPicker();
    fireEvent.change(getSearchInput(), { target: { value: 'flamethrower' } });
    expect(getMoveOptions()).toHaveLength(1);
  });

  it('is case-insensitive', () => {
    renderPicker();
    fireEvent.change(getSearchInput(), { target: { value: 'FLAMETHROWER' } });
    expect(getMoveOptions()).toHaveLength(1);
  });

  it('filters by type', () => {
    renderPicker();
    fireEvent.change(screen.getByRole('combobox', { name: 'Type' }), {
      target: { value: 'fire' },
    });
    const options = getMoveOptions();
    expect(options).toHaveLength(1);
    expect(options[0]!.textContent).toContain('Flamethrower');
  });

  it('filters by damage class', () => {
    renderPicker();
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), {
      target: { value: 'status' },
    });
    const options = getMoveOptions();
    expect(options).toHaveLength(1);
    expect(options[0]!.textContent).toContain('Detect');
  });

  it('combines search and a filter', () => {
    renderPicker();
    fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), {
      target: { value: 'special' },
    });
    fireEvent.change(getSearchInput(), { target: { value: 'psy' } });
    const options = getMoveOptions();
    expect(options).toHaveLength(1);
    expect(options[0]!.textContent).toContain('Psychic');
  });

  it('marks an already-selected move as disabled and refuses to select it again', () => {
    const { onSelect } = renderPicker({ selectedMoveSlugs: ['tackle'] });
    const tackleOption = getMoveOption(/Tackle/);
    expect(tackleOption.hasAttribute('disabled')).toBe(true);
    expect(tackleOption.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(tackleOption);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('selects a move via mouse click', () => {
    const { onSelect } = renderPicker();
    fireEvent.click(getMoveOption(/Tackle/));
    expect(onSelect).toHaveBeenCalledWith('tackle');
  });

  it('selects the highlighted move via ArrowDown + Enter', () => {
    const { onSelect } = renderPicker();
    const input = getSearchInput();
    // Alphabetical order: Detect, Flamethrower, Psychic, Tackle.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('detect');
  });

  it('does not select anything on Enter when nothing is highlighted', () => {
    const { onSelect } = renderPicker();
    fireEvent.keyDown(getSearchInput(), { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const { onClose } = renderPicker();
    fireEvent.keyDown(getSearchInput(), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes via the cancel button', () => {
    const { onClose } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a "no results" message instead of an empty list', () => {
    renderPicker();
    fireEvent.change(getSearchInput(), { target: { value: 'this move does not exist' } });
    expect(getMoveOptions()).toHaveLength(0);
    expect(screen.getByText('No moves match these filters.')).not.toBeNull();
  });
});
