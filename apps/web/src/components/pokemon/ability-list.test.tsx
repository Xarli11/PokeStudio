import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PokemonAbilityList } from './ability-list';

afterEach(cleanup);

const baseProps = {
  hiddenAbilityLabel: 'Hidden Ability',
  noDescriptionLabel: 'No description available.',
  fallbackLanguageLabel: 'English',
};

describe('PokemonAbilityList', () => {
  it('renders a description available in the current locale without a fallback tag', () => {
    render(
      <PokemonAbilityList
        {...baseProps}
        abilities={[
          {
            slug: 'overgrow',
            name: 'Espesura',
            description: 'Aumenta el poder de los movimientos de tipo Planta.',
            isHidden: false,
          },
        ]}
      />,
    );
    expect(
      screen.queryByText('Aumenta el poder de los movimientos de tipo Planta.'),
    ).not.toBeNull();
    expect(screen.queryByText('English')).toBeNull();
  });

  it('shows the English effect text with a fallback tag when Spanish is unavailable (real PokéAPI gap: 0/313 abilities)', () => {
    render(
      <PokemonAbilityList
        {...baseProps}
        abilities={[
          {
            slug: 'overgrow',
            name: 'Overgrow',
            description: 'Powers up Grass-type moves in a pinch.',
            descriptionIsFallback: true,
            isHidden: false,
          },
        ]}
      />,
    );
    expect(screen.queryByText('Powers up Grass-type moves in a pinch.')).not.toBeNull();
    expect(screen.queryByText('English')).not.toBeNull();
  });

  it('shows the unavailable state, not a blank, when neither language has a description', () => {
    render(
      <PokemonAbilityList
        {...baseProps}
        abilities={[{ slug: 'test-ability', name: 'Test Ability', isHidden: false }]}
      />,
    );
    expect(screen.queryByText('No description available.')).not.toBeNull();
    expect(screen.queryByText('English')).toBeNull();
  });
});
