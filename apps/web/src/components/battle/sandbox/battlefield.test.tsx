import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { getDictionary } from '@pokestudio/i18n';
import type {
  BattlePokemonState,
  BattleSideId,
  BattleState,
} from '@pokestudio/battle-engine/types';

import { Battlefield } from './battlefield';

afterEach(cleanup);

const labels = {
  ...getDictionary('en').battle.sandbox.battle,
  inspectTemplate: getDictionary('en').battle.sandbox.details.inspectTemplate,
};
const typeNames = getDictionary('en').types;

const mon = (side: BattleSideId, teamIndex: number, species: string): BattlePokemonState => ({
  ref: { side, teamIndex },
  species,
  level: 50,
  gender: 'N',
  hp: { kind: 'percent', percent: 100 },
  status: null,
  fainted: false,
  active: true,
  boosts: {},
  volatiles: [],
  revealed: { ability: false, item: false, moves: [] },
});

const side = (id: BattleSideId, species: string[]) => ({
  id,
  displayName: id,
  teamSize: species.length,
  pokemonLeft: species.length,
  active: species.map((name, i) => mon(id, i, name)),
  team: species.map((name, i) => mon(id, i, name)),
  sideConditions: [],
});

const doubles = {
  perspective: 'p1',
  gameType: 'doubles',
  field: { weather: null, terrain: null, pseudoWeather: [] },
  sides: {
    p1: side('p1', ['Garchomp', 'Rotom-Wash']),
    p2: side('p2', ['Incineroar', 'Amoonguss']),
  },
} as unknown as BattleState;

const tag = (name: string) => screen.getByTestId(name).getAttribute('data-highlight');

describe('Battlefield highlights while choosing a target', () => {
  const targets = [
    { side: 'p2' as const, position: 0 },
    { side: 'p2' as const, position: 1 },
  ];
  const renderWith = (selected: (typeof targets)[number] | null) =>
    render(
      <Battlefield
        state={doubles}
        labels={{
          ...labels,
          hpLabel: 'HP',
          levelTemplate: 'Lv. {level}',
          teraTemplate: 'Tera {type}',
        }}
        typeNames={typeNames}
        names={null}
        focus={{ actor: { side: 'p1', position: 0 }, targets, selected }}
      />,
    );

  it('marks the actor and every legal target, and nothing else', () => {
    renderWith(null);
    expect(tag('pokemon-p1-0')).toBe('actor');
    expect(tag('pokemon-p2-0')).toBe('target');
    expect(tag('pokemon-p2-1')).toBe('target');
    expect(screen.getByTestId('pokemon-p1-1').getAttribute('data-highlight')).toBeNull();
    expect(screen.getAllByText(labels.targetTag)).toHaveLength(2);
    expect(screen.getByText(labels.actingTag)).toBeTruthy();
  });

  it('shows the chosen target more strongly than a possible one', () => {
    renderWith(targets[1]!);
    expect(tag('pokemon-p2-1')).toBe('selected');
    expect(tag('pokemon-p2-0')).toBe('target');
    expect(tag('pokemon-p1-0')).toBe('actor');
    expect(screen.getByText(labels.selectedTag)).toBeTruthy();
    expect(screen.getAllByText(labels.targetTag)).toHaveLength(1);
  });
});
