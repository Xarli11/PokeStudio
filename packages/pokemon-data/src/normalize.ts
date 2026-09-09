import { assertValidSlug, classifyForm, detectRegionLabel, pickPrimaryForm } from './classify';
import type { PokeApiPokemon, PokeApiPokemonForm, PokeApiPokemonSpecies } from './pokeapi-client';
import type {
  BaseStats,
  FormCategory,
  LocalizedName,
  NormalizedForm,
  NormalizedSpecies,
  PokemonType,
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
  sourceId: string;
}): NormalizedSpecies {
  const slug = params.species.name;
  assertValidSlug(slug, `species #${params.species.id}`);
  return {
    slug,
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
 *   frequently missing Spanish entirely.
 * - `form_names` fills that Spanish gap for *some* form groups (Rotom's
 *   appliance formes: the full name, e.g. "Rotom Calor") but means something
 *   else for others (regional formes: a generic "Forma de Alola"-style
 *   descriptor, not "Meowth de Alola") and for cosmetic sub-forms (just the
 *   pattern/letter/flavor word, e.g. "Meadow", not the species name).
 *
 * So the fallback differs by category:
 * - `regional`: compose `"{species} de {region}"` for Spanish — the real,
 *   consistent Nintendo localization pattern for every regional form, not a
 *   per-Pokémon hardcode.
 * - anything else (`battle`, `cosmetic`): `names[lang] ?? form_names[lang]`,
 *   falling back further to `"{species} {form_names[lang]}"` when even that
 *   is missing, so a bare descriptor is never shown alone without the
 *   species name attached (avoids "Meadow" standing in for "Meadow
 *   Vivillon").
 */
export type FormNameSource = 'api' | 'composed-regional' | 'composed-fallback';

export function resolveFormName(params: {
  form: PokeApiPokemonForm;
  category: FormCategory;
  speciesName: LocalizedName;
  /** Required for `category: 'regional'` — the region's proper noun, e.g. "Alola". Identical in en/es. */
  regionLabel?: string | undefined;
}): { name: LocalizedName; esSource: FormNameSource } {
  const namesEn = findLocalized(params.form.names, 'en');
  const namesEs = findLocalized(params.form.names, 'es');

  if (params.category === 'regional') {
    if (!params.regionLabel) throw new Error('regionLabel is required for regional forms');
    return {
      name: {
        en: namesEn ?? `${params.regionLabel} ${params.speciesName.en}`,
        es: namesEs ?? `${params.speciesName.es} de ${params.regionLabel}`,
      },
      esSource: namesEs ? 'api' : 'composed-regional',
    };
  }

  const formNamesEn = findLocalized(params.form.form_names, 'en');
  const formNamesEs = findLocalized(params.form.form_names, 'es');
  const descriptor = params.form.form_name || params.form.name;
  return {
    name: {
      en: namesEn ?? formNamesEn ?? `${params.speciesName.en} (${descriptor})`,
      es: namesEs ?? formNamesEs ?? `${params.speciesName.es} (${descriptor})`,
    },
    esSource: namesEs ? 'api' : formNamesEs ? 'api' : 'composed-fallback',
  };
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

function typesEqual(a: readonly PokemonType[], b: readonly PokemonType[]): boolean {
  return a.length === b.length && a.every((type, index) => type === b[index]);
}

function statsEqual(a: BaseStats, b: BaseStats): boolean {
  return (
    a.hp === b.hp &&
    a.attack === b.attack &&
    a.defense === b.defense &&
    a.specialAttack === b.specialAttack &&
    a.specialDefense === b.specialDefense &&
    a.speed === b.speed
  );
}

/** One `pokemon` (variety) plus the raw detail of every `pokemon-form` under it. */
export interface RawVarietyGroup {
  pokemon: PokeApiPokemon;
  isDefaultVariety: boolean;
  forms: PokeApiPokemonForm[];
}

/** Everything fetched for one species — the unit `normalizeSpeciesGroup` transforms. */
export interface RawSpeciesGroup {
  species: PokeApiPokemonSpecies;
  varieties: RawVarietyGroup[];
}

export interface LocalizationNote {
  formSlug: string;
  esSource: FormNameSource;
}

export function normalizeSpeciesGroup(
  group: RawSpeciesGroup,
  sourceId: string,
): { species: NormalizedSpecies; forms: NormalizedForm[]; localizationNotes: LocalizationNote[] } {
  const species = normalizeSpecies({ species: group.species, sourceId });
  const localizationNotes: LocalizationNote[] = [];

  const varietyShapes = group.varieties.map((variety) => {
    const types = [...variety.pokemon.types]
      .sort((a, b) => a.slot - b.slot)
      .map((entry) => entry.type.name as PokemonType);
    if (types.length < 1 || types.length > 2) {
      throw new Error(`Expected 1-2 types for ${variety.pokemon.name}, got ${types.length}`);
    }
    return { variety, types, baseStats: baseStatsFrom(variety.pokemon.stats) };
  });
  const defaultShape = varietyShapes.find((shape) => shape.variety.isDefaultVariety);

  const forms = varietyShapes.flatMap(({ variety, types, baseStats }) => {
    const primaryForm = pickPrimaryForm(variety.forms, variety.pokemon.name);

    return variety.forms.map((form) => {
      const isPrimaryForm = form === primaryForm;
      const regionLabel = detectRegionLabel(variety.pokemon.name);
      const mechanicallyDifferentFromDefault = defaultShape
        ? !typesEqual(types, defaultShape.types) || !statsEqual(baseStats, defaultShape.baseStats)
        : false;
      const category = classifyForm({
        isDefaultVariety: variety.isDefaultVariety,
        isPrimaryForm,
        isMega: form.is_mega,
        isBattleOnly: form.is_battle_only,
        regionLabel,
        mechanicallyDifferentFromDefault,
      });
      const isDefault = variety.isDefaultVariety && isPrimaryForm;

      const slug = form.name;
      assertValidSlug(slug, `form of species "${species.slug}"`);

      let name: LocalizedName;
      if (isDefault) {
        name = species.name;
      } else {
        const resolved = resolveFormName({
          form,
          category,
          speciesName: species.name,
          regionLabel,
        });
        name = resolved.name;
        if (resolved.esSource !== 'api') {
          localizationNotes.push({ formSlug: slug, esSource: resolved.esSource });
        }
      }

      const normalized: NormalizedForm = {
        slug,
        speciesSlug: species.slug,
        name,
        isDefault,
        category,
        types,
        baseStats,
        source: { sourceId, externalId: String(form.id) },
      };
      return normalized;
    });
  });

  return { species, forms, localizationNotes };
}
