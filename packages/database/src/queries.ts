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

const PAGE_SIZE = 1000;

/**
 * Reads every row matching `query`, paginating past PostgREST's default
 * response row cap (`max_rows` in `supabase/config.toml`, 1000 locally) —
 * the full species/form tables now exceed it (Phase 1B, found during the
 * first full-Pokédex ingestion: `packages/pokemon-data`'s persist layer hit
 * the same cap and needed the same fix).
 */
async function selectAllRows<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

/** Every species with its default form (Pokédex index — one card per species). */
export async function listSpecies(client: PokeStudioDatabaseClient): Promise<SpeciesListItem[]> {
  const [speciesRows, defaultFormRows] = await Promise.all([
    selectAllRows((from, to) =>
      client
        .from('species')
        .select('id, slug, national_dex_number, name_en, name_es')
        .order('national_dex_number', { ascending: true })
        .range(from, to),
    ),
    selectAllRows((from, to) =>
      client
        .from('pokemon_form')
        .select('species_id, slug, name_en, name_es, is_default, form_category, types, base_stats')
        .eq('is_default', true)
        .range(from, to),
    ),
  ]);

  const defaultFormBySpeciesId = new Map(
    defaultFormRows.map((row) => [row.species_id, row as FormRow]),
  );

  return speciesRows.map((species) => {
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

export interface SpeciesPage {
  items: SpeciesListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/**
 * One page of species with their default form (Pokédex index at full
 * scale — Phase 1B §13). `listSpecies` (above) still returns everything and
 * remains correct for callers that genuinely need the whole dataset
 * (`sitemap.ts`); the index page uses this instead once the full ~1000+
 * species made rendering everything at once an unreasonable payload
 * (~6MB/one page) rather than a "keep it simple for now" case.
 */
export async function listSpeciesPage(
  client: PokeStudioDatabaseClient,
  options: { page: number; pageSize: number },
): Promise<SpeciesPage> {
  const from = (options.page - 1) * options.pageSize;
  const to = from + options.pageSize - 1;

  const [speciesResult, countResult] = await Promise.all([
    client
      .from('species')
      .select('id, slug, national_dex_number, name_en, name_es')
      .order('national_dex_number', { ascending: true })
      .range(from, to),
    client.from('species').select('id', { count: 'exact', head: true }),
  ]);

  if (speciesResult.error)
    throw new Error(`listSpeciesPage (species) failed: ${speciesResult.error.message}`);
  if (countResult.error)
    throw new Error(`listSpeciesPage (count) failed: ${countResult.error.message}`);

  const speciesIds = speciesResult.data.map((row) => row.id);
  const defaultFormsResult =
    speciesIds.length > 0
      ? await client
          .from('pokemon_form')
          .select(
            'species_id, slug, name_en, name_es, is_default, form_category, types, base_stats',
          )
          .eq('is_default', true)
          .in('species_id', speciesIds)
      : { data: [] as FormRow[], error: null };
  if (defaultFormsResult.error) {
    throw new Error(`listSpeciesPage (forms) failed: ${defaultFormsResult.error.message}`);
  }

  const defaultFormBySpeciesId = new Map(
    defaultFormsResult.data.map((row) => [row.species_id, row as FormRow]),
  );

  const totalCount = countResult.count ?? 0;
  return {
    items: speciesResult.data.map((species) => {
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
    }),
    page: options.page,
    pageSize: options.pageSize,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / options.pageSize)),
  };
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
