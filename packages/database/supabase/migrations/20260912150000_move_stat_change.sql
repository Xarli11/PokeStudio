-- Phase 1C.2c: exact stat-stage changes a move causes (task requirement —
-- "Do NOT say 'lowers Defense' when the real mechanic is 'lowers Defense by
-- 1 stage'"). PokéAPI's move.stat_changes is a separate top-level array from
-- `meta` (move.meta.stat_chance is only the *chance* the change applies —
-- see move.stat_chance's own comment; the changes themselves were never
-- captured until now).

create table public.move_stat_change (
  id uuid primary key default gen_random_uuid(),
  move_id uuid not null references public.move (id) on delete cascade,
  -- Free text (PokéAPI's stat vocabulary: attack, defense, special-attack,
  -- special-defense, speed, accuracy, evasion) — same open-domain treatment
  -- as move.type/move.target, validated in
  -- packages/pokemon-data/src/validate.ts against a known set.
  stat text not null,
  -- Signed stage delta, e.g. -1 (Growl lowers Attack by one stage) or +2
  -- (Swords Dance raises Attack by two stages). Real stat stages are -6..6.
  change smallint not null check (change != 0 and change between -6 and 6),
  -- Preserves PokéAPI's own array order for multi-stat moves (e.g. Shell
  -- Smash has 5 entries) — Postgres does not guarantee row order otherwise.
  sort_order smallint not null,
  source_id text not null references public.data_sources (source_id),
  created_at timestamptz not null default now()
);

comment on table public.move_stat_change is
  'One stat-stage change a move causes (Phase 1C.2c), e.g. Growl: attack -1. No independent external_id — PokéAPI''s move.stat_changes entries are array positions, not addressable resources; fully replaced per source_id per ingestion run, same pattern as pokemon_form_move.';

-- "stat changes for a move" (move detail page's technical breakdown).
create index move_stat_change_move_id_idx on public.move_stat_change (move_id);

alter table public.move_stat_change enable row level security;

create policy "Move stat change reference data is publicly readable"
  on public.move_stat_change
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies for anon/authenticated: writes are only
-- possible via the service role (ingestion pipeline).
