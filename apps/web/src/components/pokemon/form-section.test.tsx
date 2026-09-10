import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PokemonFormSection } from './form-section';

const statLabels = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  specialAttack: 'Sp. Atk',
  specialDefense: 'Sp. Def',
  speed: 'Speed',
};

afterEach(cleanup);

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
        abilities={[]}
        abilitiesLabel="Abilities"
        hiddenAbilityLabel="Hidden Ability"
        noAbilityDescriptionLabel="No description available."
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
        abilities={[]}
        abilitiesLabel="Abilities"
        hiddenAbilityLabel="Hidden Ability"
        noAbilityDescriptionLabel="No description available."
      />,
    );

    expect(screen.queryByRole('heading', { level: 3, name: 'Alolan Meowth' })).not.toBeNull();
    expect(screen.queryByText('Regional form')).not.toBeNull();
    expect(screen.queryByText('Dark')).not.toBeNull();
  });

  it('renders regular abilities and visually distinguishes the hidden ability', () => {
    render(
      <PokemonFormSection
        id="bulbasaur"
        name="Bulbasaur"
        types={[{ type: 'grass', label: 'Grass' }]}
        stats={{
          hp: 45,
          attack: 49,
          defense: 49,
          specialAttack: 65,
          specialDefense: 65,
          speed: 45,
        }}
        statLabels={statLabels}
        typesLabel="Types"
        baseStatsLabel="Base stats"
        abilities={[
          {
            slug: 'overgrow',
            name: 'Overgrow',
            description: 'Powers up Grass moves.',
            isHidden: false,
          },
          { slug: 'chlorophyll', name: 'Chlorophyll', description: undefined, isHidden: true },
        ]}
        abilitiesLabel="Abilities"
        hiddenAbilityLabel="Hidden Ability"
        noAbilityDescriptionLabel="No description available."
      />,
    );

    expect(screen.queryByText('Overgrow')).not.toBeNull();
    expect(screen.queryByText('Powers up Grass moves.')).not.toBeNull();
    expect(screen.queryByText('Chlorophyll')).not.toBeNull();
    expect(screen.queryByText('Hidden Ability')).not.toBeNull();
    expect(screen.queryByText('No description available.')).not.toBeNull();
  });

  it('omits the abilities heading entirely when a form has no abilities', () => {
    render(
      <PokemonFormSection
        id="test-mon"
        name="Test Mon"
        types={[{ type: 'normal', label: 'Normal' }]}
        stats={{ hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 }}
        statLabels={statLabels}
        typesLabel="Types"
        baseStatsLabel="Base stats"
        abilities={[]}
        abilitiesLabel="Abilities"
        hiddenAbilityLabel="Hidden Ability"
        noAbilityDescriptionLabel="No description available."
      />,
    );

    expect(screen.queryByText('Abilities')).toBeNull();
  });
});
