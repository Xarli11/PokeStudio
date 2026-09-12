import type { SupabaseClient } from '@supabase/supabase-js';

import type { DataProvenance, NormalizedDataset, SourceRef } from './types';

/**
 * Minimal write-side schema shape for the 6 tables this module writes to.
 *
 * Deliberately local rather than importing `@pokestudio/database`'s
 * `Database` type: `packages/database` already depends on this package for
 * shared domain types (`LocalizedName`, `BaseStats`, ...), so importing back
 * from it here would create a circular workspace dependency. This is kept
 * in sync by hand with `packages/database/supabase/migrations/*.sql` — the
 * same manual-sync tradeoff `packages/database/src/types.ts` itself
 * documents, scoped down to only the columns ingestion writes.
 */
export interface IngestSchema {
  public: {
    Tables: {
      data_sources: {
        Row: { source_id: string };
        Insert: {
          source_id: string;
          source_url: string;
          license: string;
          fetched_at: string;
          importer_version: string;
        };
        Update: never;
        Relationships: [];
      };
      species: {
        Row: { id: string; slug: string; source_id: string; external_id: string };
        Insert: {
          slug: string;
          national_dex_number: number;
          name_en: string;
          name_es: string;
          source_id: string;
          external_id: string;
        };
        Update: never;
        Relationships: [];
      };
      pokemon_form: {
        Row: { id: string; slug: string; source_id: string; external_id: string };
        Insert: {
          species_id: string;
          slug: string;
          name_en: string;
          name_es: string;
          is_default: boolean;
          form_category: string;
          types: string[];
          base_stats: Record<string, number>;
          source_id: string;
          external_id: string;
        };
        Update: never;
        Relationships: [];
      };
      ability: {
        Row: { id: string; slug: string; source_id: string; external_id: string };
        Insert: {
          slug: string;
          name_en: string;
          name_es: string | null;
          effect_en: string | null;
          effect_es: string | null;
          source_id: string;
          external_id: string;
        };
        Update: never;
        Relationships: [];
      };
      pokemon_form_ability: {
        Row: {
          id: string;
          pokemon_form_id: string;
          ability_id: string;
          slot: number;
          source_id: string;
        };
        Insert: {
          pokemon_form_id: string;
          ability_id: string;
          slot: number;
          is_hidden: boolean;
          source_id: string;
        };
        Update: never;
        Relationships: [];
      };
      move: {
        Row: { id: string; slug: string; source_id: string; external_id: string };
        Insert: {
          slug: string;
          name_en: string;
          name_es: string | null;
          type: string;
          damage_class: string;
          power: number | null;
          accuracy: number | null;
          pp: number;
          priority: number;
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
          source_id: string;
          external_id: string;
        };
        Update: never;
        Relationships: [];
      };
      version_group: {
        Row: { id: string; slug: string; source_id: string; external_id: string };
        Insert: {
          slug: string;
          generation: number;
          display_order: number;
          source_id: string;
          external_id: string;
        };
        Update: never;
        Relationships: [];
      };
      move_learn_method: {
        Row: { slug: string; source_id: string; external_id: string };
        Insert: { slug: string; source_id: string; external_id: string };
        Update: never;
        Relationships: [];
      };
      pokemon_form_move: {
        Row: { id: string; source_id: string };
        Insert: {
          pokemon_form_id: string;
          move_id: string;
          version_group_id: string;
          learn_method: string;
          level: number;
          sort_order: number | null;
          source_id: string;
        };
        Update: never;
        Relationships: [];
      };
      machine: {
        Row: { id: string; source_id: string; external_id: string };
        Insert: {
          move_id: string;
          version_group_id: string;
          item_slug: string;
          source_id: string;
          external_id: string;
        };
        Update: never;
        Relationships: [];
      };
      species_evolution: {
        Row: { id: string; from_species_id: string; to_species_id: string; source_id: string };
        Insert: {
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
          raw_condition: Record<string, unknown>;
          source_id: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type IngestClient = SupabaseClient<IngestSchema>;

export interface PersistResult {
  dataSourceUpserted: boolean;
  speciesUpserted: number;
  formsUpserted: number;
  abilitiesUpserted: number;
  formAbilitiesWritten: number;
  evolutionsWritten: number;
  movesUpserted: number;
  versionGroupsUpserted: number;
  learnMethodsUpserted: number;
  learnsetEntriesWritten: number;
  machinesUpserted: number;
  batches: number;
}

const BATCH_SIZE = 500;
/**
 * Larger batch size for `pokemon_form_move` only — at ~750k rows (Phase
 * 1C.2, docs/adr/0013-moves-learnsets-schema.md scale estimate), the default
 * 500-row batch would mean ~1500 round trips; 2000 keeps each payload small
 * (~a few hundred KB) while cutting that to ~375.
 */
const LEARNSET_BATCH_SIZE = 2000;

function sourceKey(ref: SourceRef): string {
  return `${ref.sourceId}:${ref.externalId}`;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

const PAGE_SIZE = 1000;

/**
 * Reads every row matching `query`, paginating past PostgREST's default
 * response row cap (`max_rows` in `supabase/config.toml`, 1000 locally) —
 * a plain `.select()` on >1000 species/forms silently truncates instead of
 * erroring, which only shows up once the dataset is this large (found
 * during the first full-Pokédex run, Phase 1B §16 "schema weakness at
 * full scale").
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

async function upsertDataSource(client: IngestClient, provenance: DataProvenance): Promise<void> {
  const { error } = await client.from('data_sources').upsert(
    {
      source_id: provenance.sourceId,
      source_url: provenance.sourceUrl,
      license: provenance.license,
      fetched_at: provenance.fetchedAt,
      importer_version: provenance.importerVersion,
    },
    { onConflict: 'source_id' },
  );
  if (error) throw new Error(`Failed to upsert data_sources: ${error.message}`);
}

/**
 * Batched, identity-based upsert (Phase 1B §3/§10).
 *
 * Species/forms are matched by (source_id, external_id) — PokeStudio's
 * record of upstream identity — never by slug. Any row that already exists
 * keeps its *original* slug (fetched first, reused verbatim in the upsert
 * payload) so re-running ingestion — or a future production re-sync — can
 * never silently rewrite a public URL, even if upstream naming ever changed
 * (Phase 1B §15 "Slug stability").
 *
 * Each batch is one upsert statement (Postgres commits it atomically); the
 * run as a whole is not one big transaction. If it fails partway, already-
 * committed batches remain and the script reports exactly where it stopped —
 * simply re-running ingestion is safe and completes the rest, since the
 * upsert is idempotent. A single cross-batch transaction was deliberately
 * not built: it would need a bespoke Postgres function/RPC for a dev
 * ingestion tool, for a failure mode (mid-run crash) re-running already
 * recovers from (DATABASE.md "Ingestion write strategy").
 */
export async function persistDataset(
  client: IngestClient,
  dataset: NormalizedDataset,
): Promise<PersistResult> {
  await upsertDataSource(client, dataset.provenance);

  const existingSpeciesRows = await selectAllRows((from, to) =>
    client.from('species').select('slug, source_id, external_id').range(from, to),
  );
  const existingSpeciesSlugByKey = new Map(
    existingSpeciesRows.map((row) => [`${row.source_id}:${row.external_id}`, row.slug]),
  );

  const speciesPayload = dataset.species.map((species) => ({
    slug: existingSpeciesSlugByKey.get(sourceKey(species.source)) ?? species.slug,
    national_dex_number: species.nationalDexNumber,
    name_en: species.name.en,
    name_es: species.name.es,
    source_id: species.source.sourceId,
    external_id: species.source.externalId,
  }));

  let batches = 0;
  for (const batch of chunk(speciesPayload, BATCH_SIZE)) {
    const { error } = await client
      .from('species')
      .upsert(batch, { onConflict: 'source_id,external_id' });
    if (error) throw new Error(`Failed to upsert species batch: ${error.message}`);
    batches++;
  }

  // Resolve species_id for the forms batch — read back by source identity,
  // never by slug (a form's `speciesSlug` is the *freshly normalized* slug,
  // which may differ from a preserved existing slug in the rare case a
  // species' upstream name ever changed).
  const speciesBySlug = new Map(dataset.species.map((species) => [species.slug, species]));
  const speciesIdRows = await selectAllRows((from, to) =>
    client.from('species').select('id, source_id, external_id').range(from, to),
  );
  const speciesIdByKey = new Map(
    speciesIdRows.map((row) => [`${row.source_id}:${row.external_id}`, row.id]),
  );

  const existingFormRows = await selectAllRows((from, to) =>
    client.from('pokemon_form').select('slug, source_id, external_id').range(from, to),
  );
  const existingFormSlugByKey = new Map(
    existingFormRows.map((row) => [`${row.source_id}:${row.external_id}`, row.slug]),
  );

  const formsPayload = dataset.forms.map((form) => {
    const species = speciesBySlug.get(form.speciesSlug);
    if (!species)
      throw new Error(`Orphan form "${form.slug}": unknown species "${form.speciesSlug}"`);
    const speciesId = speciesIdByKey.get(sourceKey(species.source));
    if (!speciesId) {
      throw new Error(
        `Could not resolve species_id for form "${form.slug}" (species "${form.speciesSlug}")`,
      );
    }
    return {
      species_id: speciesId,
      slug: existingFormSlugByKey.get(sourceKey(form.source)) ?? form.slug,
      name_en: form.name.en,
      name_es: form.name.es,
      is_default: form.isDefault,
      form_category: form.category,
      types: form.types,
      base_stats: { ...form.baseStats } satisfies Record<string, number>,
      source_id: form.source.sourceId,
      external_id: form.source.externalId,
    };
  });

  for (const batch of chunk(formsPayload, BATCH_SIZE)) {
    const { error } = await client
      .from('pokemon_form')
      .upsert(batch, { onConflict: 'source_id,external_id' });
    if (error) throw new Error(`Failed to upsert pokemon_form batch: ${error.message}`);
    batches++;
  }

  // Abilities: identity-based upsert, same slug-preserving pattern as
  // species/pokemon_form above — an ability's slug is stable public
  // identity too, once anything (a future ability page) links to it.
  const existingAbilityRows = await selectAllRows((from, to) =>
    client.from('ability').select('slug, source_id, external_id').range(from, to),
  );
  const existingAbilitySlugByKey = new Map(
    existingAbilityRows.map((row) => [`${row.source_id}:${row.external_id}`, row.slug]),
  );

  const abilitiesPayload = dataset.abilities.map((ability) => ({
    slug: existingAbilitySlugByKey.get(sourceKey(ability.source)) ?? ability.slug,
    name_en: ability.nameEn,
    name_es: ability.nameEs ?? null,
    effect_en: ability.effectEn ?? null,
    effect_es: ability.effectEs ?? null,
    source_id: ability.source.sourceId,
    external_id: ability.source.externalId,
  }));

  for (const batch of chunk(abilitiesPayload, BATCH_SIZE)) {
    const { error } = await client
      .from('ability')
      .upsert(batch, { onConflict: 'source_id,external_id' });
    if (error) throw new Error(`Failed to upsert ability batch: ${error.message}`);
    batches++;
  }

  // pokemon_form_ability / species_evolution have no stable identity of
  // their own upstream (PokéAPI's abilities[]/evolution_details[] are array
  // positions, not addressable resources — ADR-0011 decision 3), so each is
  // fully replaced per source_id per run rather than upserted by identity.
  // Both are small tables; this keeps idempotency trivially correct without
  // a synthetic key that could silently drift if PokéAPI ever reorders
  // either array.
  const formIdRows = await selectAllRows((from, to) =>
    client.from('pokemon_form').select('id, slug').range(from, to),
  );
  const formIdBySlug = new Map(formIdRows.map((row) => [row.slug, row.id]));

  const abilityIdRows = await selectAllRows((from, to) =>
    client.from('ability').select('id, slug').range(from, to),
  );
  const abilityIdBySlug = new Map(abilityIdRows.map((row) => [row.slug, row.id]));

  const formAbilitiesPayload = dataset.formAbilities.map((formAbility) => {
    const formId = formIdBySlug.get(formAbility.formSlug);
    if (!formId) throw new Error(`Orphan form ability: unknown form "${formAbility.formSlug}"`);
    const abilityId = abilityIdBySlug.get(formAbility.abilitySlug);
    if (!abilityId) {
      throw new Error(`Orphan form ability: unknown ability "${formAbility.abilitySlug}"`);
    }
    return {
      pokemon_form_id: formId,
      ability_id: abilityId,
      slot: formAbility.slot,
      is_hidden: formAbility.isHidden,
      source_id: dataset.provenance.sourceId,
    };
  });

  const { error: deleteFormAbilityError } = await client
    .from('pokemon_form_ability')
    .delete()
    .eq('source_id', dataset.provenance.sourceId);
  if (deleteFormAbilityError) {
    throw new Error(`Failed to clear pokemon_form_ability: ${deleteFormAbilityError.message}`);
  }
  for (const batch of chunk(formAbilitiesPayload, BATCH_SIZE)) {
    const { error } = await client.from('pokemon_form_ability').insert(batch);
    if (error) throw new Error(`Failed to insert pokemon_form_ability batch: ${error.message}`);
    batches++;
  }

  const speciesIdRowsForEvolutions = await selectAllRows((from, to) =>
    client.from('species').select('id, slug').range(from, to),
  );
  const speciesIdBySlug = new Map(speciesIdRowsForEvolutions.map((row) => [row.slug, row.id]));

  const evolutionsPayload = dataset.evolutions.map((evolution) => {
    const fromSpeciesId = speciesIdBySlug.get(evolution.fromSpeciesSlug);
    if (!fromSpeciesId) {
      throw new Error(`Orphan evolution: unknown species "${evolution.fromSpeciesSlug}"`);
    }
    const toSpeciesId = speciesIdBySlug.get(evolution.toSpeciesSlug);
    if (!toSpeciesId) {
      throw new Error(`Orphan evolution: unknown species "${evolution.toSpeciesSlug}"`);
    }
    return {
      from_species_id: fromSpeciesId,
      to_species_id: toSpeciesId,
      evolution_chain_external_id: evolution.chainExternalId,
      trigger: evolution.trigger,
      min_level: evolution.minLevel ?? null,
      item_slug: evolution.itemSlug ?? null,
      held_item_slug: evolution.heldItemSlug ?? null,
      min_happiness: evolution.minHappiness ?? null,
      min_beauty: evolution.minBeauty ?? null,
      min_affection: evolution.minAffection ?? null,
      time_of_day: evolution.timeOfDay ?? null,
      known_move_slug: evolution.knownMoveSlug ?? null,
      known_move_type_slug: evolution.knownMoveTypeSlug ?? null,
      location_slug: evolution.locationSlug ?? null,
      gender: evolution.gender ?? null,
      trade_species_slug: evolution.tradeSpeciesSlug ?? null,
      party_species_slug: evolution.partySpeciesSlug ?? null,
      party_type_slug: evolution.partyTypeSlug ?? null,
      relative_physical_stats: evolution.relativePhysicalStats ?? null,
      needs_overworld_rain: evolution.needsOverworldRain,
      turn_upside_down: evolution.turnUpsideDown,
      raw_condition: evolution.raw,
      source_id: evolution.source.sourceId,
    };
  });

  const { error: deleteEvolutionError } = await client
    .from('species_evolution')
    .delete()
    .eq('source_id', dataset.provenance.sourceId);
  if (deleteEvolutionError) {
    throw new Error(`Failed to clear species_evolution: ${deleteEvolutionError.message}`);
  }
  for (const batch of chunk(evolutionsPayload, BATCH_SIZE)) {
    const { error } = await client.from('species_evolution').insert(batch);
    if (error) throw new Error(`Failed to insert species_evolution batch: ${error.message}`);
    batches++;
  }

  // Moves: identity-based upsert, same slug-preserving pattern as
  // species/pokemon_form/ability above.
  const existingMoveRows = await selectAllRows((from, to) =>
    client.from('move').select('slug, source_id, external_id').range(from, to),
  );
  const existingMoveSlugByKey = new Map(
    existingMoveRows.map((row) => [`${row.source_id}:${row.external_id}`, row.slug]),
  );

  const movesPayload = dataset.moves.map((move) => ({
    slug: existingMoveSlugByKey.get(sourceKey(move.source)) ?? move.slug,
    name_en: move.nameEn,
    name_es: move.nameEs ?? null,
    type: move.type,
    damage_class: move.damageClass,
    power: move.power ?? null,
    accuracy: move.accuracy ?? null,
    pp: move.pp,
    priority: move.priority,
    target: move.target,
    generation: move.generation,
    effect_en: move.effectEn ?? null,
    effect_es: move.effectEs ?? null,
    effect_chance: move.effectChance ?? null,
    ailment: move.ailment ?? null,
    category: move.category ?? null,
    min_hits: move.minHits ?? null,
    max_hits: move.maxHits ?? null,
    min_turns: move.minTurns ?? null,
    max_turns: move.maxTurns ?? null,
    drain: move.drain,
    healing: move.healing,
    crit_rate: move.critRate,
    ailment_chance: move.ailmentChance,
    flinch_chance: move.flinchChance,
    stat_chance: move.statChance,
    source_id: move.source.sourceId,
    external_id: move.source.externalId,
  }));

  for (const batch of chunk(movesPayload, BATCH_SIZE)) {
    const { error } = await client
      .from('move')
      .upsert(batch, { onConflict: 'source_id,external_id' });
    if (error) throw new Error(`Failed to upsert move batch: ${error.message}`);
    batches++;
  }

  // Version groups: identity-based upsert, same pattern.
  const existingVersionGroupRows = await selectAllRows((from, to) =>
    client.from('version_group').select('slug, source_id, external_id').range(from, to),
  );
  const existingVersionGroupSlugByKey = new Map(
    existingVersionGroupRows.map((row) => [`${row.source_id}:${row.external_id}`, row.slug]),
  );

  const versionGroupsPayload = dataset.versionGroups.map((versionGroup) => ({
    slug: existingVersionGroupSlugByKey.get(sourceKey(versionGroup.source)) ?? versionGroup.slug,
    generation: versionGroup.generation,
    display_order: versionGroup.displayOrder,
    source_id: versionGroup.source.sourceId,
    external_id: versionGroup.source.externalId,
  }));

  for (const batch of chunk(versionGroupsPayload, BATCH_SIZE)) {
    const { error } = await client
      .from('version_group')
      .upsert(batch, { onConflict: 'source_id,external_id' });
    if (error) throw new Error(`Failed to upsert version_group batch: ${error.message}`);
    batches++;
  }

  // Learn methods: the slug itself is the PK and is PokéAPI's own stable
  // identity (e.g. "level-up" never renames), so this upserts directly by
  // slug rather than the source_id/external_id-preserving dance above.
  const learnMethodsPayload = dataset.learnMethods.map((method) => ({
    slug: method.slug,
    source_id: method.source.sourceId,
    external_id: method.source.externalId,
  }));

  for (const batch of chunk(learnMethodsPayload, BATCH_SIZE)) {
    const { error } = await client.from('move_learn_method').upsert(batch, { onConflict: 'slug' });
    if (error) throw new Error(`Failed to upsert move_learn_method batch: ${error.message}`);
    batches++;
  }

  // Resolve move_id/version_group_id for the learnset + machine payloads.
  const moveIdRows = await selectAllRows((from, to) =>
    client.from('move').select('id, slug').range(from, to),
  );
  const moveIdBySlug = new Map(moveIdRows.map((row) => [row.slug, row.id]));

  const versionGroupIdRows = await selectAllRows((from, to) =>
    client.from('version_group').select('id, slug').range(from, to),
  );
  const versionGroupIdBySlug = new Map(versionGroupIdRows.map((row) => [row.slug, row.id]));

  // pokemon_form_move has no independent identity of its own upstream
  // (PokéAPI's version_group_details entries are array positions, not
  // addressable resources — same reasoning as pokemon_form_ability/
  // species_evolution, ADR-0011 decision 3), so it is fully replaced per
  // source_id per run rather than upserted by identity.
  const learnsetPayload = dataset.learnsetEntries.map((entry) => {
    const formId = formIdBySlug.get(entry.formSlug);
    if (!formId) throw new Error(`Orphan learnset entry: unknown form "${entry.formSlug}"`);
    const moveId = moveIdBySlug.get(entry.moveSlug);
    if (!moveId) throw new Error(`Orphan learnset entry: unknown move "${entry.moveSlug}"`);
    const versionGroupId = versionGroupIdBySlug.get(entry.versionGroupSlug);
    if (!versionGroupId) {
      throw new Error(`Orphan learnset entry: unknown version group "${entry.versionGroupSlug}"`);
    }
    return {
      pokemon_form_id: formId,
      move_id: moveId,
      version_group_id: versionGroupId,
      learn_method: entry.learnMethodSlug,
      level: entry.level,
      sort_order: entry.sortOrder ?? null,
      source_id: dataset.provenance.sourceId,
    };
  });

  const { error: deleteLearnsetError } = await client
    .from('pokemon_form_move')
    .delete()
    .eq('source_id', dataset.provenance.sourceId);
  if (deleteLearnsetError) {
    throw new Error(`Failed to clear pokemon_form_move: ${deleteLearnsetError.message}`);
  }
  for (const batch of chunk(learnsetPayload, LEARNSET_BATCH_SIZE)) {
    const { error } = await client.from('pokemon_form_move').insert(batch);
    if (error) throw new Error(`Failed to insert pokemon_form_move batch: ${error.message}`);
    batches++;
  }

  // Machines: identity-based upsert, same pattern as move/ability/species —
  // but with no slug to preserve (machine has none), the upsert can write
  // directly without a read-back-existing-rows step first.
  const machinesPayload = dataset.machines.map((machine) => {
    const moveId = moveIdBySlug.get(machine.moveSlug);
    if (!moveId) throw new Error(`Orphan machine: unknown move "${machine.moveSlug}"`);
    const versionGroupId = versionGroupIdBySlug.get(machine.versionGroupSlug);
    if (!versionGroupId) {
      throw new Error(`Orphan machine: unknown version group "${machine.versionGroupSlug}"`);
    }
    return {
      move_id: moveId,
      version_group_id: versionGroupId,
      item_slug: machine.itemSlug,
      source_id: machine.source.sourceId,
      external_id: machine.source.externalId,
    };
  });

  for (const batch of chunk(machinesPayload, BATCH_SIZE)) {
    const { error } = await client
      .from('machine')
      .upsert(batch, { onConflict: 'source_id,external_id' });
    if (error) throw new Error(`Failed to upsert machine batch: ${error.message}`);
    batches++;
  }

  return {
    dataSourceUpserted: true,
    speciesUpserted: speciesPayload.length,
    formsUpserted: formsPayload.length,
    abilitiesUpserted: abilitiesPayload.length,
    formAbilitiesWritten: formAbilitiesPayload.length,
    evolutionsWritten: evolutionsPayload.length,
    movesUpserted: movesPayload.length,
    versionGroupsUpserted: versionGroupsPayload.length,
    learnMethodsUpserted: learnMethodsPayload.length,
    learnsetEntriesWritten: learnsetPayload.length,
    machinesUpserted: machinesPayload.length,
    batches,
  };
}
