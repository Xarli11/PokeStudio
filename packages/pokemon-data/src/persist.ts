import type { SupabaseClient } from '@supabase/supabase-js';

import type { DataProvenance, NormalizedDataset, SourceRef } from './types';

/**
 * Minimal write-side schema shape for the 3 tables this module upserts.
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
  batches: number;
}

const BATCH_SIZE = 500;

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

  return {
    dataSourceUpserted: true,
    speciesUpserted: speciesPayload.length,
    formsUpserted: formsPayload.length,
    batches,
  };
}
