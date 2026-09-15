-- Milestone 2 Stage 2.0: canonical Nature data (Team Builder v1 needs exact
-- stat modifiers). Same shape as public.ability/public.move — one row per
-- real nature, never duplicated per team member.
--
-- PokéAPI has exactly 25 natures (verified live). Five are neutral (Hardy,
-- Docile, Bashful, Quirky, Serious) — both increased_stat and decreased_stat
-- are null upstream for those, never invented as "no-op" sentinels.

create table public.nature (
  id uuid primary key default gen_random_uuid(),
  -- PokéAPI's nature name is already lowercase kebab-case (e.g. "adamant").
  slug text not null unique,
  name_en text not null,
  -- Nullable: not yet verified at ingestion time whether PokéAPI guarantees
  -- a Spanish name for every nature (ability/move both had real gaps — see
  -- docs/engineering/DATA_SOURCES.md). Never invented if absent.
  name_es text,
  -- Free text, not a checked enum — same open-domain treatment as
  -- move.stat_changes.stat (validated in packages/pokemon-data/src/validate.ts
  -- against the known stat vocabulary: attack, defense, special-attack,
  -- special-defense, speed). Both null together means a neutral nature.
  increased_stat text,
  decreased_stat text,
  source_id text not null references public.data_sources (source_id),
  external_id text not null,
  created_at timestamptz not null default now(),
  constraint nature_source_external_id_key unique (source_id, external_id),
  constraint nature_neutral_or_both_stats check (
    (increased_stat is null and decreased_stat is null)
    or (increased_stat is not null and decreased_stat is not null)
  ),
  constraint nature_increased_decreased_differ check (
    increased_stat is distinct from decreased_stat
  )
);

comment on table public.nature is
  'Canonical Pokémon nature (Milestone 2, Stage 2.0). One row per real nature — 25 total, 5 neutral (both stat columns null). Increased/decreased stat modifiers drive exact stat calculation in Team Builder.';

alter table public.nature enable row level security;

create policy "Nature reference data is publicly readable"
  on public.nature
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies for anon/authenticated: writes are only
-- possible via the service role (ingestion pipeline), same pattern as every
-- other reference table.
