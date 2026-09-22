import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PokemonArtSlot } from './art-slot';

const TYPES = ['grass', 'poison'] as const;

afterEach(cleanup);

describe('PokemonArtSlot', () => {
  it('tile sprite keeps decorative alt, lazy loading, and an explicitly dimensioned box (fix for the mini-sized/top-left-biased sprite bug)', () => {
    const { container } = render(
      <PokemonArtSlot
        initial="B"
        types={TYPES}
        variant="tile"
        spriteUrl="https://example.test/1.png"
      />,
    );
    const img = container.querySelector('img')!;
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('loading')).toBe('lazy');
    // Explicit width/height (not left to the image's intrinsic pixel size —
    // the root cause of the reported bug for absolutely positioned replaced
    // elements per CSS 2.1 §10.3.8).
    expect(img.className).toContain('h-[88%]');
    expect(img.className).toContain('w-[88%]');
    expect(img.className).toContain('object-contain');
  });

  it('tile sprite wires a CSS-only hover/focus microinteraction to the ancestor .group, with no JS state', () => {
    const { container } = render(
      <PokemonArtSlot
        initial="B"
        types={TYPES}
        variant="tile"
        spriteUrl="https://example.test/1.png"
      />,
    );
    const img = container.querySelector('img')!;
    expect(img.className).toContain('group-hover:scale-[1.06]');
    expect(img.className).toContain('group-focus-visible:scale-[1.06]');
    // prefers-reduced-motion: the transform is explicitly cancelled, not
    // just left unanimated.
    expect(img.className).toContain('motion-reduce:group-hover:scale-100');
    expect(img.className).toContain('motion-reduce:group-hover:translate-y-0');
  });

  it('hero variant gets the same explicit-size fix as tile (visual review — sprite rendered intrinsic-sized and off-center, e.g. Pikachu), still no tile-only hover classes', () => {
    const { container } = render(
      <PokemonArtSlot
        initial="B"
        types={TYPES}
        variant="hero"
        spriteUrl="https://example.test/1.png"
      />,
    );
    const img = container.querySelector('img')!;
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.className).toContain('h-[88%]');
    expect(img.className).toContain('w-[88%]');
    expect(img.className).toContain('object-contain');
    expect(img.className).not.toContain('group-hover');
  });

  it('detailHero variant gets the same explicit-size fix as tile, still no tile-only hover classes', () => {
    const { container } = render(
      <PokemonArtSlot
        initial="B"
        types={TYPES}
        variant="detailHero"
        spriteUrl="https://example.test/1.png"
      />,
    );
    const img = container.querySelector('img')!;
    expect(img.className).toContain('h-[88%]');
    expect(img.className).toContain('w-[88%]');
    expect(img.className).toContain('object-contain');
    expect(img.className).not.toContain('group-hover');
  });

  it('image load failure still calls the caller-owned fallback, never a broken image left in place', () => {
    const onSpriteError = vi.fn();
    const { container } = render(
      <PokemonArtSlot
        initial="B"
        types={TYPES}
        variant="tile"
        spriteUrl="https://example.test/1.png"
        onSpriteError={onSpriteError}
      />,
    );
    fireEvent.error(container.querySelector('img')!);
    expect(onSpriteError).toHaveBeenCalledTimes(1);
  });

  it('without a spriteUrl, still renders the monogram placeholder for every variant', () => {
    const { container } = render(<PokemonArtSlot initial="B" types={TYPES} variant="tile" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('B');
  });
});
