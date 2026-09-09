-- PokeStudio reference-data schema (Phase 0 spike).
--
-- Scope is intentionally small: enough to prove the migration workflow and
-- the public-read / service-write RLS pattern for reference data
-- (DATABASE.md, SECURITY.md). Full Explore data model arrives in Phase 1.

-- Provenance for every imported reference dataset (DATA_SOURCES.md).
create table if not exists public.data_sources (
  source_id text primary key,
  source_url text not null,
  license text not null,
  fetched_at timestamptz not null,
  importer_version text not null
);

comment on table public.data_sources is
  'Provenance record for each imported external dataset. See DATA_SOURCES.md.';

-- Minimal species reference table (subset of the eventual normalized model).
create table if not exists public.species (
  id text primary key,
  national_dex_number integer not null unique,
  name_en text not null,
  name_es text not null,
  types text[] not null,
  base_stats jsonb not null,
  introduced_in_generation smallint not null,
  source_id text not null references public.data_sources (source_id),
  created_at timestamptz not null default now(),
  constraint species_types_count check (array_length(types, 1) between 1 and 2),
  constraint species_generation_range check (introduced_in_generation between 1 and 9)
);

comment on table public.species is
  'Phase 0 spike subset of PokeStudio normalized species reference data.';

create index if not exists species_national_dex_number_idx
  on public.species (national_dex_number);

-- Reference data is public by default; only service-role writes are allowed.
alter table public.data_sources enable row level security;
alter table public.species enable row level security;

create policy "Reference data sources are publicly readable"
  on public.data_sources
  for select
  to anon, authenticated
  using (true);

create policy "Species reference data is publicly readable"
  on public.species
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies are defined for anon/authenticated:
-- writes are only possible via the service role (ingestion pipeline),
-- matching the "service-only operations are not accidentally available
-- client-side" requirement in DATABASE.md.
