import type { PokeApiPokemon, PokeApiPokemonForm, PokeApiPokemonSpecies } from './pokeapi-client';
import type {
  BaseStats,
  FormCategory,
  LocalizedName,
  NormalizedForm,
  NormalizedSpecies,
  PokemonType,
  SourceRef,
} from './types';

function findLocalized(
  names: { name: string; language: { name: string } }[],
  language: string,
): string | undefined {
  return names.find((entry) => entry.language.name === language)?.name;
}

function localizedFrom(names: { name: string; language: { name: string } }[]): LocalizedName {
  const en = findLocalized(names, 'en');
  const es = findLocalized(names, 'es');
  if (!en || !es) {
    throw new Error(`Missing en/es localized name (got en=${en ?? '?'}, es=${es ?? '?'})`);
  }
  return { en, es };
}

export function normalizeSpecies(params: {
  species: PokeApiPokemonSpecies;
  slug: string;
  sourceId: string;
}): NormalizedSpecies {
  return {
    slug: params.slug,
    nationalDexNumber: params.species.id,
    name: localizedFrom(params.species.names),
    source: { sourceId: params.sourceId, externalId: String(params.species.id) },
  };
}

/**
 * Resolves a non-default form's localized display name.
 *
 * PokéAPI's `pokemon-form` resource is inconsistent across form groups:
 * - `names` (full "Species Form" name) is reliable for English but is
 *   frequently missing Spanish entirely (observed for every non-default form
 *   in this sample).
 * - `form_names` fills that Spanish gap, but its *meaning* differs by form
 *   group: for Rotom's appliance formes it is the full name ("Rotom Calor");
 *   for regional formes it is a generic descriptor shared across many species
 *   ("Forma de Alola"), not "Meowth de Alola".
 *
 * So the fallback differs by category:
 * - `battle` forms (Rotom-style): `names[lang] ?? form_names[lang]` — both
 *   happen to carry the full name for this group.
 * - `regional` forms: `names[lang]` when present (true for English); for
 *   Spanish, compose `"{species} de {region}"`, which is the real,
 *   consistent Nintendo localization pattern for every regional form (Alolan/
 *   Galarian/Hisuian/Paldean), not a per-Pokémon hardcode.
 */
export function resolveFormName(params: {
  form: PokeApiPokemonForm;
  category: FormCategory;
  speciesName: LocalizedName;
  /** Required for `category: 'regional'` — the region's proper noun, e.g. "Alola". Identical in en/es. */
  regionLabel?: string | undefined;
}): LocalizedName {
  const namesEn = findLocalized(params.form.names, 'en');
  const namesEs = findLocalized(params.form.names, 'es');

  if (params.category === 'regional') {
    if (!params.regionLabel) throw new Error('regionLabel is required for regional forms');
    return {
      en: namesEn ?? `${params.regionLabel} ${params.speciesName.en}`,
      es: namesEs ?? `${params.speciesName.es} de ${params.regionLabel}`,
    };
  }

  const formNamesEn = findLocalized(params.form.form_names, 'en');
  const formNamesEs = findLocalized(params.form.form_names, 'es');
  const en = namesEn ?? formNamesEn;
  const es = namesEs ?? formNamesEs;
  if (!en || !es) {
    throw new Error(`Could not resolve a full en/es name from pokemon-form (en=${en}, es=${es})`);
  }
  return { en, es };
}

function findStat(stats: { base_stat: number; stat: { name: string } }[], name: string): number {
  const stat = stats.find((entry) => entry.stat.name === name);
  if (!stat) throw new Error(`Missing stat "${name}"`);
  return stat.base_stat;
}

function baseStatsFrom(stats: { base_stat: number; stat: { name: string } }[]): BaseStats {
  return {
    hp: findStat(stats, 'hp'),
    attack: findStat(stats, 'attack'),
    defense: findStat(stats, 'defense'),
    specialAttack: findStat(stats, 'special-attack'),
    specialDefense: findStat(stats, 'special-defense'),
    speed: findStat(stats, 'speed'),
  };
}

export function normalizeForm(params: {
  pokemon: PokeApiPokemon;
  /** Required unless `isDefault` — the default form's name is always the species name. */
  form: PokeApiPokemonForm | undefined;
  slug: string;
  speciesSlug: string;
  speciesName: LocalizedName;
  isDefault: boolean;
  category: FormCategory;
  regionLabel?: string | undefined;
  sourceId: string;
}): NormalizedForm {
  const types = [...params.pokemon.types]
    .sort((a, b) => a.slot - b.slot)
    .map((entry) => entry.type.name as PokemonType);
  if (types.length < 1 || types.length > 2) {
    throw new Error(`Expected 1-2 types for ${params.slug}, got ${types.length}`);
  }

  if (!params.isDefault && !params.form) {
    throw new Error(`"form" is required for non-default form "${params.slug}"`);
  }
  const name: LocalizedName = params.isDefault
    ? params.speciesName
    : resolveFormName({
        form: params.form!,
        category: params.category,
        speciesName: params.speciesName,
        regionLabel: params.regionLabel,
      });

  const source: SourceRef = { sourceId: params.sourceId, externalId: String(params.pokemon.id) };

  return {
    slug: params.slug,
    speciesSlug: params.speciesSlug,
    name,
    isDefault: params.isDefault,
    category: params.category,
    types,
    baseStats: baseStatsFrom(params.pokemon.stats),
    source,
  };
}
