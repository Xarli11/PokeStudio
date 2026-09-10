-- Phase 1C.1 Part A: Pokémon abilities (ADR-0010 decision #4 — abilities are
-- their own entity, referenced by form, never duplicated inline per Pokémon).
--
-- pokemon_form
--     ↓
-- pokemon_form_ability   (join: which ability, which slot, hidden or not)
--     ↓
-- ability                (canonical — one row per real ability, shared by every form that has it)

-- Canonical ability, independent of any Pokémon.
create table public.ability (
  id uuid primary key default gen_random_uuid(),
  -- PokeStudio's own stable identity — PokéAPI's ability name is already
  -- lowercase kebab-case (e.g. "intimidate", "solar-power").
  slug text not null unique,
  name_en text not null,
  -- Nullable: PokéAPI does not reliably provide a Spanish name for every
  -- ability. Never invented (CLAUDE.md §14) — null means genuinely unknown.
  name_es text,
  -- Concise effect text (PokéAPI's short_effect, falling back to effect).
  effect_en text,
  -- Nullable, and left null far more often than name_es — PokéAPI rarely
  -- publishes a Spanish ability effect_entries entry at all (see DATA_SOURCES.md).
  effect_es text,
  source_id text not null references public.data_sources (source_id),
  external_id text not null,
  created_at timestamptz not null default now(),
  constraint ability_source_external_id_key unique (source_id, external_id)
);

comment on table public.ability is
  'Canonical Pokémon ability (Phase 1C.1, Part A). One row per real ability — never duplicated per Pokémon/form.';

-- Which ability belongs to which form, in which slot, hidden or not.
-- Abilities are a per-variety PokéAPI attribute, not per-cosmetic-form — every
-- cosmetic sub-form under the same variety shares this row set, same as it
-- shares that variety's types/base stats (pokemon_form already models that).
create table public.pokemon_form_ability (
  id uuid primary key default gen_random_uuid(),
  pokemon_form_id uuid not null references public.pokemon_form (id) on delete cascade,
  ability_id uuid not null references public.ability (id) on delete cascade,
  -- PokéAPI's 1-based ability slot (1-2 normal, 3 conventionally hidden).
  -- Preserved for source fidelity; is_hidden is the authoritative signal.
  slot smallint not null check (slot >= 1),
  is_hidden boolean not null default false,
  source_id text not null references public.data_sources (source_id),
  created_at timestamptz not null default now(),
  -- A form cannot have two abilities in the same slot.
  constraint pokemon_form_ability_form_slot_key unique (pokemon_form_id, slot)
);

comment on table public.pokemon_form_ability is
  'Join: which ability a pokemon_form has, in which slot, hidden or not (Phase 1C.1, Part A). No independent external_id — this relation has no stable id upstream; ingestion fully replaces a form''s rows per run instead of upserting by identity (see packages/pokemon-data/src/persist.ts).';

create index pokemon_form_ability_form_id_idx on public.pokemon_form_ability (pokemon_form_id);
create index pokemon_form_ability_ability_id_idx on public.pokemon_form_ability (ability_id);

-- Reference data is public by default; only service-role writes are allowed
-- (same pattern as species/pokemon_form).
alter table public.ability enable row level security;
alter table public.pokemon_form_ability enable row level security;

create policy "Ability reference data is publicly readable"
  on public.ability
  for select
  to anon, authenticated
  using (true);

create policy "Pokémon form ability reference data is publicly readable"
  on public.pokemon_form_ability
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies for anon/authenticated: writes are only
-- possible via the service role (ingestion pipeline).
