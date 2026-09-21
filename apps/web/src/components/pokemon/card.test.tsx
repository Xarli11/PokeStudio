import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PokemonCard } from './card';

const BULBASAUR_TYPES = [
  { type: 'grass', label: 'Grass' },
  { type: 'poison', label: 'Poison' },
] as const;

afterEach(cleanup);

describe('PokemonCard', () => {
  it('renders the localized name, dex number and type labels, linking to the detail page', () => {
    render(
      <PokemonCard
        href="/en/pokemon/bulbasaur"
        name="Bulbasaur"
        dexNumberLabel="#001"
        types={[...BULBASAUR_TYPES]}
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

  it('without a spriteUrl, keeps the monogram fallback — no <img> in the art slot', () => {
    render(
      <PokemonCard
        href="/en/pokemon/bulbasaur"
        name="Bulbasaur"
        dexNumberLabel="#001"
        types={[...BULBASAUR_TYPES]}
      />,
    );

    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('B')).not.toBeNull(); // the monogram initial
  });

  it('with a spriteUrl, renders a decorative, lazy-loaded sprite image instead of the monogram', () => {
    render(
      <PokemonCard
        href="/en/pokemon/bulbasaur"
        name="Bulbasaur"
        dexNumberLabel="#001"
        types={[...BULBASAUR_TYPES]}
        spriteUrl="https://example.test/1.png"
      />,
    );

    const sprite = document.querySelector('img');
    expect(sprite).not.toBeNull();
    expect(sprite?.getAttribute('src')).toBe('https://example.test/1.png');
    expect(sprite?.getAttribute('alt')).toBe(''); // decorative — the card already states the name
    expect(sprite?.getAttribute('loading')).toBe('lazy');
    expect(screen.queryByText('B')).toBeNull(); // monogram not also rendered
  });

  it('falls back to the monogram if the sprite image itself fails to load', () => {
    render(
      <PokemonCard
        href="/en/pokemon/bulbasaur"
        name="Bulbasaur"
        dexNumberLabel="#001"
        types={[...BULBASAUR_TYPES]}
        spriteUrl="https://example.test/1.png"
      />,
    );

    fireEvent.error(document.querySelector('img')!);

    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('B')).not.toBeNull();
  });
});
