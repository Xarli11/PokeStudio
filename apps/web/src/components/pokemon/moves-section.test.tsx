import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { FormLearnsetAllEntry } from '@pokestudio/database';

import { PokemonMovesSection, type MovesExplorerMove } from './moves-section';

afterEach(cleanup);

function move(
  overrides: Partial<MovesExplorerMove> & { slug: string; name: string },
): MovesExplorerMove {
  return {
    type: 'normal',
    damageClass: 'physical',
    power: 40,
    accuracy: 100,
    pp: 35,
    ...overrides,
  };
}

function entry(overrides: Partial<FormLearnsetAllEntry> = {}): FormLearnsetAllEntry {
  return {
    moveSlug: 'tackle',
    versionGroupSlug: 'scarlet-violet',
    learnMethod: 'level-up',
    level: 1,
    ...overrides,
  };
}

const versionGroups = [
  {
    slug: 'scarlet-violet',
    label: 'Generation 9 — Scarlet / Violet',
    name: 'Scarlet / Violet',
    generation: 9,
  },
];

const baseProps = {
  entries: [] as FormLearnsetAllEntry[],
  versionGroups,
  initialVersionGroupSlug: 'scarlet-violet',
  localePrefix: '/en',
  title: 'Moves',
  versionGroupLabel: 'Game',
  allMovesLabel: 'All moves',
  allMovesHint:
    'Moves this form can learn in at least one supported game — not all legal together.',
  noMoveDataLabel: 'No move data available for this game.',
  noResultsLabel: 'No moves match these filters.',
  resultCountTemplate: '{count} of {total} moves',
  searchLabel: 'Search',
  searchPlaceholder: 'Search moves…',
  allTypesLabel: 'All types',
  allDamageClassesLabel: 'All categories',
  allMethodsLabel: 'All methods',
  typeLabels: {
    normal: 'Normal',
    electric: 'Electric',
    poison: 'Poison',
    rock: 'Rock',
    ground: 'Ground',
  } as Record<string, string>,
  damageClassLabels: { physical: 'Physical', special: 'Special', status: 'Status' } as Record<
    string,
    string
  >,
  methodLabels: { 'level-up': 'Level up', machine: 'Machine', tutor: 'Tutor' } as Record<
    string,
    string
  >,
  typeFilterLabel: 'Type',
  damageClassFilterLabel: 'Category',
  methodFilterLabel: 'Method',
  columnLabels: {
    name: 'Name',
    type: 'Type',
    category: 'Category',
    power: 'Power',
    accuracy: 'Accuracy',
    pp: 'PP',
    method: 'Method',
    level: 'Level',
    games: 'Games',
  },
  noPowerLabel: '—',
  neverMissesLabel: 'Never misses',
  levelTemplate: 'Lv. {level}',
  levelRangeTemplate: 'Lv. {min}–{max}',
  levelOnEvolveLabel: 'On evolve',
  levelNotApplicableLabel: '—',
  gamesCountTemplate: '{count} games',
  gamesSummarySameGenerationTemplate: '{count} games · Gen. {number}',
  gamesSummaryRangeTemplate: '{count} games · Gen. {min}–{max}',
  generationLabelTemplate: 'Generation {number}',
  methodsSummaryTemplate: '{primary} +{count}',
  methodsSummaryAriaLabelTemplate: '{primary}, and {count} more methods',
} as const;

describe('PokemonMovesSection', () => {
  it('shows the empty state when the form has no learnset data anywhere', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[]}
        versionGroups={[]}
        initialVersionGroupSlug={undefined}
      />,
    );
    expect(screen.queryByText('No move data available for this game.')).not.toBeNull();
  });

  it('renders a move linked to its detail route, with the result count', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[move({ slug: 'tackle', name: 'Tackle' })]}
        entries={[entry({ moveSlug: 'tackle' })]}
      />,
    );
    const links = screen.getAllByRole('link', { name: 'Tackle' }); // one per layout (table + mobile card)
    expect(links.every((l) => l.getAttribute('href') === '/en/moves/tackle')).toBe(true);
    expect(screen.queryByText('1 of 1 moves')).not.toBeNull();
  });

  it('shows "On evolve" for a level-up entry at level 0 instead of "Lv. 0"', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[
          move({
            slug: 'mimic',
            name: 'Mimic',
            damageClass: 'status',
            power: undefined,
            accuracy: undefined,
          }),
        ]}
        entries={[entry({ moveSlug: 'mimic', level: 0 })]}
      />,
    );
    expect(screen.queryAllByText('On evolve').length).toBeGreaterThan(0);
  });

  it('shows "—" for level on a non-level-up move, never a misleading 0', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[
          move({
            slug: 'ancient-power',
            name: 'AncientPower',
            type: 'rock',
            damageClass: 'special',
            power: 60,
          }),
        ]}
        entries={[entry({ moveSlug: 'ancient-power', learnMethod: 'machine', level: 0 })]}
      />,
    );
    expect(screen.queryByText('0')).toBeNull();
  });

  it('renders a status move with the "no power"/"never misses" fallbacks, never a fake 0', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[
          move({
            slug: 'toxic',
            name: 'Toxic',
            damageClass: 'status',
            power: undefined,
            accuracy: undefined,
          }),
        ]}
        entries={[entry({ moveSlug: 'toxic' })]}
      />,
    );
    expect(screen.queryAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Never misses').length).toBeGreaterThan(0);
  });

  it('filters by text search across move names', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[
          move({ slug: 'tackle', name: 'Tackle' }),
          move({
            slug: 'thunderbolt',
            name: 'Thunderbolt',
            type: 'electric',
            damageClass: 'special',
          }),
        ]}
        entries={[entry({ moveSlug: 'tackle' }), entry({ moveSlug: 'thunderbolt' })]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'thunder' } });
    expect(screen.getAllByRole('link', { name: 'Thunderbolt' })).toHaveLength(2);
    expect(screen.queryAllByRole('link', { name: 'Tackle' })).toHaveLength(0);
    expect(screen.queryByText('1 of 2 moves')).not.toBeNull();
  });

  it('filters by type', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[
          move({ slug: 'tackle', name: 'Tackle', type: 'normal' }),
          move({
            slug: 'thunderbolt',
            name: 'Thunderbolt',
            type: 'electric',
            damageClass: 'special',
          }),
        ]}
        entries={[entry({ moveSlug: 'tackle' }), entry({ moveSlug: 'thunderbolt' })]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'electric' } });
    expect(screen.getAllByRole('link', { name: 'Thunderbolt' })).toHaveLength(2);
    expect(screen.queryAllByRole('link', { name: 'Tackle' })).toHaveLength(0);
  });

  it('filters by damage class', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[
          move({ slug: 'tackle', name: 'Tackle', damageClass: 'physical' }),
          move({
            slug: 'toxic',
            name: 'Toxic',
            damageClass: 'status',
            power: undefined,
            accuracy: undefined,
          }),
        ]}
        entries={[entry({ moveSlug: 'tackle' }), entry({ moveSlug: 'toxic' })]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'status' } });
    expect(screen.getAllByRole('link', { name: 'Toxic' })).toHaveLength(2);
    expect(screen.queryAllByRole('link', { name: 'Tackle' })).toHaveLength(0);
  });

  it('filters by learn method', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[
          move({ slug: 'tackle', name: 'Tackle' }),
          move({ slug: 'dig', name: 'Dig', type: 'ground', power: 80 }),
        ]}
        entries={[
          entry({ moveSlug: 'tackle', learnMethod: 'level-up' }),
          entry({ moveSlug: 'dig', learnMethod: 'machine', level: 0 }),
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Method'), { target: { value: 'machine' } });
    expect(screen.getAllByRole('link', { name: 'Dig' })).toHaveLength(2);
    expect(screen.queryAllByRole('link', { name: 'Tackle' })).toHaveLength(0);
  });

  it('shows the no-results state when filters match nothing, distinct from no learnset data at all', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[move({ slug: 'tackle', name: 'Tackle' })]}
        entries={[entry({ moveSlug: 'tackle' })]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'nonexistent-move-xyz' },
    });
    expect(screen.queryByText('No moves match these filters.')).not.toBeNull();
    expect(screen.queryByText('No move data available for this game.')).toBeNull();
  });

  it('sorts by power when the Power column header is activated, toggling direction on repeat clicks', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[
          move({ slug: 'weak', name: 'Weak Move', power: 20 }),
          move({ slug: 'strong', name: 'Strong Move', power: 150 }),
        ]}
        entries={[entry({ moveSlug: 'weak' }), entry({ moveSlug: 'strong' })]}
      />,
    );
    const table = screen.getByRole('table');
    fireEvent.click(within(table).getByText('Power'));
    let rows = within(table).getAllByRole('row').slice(1); // skip header row
    expect(within(rows[0]!).queryByText('Weak Move')).not.toBeNull();
    fireEvent.click(within(table).getByText('Power')); // toggle to descending
    rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]!).queryByText('Strong Move')).not.toBeNull();
  });

  it('sorts moves with no power after every move with a real power value', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[
          move({
            slug: 'toxic',
            name: 'Toxic',
            power: undefined,
            accuracy: undefined,
            damageClass: 'status',
          }),
          move({ slug: 'tackle', name: 'Tackle', power: 40 }),
        ]}
        entries={[entry({ moveSlug: 'toxic' }), entry({ moveSlug: 'tackle' })]}
      />,
    );
    const table = screen.getByRole('table');
    fireEvent.click(within(table).getByText('Power'));
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]!).queryByText('Tackle')).not.toBeNull();
    expect(within(rows[1]!).queryByText('Toxic')).not.toBeNull();
  });

  it('renders a desktop table and a mobile card list for the same data (only one visible per breakpoint via CSS)', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[move({ slug: 'tackle', name: 'Tackle' })]}
        entries={[entry({ moveSlug: 'tackle' })]}
      />,
    );
    expect(screen.getByRole('table')).not.toBeNull();
    expect(screen.getAllByRole('link', { name: 'Tackle' })).toHaveLength(2); // one per layout
  });

  it('switches version group via plain client state — no navigation, data updates immediately', () => {
    const twoGroups = [
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
    render(
      <PokemonMovesSection
        {...baseProps}
        versionGroups={twoGroups}
        moves={[
          move({ slug: 'tackle', name: 'Tackle' }),
          move({
            slug: 'growl',
            name: 'Growl',
            power: undefined,
            accuracy: 100,
            damageClass: 'status',
          }),
        ]}
        entries={[
          entry({ moveSlug: 'tackle', versionGroupSlug: 'scarlet-violet' }),
          entry({ moveSlug: 'growl', versionGroupSlug: 'sword-shield' }),
        ]}
      />,
    );
    expect(screen.getAllByRole('link', { name: 'Tackle' }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('link', { name: 'Growl' })).toHaveLength(0);

    fireEvent.change(screen.getByLabelText('Game'), { target: { value: 'sword-shield' } });

    expect(screen.getAllByRole('link', { name: 'Growl' }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('link', { name: 'Tackle' })).toHaveLength(0);
  });

  it('"All moves" aggregates a move learnable in multiple games instead of showing it once per game', () => {
    const twoGroups = [
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
    render(
      <PokemonMovesSection
        {...baseProps}
        versionGroups={twoGroups}
        moves={[move({ slug: 'tackle', name: 'Tackle' })]}
        entries={[
          entry({ moveSlug: 'tackle', versionGroupSlug: 'scarlet-violet', level: 1 }),
          entry({ moveSlug: 'tackle', versionGroupSlug: 'sword-shield', level: 3 }),
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Game'), { target: { value: '__all__' } });
    expect(screen.getAllByRole('link', { name: 'Tackle' })).toHaveLength(2); // one row, table + card
    expect(screen.queryByText('1 of 1 moves')).not.toBeNull();
    // Different levels in different games — a range, never one invented single level.
    expect(screen.queryAllByText('Lv. 1–3').length).toBeGreaterThan(0);
  });

  it('shows the "All moves" clarifying hint only while All moves is selected', () => {
    render(
      <PokemonMovesSection
        {...baseProps}
        moves={[move({ slug: 'tackle', name: 'Tackle' })]}
        entries={[entry({ moveSlug: 'tackle' })]}
      />,
    );
    expect(screen.queryByText(baseProps.allMovesHint)).toBeNull();
    fireEvent.change(screen.getByLabelText('Game'), { target: { value: '__all__' } });
    expect(screen.queryByText(baseProps.allMovesHint)).not.toBeNull();
  });

  describe('"All moves" games cell', () => {
    const fourGroups = [
      {
        slug: 'scarlet-violet',
        label: 'Generation 9 — Scarlet / Violet',
        name: 'Scarlet / Violet',
        generation: 9,
      },
      { slug: 'champions', label: 'Generation 9 — Champions', name: 'Champions', generation: 9 },
      {
        slug: 'sword-shield',
        label: 'Generation 8 — Sword / Shield',
        name: 'Sword / Shield',
        generation: 8,
      },
      { slug: 'sun-moon', label: 'Generation 7 — Sun / Moon', name: 'Sun / Moon', generation: 7 },
    ];

    function renderAllMoves(entries: FormLearnsetAllEntry[]) {
      render(
        <PokemonMovesSection
          {...baseProps}
          versionGroups={fourGroups}
          initialVersionGroupSlug="scarlet-violet"
          moves={[move({ slug: 'tackle', name: 'Tackle' })]}
          entries={entries}
        />,
      );
      fireEvent.change(screen.getByLabelText('Game'), { target: { value: '__all__' } });
    }

    it('shows the single game name directly, with no popover, for a move learnable in exactly one game', () => {
      renderAllMoves([entry({ moveSlug: 'tackle', versionGroupSlug: 'scarlet-violet' })]);
      expect(screen.getAllByText('Scarlet / Violet').length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: /Scarlet \/ Violet/ })).toBeNull();
    });

    it('summarizes multiple games in the same generation without a range', () => {
      renderAllMoves([
        entry({ moveSlug: 'tackle', versionGroupSlug: 'scarlet-violet' }),
        entry({ moveSlug: 'tackle', versionGroupSlug: 'champions' }),
      ]);
      expect(screen.getAllByRole('button', { name: '2 games · Gen. 9' }).length).toBeGreaterThan(0);
    });

    it('summarizes games spanning generations as a range', () => {
      renderAllMoves([
        entry({ moveSlug: 'tackle', versionGroupSlug: 'scarlet-violet' }),
        entry({ moveSlug: 'tackle', versionGroupSlug: 'sword-shield' }),
        entry({ moveSlug: 'tackle', versionGroupSlug: 'sun-moon' }),
      ]);
      expect(screen.getAllByRole('button', { name: '3 games · Gen. 7–9' }).length).toBeGreaterThan(
        0,
      );
    });

    it('opens a popover grouped by generation, never repeating a generation heading per game', () => {
      renderAllMoves([
        entry({ moveSlug: 'tackle', versionGroupSlug: 'scarlet-violet' }),
        entry({ moveSlug: 'tackle', versionGroupSlug: 'champions' }),
        entry({ moveSlug: 'tackle', versionGroupSlug: 'sword-shield' }),
      ]);
      const [trigger] = screen.getAllByRole('button', { name: '3 games · Gen. 8–9' });
      fireEvent.click(trigger!);
      expect(screen.getAllByText('Generation 9')).toHaveLength(1);
      expect(screen.getAllByText('Generation 8')).toHaveLength(1);
      expect(screen.getByText('Scarlet / Violet')).not.toBeNull();
      expect(screen.getByText('Champions')).not.toBeNull();
      expect(screen.getByText('Sword / Shield')).not.toBeNull();
    });

    it('does not resize the row when the popover is closed — no inline expansion', () => {
      renderAllMoves([
        entry({ moveSlug: 'tackle', versionGroupSlug: 'scarlet-violet' }),
        entry({ moveSlug: 'tackle', versionGroupSlug: 'champions' }),
      ]);
      // Closed: only the trigger is present, no list of game names rendered inline.
      expect(screen.queryByText('Champions')).toBeNull();
    });
  });

  describe('"All moves" method cell', () => {
    it('renders a single method plainly, with no popover', () => {
      render(
        <PokemonMovesSection
          {...baseProps}
          moves={[move({ slug: 'tackle', name: 'Tackle' })]}
          entries={[entry({ moveSlug: 'tackle', learnMethod: 'level-up', level: 5 })]}
        />,
      );
      fireEvent.change(screen.getByLabelText('Game'), { target: { value: '__all__' } });
      expect(screen.getAllByText('Level up (Lv. 5)').length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: /Level up/ })).toBeNull();
    });

    it('collapses multiple methods to a compact "{primary} +{count}" trigger', () => {
      render(
        <PokemonMovesSection
          {...baseProps}
          moves={[move({ slug: 'tackle', name: 'Tackle' })]}
          entries={[
            entry({
              moveSlug: 'tackle',
              versionGroupSlug: 'scarlet-violet',
              learnMethod: 'level-up',
              level: 5,
            }),
            entry({
              moveSlug: 'tackle',
              versionGroupSlug: 'scarlet-violet',
              learnMethod: 'machine',
              level: 0,
            }),
          ]}
        />,
      );
      fireEvent.change(screen.getByLabelText('Game'), { target: { value: '__all__' } });
      expect(screen.getAllByText('Level up +1').length).toBeGreaterThan(0);
      expect(
        screen.getAllByRole('button', { name: 'Level up, and 1 more methods' }).length,
      ).toBeGreaterThan(0);
    });

    it('reveals every method, still accessible, once the popover opens', () => {
      render(
        <PokemonMovesSection
          {...baseProps}
          moves={[move({ slug: 'tackle', name: 'Tackle' })]}
          entries={[
            entry({
              moveSlug: 'tackle',
              versionGroupSlug: 'scarlet-violet',
              learnMethod: 'level-up',
              level: 5,
            }),
            entry({
              moveSlug: 'tackle',
              versionGroupSlug: 'scarlet-violet',
              learnMethod: 'machine',
              level: 0,
            }),
            entry({
              moveSlug: 'tackle',
              versionGroupSlug: 'scarlet-violet',
              learnMethod: 'tutor',
              level: 0,
            }),
          ]}
        />,
      );
      fireEvent.change(screen.getByLabelText('Game'), { target: { value: '__all__' } });
      const [trigger] = screen.getAllByRole('button', { name: 'Level up, and 2 more methods' });
      fireEvent.click(trigger!);
      expect(screen.getByText('Level up (Lv. 5)')).not.toBeNull();
      // "Machine"/"Tutor" also appear as plain <option> text in the method
      // filter <select> — assert presence, not uniqueness, here.
      expect(screen.getAllByText('Machine').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Tutor').length).toBeGreaterThan(0);
    });
  });
});
