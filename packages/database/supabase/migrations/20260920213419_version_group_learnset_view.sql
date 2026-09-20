-- Perf (Fase 2A): replace listVersionGroups()'s N+1 count(*) exact per
-- version_group (one round trip per row in version_group, ~32 today) with a
-- single query against this view. `EXISTS` lets Postgres stop scanning as
-- soon as it finds one matching row per version_group, reusing the existing
-- pokemon_form_move_version_group_id_idx (20260912143000) — no new index
-- added here; add a composite (version_group_id, learn_method) index later
-- only if EXPLAIN shows it's actually needed.
--
-- security_invoker = true: the view enforces RLS as the querying role, not
-- the view owner — consistent with every other reference table in this
-- schema, even though this data is public-read either way.

create view public.version_group_with_learnset_data
  with (security_invoker = true) as
select vg.id, vg.slug, vg.generation, vg.display_order
from public.version_group vg
where exists (
  select 1
  from public.pokemon_form_move pfm
  where pfm.version_group_id = vg.id
    and pfm.learn_method = 'level-up'
);

comment on view public.version_group_with_learnset_data is
  'Version groups that have at least one level-up learnset row (Fase 2A perf) — replaces listVersionGroups()''s prior N+1 count(*) exact per version_group with one query.';

grant select on public.version_group_with_learnset_data to anon, authenticated;
