import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PokemonFormSection } from './form-section';

const statLabels = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  specialAttack: 'Sp. Atk',
  specialDefense: 'Sp. Def',
  speed: 'Speed',
};

describe('PokemonFormSection', () => {
  it('renders types/stats and omits a category label for the default form', () => {
    render(
      <PokemonFormSection
        id="rotom"
        name="Rotom"
        types={[
          { type: 'electric', label: 'Electric' },
          { type: 'ghost', label: 'Ghost' },
        ]}
        stats={{
          hp: 50,
          attack: 50,
          defense: 77,
          specialAttack: 95,
          specialDefense: 77,
          speed: 91,
        }}
        statLabels={statLabels}
        typesLabel="Types"
        baseStatsLabel="Base stats"
      />,
    );

    expect(screen.queryByRole('heading', { level: 3, name: 'Rotom' })).not.toBeNull();
    expect(screen.queryByText('Electric')).not.toBeNull();
    expect(screen.queryByText('Ghost')).not.toBeNull();
    expect(screen.queryByText('91')).not.toBeNull(); // speed
    expect(screen.queryByText(/form/i)).toBeNull();
  });

  it('shows a category label for a non-default form (regional Meowth shape)', () => {
    render(
      <PokemonFormSection
        id="meowth-alola"
        name="Alolan Meowth"
        categoryLabel="Regional form"
        types={[{ type: 'dark', label: 'Dark' }]}
        stats={{
          hp: 40,
          attack: 35,
          defense: 35,
          specialAttack: 50,
          specialDefense: 40,
          speed: 90,
        }}
        statLabels={statLabels}
        typesLabel="Types"
        baseStatsLabel="Base stats"
      />,
    );

    expect(screen.queryByRole('heading', { level: 3, name: 'Alolan Meowth' })).not.toBeNull();
    expect(screen.queryByText('Regional form')).not.toBeNull();
    expect(screen.queryByText('Dark')).not.toBeNull();
  });
});
