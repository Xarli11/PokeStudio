import { getDictionary } from '@pokestudio/i18n';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { EvolutionFamily } from '@pokestudio/database';

import { PokemonEvolutionSection } from './evolution-section';

const dictionary = getDictionary('en');

afterEach(cleanup);

describe('PokemonEvolutionSection', () => {
  it('shows a "does not evolve" message for a species with no evolution family (Ditto)', () => {
    const family: EvolutionFamily = {
      members: [{ slug: 'ditto', nationalDexNumber: 132, name: { en: 'Ditto', es: 'Ditto' } }],
      edges: [],
    };
    render(<PokemonEvolutionSection family={family} locale="en" dictionary={dictionary} />);
    expect(screen.queryByText('Ditto does not evolve.')).not.toBeNull();
  });

  it('renders a linear chain as from -> to rows with a condition', () => {
    const family: EvolutionFamily = {
      members: [
        { slug: 'bulbasaur', nationalDexNumber: 1, name: { en: 'Bulbasaur', es: 'Bulbasaur' } },
        { slug: 'ivysaur', nationalDexNumber: 2, name: { en: 'Ivysaur', es: 'Ivysaur' } },
        { slug: 'venusaur', nationalDexNumber: 3, name: { en: 'Venusaur', es: 'Venusaur' } },
      ],
      edges: [
        {
          fromSpeciesSlug: 'bulbasaur',
          toSpeciesSlug: 'ivysaur',
          condition: {
            trigger: 'level-up',
            minLevel: 16,
            needsOverworldRain: false,
            turnUpsideDown: false,
          },
        },
        {
          fromSpeciesSlug: 'ivysaur',
          toSpeciesSlug: 'venusaur',
          condition: {
            trigger: 'level-up',
            minLevel: 32,
            needsOverworldRain: false,
            turnUpsideDown: false,
          },
        },
      ],
    };
    render(<PokemonEvolutionSection family={family} locale="en" dictionary={dictionary} />);

    expect(screen.queryAllByText('Bulbasaur')).toHaveLength(1);
    // Ivysaur appears twice: as the "to" of row 1 and the "from" of row 2 — expected for a row-per-edge flow.
    expect(screen.queryAllByText('Ivysaur')).toHaveLength(2);
    expect(screen.queryAllByText('Venusaur')).toHaveLength(1);
    expect(screen.queryByText(/at level 16/)).not.toBeNull();
    expect(screen.queryByText(/at level 32/)).not.toBeNull();
  });

  it('renders every branch of a branching family (Eevee) as its own row', () => {
    const family: EvolutionFamily = {
      members: [
        { slug: 'eevee', nationalDexNumber: 133, name: { en: 'Eevee', es: 'Eevee' } },
        { slug: 'vaporeon', nationalDexNumber: 134, name: { en: 'Vaporeon', es: 'Vaporeon' } },
        { slug: 'jolteon', nationalDexNumber: 135, name: { en: 'Jolteon', es: 'Jolteon' } },
        { slug: 'flareon', nationalDexNumber: 136, name: { en: 'Flareon', es: 'Flareon' } },
      ],
      edges: [
        {
          fromSpeciesSlug: 'eevee',
          toSpeciesSlug: 'vaporeon',
          condition: {
            trigger: 'use-item',
            itemSlug: 'water-stone',
            needsOverworldRain: false,
            turnUpsideDown: false,
          },
        },
        {
          fromSpeciesSlug: 'eevee',
          toSpeciesSlug: 'jolteon',
          condition: {
            trigger: 'use-item',
            itemSlug: 'thunder-stone',
            needsOverworldRain: false,
            turnUpsideDown: false,
          },
        },
        {
          fromSpeciesSlug: 'eevee',
          toSpeciesSlug: 'flareon',
          condition: {
            trigger: 'use-item',
            itemSlug: 'fire-stone',
            needsOverworldRain: false,
            turnUpsideDown: false,
          },
        },
      ],
    };
    render(<PokemonEvolutionSection family={family} locale="en" dictionary={dictionary} />);

    expect(screen.queryAllByText('Eevee')).toHaveLength(3); // one per branch row
    expect(screen.queryByText('Vaporeon')).not.toBeNull();
    expect(screen.queryByText('Jolteon')).not.toBeNull();
    expect(screen.queryByText('Flareon')).not.toBeNull();
  });
});
