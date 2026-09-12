-- Phase 1C.2 Part B: the learnset relation itself — the most important part
-- of this phase. See docs/adr/0013-moves-learnsets-schema.md for the full
-- natural-key rationale (in particular why `level` must be part of it: real
-- PokéAPI data has ~9.4k cases of the same Pokémon/move/version-group/method
-- combination at two different levels — e.g. a move both inherited at level 1
-- on evolution and re-taught naturally later).
--
-- pokemon_form
--     ↓
-- pokemon_form_move   (join: which move, which version group, which method, what level)
--     ↓
-- move                (canonical — one row per real move, shared by every form that can learn it)
--
-- Form-aware, not species-aware (task requirement): legality can differ by
-- form even when a species-level view wouldn't show it.

create table public.pokemon_form_move (
  id uuid primary key default gen_random_uuid(),
  pokemon_form_id uuid not null references public.pokemon_form (id) on delete cascade,
  move_id uuid not null references public.move (id) on delete cascade,
  version_group_id uuid not null references public.version_group (id) on delete cascade,
  -- FK by slug, not a checked enum — see move_learn_method's own comment.
  learn_method text not null references public.move_learn_method (slug),
  -- 0 for every non-level-up method (not applicable) *and* for a level-up
  -- entry meaning "known immediately upon evolving" — both are PokéAPI's own
  -- raw encoding, not a PokeStudio-invented sentinel. Real levels are 1-100.
  level smallint not null default 0 check (level >= 0),
  -- PokéAPI's per-entry "order" — disambiguates teaching order for moves
  -- sharing the same level in the same game; null where PokéAPI has none.
  sort_order smallint,
  -- No independent external_id: PokéAPI's version_group_details entries are
  -- array positions, not addressable resources (same reasoning as
  -- pokemon_form_ability/species_evolution, ADR-0011 decision 3) — ingestion
  -- fully replaces a form's rows per run instead of upserting by identity.
  source_id text not null references public.data_sources (source_id),
  created_at timestamptz not null default now(),
  constraint pokemon_form_move_natural_key
    unique (pokemon_form_id, move_id, version_group_id, learn_method, level)
);

comment on table public.pokemon_form_move is
  'One fact: this pokemon_form can learn this move, in this version_group, via this learn_method, at this level (Phase 1C.2). Form-aware (not species-aware) because legality can differ by form. No independent external_id — full replacement per source_id per ingestion run, same idempotency strategy as pokemon_form_ability/species_evolution (ADR-0011 decision 3, docs/adr/0013-moves-learnsets-schema.md).';

-- Query patterns this phase actually needs (CLAUDE.md §16, task §12):
-- "moves for a form" (Pokémon detail page).
create index pokemon_form_move_form_id_idx on public.pokemon_form_move (pokemon_form_id);
-- "forms that learn a move" (move detail page's Pokémon list).
create index pokemon_form_move_move_id_idx on public.pokemon_form_move (move_id);
-- "form + version group" (default/selected game context on the detail page).
create index pokemon_form_move_form_version_idx
  on public.pokemon_form_move (pokemon_form_id, version_group_id);
-- "move + version group" (move detail page scoped to one game context).
create index pokemon_form_move_move_version_idx
  on public.pokemon_form_move (move_id, version_group_id);
-- "method filtering" (e.g. "egg moves only").
create index pokemon_form_move_learn_method_idx on public.pokemon_form_move (learn_method);

alter table public.pokemon_form_move enable row level security;

create policy "Pokémon form move reference data is publicly readable"
  on public.pokemon_form_move
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies for anon/authenticated: writes are only
-- possible via the service role (ingestion pipeline).
