import { describe, expect, it } from 'vitest';

import type { MoveSummary } from '@pokestudio/database';

import { moveDisplayName, searchMoves } from './move-search';

const EN_TYPE_LABELS = {
  normal: 'Normal',
  fire: 'Fire',
  water: 'Water',
  electric: 'Electric',
  grass: 'Grass',
  ice: 'Ice',
  fighting: 'Fighting',
  poison: 'Poison',
  ground: 'Ground',
  flying: 'Flying',
  psychic: 'Psychic',
  bug: 'Bug',
  rock: 'Rock',
  ghost: 'Ghost',
  dragon: 'Dragon',
  dark: 'Dark',
  steel: 'Steel',
  fairy: 'Fairy',
} as const;

const ES_TYPE_LABELS = {
  normal: 'Normal',
  fire: 'Fuego',
  water: 'Agua',
  electric: 'Eléctrico',
  grass: 'Planta',
  ice: 'Hielo',
  fighting: 'Lucha',
  poison: 'Veneno',
  ground: 'Tierra',
  flying: 'Volador',
  psychic: 'Psíquico',
  bug: 'Bicho',
  rock: 'Roca',
  ghost: 'Fantasma',
  dragon: 'Dragón',
  dark: 'Siniestro',
  steel: 'Acero',
  fairy: 'Hada',
} as const;

const EN_DAMAGE_CLASS_LABELS = {
  physical: 'Physical',
  special: 'Special',
  status: 'Status',
} as const;
const ES_DAMAGE_CLASS_LABELS = {
  physical: 'Físico',
  special: 'Especial',
  status: 'Estado',
} as const;

function move(overrides: Partial<MoveSummary> & Pick<MoveSummary, 'slug' | 'nameEn'>): MoveSummary {
  return {
    type: 'normal',
    damageClass: 'physical',
    pp: 15,
    priority: 0,
    ...overrides,
  };
}

const PSYCHIC: MoveSummary = move({
  slug: 'psychic',
  nameEn: 'Psychic',
  nameEs: 'Psíquico',
  type: 'psychic',
  damageClass: 'special',
  power: 90,
  accuracy: 100,
});
const PSYBEAM: MoveSummary = move({
  slug: 'psybeam',
  nameEn: 'Psybeam',
  nameEs: 'Psicorrayo',
  type: 'psychic',
  damageClass: 'special',
  power: 65,
  accuracy: 100,
});
const FLAMETHROWER: MoveSummary = move({
  slug: 'flamethrower',
  nameEn: 'Flamethrower',
  nameEs: 'Lanzallamas',
  type: 'fire',
  damageClass: 'special',
  power: 90,
  accuracy: 100,
});
const TACKLE: MoveSummary = move({
  slug: 'tackle',
  nameEn: 'Tackle',
  nameEs: 'Placaje',
  type: 'normal',
  damageClass: 'physical',
  power: 40,
  accuracy: 100,
});
const AMNESIA: MoveSummary = move({
  slug: 'amnesia',
  nameEn: 'Amnesia',
  nameEs: 'Amnesia',
  type: 'psychic',
  damageClass: 'status',
});
/** A move with an accented Spanish name that does NOT also collide with any type/damage-class label, so the accent-insensitivity test exercises name-matching in isolation. */
const DETECT: MoveSummary = move({
  slug: 'detect',
  nameEn: 'Detect',
  nameEs: 'Detección',
  type: 'fighting',
  damageClass: 'status',
});

const MOVES = [PSYCHIC, PSYBEAM, FLAMETHROWER, TACKLE, AMNESIA, DETECT];

function search(query: string, filters = {}, locale: 'en' | 'es' = 'en') {
  const typeLabels = locale === 'es' ? ES_TYPE_LABELS : EN_TYPE_LABELS;
  const damageClassLabels = locale === 'es' ? ES_DAMAGE_CLASS_LABELS : EN_DAMAGE_CLASS_LABELS;
  return searchMoves(MOVES, query, locale, typeLabels, damageClassLabels, filters).map(
    (m) => m.slug,
  );
}

describe('searchMoves', () => {
  it('returns everything (filter-narrowed), alphabetically, for an empty query', () => {
    expect(search('')).toEqual([
      'amnesia',
      'detect',
      'flamethrower',
      'psybeam',
      'psychic',
      'tackle',
    ]);
  });

  it('finds a move by its localized (Spanish) name', () => {
    expect(search('lanzallamas', {}, 'es')).toEqual(['flamethrower']);
  });

  it('finds a move by its English/source name even in the es locale', () => {
    expect(search('flamethrower', {}, 'es')).toEqual(['flamethrower']);
  });

  it('is case-insensitive', () => {
    expect(search('FLAMETHROWER')).toEqual(['flamethrower']);
    expect(search('FlameThrower')).toEqual(['flamethrower']);
  });

  it('is accent-insensitive', () => {
    expect(search('deteccion', {}, 'es')).toEqual(['detect']);
    expect(search('detección', {}, 'es')).toEqual(['detect']);
  });

  it('ranks tiers correctly: exact name > startsWith > contains-only', () => {
    // Isolated from PSYCHIC/PSYBEAM's real-data quirk (the Psychic *type*
    // label happens to equal the Psychic *move* name) — a synthetic trio
    // sharing no type/damage-class label with the query.
    const exact = move({ slug: 'foo-exact', nameEn: 'Foo', type: 'grass' });
    const startsWith = move({ slug: 'foo-starts', nameEn: 'Foobar', type: 'grass' });
    const contains = move({ slug: 'foo-contains', nameEn: 'Barfoo', type: 'grass' });
    const result = searchMoves(
      [contains, startsWith, exact],
      'foo',
      'en',
      EN_TYPE_LABELS,
      EN_DAMAGE_CLASS_LABELS,
      {},
    );
    expect(result.map((m) => m.slug)).toEqual(['foo-exact', 'foo-starts', 'foo-contains']);
  });

  it('finds moves by type name typed in the search box', () => {
    // No move is literally named "psychic" other than the Psychic move
    // itself, which also matches by name — assert the type-only matches
    // (Psybeam, Amnesia) are included too, ranked after the name match.
    const result = search('psychic');
    expect(result).toContain('psychic');
    // "psychic" also equals the type label, so Psybeam/Amnesia (Psychic-type,
    // non-matching name) should still appear via the meta-tier fallback.
    expect(result).toEqual(['psychic', 'amnesia', 'psybeam']);
  });

  it('finds moves by damage class name typed in the search box', () => {
    // Both status moves match via the damage-class meta-tier; alphabetical
    // by Spanish name (Amnesia < Detección).
    expect(search('estado', {}, 'es')).toEqual(['amnesia', 'detect']);
  });

  it('filters by type', () => {
    expect(search('', { type: 'psychic' })).toEqual(['amnesia', 'psybeam', 'psychic']);
  });

  it('filters by damage class', () => {
    expect(search('', { damageClass: 'status' })).toEqual(['amnesia', 'detect']);
  });

  it('composes search and filters together', () => {
    // Type=fire narrows the candidates first, then "flame" ranks within
    // that narrowed set — Tackle (normal-type) is excluded by the filter
    // regardless of matching nothing by name anyway.
    expect(search('flame', { type: 'fire' })).toEqual(['flamethrower']);
  });

  it('never ranks by power', () => {
    // Psychic (power 90) and Psybeam (power 65) both match "psy" at the
    // same name tier (startsWith) — alphabetical tie-break puts Psybeam
    // first regardless of its lower power.
    const result = search('psy');
    expect(result.indexOf('psybeam')).toBeLessThan(result.indexOf('psychic'));
  });

  it('handles a large (Mew-sized) learnset without truncating results', () => {
    const bigLearnset: MoveSummary[] = Array.from({ length: 234 }, (_, i) =>
      move({ slug: `move-${i}`, nameEn: `Move ${i}`, type: 'normal' }),
    );
    bigLearnset.push(FLAMETHROWER);
    const result = searchMoves(bigLearnset, '', 'en', EN_TYPE_LABELS, EN_DAMAGE_CLASS_LABELS, {});
    expect(result).toHaveLength(235);
    const filtered = searchMoves(
      bigLearnset,
      'flame',
      'en',
      EN_TYPE_LABELS,
      EN_DAMAGE_CLASS_LABELS,
      {},
    );
    expect(filtered.map((m) => m.slug)).toEqual(['flamethrower']);
  });
});

describe('moveDisplayName', () => {
  it('prefers the localized name in es, falling back to English if absent', () => {
    expect(moveDisplayName(FLAMETHROWER, 'es')).toBe('Lanzallamas');
    expect(moveDisplayName(move({ slug: 'x', nameEn: 'X' }), 'es')).toBe('X');
  });

  it('always uses English in en regardless of nameEs', () => {
    expect(moveDisplayName(FLAMETHROWER, 'en')).toBe('Flamethrower');
  });
});
