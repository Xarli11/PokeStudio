import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PokemonMovesSection, type MoveRowItem } from './moves-section';

afterEach(cleanup);

function move(overrides: Partial<MoveRowItem> & { slug: string; name: string }): MoveRowItem {
  return {
    type: 'normal',
    typeLabel: 'Normal',
    damageClass: 'physical',
    damageClassLabel: 'Physical',
    power: 40,
    accuracy: 100,
    learnMethod: 'level-up',
    methodLabel: 'Level up',
    level: 1,
    ...overrides,
  };
}

const baseProps = {
  localePrefix: '/en',
  title: 'Moves',
  gameContextLabel: 'Showing data for Generation 9',
  noMoveDataLabel: 'No move data available for this game.',
  powerLabel: 'Power',
  accuracyLabel: 'Accuracy',
  noPowerLabel: '—',
  neverMissesLabel: 'Never misses',
  levelLabel: (level: number) => `Lv. ${level}`,
  levelOnEvolveLabel: 'On evolve',
  showAllLabel: (count: number) => `Show all ${count}`,
};

describe('PokemonMovesSection', () => {
  it('shows the empty state when there is no learnset data for the version group', () => {
    render(<PokemonMovesSection {...baseProps} moves={[]} />);
    expect(screen.queryByText('No move data available for this game.')).not.toBeNull();
  });

  it('renders a level-up move with its level, linked to the move detail route', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[move({ slug: 'tackle', name: 'Tackle', level: 1 })]}
      />,
    );
    const link = screen.getByRole('link', { name: 'Tackle' });
    expect(link.getAttribute('href')).toBe('/en/moves/tackle');
    expect(screen.queryByText('Lv. 1')).not.toBeNull();
  });

  it('shows "On evolve" for a level-up entry at level 0 instead of "Lv. 0"', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[move({ slug: 'mimic', name: 'Mimic', level: 0 })]}
      />,
    );
    expect(screen.queryByText('On evolve')).not.toBeNull();
    expect(screen.queryByText('Lv. 0')).toBeNull();
  });

  it('shows the method label (not a level) for a non-level-up move', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[
          move({
            slug: 'ancient-power',
            name: 'AncientPower',
            learnMethod: 'machine',
            methodLabel: 'Machine',
            level: 0,
          }),
        ]}
      />,
    );
    expect(screen.queryByText('Machine')).not.toBeNull();
  });

  it('renders a status move with the "no power"/"never misses" fallbacks', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[
          move({
            slug: 'toxic',
            name: 'Toxic',
            damageClass: 'status',
            damageClassLabel: 'Status',
            power: undefined,
            accuracy: 90,
          }),
        ]}
      />,
    );
    expect(screen.queryByText('Power: —')).not.toBeNull();
  });

  it('renders a move that never misses without a fake accuracy number', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[move({ slug: 'aerial-ace', name: 'Aerial Ace', accuracy: undefined })]}
      />,
    );
    expect(screen.queryByText('Accuracy: Never misses')).not.toBeNull();
  });

  it('collapses moves beyond the initial visible count behind a "show all" details element', () => {
    const manyMoves = Array.from({ length: 20 }, (_, i) =>
      move({ slug: `move-${i}`, name: `Move ${i}`, level: i + 1 }),
    );
    render(<PokemonMovesSection {...baseProps} moves={manyMoves} />);
    expect(screen.queryByText('Show all 20')).not.toBeNull();
    // The 20th move (index 19, beyond the 15-row initial view) still renders
    // — collapsed inside <details>, not omitted from the DOM.
    expect(screen.queryByText('Move 19')).not.toBeNull();
  });

  it('does not show a "show all" toggle when every move already fits', () => {
    render(
      <PokemonMovesSection {...baseProps} moves={[move({ slug: 'tackle', name: 'Tackle' })]} />,
    );
    expect(screen.queryByText(/Show all/)).toBeNull();
  });
});
