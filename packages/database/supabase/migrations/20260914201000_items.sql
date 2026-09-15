-- Milestone 2 Stage 2.0: canonical held-item data (Team Builder v1).
--
-- PokéAPI models ~2223 items total — the vast majority are key items,
-- TMs/HMs (already covered minimally by public.machine.item_slug), berries
-- used only for crafting/Pokéathlon, etc. Ingesting all of them would be
-- exactly the "irrelevant inventory/key-item concept" noise the milestone
-- brief warned against.
--
-- PokéAPI exposes an authoritative, non-heuristic signal for this instead:
-- each item has an `attributes` array, and items carrying the "holdable"
-- attribute are precisely the ones a Pokémon can hold in battle (verified
-- live against the real API: 175 of 2223 items carry it — Leftovers, Choice
-- Band, Life Orb, type-boosting plates, berries, etc.). Ingestion filters on
-- this attribute, never on item-name string heuristics.

create table public.item (
  id uuid primary key default gen_random_uuid(),
  -- PokéAPI's item name is already lowercase kebab-case (e.g. "leftovers").
  slug text not null unique,
  name_en text not null,
  -- Nullable: same real-gap pattern as ability/move/nature names — never invented.
  name_es text,
  -- PokéAPI's short_effect, falling back to effect — same "concise effect
  -- text" pattern as public.ability.effect_en.
  effect_en text,
  -- Nullable, and expected null far more often than name_es — PokéAPI rarely
  -- publishes a Spanish item effect_entries entry (same documented gap as
  -- ability/move effect_es, docs/engineering/DATA_SOURCES.md).
  effect_es text,
  -- PokéAPI's item category name (e.g. "held-items", "choice", "type-protection",
  -- "species-specific") — free text, not a checked enum, same open-domain
  -- treatment as move.type/move.target: upstream's category vocabulary is
  -- larger than any fixed list PokeStudio would want to hand-maintain.
  category text not null,
  source_id text not null references public.data_sources (source_id),
  external_id text not null,
  created_at timestamptz not null default now(),
  constraint item_source_external_id_key unique (source_id, external_id)
);

comment on table public.item is
  'Canonical held item (Milestone 2, Stage 2.0) — only items PokéAPI marks with the "holdable" attribute are ingested (~175 of ~2223 total items upstream), never the full item catalog. See migration comment for the filtering rationale.';

create index item_category_idx on public.item (category);

alter table public.item enable row level security;

create policy "Item reference data is publicly readable"
  on public.item
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies for anon/authenticated: writes are only
-- possible via the service role (ingestion pipeline), same pattern as every
-- other reference table.
