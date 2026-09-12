-- Phase 1C.2 Part C: minimal TM/HM/TR machine identity.
--
-- Scope deliberately small (task §7): PokéAPI's /machine/{id} resource maps
-- (item, move, version_group) but an item's full identity (sprite, category,
-- description) is not modeled here — only the raw item slug (e.g. "tm34",
-- "hm01") needed to render a "TM034 Earthquake"-style label later. A future
-- phase can add a proper item table and join to it by item_slug without
-- losing anything this migration wrote.

create table public.machine (
  id uuid primary key default gen_random_uuid(),
  move_id uuid not null references public.move (id) on delete cascade,
  version_group_id uuid not null references public.version_group (id) on delete cascade,
  -- PokéAPI's raw item slug for this machine (e.g. "tm34", "hm01") —
  -- intentionally not decoded further; see comment above.
  item_slug text not null,
  source_id text not null references public.data_sources (source_id),
  external_id text not null,
  created_at timestamptz not null default now(),
  constraint machine_source_external_id_key unique (source_id, external_id),
  -- A move has at most one machine identity per version group.
  constraint machine_move_version_group_key unique (move_id, version_group_id)
);

comment on table public.machine is
  'Minimal TM/HM/TR identity: which move is which machine item, in which version group (Phase 1C.2). Deliberately does not model item detail (sprite, TM vs. HM vs. TR category, description) — see table comment / docs/adr/0013-moves-learnsets-schema.md.';

create index machine_move_id_idx on public.machine (move_id);
create index machine_version_group_id_idx on public.machine (version_group_id);

alter table public.machine enable row level security;

create policy "Machine reference data is publicly readable"
  on public.machine
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies for anon/authenticated: writes are only
-- possible via the service role (ingestion pipeline).
