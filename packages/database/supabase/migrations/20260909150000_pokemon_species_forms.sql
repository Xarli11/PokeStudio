-- PokeStudio Phase 1A normalized Pokémon reference schema (ADR-0010).
--
-- Supersedes the Phase 0 flattened `species` spike table: species and forms
-- are now separate, because types/base stats can differ *by form*, not just
-- by species (proven by this phase's own representative sample — Alolan and
-- Galarian Meowth have different types AND base stats from Kantonian
-- Meowth, despite sharing a species).

drop table if exists public.species;

-- The biological/canonical Pokémon species: dex number, canonical identity,
-- localized name. Does not carry types/stats — see public.pokemon_form.
create table public.species (
  id uuid primary key default gen_random_uuid(),
  -- PokeStudio's own stable identity — never PokéAPI's id (ADR-0010).
  slug text not null unique,
  national_dex_number integer not null unique,
  name_en text not null,
  name_es text not null,
  -- Provenance (docs/engineering/DATA_SOURCES.md): which import produced this row, and this
  -- row's id within that source. Never used as this row's identity.
  source_id text not null references public.data_sources (source_id),
  external_id text not null,
  created_at timestamptz not null default now()
);

comment on table public.species is
  'Canonical Pokémon species (Phase 1A, ADR-0010). Types/stats live on pokemon_form, not here, because they can differ by form.';

-- A specific expression of a species: default, regional, battle-relevant or
-- cosmetic (ADR-0010). Every species has exactly one default form.
create table public.pokemon_form (
  id uuid primary key default gen_random_uuid(),
  species_id uuid not null references public.species (id) on delete cascade,
  slug text not null unique,
  name_en text not null,
  name_es text not null,
  is_default boolean not null default false,
  form_category text not null
    check (form_category in ('default', 'regional', 'battle', 'cosmetic')),
  -- Ordered (primary type first); array preserves that order.
  types text[] not null check (array_length(types, 1) between 1 and 2),
  base_stats jsonb not null,
  source_id text not null references public.data_sources (source_id),
  external_id text not null,
  created_at timestamptz not null default now()
);

comment on table public.pokemon_form is
  'A specific expression of a species — default/regional/battle/cosmetic (Phase 1A, ADR-0010). Types and base stats are scoped here, not to the species, because they can differ by form.';

create index pokemon_form_species_id_idx on public.pokemon_form (species_id);

-- At most one default form per species (partial unique index — a normal
-- unique(species_id, is_default) would also forbid a second *non*-default
-- form, which every multi-form species needs).
create unique index pokemon_form_one_default_per_species_idx
  on public.pokemon_form (species_id)
  where is_default;

-- Reference data is public by default; only service-role writes are allowed
-- (same pattern as data_sources/the superseded species table).
alter table public.species enable row level security;
alter table public.pokemon_form enable row level security;

create policy "Species reference data is publicly readable"
  on public.species
  for select
  to anon, authenticated
  using (true);

create policy "Pokémon form reference data is publicly readable"
  on public.pokemon_form
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies for anon/authenticated: writes are only
-- possible via the service role (ingestion pipeline).
