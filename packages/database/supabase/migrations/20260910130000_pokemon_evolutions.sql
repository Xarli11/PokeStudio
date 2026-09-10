-- Phase 1C.1 Part B: Pokémon evolutions, modeled as a graph of edges between
-- species — never a fixed "stage_1/stage_2/stage_3" structure. See
-- docs/adr/0011-abilities-evolutions-schema.md for the full rationale.
--
-- species A --(condition(s))--> species B --(condition(s))--> species C
--
-- A species with no evolution has zero rows referencing it. Branching
-- (Eevee) is multiple rows sharing from_species_id. A species with more than
-- one valid evolution method to the *same* target (Feebas: max Beauty, or
-- trade holding Prism Scale) is multiple rows sharing (from_species_id, to_species_id).

create table public.species_evolution (
  id uuid primary key default gen_random_uuid(),
  from_species_id uuid not null references public.species (id) on delete cascade,
  to_species_id uuid not null references public.species (id) on delete cascade,
  -- Groups every edge belonging to the same evolution family — PokéAPI's own
  -- evolution-chain id, not a PokeStudio invention. Lets a detail page fetch
  -- a whole family (typically 1-9 rows) without a recursive query or a
  -- full-table scan (see packages/database/src/queries.ts).
  evolution_chain_external_id text not null,
  -- Free-form, not a checked enum: PokéAPI's trigger vocabulary has grown
  -- across generations (level-up, trade, use-item, shed, spin,
  -- tower-of-darkness/-waters, three-critical-hits, agile-style-move, ...)
  -- and a closed check constraint would need a migration for every new one.
  trigger text not null,
  min_level smallint,
  item_slug text,
  held_item_slug text,
  min_happiness smallint,
  min_beauty smallint,
  min_affection smallint,
  time_of_day text check (time_of_day in ('day', 'night')),
  known_move_slug text,
  known_move_type_slug text,
  location_slug text,
  -- PokéAPI's raw gender index: 1 = female, 2 = male. Null = no requirement.
  gender smallint,
  trade_species_slug text,
  party_species_slug text,
  party_type_slug text,
  -- Tyrogue-style: -1 (attack < defense), 0 (equal), 1 (attack > defense).
  relative_physical_stats smallint,
  needs_overworld_rain boolean not null default false,
  turn_upside_down boolean not null default false,
  -- The complete raw PokéAPI evolution-details entry, preserved verbatim so
  -- a future feature can use a condition this migration didn't model as its
  -- own column without re-fetching or losing data (Phase 1C.1 §B6).
  raw_condition jsonb not null default '{}'::jsonb,
  source_id text not null references public.data_sources (source_id),
  created_at timestamptz not null default now(),
  constraint species_evolution_not_self check (from_species_id != to_species_id)
);

comment on table public.species_evolution is
  'One evolution edge (from_species -> to_species) plus its condition(s) (Phase 1C.1, Part B). Graph/edge model, not stage columns — see docs/adr/0011-abilities-evolutions-schema.md. No independent external_id: PokéAPI''s evolution_details entries have no stable id of their own, so ingestion fully replaces every row for a source_id per run rather than upserting by identity (see packages/pokemon-data/src/persist.ts).';

create index species_evolution_from_species_id_idx on public.species_evolution (from_species_id);
create index species_evolution_to_species_id_idx on public.species_evolution (to_species_id);
create index species_evolution_chain_external_id_idx on public.species_evolution (evolution_chain_external_id);

alter table public.species_evolution enable row level security;

create policy "Species evolution reference data is publicly readable"
  on public.species_evolution
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies for anon/authenticated: writes are only
-- possible via the service role (ingestion pipeline).
