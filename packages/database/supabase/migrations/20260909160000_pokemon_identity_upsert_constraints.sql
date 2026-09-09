-- Phase 1B: identity constraints for idempotent full-dataset ingestion.
--
-- Full ingestion re-runs (and future production re-syncs) must resolve "is
-- this species/form already in the database?" by upstream identity
-- (source_id + external_id), not by slug — the slug is PokeStudio's own
-- public identifier and must stay stable even if it ever needed to diverge
-- from upstream naming. These constraints are what `ON CONFLICT
-- (source_id, external_id)` upserts (packages/pokemon-data ingestion) rely on.

alter table public.species
  add constraint species_source_external_id_key unique (source_id, external_id);

alter table public.pokemon_form
  add constraint pokemon_form_source_external_id_key unique (source_id, external_id);
