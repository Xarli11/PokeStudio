import { describe, expect, it } from 'vitest';

import type { SpeciesSearchAlias, SpeciesSearchItem } from '@pokelab/database';

import {
  MAX_POKEMON_SUGGESTIONS,
  applyPokemonIndexFilters,
  dexNumberLabel,
  filterSpeciesSearchIndex,
  getPokemonSuggestions,
  parsePokemonQuery,
  type SpeciesSearchMatch,
} from './pokemon-search';

// Fixture base stats are irrelevant to every test in this file except the
// dedicated filter/sort suite below (which sets its own per-item values) —
// one flat, neutral spread keeps every other fixture's intent readable.
const STATS = { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 };

const ITEMS: SpeciesSearchItem[] = [
  {
    slug: 'bulbasaur',
    nationalDexNumber: 1,
    name: { en: 'Bulbasaur', es: 'Bulbasaur' },
    types: ['grass', 'poison'],
    baseStats: STATS,
    formSlug: 'bulbasaur',
  },
  {
    slug: 'pikachu',
    nationalDexNumber: 25,
    name: { en: 'Pikachu', es: 'Pikachu' },
    types: ['electric'],
    baseStats: STATS,
    formSlug: 'pikachu',
  },
  {
    slug: 'mewtwo',
    nationalDexNumber: 150,
    name: { en: 'Mewtwo', es: 'Mewtwo' },
    types: ['psychic'],
    baseStats: STATS,
    formSlug: 'mewtwo',
  },
  {
    slug: 'meowth',
    nationalDexNumber: 52,
    name: { en: 'Meowth', es: 'Meowth' },
    types: ['normal'],
    baseStats: STATS,
    formSlug: 'meowth',
  },
];

// Real Pokédex forms: Alolan Meowth is Dark-type, Galarian Meowth is Steel-type.
const ALIASES: SpeciesSearchAlias[] = [
  {
    name: { en: 'Alolan Meowth', es: 'Meowth de Alola' },
    speciesSlug: 'meowth',
    types: ['dark'],
    formSlug: 'meowth-alola',
  },
  {
    name: { en: 'Galarian Meowth', es: 'Meowth de Galar' },
    speciesSlug: 'meowth',
    types: ['steel'],
    formSlug: 'meowth-galar',
  },
];

describe('parsePokemonQuery', () => {
  it('classifies an empty/whitespace-only query as empty', () => {
    expect(parsePokemonQuery('')).toEqual({ kind: 'empty' });
    expect(parsePokemonQuery('   ')).toEqual({ kind: 'empty' });
  });

  it('parses a plain number as a dex number', () => {
    expect(parsePokemonQuery('25')).toEqual({ kind: 'dexNumber', value: 25 });
  });

  it('parses a leading-zero number as the same dex number', () => {
    expect(parsePokemonQuery('025')).toEqual({ kind: 'dexNumber', value: 25 });
    expect(parsePokemonQuery('0025')).toEqual({ kind: 'dexNumber', value: 25 });
  });

  it('strips a leading "#" before parsing a dex number', () => {
    expect(parsePokemonQuery('#25')).toEqual({ kind: 'dexNumber', value: 25 });
    expect(parsePokemonQuery('#025')).toEqual({ kind: 'dexNumber', value: 25 });
    expect(parsePokemonQuery('#150')).toEqual({ kind: 'dexNumber', value: 150 });
  });

  it('treats non-digit text as a text query, case/whitespace-normalized', () => {
    expect(parsePokemonQuery('  Bulbasaur  ')).toEqual({ kind: 'text', value: 'bulbasaur' });
    expect(parsePokemonQuery('Mr   Mime')).toEqual({ kind: 'text', value: 'mr mime' });
  });
});

describe('filterSpeciesSearchIndex', () => {
  it('returns nothing for an empty query', () => {
    expect(filterSpeciesSearchIndex(ITEMS, ALIASES, '', 'en')).toEqual([]);
  });

  it('matches the English name, case-insensitively, in the en locale', () => {
    expect(
      filterSpeciesSearchIndex(ITEMS, ALIASES, 'bulbasaur', 'en').map((m) => m.item.slug),
    ).toEqual(['bulbasaur']);
    expect(
      filterSpeciesSearchIndex(ITEMS, ALIASES, 'PIKACHU', 'en').map((m) => m.item.slug),
    ).toEqual(['pikachu']);
  });

  it('matches by exact dex number', () => {
    expect(filterSpeciesSearchIndex(ITEMS, ALIASES, '25', 'en').map((m) => m.item.slug)).toEqual([
      'pikachu',
    ]);
    expect(filterSpeciesSearchIndex(ITEMS, ALIASES, '#150', 'en').map((m) => m.item.slug)).toEqual([
      'mewtwo',
    ]);
    expect(filterSpeciesSearchIndex(ITEMS, ALIASES, '025', 'en').map((m) => m.item.slug)).toEqual([
      'pikachu',
    ]);
  });

  it('returns empty for a dex number nothing matches', () => {
    expect(filterSpeciesSearchIndex(ITEMS, ALIASES, '999', 'en')).toEqual([]);
  });

  it('returns empty for text nothing matches', () => {
    expect(filterSpeciesSearchIndex(ITEMS, ALIASES, 'zzz-not-a-pokemon', 'en')).toEqual([]);
  });

  it('resolves a non-default form-name search (English) to its owning species, once — never a separate entry', () => {
    const result = filterSpeciesSearchIndex(ITEMS, ALIASES, 'Alolan Meowth', 'en');
    expect(result.map((m) => m.item.slug)).toEqual(['meowth']);

    const galarian = filterSpeciesSearchIndex(ITEMS, ALIASES, 'galarian meowth', 'en');
    expect(galarian.map((m) => m.item.slug)).toEqual(['meowth']);
  });

  it('does not duplicate a species matched by both its own name and a form alias', () => {
    // "meowth" matches the species name directly AND is a token in both aliases.
    const result = filterSpeciesSearchIndex(ITEMS, ALIASES, 'meowth', 'en');
    expect(result.map((m) => m.item.slug)).toEqual(['meowth']);
  });

  it('orders results by national Dex number', () => {
    const result = filterSpeciesSearchIndex(ITEMS, ALIASES, 'e', 'en');
    const dexNumbers = result.map((m) => m.item.nationalDexNumber);
    expect(dexNumbers).toEqual([...dexNumbers].sort((a, b) => a - b));
  });

  it('is accent-insensitive in both directions', () => {
    const items: SpeciesSearchItem[] = [
      {
        slug: 'accentmon',
        nationalDexNumber: 500,
        name: { en: 'Accentmon', es: 'Camión' },
        types: ['normal'],
        baseStats: STATS,
        formSlug: 'accentmon',
      },
    ];
    expect(filterSpeciesSearchIndex(items, [], 'camion', 'es').map((m) => m.item.slug)).toEqual([
      'accentmon',
    ]);
    expect(filterSpeciesSearchIndex(items, [], 'camión', 'es').map((m) => m.item.slug)).toEqual([
      'accentmon',
    ]);
  });

  describe('Spanish natural-phrasing form search (must all resolve to meowth)', () => {
    const queries = [
      'meowth de alola',
      'Meowth de Alola',
      'alolan meowth',
      'meowth alola',
      'alola meowth',
    ];

    it.each(queries)('%s', (query) => {
      const result = filterSpeciesSearchIndex(ITEMS, ALIASES, query, 'es');
      expect(result.map((m) => m.item.slug)).toEqual(['meowth']);
    });
  });

  it('still accepts the English/source alias in the es locale when no Spanish field matches as well', () => {
    // "alolan meowth" only matches the alias's English field; the es locale
    // must still fall back to it rather than coming up empty.
    const result = filterSpeciesSearchIndex(ITEMS, ALIASES, 'alolan meowth', 'es');
    expect(result.map((m) => m.item.slug)).toEqual(['meowth']);
  });

  it('continues to accept localized/source alias queries in the en locale (no regression)', () => {
    const result = filterSpeciesSearchIndex(ITEMS, ALIASES, 'alolan meowth', 'en');
    expect(result.map((m) => m.item.slug)).toEqual(['meowth']);
  });

  it('a query matching two of the same species\' form aliases equally still yields exactly one deduplicated species result, marked "ambiguous"', () => {
    const result = filterSpeciesSearchIndex(ITEMS, ALIASES, 'meowth de', 'es');
    expect(result).toHaveLength(1);
    expect(result[0]!.item.slug).toBe('meowth');
    expect(result[0]!.formMatch?.kind).toBe('ambiguous');
  });
});

describe('getPokemonSuggestions', () => {
  const SUGGEST_ITEMS: SpeciesSearchItem[] = [
    {
      slug: 'mew',
      nationalDexNumber: 151,
      name: { en: 'Mew', es: 'Mew' },
      types: ['psychic'],
      baseStats: STATS,
      formSlug: 'mew',
    },
    {
      slug: 'mewtwo',
      nationalDexNumber: 150,
      name: { en: 'Mewtwo', es: 'Mewtwo' },
      types: ['psychic'],
      baseStats: STATS,
      formSlug: 'mewtwo',
    },
    {
      slug: 'charmander',
      nationalDexNumber: 4,
      name: { en: 'Charmander', es: 'Charmander' },
      types: ['fire'],
      baseStats: STATS,
      formSlug: 'charmander',
    },
    {
      slug: 'charmeleon',
      nationalDexNumber: 5,
      name: { en: 'Charmeleon', es: 'Charmeleon' },
      types: ['fire'],
      baseStats: STATS,
      formSlug: 'charmeleon',
    },
    {
      slug: 'charizard',
      nationalDexNumber: 6,
      name: { en: 'Charizard', es: 'Charizard' },
      types: ['fire', 'flying'],
      baseStats: STATS,
      formSlug: 'charizard',
    },
    {
      slug: 'meowth',
      nationalDexNumber: 52,
      name: { en: 'Meowth', es: 'Meowth' },
      types: ['normal'],
      baseStats: STATS,
      formSlug: 'meowth',
    },
  ];

  it('returns nothing for an empty query', () => {
    expect(getPokemonSuggestions(SUGGEST_ITEMS, ALIASES, '', 'en')).toEqual([]);
  });

  it('ranks an exact dex-number match', () => {
    expect(
      getPokemonSuggestions(SUGGEST_ITEMS, ALIASES, '150', 'en').map((s) => s.item.slug),
    ).toEqual(['mewtwo']);
    expect(
      getPokemonSuggestions(SUGGEST_ITEMS, ALIASES, '#150', 'en').map((s) => s.item.slug),
    ).toEqual(['mewtwo']);
  });

  it('ranks an exact name match above a startsWith match on the same query', () => {
    const result = getPokemonSuggestions(SUGGEST_ITEMS, ALIASES, 'mew', 'en');
    expect(result.map((s) => s.item.slug)).toEqual(['mew', 'mewtwo']);
  });

  it('ranks a startsWith match above a contains-only match', () => {
    const items: SpeciesSearchItem[] = [
      ...SUGGEST_ITEMS,
      {
        slug: 'armorpoke',
        nationalDexNumber: 999,
        name: { en: 'Armorpoke', es: 'Armorpoke' },
        types: ['steel'],
        baseStats: STATS,
        formSlug: 'armorpoke',
      },
    ];
    const result = getPokemonSuggestions(items, ALIASES, 'arm', 'en');
    // "Armorpoke" starts with "arm"; "Charmander"/"Charmeleon" only contain
    // it as a token substring (not at the start); "Charizard" doesn't
    // contain "arm" at all.
    expect(result.map((s) => s.item.slug)).toEqual(['armorpoke', 'charmander', 'charmeleon']);
  });

  it('resolves an unambiguous form-alias match to its species, attaches the matched alias (with its own types) as a "single" formMatch, and never duplicates the species', () => {
    const result = getPokemonSuggestions(SUGGEST_ITEMS, ALIASES, 'alolan meowth', 'en');
    expect(result.map((s) => s.item.slug)).toEqual(['meowth']);
    expect(result[0]?.formMatch).toEqual({
      kind: 'single',
      alias: {
        name: { en: 'Alolan Meowth', es: 'Meowth de Alola' },
        speciesSlug: 'meowth',
        types: ['dark'],
        formSlug: 'meowth-alola',
      },
    });
  });

  it('does not attach form-match context when the species name itself is the best match', () => {
    const result = getPokemonSuggestions(SUGGEST_ITEMS, ALIASES, 'meowth', 'en');
    expect(result.map((s) => s.item.slug)).toEqual(['meowth']);
    expect(result[0]?.formMatch).toBeUndefined();
  });

  describe('ambiguous same-species form matches (must not arbitrarily pick one)', () => {
    it('reports "ambiguous" with every tied alias when two of the same species\' forms match equally', () => {
      // Both "Meowth de Alola" and "Meowth de Galar" start with "meowth de" —
      // a genuine tie, not one arbitrarily winning over the other.
      const result = getPokemonSuggestions(SUGGEST_ITEMS, ALIASES, 'meowth de', 'es');
      expect(result.map((s) => s.item.slug)).toEqual(['meowth']); // still deduplicated to one species
      expect(result[0]?.formMatch?.kind).toBe('ambiguous');
      const ambiguous = result[0]!.formMatch as {
        kind: 'ambiguous';
        aliases: SpeciesSearchAlias[];
      };
      expect(ambiguous.aliases.map((a) => a.name.es).sort()).toEqual([
        'Meowth de Alola',
        'Meowth de Galar',
      ]);
    });

    it('narrows to a single unambiguous form once the query is specific enough (Alola)', () => {
      const result = getPokemonSuggestions(SUGGEST_ITEMS, ALIASES, 'meowth de a', 'es');
      expect(result.map((s) => s.item.slug)).toEqual(['meowth']);
      expect(result[0]?.formMatch).toEqual({
        kind: 'single',
        alias: {
          name: { en: 'Alolan Meowth', es: 'Meowth de Alola' },
          speciesSlug: 'meowth',
          types: ['dark'],
          formSlug: 'meowth-alola',
        },
      });
    });

    it('narrows to a single unambiguous form once the query is specific enough (Galar)', () => {
      const result = getPokemonSuggestions(SUGGEST_ITEMS, ALIASES, 'meowth de g', 'es');
      expect(result.map((s) => s.item.slug)).toEqual(['meowth']);
      expect(result[0]?.formMatch).toEqual({
        kind: 'single',
        alias: {
          name: { en: 'Galarian Meowth', es: 'Meowth de Galar' },
          speciesSlug: 'meowth',
          types: ['steel'],
          formSlug: 'meowth-galar',
        },
      });
    });

    it('"alola meowth" stays unambiguous — only the Alolan alias matches, not the Galarian one', () => {
      const result = getPokemonSuggestions(SUGGEST_ITEMS, ALIASES, 'alola meowth', 'es');
      expect(result.map((s) => s.item.slug)).toEqual(['meowth']);
      expect(result[0]?.formMatch).toEqual({
        kind: 'single',
        alias: {
          name: { en: 'Alolan Meowth', es: 'Meowth de Alola' },
          speciesSlug: 'meowth',
          types: ['dark'],
          formSlug: 'meowth-alola',
        },
      });
    });
  });

  it('orders same-rank matches by national Dex number', () => {
    const result = getPokemonSuggestions(SUGGEST_ITEMS, ALIASES, 'char', 'en');
    expect(result.map((s) => s.item.slug)).toEqual(['charmander', 'charmeleon', 'charizard']);
  });

  it('caps suggestions at the given limit, defaulting to MAX_POKEMON_SUGGESTIONS', () => {
    const manyItems: SpeciesSearchItem[] = Array.from({ length: 10 }, (_, i) => ({
      slug: `test-${i}`,
      nationalDexNumber: 900 + i,
      name: { en: `Testmon${i}`, es: `Testmon${i}` },
      types: ['normal'],
      baseStats: STATS,
      formSlug: `test-${i}`,
    }));
    expect(getPokemonSuggestions(manyItems, [], 'testmon', 'en')).toHaveLength(
      MAX_POKEMON_SUGGESTIONS,
    );
    expect(getPokemonSuggestions(manyItems, [], 'testmon', 'en', 3)).toHaveLength(3);
  });

  describe('Spanish natural-phrasing form search (must all resolve to meowth)', () => {
    const queries = [
      'meowth de alola',
      'Meowth de Alola',
      'alolan meowth',
      'meowth alola',
      'alola meowth',
    ];

    it.each(queries)('%s', (query) => {
      const result = getPokemonSuggestions(SUGGEST_ITEMS, ALIASES, query, 'es');
      expect(result.map((s) => s.item.slug)).toEqual(['meowth']);
      // These queries all mention "alola" specifically, so only the Alolan
      // alias matches — never the Galarian one, and never ambiguous.
      expect(result[0]?.formMatch).toMatchObject({
        kind: 'single',
        alias: { speciesSlug: 'meowth' },
      });
    });
  });

  it('ranks the localized alias above the equivalent-tier English/source alias in the es locale', () => {
    const items: SpeciesSearchItem[] = [
      {
        slug: 'high-dex-locale',
        nationalDexNumber: 20,
        name: { en: 'HDL', es: 'HDL' },
        types: ['normal'],
        baseStats: STATS,
        formSlug: 'high-dex-locale',
      },
      {
        slug: 'low-dex-source',
        nationalDexNumber: 10,
        name: { en: 'LDS', es: 'LDS' },
        types: ['normal'],
        baseStats: STATS,
        formSlug: 'low-dex-source',
      },
    ];
    const aliases: SpeciesSearchAlias[] = [
      // es field starts with "forma"; en field does not.
      {
        name: { en: 'Zzz Form', es: 'Forma Alfa' },
        speciesSlug: 'high-dex-locale',
        types: ['normal'],
        formSlug: 'high-dex-locale-alt',
      },
      // en field starts with "forma"; es field does not.
      {
        name: { en: 'Forma Beta', es: 'Otra Cosa' },
        speciesSlug: 'low-dex-source',
        types: ['normal'],
        formSlug: 'low-dex-source-alt',
      },
    ];

    const result = getPokemonSuggestions(items, aliases, 'forma', 'es');
    // The locale (es) match outranks the source (en) match even though its
    // species has a *higher* Dex number — proving locale beats dex order,
    // not just coinciding with it.
    expect(result.map((s) => s.item.slug)).toEqual(['high-dex-locale', 'low-dex-source']);
  });

  it('continues to accept localized/source alias queries in the en locale (no regression)', () => {
    const result = getPokemonSuggestions(SUGGEST_ITEMS, ALIASES, 'alolan meowth', 'en');
    expect(result.map((s) => s.item.slug)).toEqual(['meowth']);
  });
});

describe('dexNumberLabel', () => {
  it('pads to 3 digits with a leading "#"', () => {
    expect(dexNumberLabel(1)).toBe('#001');
    expect(dexNumberLabel(25)).toBe('#025');
    expect(dexNumberLabel(150)).toBe('#150');
    expect(dexNumberLabel(1025)).toBe('#1025');
  });
});

describe('applyPokemonIndexFilters (Explore Pro, Milestone 2 Stage 2A)', () => {
  // Distinct, easily-comparable stats per species so sort tests are unambiguous.
  const bulbasaur: SpeciesSearchItem = {
    slug: 'bulbasaur',
    nationalDexNumber: 1,
    name: { en: 'Bulbasaur', es: 'Bulbasaur' },
    types: ['grass', 'poison'],
    baseStats: {
      hp: 45,
      attack: 49,
      defense: 49,
      specialAttack: 65,
      specialDefense: 65,
      speed: 45,
    },
    formSlug: 'bulbasaur',
  };
  const charmander: SpeciesSearchItem = {
    slug: 'charmander',
    nationalDexNumber: 4,
    name: { en: 'Charmander', es: 'Charmander' },
    types: ['fire'],
    baseStats: {
      hp: 39,
      attack: 52,
      defense: 43,
      specialAttack: 60,
      specialDefense: 50,
      speed: 65,
    },
    formSlug: 'charmander',
  };
  const charizard: SpeciesSearchItem = {
    slug: 'charizard',
    nationalDexNumber: 6,
    name: { en: 'Charizard', es: 'Charizard' },
    types: ['fire', 'flying'],
    baseStats: {
      hp: 78,
      attack: 84,
      defense: 78,
      specialAttack: 109,
      specialDefense: 85,
      speed: 100,
    },
    formSlug: 'charizard',
  };
  const squirtle: SpeciesSearchItem = {
    slug: 'squirtle',
    nationalDexNumber: 7,
    name: { en: 'Squirtle', es: 'Squirtle' },
    types: ['water'],
    baseStats: {
      hp: 44,
      attack: 48,
      defense: 65,
      specialAttack: 50,
      specialDefense: 64,
      speed: 43,
    },
    formSlug: 'squirtle',
  };
  const ALL: SpeciesSearchMatch[] = [bulbasaur, charmander, charizard, squirtle].map((item) => ({
    item,
  }));

  it('filters by type', () => {
    const result = applyPokemonIndexFilters(ALL, { type: 'fire' }, 'en');
    expect(result.map((m) => m.item.slug).sort()).toEqual(['charizard', 'charmander']);
  });

  it('filters by generation (derived from Dex number, all these are Gen 1)', () => {
    const result = applyPokemonIndexFilters(ALL, { generation: 1 }, 'en');
    expect(result).toHaveLength(4);
    const result2 = applyPokemonIndexFilters(ALL, { generation: 2 }, 'en');
    expect(result2).toHaveLength(0);
  });

  it('sorts by base stat total, descending', () => {
    const result = applyPokemonIndexFilters(ALL, { sortBy: 'bst', sortDirection: 'desc' }, 'en');
    expect(result.map((m) => m.item.slug)).toEqual([
      'charizard',
      'bulbasaur',
      'squirtle',
      'charmander',
    ]);
  });

  it('sorts by a single stat (Speed), ascending', () => {
    const result = applyPokemonIndexFilters(ALL, { sortBy: 'speed', sortDirection: 'asc' }, 'en');
    expect(result.map((m) => m.item.slug)).toEqual([
      'squirtle',
      'bulbasaur',
      'charmander',
      'charizard',
    ]);
  });

  it('sorts by name', () => {
    const result = applyPokemonIndexFilters(ALL, { sortBy: 'name' }, 'en');
    expect(result.map((m) => m.item.slug)).toEqual([
      'bulbasaur',
      'charizard',
      'charmander',
      'squirtle',
    ]);
  });

  it('composes search + type filter + sort predictably ("char" + Fire + sort Speed desc)', () => {
    const items = [bulbasaur, charmander, charizard, squirtle];
    const searched = filterSpeciesSearchIndex(items, [], 'char', 'en');
    expect(searched.map((m) => m.item.slug)).toEqual(['charmander', 'charizard']);

    const result = applyPokemonIndexFilters(
      searched,
      { type: 'fire', sortBy: 'speed', sortDirection: 'desc' },
      'en',
    );
    expect(result.map((m) => m.item.slug)).toEqual(['charizard', 'charmander']);
  });

  it('ties on the sorted stat break by national Dex number for determinism', () => {
    const tiedA: SpeciesSearchItem = { ...squirtle, slug: 'tied-a', nationalDexNumber: 500 };
    const tiedB: SpeciesSearchItem = { ...squirtle, slug: 'tied-b', nationalDexNumber: 5 };
    const result = applyPokemonIndexFilters(
      [{ item: tiedA }, { item: tiedB }],
      { sortBy: 'speed', sortDirection: 'asc' },
      'en',
    );
    expect(result.map((m) => m.item.slug)).toEqual(['tied-b', 'tied-a']);
  });
});
