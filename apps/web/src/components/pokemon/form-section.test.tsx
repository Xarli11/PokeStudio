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
  it('renders types/stats for the primary (default) form without a redundant name heading', () => {
    render(
      <PokemonFormSection
        id="rotom"
        name="Rotom"
        categoryLabel="Default form"
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
        baseStatTotalLabel="Base stat total"
        abilities={[]}
        abilitiesLabel="Abilities"
        hiddenAbilityLabel="Hidden Ability"
        noAbilityDescriptionLabel="No description available."
        fallbackLanguageLabel="English"
        statTierLabels={{ low: 'Low', average: 'Average', good: 'Good', excellent: 'Excellent' }}
        variant="primary"
      />,
    );

    // The page's own <h1> already names the species — the primary form
    // shows its name as plain text, not a redundant heading.
    expect(screen.queryByRole('heading', { name: 'Rotom' })).toBeNull();
    expect(screen.queryByText('Rotom')).not.toBeNull();
    expect(screen.queryByText('Default form')).not.toBeNull();
    expect(screen.queryByText('Electric')).not.toBeNull();
    expect(screen.queryByText('Ghost')).not.toBeNull();
    expect(screen.queryByText('91')).not.toBeNull(); // speed
    // Base stat total is a derived sum (50+50+77+95+77+91), shown once for the primary form.
    expect(screen.queryByText('440')).not.toBeNull();
    expect(screen.queryByText('Base stat total')).not.toBeNull();
  });

  it('shows a category label and a heading for a non-default (secondary) form (regional Meowth shape)', () => {
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
        baseStatTotalLabel="Base stat total"
        abilities={[]}
        abilitiesLabel="Abilities"
        hiddenAbilityLabel="Hidden Ability"
        noAbilityDescriptionLabel="No description available."
        fallbackLanguageLabel="English"
        statTierLabels={{ low: 'Low', average: 'Average', good: 'Good', excellent: 'Excellent' }}
        variant="secondary"
      />,
    );

    expect(screen.queryByRole('heading', { level: 3, name: 'Alolan Meowth' })).not.toBeNull();
    expect(screen.queryByText('Regional form')).not.toBeNull();
    expect(screen.queryByText('Dark')).not.toBeNull();
    // The base stat total summary is primary-only — secondary (other form)
    // cards stay compact and don't repeat it.
    expect(screen.queryByText('Base stat total')).toBeNull();
  });

  it('renders regular abilities and visually distinguishes the hidden ability', () => {
    render(
      <PokemonFormSection
        id="bulbasaur"
        name="Bulbasaur"
        categoryLabel="Default form"
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
        baseStatTotalLabel="Base stat total"
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
        fallbackLanguageLabel="English"
        statTierLabels={{ low: 'Low', average: 'Average', good: 'Good', excellent: 'Excellent' }}
        variant="primary"
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
        categoryLabel="Default form"
        types={[{ type: 'normal', label: 'Normal' }]}
        stats={{ hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 }}
        statLabels={statLabels}
        typesLabel="Types"
        baseStatsLabel="Base stats"
        baseStatTotalLabel="Base stat total"
        abilities={[]}
        abilitiesLabel="Abilities"
        hiddenAbilityLabel="Hidden Ability"
        noAbilityDescriptionLabel="No description available."
        fallbackLanguageLabel="English"
        statTierLabels={{ low: 'Low', average: 'Average', good: 'Good', excellent: 'Excellent' }}
        variant="primary"
      />,
    );

    expect(screen.queryByText('Abilities')).toBeNull();
  });

  it('groups type badges under an accessible group label instead of a visible "Types" heading', () => {
    render(
      <PokemonFormSection
        id="charizard"
        name="Charizard"
        categoryLabel="Default form"
        types={[
          { type: 'fire', label: 'Fire' },
          { type: 'flying', label: 'Flying' },
        ]}
        stats={{
          hp: 78,
          attack: 84,
          defense: 78,
          specialAttack: 109,
          specialDefense: 85,
          speed: 100,
        }}
        statLabels={statLabels}
        typesLabel="Types"
        baseStatsLabel="Base stats"
        baseStatTotalLabel="Base stat total"
        abilities={[]}
        abilitiesLabel="Abilities"
        hiddenAbilityLabel="Hidden Ability"
        noAbilityDescriptionLabel="No description available."
        fallbackLanguageLabel="English"
        statTierLabels={{ low: 'Low', average: 'Average', good: 'Good', excellent: 'Excellent' }}
        variant="primary"
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Types' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Types' })).not.toBeNull();
    expect(screen.queryByText('Fire')).not.toBeNull();
    expect(screen.queryByText('Flying')).not.toBeNull();
  });
});
