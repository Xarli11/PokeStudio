-- Phase 1C.2 follow-up: a standalone index on version_group_id.
--
-- The composite pokemon_form_move_move_version_idx (move_id, version_group_id)
-- from 20260912141000 does not help a query that filters on version_group_id
-- alone (no leading-column match) — needed for "does this version group have
-- any learnset data at all" (packages/database's getDefaultVersionGroup,
-- which picks the latest version group that actually has rows, since a few
-- announced/DLC version groups in the reference table have none yet).

create index pokemon_form_move_version_group_id_idx
  on public.pokemon_form_move (version_group_id);
