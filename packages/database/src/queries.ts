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

/** One ability on one form — canonical ability fields plus that form's slot/hidden status. */
export interface AbilitySummary {
  slug: string;
  nameEn: string;
  /** Undefined when PokéAPI has no Spanish name for this ability (DATA_SOURCES.md) — never invented. */
  nameEs?: string | undefined;
  effectEn?: string | undefined;
  /** Undefined far more often than nameEs — PokéAPI rarely publishes a Spanish ability effect at all. */
  effectEs?: string | undefined;
  isHidden: boolean;
  slot: number;
}

export interface SpeciesFormDetail extends SpeciesFormSummary {
  /** Ordered by slot; hidden ability (if any) last. */
  abilities: AbilitySummary[];
}

export interface SpeciesDetail {
  slug: string;
  nationalDexNumber: number;
  name: LocalizedName;
  /** Default form first, then other forms ordered by slug. */
  forms: SpeciesFormDetail[];
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
    .select('id, species_id, slug, name_en, name_es, is_default, form_category, types, base_stats')
    .eq('species_id', species.id)
    .order('is_default', { ascending: false })
    .order('slug', { ascending: true });

  if (formsResult.error)
    throw new Error(`getSpeciesBySlug (forms) failed: ${formsResult.error.message}`);

  const formIds = formsResult.data.map((row) => row.id);
  const abilitiesByFormId = await loadAbilitiesByFormId(client, formIds);

  return {
    slug: species.slug,
    nationalDexNumber: species.national_dex_number,
    name: { en: species.name_en, es: species.name_es },
    forms: formsResult.data.map((row) => ({
      ...toFormSummary(row as FormRow),
      abilities: abilitiesByFormId.get(row.id) ?? [],
    })),
  };
}

interface FormAbilityRow {
  pokemon_form_id: string;
  ability_id: string;
  slot: number;
  is_hidden: boolean;
}

interface AbilityRow {
  id: string;
  slug: string;
  name_en: string;
  name_es: string | null;
  effect_en: string | null;
  effect_es: string | null;
}

function toAbilitySummary(row: AbilityRow, link: FormAbilityRow): AbilitySummary {
  return {
    slug: row.slug,
    nameEn: row.name_en,
    nameEs: row.name_es ?? undefined,
    effectEn: row.effect_en ?? undefined,
    effectEs: row.effect_es ?? undefined,
    isHidden: link.is_hidden,
    slot: link.slot,
  };
}

/**
 * A form's abilities, keyed by `pokemon_form.id`. Bounded to the one
 * species' forms the caller already resolved (at most a few dozen, even for
 * Alcremie) — no PostgREST 1000-row pagination concern here, unlike the
 * dataset-wide reads above.
 */
async function loadAbilitiesByFormId(
  client: PokeStudioDatabaseClient,
  formIds: string[],
): Promise<Map<string, AbilitySummary[]>> {
  const abilitiesByFormId = new Map<string, AbilitySummary[]>();
  if (formIds.length === 0) return abilitiesByFormId;

  const linksResult = await client
    .from('pokemon_form_ability')
    .select('pokemon_form_id, ability_id, slot, is_hidden')
    .in('pokemon_form_id', formIds)
    .order('slot', { ascending: true });
  if (linksResult.error) {
    throw new Error(`loadAbilitiesByFormId (links) failed: ${linksResult.error.message}`);
  }

  const abilityIds = [...new Set(linksResult.data.map((link) => link.ability_id))];
  if (abilityIds.length === 0) return abilitiesByFormId;

  const abilitiesResult = await client
    .from('ability')
    .select('id, slug, name_en, name_es, effect_en, effect_es')
    .in('id', abilityIds);
  if (abilitiesResult.error) {
    throw new Error(`loadAbilitiesByFormId (abilities) failed: ${abilitiesResult.error.message}`);
  }
  const abilityById = new Map(abilitiesResult.data.map((row) => [row.id, row as AbilityRow]));

  for (const link of linksResult.data as FormAbilityRow[]) {
    const ability = abilityById.get(link.ability_id);
    if (!ability) continue; // defensive: should never happen given the FK constraint
    const list = abilitiesByFormId.get(link.pokemon_form_id) ?? [];
    list.push(toAbilitySummary(ability, link));
    abilitiesByFormId.set(link.pokemon_form_id, list);
  }
  return abilitiesByFormId;
}

/** One evolution edge's condition — see docs/adr/0011-abilities-evolutions-schema.md. */
export interface EvolutionCondition {
  trigger: string;
  minLevel?: number | undefined;
  itemSlug?: string | undefined;
  heldItemSlug?: string | undefined;
  minHappiness?: number | undefined;
  minBeauty?: number | undefined;
  minAffection?: number | undefined;
  timeOfDay?: 'day' | 'night' | undefined;
  knownMoveSlug?: string | undefined;
  knownMoveTypeSlug?: string | undefined;
  locationSlug?: string | undefined;
  gender?: number | undefined;
  tradeSpeciesSlug?: string | undefined;
  partySpeciesSlug?: string | undefined;
  partyTypeSlug?: string | undefined;
  relativePhysicalStats?: number | undefined;
  needsOverworldRain: boolean;
  turnUpsideDown: boolean;
}

export interface EvolutionEdge {
  fromSpeciesSlug: string;
  toSpeciesSlug: string;
  condition: EvolutionCondition;
}

export interface EvolutionFamilyMember {
  slug: string;
  nationalDexNumber: number;
  name: LocalizedName;
}

/**
 * A species' full evolution family (ADR-0011 decision 2 — a graph of edges,
 * reconstructed here, not stored pre-assembled). `members` has exactly one
 * entry and `edges` is empty for a species with no evolution (e.g. Ditto).
 */
export interface EvolutionFamily {
  members: EvolutionFamilyMember[];
  edges: EvolutionEdge[];
}

interface SpeciesEvolutionRow {
  from_species_id: string;
  to_species_id: string;
  evolution_chain_external_id: string;
  trigger: string;
  min_level: number | null;
  item_slug: string | null;
  held_item_slug: string | null;
  min_happiness: number | null;
  min_beauty: number | null;
  min_affection: number | null;
  time_of_day: string | null;
  known_move_slug: string | null;
  known_move_type_slug: string | null;
  location_slug: string | null;
  gender: number | null;
  trade_species_slug: string | null;
  party_species_slug: string | null;
  party_type_slug: string | null;
  relative_physical_stats: number | null;
  needs_overworld_rain: boolean;
  turn_upside_down: boolean;
}

function toEvolutionCondition(row: SpeciesEvolutionRow): EvolutionCondition {
  return {
    trigger: row.trigger,
    minLevel: row.min_level ?? undefined,
    itemSlug: row.item_slug ?? undefined,
    heldItemSlug: row.held_item_slug ?? undefined,
    minHappiness: row.min_happiness ?? undefined,
    minBeauty: row.min_beauty ?? undefined,
    minAffection: row.min_affection ?? undefined,
    timeOfDay: (row.time_of_day as 'day' | 'night' | null) ?? undefined,
    knownMoveSlug: row.known_move_slug ?? undefined,
    knownMoveTypeSlug: row.known_move_type_slug ?? undefined,
    locationSlug: row.location_slug ?? undefined,
    gender: row.gender ?? undefined,
    tradeSpeciesSlug: row.trade_species_slug ?? undefined,
    partySpeciesSlug: row.party_species_slug ?? undefined,
    partyTypeSlug: row.party_type_slug ?? undefined,
    relativePhysicalStats: row.relative_physical_stats ?? undefined,
    needsOverworldRain: row.needs_overworld_rain,
    turnUpsideDown: row.turn_upside_down,
  };
}

/**
 * A species' whole evolution family (Pokédex detail page, Phase 1C.1 Part B).
 * Two small indexed queries, not a recursive walk or a full-table scan: first
 * find any edge touching this species to learn its `evolution_chain_external_id`
 * (empty means "no evolution" — not an error), then fetch every edge sharing
 * that id. Returns null only if the species slug itself doesn't exist.
 */
export async function getEvolutionFamily(
  client: PokeStudioDatabaseClient,
  speciesSlug: string,
): Promise<EvolutionFamily | null> {
  const speciesResult = await client
    .from('species')
    .select('id, slug, national_dex_number, name_en, name_es')
    .eq('slug', speciesSlug)
    .maybeSingle();
  if (speciesResult.error) {
    throw new Error(`getEvolutionFamily (species) failed: ${speciesResult.error.message}`);
  }
  if (!speciesResult.data) return null;
  const species = speciesResult.data;

  const touchingResult = await client
    .from('species_evolution')
    .select('evolution_chain_external_id')
    .or(`from_species_id.eq.${species.id},to_species_id.eq.${species.id}`)
    .limit(1)
    .maybeSingle();
  if (touchingResult.error) {
    throw new Error(`getEvolutionFamily (chain lookup) failed: ${touchingResult.error.message}`);
  }

  const soloMember: EvolutionFamilyMember = {
    slug: species.slug,
    nationalDexNumber: species.national_dex_number,
    name: { en: species.name_en, es: species.name_es },
  };
  if (!touchingResult.data) return { members: [soloMember], edges: [] };

  const edgesResult = await client
    .from('species_evolution')
    .select(
      'from_species_id, to_species_id, evolution_chain_external_id, trigger, min_level, item_slug, held_item_slug, min_happiness, min_beauty, min_affection, time_of_day, known_move_slug, known_move_type_slug, location_slug, gender, trade_species_slug, party_species_slug, party_type_slug, relative_physical_stats, needs_overworld_rain, turn_upside_down',
    )
    .eq('evolution_chain_external_id', touchingResult.data.evolution_chain_external_id);
  if (edgesResult.error) {
    throw new Error(`getEvolutionFamily (edges) failed: ${edgesResult.error.message}`);
  }

  const memberIds = [
    ...new Set(edgesResult.data.flatMap((row) => [row.from_species_id, row.to_species_id])),
  ];
  const membersResult = await client
    .from('species')
    .select('id, slug, national_dex_number, name_en, name_es')
    .in('id', memberIds);
  if (membersResult.error) {
    throw new Error(`getEvolutionFamily (members) failed: ${membersResult.error.message}`);
  }
  const memberById = new Map(membersResult.data.map((row) => [row.id, row]));

  return {
    members: membersResult.data
      .map((row) => ({
        slug: row.slug,
        nationalDexNumber: row.national_dex_number,
        name: { en: row.name_en, es: row.name_es },
      }))
      .sort((a, b) => a.nationalDexNumber - b.nationalDexNumber),
    edges: (edgesResult.data as SpeciesEvolutionRow[]).map((row) => ({
      fromSpeciesSlug: memberById.get(row.from_species_id)!.slug,
      toSpeciesSlug: memberById.get(row.to_species_id)!.slug,
      condition: toEvolutionCondition(row),
    })),
  };
}
