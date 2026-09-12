import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VersionGroupSelect } from './version-group-select';

afterEach(cleanup);

const options = [
  {
    slug: 'scarlet-violet',
    label: 'Generation 9 — Scarlet / Violet',
    name: 'Scarlet / Violet',
    generation: 9,
  },
  {
    slug: 'sword-shield',
    label: 'Generation 8 — Sword / Shield',
    name: 'Sword / Shield',
    generation: 8,
  },
];

describe('VersionGroupSelect', () => {
  it('renders nothing when there are no version groups at all', () => {
    const { container } = render(
      <VersionGroupSelect
        label="Game"
        options={[]}
        selectedSlug={undefined}
        allMovesLabel="All moves"
        onChange={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls onChange with the version-group slug — never a router navigation', () => {
    const onChange = vi.fn();
    render(
      <VersionGroupSelect
        label="Game"
        options={options}
        selectedSlug="scarlet-violet"
        allMovesLabel="All moves"
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'sword-shield' } });
    expect(onChange).toHaveBeenCalledWith({ versionGroupSlug: 'sword-shield' });
  });

  it('calls onChange with allMoves:true when "All moves" is selected', () => {
    const onChange = vi.fn();
    render(
      <VersionGroupSelect
        label="Game"
        options={options}
        selectedSlug="scarlet-violet"
        allMovesLabel="All moves"
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '__all__' } });
    expect(onChange).toHaveBeenCalledWith({ allMoves: true });
  });

  it('reflects an undefined selectedSlug (All moves is current) as the All-moves option', () => {
    render(
      <VersionGroupSelect
        label="Game"
        options={options}
        selectedSlug={undefined}
        allMovesLabel="All moves"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe('__all__');
  });
});
