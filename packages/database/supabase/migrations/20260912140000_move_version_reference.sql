-- Phase 1C.2 Part A: canonical move entity plus its two small reference
-- domains (version_group, move_learn_method) — same "normalize what's
-- shared, join what varies" shape ADR-0010/ADR-0011 already used for
-- species/form and ability. See docs/adr/0013-moves-learnsets-schema.md.

-- Canonical move, independent of any Pokémon. One row per real move — never
-- duplicated per Pokémon/form (same principle as public.ability).
create table public.move (
  id uuid primary key default gen_random_uuid(),
  -- PokeStudio's own stable identity — PokéAPI's move name is already
  -- lowercase kebab-case (e.g. "thunderbolt", "swords-dance").
  slug text not null unique,
  name_en text not null,
  -- Nullable: not yet verified at full-dataset scale whether PokéAPI
  -- guarantees a Spanish move name for every move (ability names had a
  -- small real gap — see docs/engineering/DATA_SOURCES.md). Never invented if absent.
  name_es text,
  -- Free text, not a checked enum — same reasoning as species_evolution.trigger:
  -- reuses the same 18-value domain pokemon_form.types already uses without a
  -- DB-level type table (none exists yet for that either), validated in
  -- packages/pokemon-data/src/validate.ts against the same known-type set.
  type text not null,
  damage_class text not null check (damage_class in ('physical', 'special', 'status')),
  -- Null means "no fixed power" (status moves) / "no fixed accuracy" (never-miss moves) —
  -- a real absence, not an unknown value.
  power smallint check (power is null or power > 0),
  accuracy smallint check (accuracy is null or accuracy between 1 and 100),
  pp smallint not null check (pp > 0),
  priority smallint not null,
  -- Free text (e.g. "selected-pokemon", "all-opponents") — PokéAPI's target
  -- vocabulary, same open-domain treatment as move.type/species_evolution.trigger.
  target text not null,
  -- Parsed from PokéAPI's "generation-i".."generation-ix" slug.
  generation smallint not null check (generation between 1 and 9),
  effect_en text,
  -- Nullable, and expected to be null for every row at least initially — PokéAPI's
  -- move effect_entries has never been observed to contain an "es" entry (same
  -- documented gap as public.ability.effect_es). Never invented.
  effect_es text,
  effect_chance smallint check (effect_chance is null or effect_chance between 1 and 100),
  -- PokéAPI's move "meta" block — always present upstream, "none"/"damage" are
  -- real sentinel values (no special ailment/category), not unknowns.
  ailment text not null,
  category text not null,
  min_hits smallint,
  max_hits smallint,
  min_turns smallint,
  max_turns smallint,
  drain smallint not null default 0,
  healing smallint not null default 0,
  crit_rate smallint not null default 0,
  ailment_chance smallint not null default 0,
  flinch_chance smallint not null default 0,
  stat_chance smallint not null default 0,
  source_id text not null references public.data_sources (source_id),
  external_id text not null,
  created_at timestamptz not null default now(),
  constraint move_source_external_id_key unique (source_id, external_id)
);

comment on table public.move is
  'Canonical Pokémon move (Phase 1C.2). One row per real move — never duplicated per Pokémon/form. Omits PokéAPI flavor text, contest data and past_values (historical power/accuracy changes) — see docs/adr/0013-moves-learnsets-schema.md.';

-- Small reference table: PokéAPI's version_group (generation-scoped game
-- grouping, e.g. "scarlet-violet", "sword-shield"). Learnsets are scoped to
-- this, not to individual game titles, matching PokéAPI's own granularity.
create table public.version_group (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  generation smallint not null check (generation between 1 and 9),
  -- PokéAPI's own chronological "order" field — lets the app pick the
  -- latest version group without hardcoding a slug.
  display_order smallint not null,
  source_id text not null references public.data_sources (source_id),
  external_id text not null,
  created_at timestamptz not null default now(),
  constraint version_group_source_external_id_key unique (source_id, external_id)
);

comment on table public.version_group is
  'PokéAPI version_group reference data (Phase 1C.2) — the game-context granularity learnsets/machines are scoped to. Small, fixed-ish set (~30 rows); upserted by ingestion, not hand-authored.';

-- Small reference table, not a checked enum: unlike species_evolution.trigger
-- (kept free text because its vocabulary keeps growing with no other table
-- needing to reference it), move_learn_method has genuine referential value —
-- pokemon_form_move.learn_method needs "known methods only" integrity
-- (CLAUDE.md §12 gate), and a reference table gets that from a FK for free,
-- self-updating on the next ingestion run if PokéAPI ever adds a 13th method
-- (no migration required, unlike a CHECK constraint). No name columns:
-- localized labels belong in packages/i18n, not the database (this phase's
-- explicit requirement) — PokéAPI's own move-learn-method names are never
-- imported here.
create table public.move_learn_method (
  slug text primary key,
  source_id text not null references public.data_sources (source_id),
  external_id text not null,
  created_at timestamptz not null default now(),
  constraint move_learn_method_source_external_id_key unique (source_id, external_id)
);

comment on table public.move_learn_method is
  'Reference domain for how a move is learned (level-up, machine, egg, tutor, and a handful of historical/special methods — Phase 1C.2). Slug-keyed, no name columns: UI labels live in packages/i18n.';

alter table public.move enable row level security;
alter table public.version_group enable row level security;
alter table public.move_learn_method enable row level security;

create policy "Move reference data is publicly readable"
  on public.move
  for select
  to anon, authenticated
  using (true);

create policy "Version group reference data is publicly readable"
  on public.version_group
  for select
  to anon, authenticated
  using (true);

create policy "Move learn method reference data is publicly readable"
  on public.move_learn_method
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies for anon/authenticated: writes are only
-- possible via the service role (ingestion pipeline), same pattern as every
-- other reference table.
