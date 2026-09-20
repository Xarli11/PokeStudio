import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { middleware } from './middleware';

function request(path: string): NextRequest {
  return new NextRequest(new URL(path, 'https://pokestudio.pro'));
}

describe('middleware — case-insensitive canonical entity routes (Phase 1C.3 §13)', () => {
  it('redirects an uppercase Pokémon slug to lowercase, permanently', () => {
    const response = middleware(request('/es/pokemon/MEW'));
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://pokestudio.pro/es/pokemon/mew');
  });

  it('redirects a mixed-case Pokémon slug to lowercase', () => {
    const response = middleware(request('/es/pokemon/Mew'));
    expect(response.headers.get('location')).toBe('https://pokestudio.pro/es/pokemon/mew');
  });

  it('redirects an uppercase move slug to lowercase', () => {
    const response = middleware(request('/es/moves/TACKLE'));
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://pokestudio.pro/es/moves/tackle');
  });

  it('redirects an uppercase ability slug to lowercase', () => {
    const response = middleware(request('/es/abilities/OVERGROW'));
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://pokestudio.pro/es/abilities/overgrow');
  });

  it('preserves the locale and query string across the redirect', () => {
    const response = middleware(request('/en/moves/TACKLE?learnersPage=2'));
    expect(response.headers.get('location')).toBe(
      'https://pokestudio.pro/en/moves/tackle?learnersPage=2',
    );
  });

  it('does not redirect an already-lowercase slug', () => {
    const response = middleware(request('/es/pokemon/mew'));
    expect(response.status).not.toBe(308);
    expect(response.headers.get('location')).toBeNull();
  });

  it('does not touch an index route (no slug segment)', () => {
    const response = middleware(request('/es/pokemon'));
    expect(response.headers.get('location')).toBeNull();
  });

  it('still redirects a locale-less path to a locale-prefixed one (existing behavior, unaffected)', () => {
    const response = middleware(request('/pokemon/mew'));
    expect(response.headers.get('location')).toMatch(
      /^https:\/\/pokestudio\.pro\/(en|es)\/pokemon\/mew$/,
    );
  });
});
