import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PokemonCard } from './card';

describe('PokemonCard', () => {
  it('renders the localized name, dex number and type labels, linking to the detail page', () => {
    render(
      <PokemonCard
        href="/en/pokemon/bulbasaur"
        name="Bulbasaur"
        dexNumberLabel="#001"
        types={[
          { type: 'grass', label: 'Grass' },
          { type: 'poison', label: 'Poison' },
        ]}
      />,
    );

    expect(screen.queryByText('Bulbasaur')).not.toBeNull();
    expect(screen.queryByText('#001')).not.toBeNull();
    expect(screen.queryByText('Grass')).not.toBeNull();
    expect(screen.queryByText('Poison')).not.toBeNull();
    expect(screen.getByRole('link', { name: /Bulbasaur/ }).getAttribute('href')).toBe(
      '/en/pokemon/bulbasaur',
    );
  });
});
