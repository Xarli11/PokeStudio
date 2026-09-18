import { getDictionary } from '@pokelab/i18n';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { EvolutionFamily } from '@pokelab/database';

import { PokemonEvolutionSection } from './evolution-section';

const dictionary = getDictionary('en');
const dictionaryEs = getDictionary('es');

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

  it('renders a branching family (Eevee) as one parent fanning out to every branch, not repeated per row', () => {
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

    // The whole point of the fan-out redesign (Phase 1C.2b): the parent
    // renders exactly once, not once per branch.
    expect(screen.queryAllByText('Eevee')).toHaveLength(1);
    expect(screen.queryByText('Vaporeon')).not.toBeNull();
    expect(screen.queryByText('Jolteon')).not.toBeNull();
    expect(screen.queryByText('Flareon')).not.toBeNull();
    expect(screen.queryByText(/Water Stone/)).not.toBeNull();
    expect(screen.queryByText(/Thunder Stone/)).not.toBeNull();
    expect(screen.queryByText(/Fire Stone/)).not.toBeNull();
  });

  it('keeps a multi-condition edge (Feebas -> Milotic) grouped under one branch with both alternatives shown', () => {
    const family: EvolutionFamily = {
      members: [
        { slug: 'feebas', nationalDexNumber: 349, name: { en: 'Feebas', es: 'Feebas' } },
        { slug: 'milotic', nationalDexNumber: 350, name: { en: 'Milotic', es: 'Milotic' } },
      ],
      edges: [
        {
          fromSpeciesSlug: 'feebas',
          toSpeciesSlug: 'milotic',
          condition: {
            trigger: 'level-up',
            minBeauty: 170,
            needsOverworldRain: false,
            turnUpsideDown: false,
          },
        },
        {
          fromSpeciesSlug: 'feebas',
          toSpeciesSlug: 'milotic',
          condition: {
            trigger: 'trade',
            heldItemSlug: 'prism-scale',
            needsOverworldRain: false,
            turnUpsideDown: false,
          },
        },
      ],
    };
    render(<PokemonEvolutionSection family={family} locale="en" dictionary={dictionary} />);

    expect(screen.queryAllByText('Feebas')).toHaveLength(1);
    expect(screen.queryAllByText('Milotic')).toHaveLength(1);
    expect(screen.queryByText(/Beauty 170\+/)).not.toBeNull();
    expect(screen.queryByText(/Prism Scale/)).not.toBeNull();
    expect(screen.queryByText('or')).not.toBeNull();
  });

  it('renders localized Spanish condition text for a level-up + item chain', () => {
    const family: EvolutionFamily = {
      members: [
        { slug: 'eevee', nationalDexNumber: 133, name: { en: 'Eevee', es: 'Eevee' } },
        { slug: 'vaporeon', nationalDexNumber: 134, name: { en: 'Vaporeon', es: 'Vaporeon' } },
        { slug: 'umbreon', nationalDexNumber: 197, name: { en: 'Umbreon', es: 'Umbreon' } },
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
          toSpeciesSlug: 'umbreon',
          condition: {
            trigger: 'level-up',
            minHappiness: 220,
            timeOfDay: 'night',
            needsOverworldRain: false,
            turnUpsideDown: false,
          },
        },
      ],
    };
    render(<PokemonEvolutionSection family={family} locale="es" dictionary={dictionaryEs} />);

    expect(screen.queryAllByText('Eevee')).toHaveLength(1); // fan-out, not repeated
    expect(screen.queryByText('Vaporeon')).not.toBeNull();
    expect(screen.queryByText('Umbreon')).not.toBeNull();
    expect(screen.queryByText(/Piedra Agua/)).not.toBeNull();
    expect(screen.queryByText(/amistad 220\+/)).not.toBeNull();
    expect(screen.queryByText(/de noche/)).not.toBeNull();
  });
});
