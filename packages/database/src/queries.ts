import type { BaseStats, FormCategory, LocalizedName, PokemonType } from '@pokestudio/pokemon-data';

import type { PokeStudioDatabaseClient } from './client';

/**
 * Domain-shaped Pokémon reference-data queries (DATABASE.md, ADR-0010).
 *
 * The Pokédex UI must call these instead of querying `species`/`pokemon_form`
 * directly — this is the one place that knows the table shape.
 */

export interface SpeciesFormSummary {
  slug: string;
  name: LocalizedName;
  isDefault: boolean;
  category: FormCategory;
  types: PokemonType[];
  baseStats: BaseStats;
}

export interface SpeciesListItem {
  slug: string;
  nationalDexNumber: number;
  name: LocalizedName;
  defaultForm: SpeciesFormSummary;
}

export interface SpeciesDetail {
  slug: string;
  nationalDexNumber: number;
  name: LocalizedName;
  /** Default form first, then other forms ordered by slug. */
  forms: SpeciesFormSummary[];
}

interface FormRow {
  species_id: string;
  slug: string;
  name_en: string;
  name_es: string;
  is_default: boolean;
  form_category: string;
  types: string[];
  base_stats: Record<string, number>;
}

function toFormSummary(row: FormRow): SpeciesFormSummary {
  return {
    slug: row.slug,
    name: { en: row.name_en, es: row.name_es },
    isDefault: row.is_default,
    category: row.form_category as FormCategory,
    types: row.types as PokemonType[],
    baseStats: row.base_stats as unknown as BaseStats,
  };
}

/** Every species with its default form (Pokédex index — one card per species). */
export async function listSpecies(client: PokeStudioDatabaseClient): Promise<SpeciesListItem[]> {
  const [speciesResult, defaultFormsResult] = await Promise.all([
    client
      .from('species')
      .select('id, slug, national_dex_number, name_en, name_es')
      .order('national_dex_number', { ascending: true }),
    client
      .from('pokemon_form')
      .select('species_id, slug, name_en, name_es, is_default, form_category, types, base_stats')
      .eq('is_default', true),
  ]);

  if (speciesResult.error)
    throw new Error(`listSpecies (species) failed: ${speciesResult.error.message}`);
  if (defaultFormsResult.error) {
    throw new Error(`listSpecies (forms) failed: ${defaultFormsResult.error.message}`);
  }

  const defaultFormBySpeciesId = new Map(
    defaultFormsResult.data.map((row) => [row.species_id, row as FormRow]),
  );

  return speciesResult.data.map((species) => {
    const defaultFormRow = defaultFormBySpeciesId.get(species.id);
    if (!defaultFormRow) {
      throw new Error(`Species "${species.slug}" has no default form — data integrity issue.`);
    }
    return {
      slug: species.slug,
      nationalDexNumber: species.national_dex_number,
      name: { en: species.name_en, es: species.name_es },
      defaultForm: toFormSummary(defaultFormRow),
    };
  });
}

/** A single species with all of its forms (Pokédex detail page). Null if the slug doesn't exist. */
export async function getSpeciesBySlug(
  client: PokeStudioDatabaseClient,
  slug: string,
): Promise<SpeciesDetail | null> {
  const speciesResult = await client
    .from('species')
    .select('id, slug, national_dex_number, name_en, name_es')
    .eq('slug', slug)
    .maybeSingle();

  if (speciesResult.error)
    throw new Error(`getSpeciesBySlug (species) failed: ${speciesResult.error.message}`);
  if (!speciesResult.data) return null;

  const species = speciesResult.data;

  const formsResult = await client
    .from('pokemon_form')
    .select('species_id, slug, name_en, name_es, is_default, form_category, types, base_stats')
    .eq('species_id', species.id)
    .order('is_default', { ascending: false })
    .order('slug', { ascending: true });

  if (formsResult.error)
    throw new Error(`getSpeciesBySlug (forms) failed: ${formsResult.error.message}`);

  return {
    slug: species.slug,
    nationalDexNumber: species.national_dex_number,
    name: { en: species.name_en, es: species.name_es },
    forms: formsResult.data.map((row) => toFormSummary(row as FormRow)),
  };
}
