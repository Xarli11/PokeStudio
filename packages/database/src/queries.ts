import type {
  BaseStats,
  DamageClass,
  FormCategory,
  LocalizedName,
  MoveStat,
  PokemonType,
} from '@pokestudio/pokemon-data';

import type { PokeStudioDatabaseClient } from './client';

/**
 * Domain-shaped Pokémon reference-data queries (docs/engineering/DATABASE.md, ADR-0010).
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
  /** Undefined when PokéAPI has no Spanish name for this ability (docs/engineering/DATA_SOURCES.md) — never invented. */
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

/** Move fields useful in list contexts (Pokémon detail's Moves section, the move index). */
export interface MoveSummary {
  slug: string;
  nameEn: string;
  /** Undefined only if PokéAPI ever lacks a Spanish move name — never invented. */
  nameEs?: string | undefined;
  type: PokemonType;
  damageClass: DamageClass;
  power?: number | undefined;
  accuracy?: number | undefined;
  pp: number;
  priority: number;
}

/** Everything MoveSummary has, plus the fields only the move detail page needs. */
export interface MoveDetail extends MoveSummary {
  target: string;
  generation: number;
  effectEn?: string | undefined;
  effectEs?: string | undefined;
  effectChance?: number | undefined;
  /** Undefined when PokéAPI's move `meta` block is entirely absent (a real, current gap for some very recent moves — docs/adr/0013-moves-learnsets-schema.md) — never invented. */
  ailment?: string | undefined;
  category?: string | undefined;
  minHits?: number | undefined;
  maxHits?: number | undefined;
  minTurns?: number | undefined;
  maxTurns?: number | undefined;
  drain: number;
  healing: number;
  critRate: number;
  ailmentChance: number;
  flinchChance: number;
  statChance: number;
  /** In PokéAPI's original order (relevant for multi-stat moves like Shell Smash). Empty, never invented, for moves with no stat effect. */
  statChanges: MoveStatChange[];
}

export interface MoveStatChange {
  stat: MoveStat;
  change: number;
}

export interface VersionGroupSummary {
  slug: string;
  generation: number;
  displayOrder: number;
}

/** One learnset fact for a form, joined with the move it refers to. */

interface MoveRow {
  slug: string;
  name_en: string;
  name_es: string | null;
  type: string;
  damage_class: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
  priority: number;
}

function toMoveSummary(row: MoveRow): MoveSummary {
  return {
    slug: row.slug,
    nameEn: row.name_en,
    nameEs: row.name_es ?? undefined,
    type: row.type as PokemonType,
    damageClass: row.damage_class as DamageClass,
    power: row.power ?? undefined,
    accuracy: row.accuracy ?? undefined,
    pp: row.pp,
    priority: row.priority,
  };
}

interface MoveDetailRow extends MoveRow {
  id: string;
  target: string;
  generation: number;
  effect_en: string | null;
  effect_es: string | null;
  effect_chance: number | null;
  ailment: string | null;
  category: string | null;
  min_hits: number | null;
  max_hits: number | null;
  min_turns: number | null;
  max_turns: number | null;
  drain: number;
  healing: number;
  crit_rate: number;
  ailment_chance: number;
  flinch_chance: number;
  stat_chance: number;
}

function toMoveDetail(row: MoveDetailRow, statChanges: MoveStatChange[]): MoveDetail {
  return {
    ...toMoveSummary(row),
    target: row.target,
    generation: row.generation,
    effectEn: row.effect_en ?? undefined,
    effectEs: row.effect_es ?? undefined,
    effectChance: row.effect_chance ?? undefined,
    ailment: row.ailment ?? undefined,
    category: row.category ?? undefined,
    minHits: row.min_hits ?? undefined,
    maxHits: row.max_hits ?? undefined,
    minTurns: row.min_turns ?? undefined,
    maxTurns: row.max_turns ?? undefined,
    drain: row.drain,
    healing: row.healing,
    critRate: row.crit_rate,
    ailmentChance: row.ailment_chance,
    flinchChance: row.flinch_chance,
    statChance: row.stat_chance,
    statChanges,
  };
}

const MOVE_DETAIL_COLUMNS =
  'id, slug, name_en, name_es, type, damage_class, power, accuracy, pp, priority, target, generation, effect_en, effect_es, effect_chance, ailment, category, min_hits, max_hits, min_turns, max_turns, drain, healing, crit_rate, ailment_chance, flinch_chance, stat_chance';

interface MoveStatChangeRow {
  stat: string;
  change: number;
}

/** A single move by slug (move detail page). Null if the slug doesn't exist. */
export async function getMoveBySlug(
  client: PokeStudioDatabaseClient,
  slug: string,
): Promise<MoveDetail | null> {
  const result = await client
    .from('move')
    .select(MOVE_DETAIL_COLUMNS)
    .eq('slug', slug)
    .maybeSingle();
  if (result.error) throw new Error(`getMoveBySlug failed: ${result.error.message}`);
  if (!result.data) return null;
  const row = result.data as MoveDetailRow;

  const statChangesResult = await client
    .from('move_stat_change')
    .select('stat, change')
    .eq('move_id', row.id)
    .order('sort_order', { ascending: true });
  if (statChangesResult.error) {
    throw new Error(`getMoveBySlug (stat changes) failed: ${statChangesResult.error.message}`);
  }
  const statChanges = (statChangesResult.data as MoveStatChangeRow[]).map((r) => ({
    stat: r.stat as MoveStat,
    change: r.change,
  }));

  return toMoveDetail(row, statChanges);
}

/**
 * The version group to default the UI to when none is explicitly selected
 * (Pokémon detail's Moves section, move detail's "Pokémon that learn this"
 * list) — the newest-generation version group that actually has learnset
 * rows. Not simply "the newest version_group row": a few announced/DLC
 * version groups in the reference table (e.g. an unreleased game) can have
 * zero pokemon_form_move rows if PokéAPI hasn't published per-Pokémon
 * learnsets for them yet, and defaulting to an empty game context would show
 * a misleadingly empty Moves section. Walks newest-first and stops at the
 * first version group with at least one row — typically the very first
 * candidate, so this is a handful of small indexed lookups, not a scan.
 */
export async function getDefaultVersionGroup(
  client: PokeStudioDatabaseClient,
): Promise<VersionGroupSummary | null> {
  const versionGroupsResult = await client
    .from('version_group')
    .select('id, slug, generation, display_order')
    .order('generation', { ascending: false })
    .order('display_order', { ascending: false });
  if (versionGroupsResult.error) {
    throw new Error(
      `getDefaultVersionGroup (version groups) failed: ${versionGroupsResult.error.message}`,
    );
  }

  for (const versionGroup of versionGroupsResult.data) {
    // "Has any row at all" is too weak a signal: a real full-dataset case
    // (version group "champions", generation 9) has thousands of rows but
    // *only* via the niche "train" learn method — no genuine per-species
    // moveset coverage. Every real, playable mainline game has level-up
    // rows (every Pokémon learns something at level 1), so requiring at
    // least one level-up row is a much stronger signal of "this version
    // group has real, useful moveset data" than mere row presence.
    const countResult = await client
      .from('pokemon_form_move')
      .select('id', { count: 'exact', head: true })
      .eq('version_group_id', versionGroup.id)
      .eq('learn_method', 'level-up');
    if (countResult.error) {
      throw new Error(`getDefaultVersionGroup (count) failed: ${countResult.error.message}`);
    }
    if ((countResult.count ?? 0) > 0) {
      return {
        slug: versionGroup.slug,
        generation: versionGroup.generation,
        displayOrder: versionGroup.display_order,
      };
    }
  }
  return null;
}

/** One raw (move, version group, method, level) fact — the client-side moves explorer's unit of data. */
export interface FormLearnsetAllEntry {
  moveSlug: string;
  versionGroupSlug: string;
  learnMethod: string;
  /** 0 = not applicable (non-level-up) or "known upon evolution" (level-up) — see NormalizedLearnsetEntry. */
  level: number;
}

export interface FormLearnsetAllVersionGroups {
  /** Newest-first — only groups this form actually has data in. */
  versionGroups: VersionGroupSummary[];
  /** Every unique move this form can learn in any version group — never repeated per version group/entry. */
  moves: MoveSummary[];
  entries: FormLearnsetAllEntry[];
}

/**
 * A form's *entire* learnset across every version group it has data in, in
 * one bounded fetch (Phase 1C.2b instant client-side version switching —
 * moves/entries are normalized/deduplicated, not repeated per version group,
 * so the payload stays proportional to the form's real move count, not
 * `moves × version groups`). Scoped entirely to *this form's own* indexed
 * rows (`pokemon_form_move_form_version_idx`'s leading column) — never a
 * query across the whole ~693k-row table. Paginated past PostgREST's
 * default 1000-row cap: a handful of forms with data in every version group
 * (Mew, Mewtwo, Chansey, ...) have 1500-2700+ raw rows. Null if the form
 * doesn't exist.
 */
export async function getFormLearnsetAllVersionGroups(
  client: PokeStudioDatabaseClient,
  formSlug: string,
): Promise<FormLearnsetAllVersionGroups | null> {
  const formResult = await client
    .from('pokemon_form')
    .select('id')
    .eq('slug', formSlug)
    .maybeSingle();
  if (formResult.error) {
    throw new Error(`getFormLearnsetAllVersionGroups (form) failed: ${formResult.error.message}`);
  }
  if (!formResult.data) return null;
  const formId = formResult.data.id;

  const rawEntries = await selectAllRows<{
    move_id: string;
    version_group_id: string;
    learn_method: string;
    level: number;
  }>((from, to) =>
    client
      .from('pokemon_form_move')
      .select('move_id, version_group_id, learn_method, level')
      .eq('pokemon_form_id', formId)
      .range(from, to),
  );
  if (rawEntries.length === 0) return { versionGroups: [], moves: [], entries: [] };

  const moveIds = [...new Set(rawEntries.map((entry) => entry.move_id))];
  const versionGroupIds = [...new Set(rawEntries.map((entry) => entry.version_group_id))];

  const [movesResult, versionGroupsResult] = await Promise.all([
    client
      .from('move')
      .select('id, slug, name_en, name_es, type, damage_class, power, accuracy, pp, priority')
      .in('id', moveIds),
    client
      .from('version_group')
      .select('id, slug, generation, display_order')
      .in('id', versionGroupIds)
      .order('generation', { ascending: false })
      .order('display_order', { ascending: false }),
  ]);
  if (movesResult.error) {
    throw new Error(`getFormLearnsetAllVersionGroups (moves) failed: ${movesResult.error.message}`);
  }
  if (versionGroupsResult.error) {
    throw new Error(
      `getFormLearnsetAllVersionGroups (version groups) failed: ${versionGroupsResult.error.message}`,
    );
  }

  const moveById = new Map(movesResult.data.map((row) => [row.id, toMoveSummary(row as MoveRow)]));
  const versionGroupSlugById = new Map(versionGroupsResult.data.map((row) => [row.id, row.slug]));

  const entries: FormLearnsetAllEntry[] = [];
  for (const entry of rawEntries) {
    const moveSlug = moveById.get(entry.move_id)?.slug;
    const versionGroupSlug = versionGroupSlugById.get(entry.version_group_id);
    if (!moveSlug || !versionGroupSlug) continue; // defensive: should never happen given the FK constraints
    entries.push({
      moveSlug,
      versionGroupSlug,
      learnMethod: entry.learn_method,
      level: entry.level,
    });
  }

  return {
    versionGroups: versionGroupsResult.data.map((row) => ({
      slug: row.slug,
      generation: row.generation,
      displayOrder: row.display_order,
    })),
    moves: [...moveById.values()].sort((a, b) => a.nameEn.localeCompare(b.nameEn)),
    entries,
  };
}

export interface MovePage {
  items: MoveSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** One page of the move index (/[locale]/moves), ordered alphabetically by English name. */
/**
 * Server/database-backed filters for the global move index (Phase 1C.2b
 * task §6) — deliberately not an Excel-like query builder: a text search
 * (matched against both localized names) plus three exact-match filters and
 * one sort column. `search` is intentionally locale-agnostic (matches
 * `name_en` OR `name_es` regardless of the page's own locale) so a Spanish
 * user typing an English name they already know still finds the move.
 */
export interface MoveListFilters {
  search?: string | undefined;
  type?: PokemonType | undefined;
  damageClass?: DamageClass | undefined;
  generation?: number | undefined;
  sortBy?: 'name' | 'power' | 'accuracy' | 'pp' | undefined;
  sortDirection?: 'asc' | 'desc' | undefined;
}

const MOVE_SORT_COLUMN: Record<NonNullable<MoveListFilters['sortBy']>, string> = {
  name: 'name_en',
  power: 'power',
  accuracy: 'accuracy',
  pp: 'pp',
};

/** One page of the move index, filtered/sorted entirely in Postgres — never loads the full ~937-move table into the browser to filter client-side. */
export async function listMovesPage(
  client: PokeStudioDatabaseClient,
  options: { page: number; pageSize: number; filters?: MoveListFilters },
): Promise<MovePage> {
  const from = (options.page - 1) * options.pageSize;
  const to = from + options.pageSize - 1;
  const filters = options.filters ?? {};
  const sortColumn = MOVE_SORT_COLUMN[filters.sortBy ?? 'name'];
  const ascending = filters.sortDirection !== 'desc';

  let dataQuery = client
    .from('move')
    .select('slug, name_en, name_es, type, damage_class, power, accuracy, pp, priority');
  let countQuery = client.from('move').select('id', { count: 'exact', head: true });

  if (filters.search && filters.search.trim()) {
    // PostgREST .or() syntax: comma-separated "column.op.value" clauses.
    // "%"-wrap for a substring ilike match; commas in user input can't
    // break this since a literal comma inside a value would need
    // percent-encoding to be interpreted as a separator here.
    const escaped = filters.search.trim().replace(/[%,()]/g, '');
    const clause = `name_en.ilike.%${escaped}%,name_es.ilike.%${escaped}%`;
    dataQuery = dataQuery.or(clause);
    countQuery = countQuery.or(clause);
  }
  if (filters.type) {
    dataQuery = dataQuery.eq('type', filters.type);
    countQuery = countQuery.eq('type', filters.type);
  }
  if (filters.damageClass) {
    dataQuery = dataQuery.eq('damage_class', filters.damageClass);
    countQuery = countQuery.eq('damage_class', filters.damageClass);
  }
  if (filters.generation) {
    dataQuery = dataQuery.eq('generation', filters.generation);
    countQuery = countQuery.eq('generation', filters.generation);
  }

  const [movesResult, countResult] = await Promise.all([
    dataQuery.order(sortColumn, { ascending, nullsFirst: false }).range(from, to),
    countQuery,
  ]);
  if (movesResult.error)
    throw new Error(`listMovesPage (moves) failed: ${movesResult.error.message}`);
  if (countResult.error)
    throw new Error(`listMovesPage (count) failed: ${countResult.error.message}`);

  const totalCount = countResult.count ?? 0;
  return {
    items: movesResult.data.map((row) => toMoveSummary(row as MoveRow)),
    page: options.page,
    pageSize: options.pageSize,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / options.pageSize)),
  };
}

/**
 * One form that can learn a move — deliberately its own shape, not
 * `SpeciesFormSummary`: the Pokémon detail route is keyed by *species* slug
 * (`/pokemon/[speciesSlug]`), which differs from a non-default form's own
 * slug (e.g. form "rotom-heat" belongs to species "rotom") — `speciesSlug`
 * is what a "Pokémon that can learn this move" link must point at.
 */
export interface MoveLearnerItem {
  formSlug: string;
  speciesSlug: string;
  name: LocalizedName;
  isDefault: boolean;
  types: PokemonType[];
}

export interface MoveLearnerPage {
  items: MoveLearnerItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/**
 * Forms that can learn a given move in a given version group (move detail's
 * "Pokémon that can learn it" section). Null if the move doesn't exist; an
 * empty page is a real state (no form learns it in this version group).
 */
export async function getMoveLearners(
  client: PokeStudioDatabaseClient,
  moveSlug: string,
  versionGroupSlug: string,
  options: { page: number; pageSize: number },
): Promise<MoveLearnerPage | null> {
  const moveResult = await client.from('move').select('id').eq('slug', moveSlug).maybeSingle();
  if (moveResult.error)
    throw new Error(`getMoveLearners (move) failed: ${moveResult.error.message}`);
  if (!moveResult.data) return null;

  const versionGroupResult = await client
    .from('version_group')
    .select('id')
    .eq('slug', versionGroupSlug)
    .maybeSingle();
  if (versionGroupResult.error) {
    throw new Error(`getMoveLearners (version group) failed: ${versionGroupResult.error.message}`);
  }
  const emptyPage = {
    items: [],
    page: options.page,
    pageSize: options.pageSize,
    totalCount: 0,
    totalPages: 1,
  };
  if (!versionGroupResult.data) return emptyPage;

  // At most a few thousand rows for even the most common moves (Tackle-tier);
  // deduplicated to distinct forms in JS, then paginated — a single move's
  // learner set is never large enough to need a second round trip per page.
  const entriesResult = await client
    .from('pokemon_form_move')
    .select('pokemon_form_id')
    .eq('move_id', moveResult.data.id)
    .eq('version_group_id', versionGroupResult.data.id);
  if (entriesResult.error) {
    throw new Error(`getMoveLearners (entries) failed: ${entriesResult.error.message}`);
  }
  const formIds = [...new Set(entriesResult.data.map((row) => row.pokemon_form_id))];
  if (formIds.length === 0) return emptyPage;

  const from = (options.page - 1) * options.pageSize;
  const to = from + options.pageSize;
  const pageFormIds = formIds.slice(from, to);
  if (pageFormIds.length === 0) {
    return {
      ...emptyPage,
      totalCount: formIds.length,
      totalPages: Math.max(1, Math.ceil(formIds.length / options.pageSize)),
    };
  }

  const formsResult = await client
    .from('pokemon_form')
    .select('species_id, slug, name_en, name_es, is_default, types')
    .in('id', pageFormIds);
  if (formsResult.error)
    throw new Error(`getMoveLearners (forms) failed: ${formsResult.error.message}`);

  const speciesIds = [...new Set(formsResult.data.map((row) => row.species_id))];
  const speciesResult = await client.from('species').select('id, slug').in('id', speciesIds);
  if (speciesResult.error) {
    throw new Error(`getMoveLearners (species) failed: ${speciesResult.error.message}`);
  }
  const speciesSlugById = new Map(speciesResult.data.map((row) => [row.id, row.slug]));

  return {
    items: formsResult.data.map((row) => ({
      formSlug: row.slug,
      speciesSlug: speciesSlugById.get(row.species_id) ?? row.slug,
      name: { en: row.name_en, es: row.name_es },
      isDefault: row.is_default,
      types: row.types as PokemonType[],
    })),
    page: options.page,
    pageSize: options.pageSize,
    totalCount: formIds.length,
    totalPages: Math.max(1, Math.ceil(formIds.length / options.pageSize)),
  };
}
