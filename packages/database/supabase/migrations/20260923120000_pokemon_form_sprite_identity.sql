-- Explore → Damage Lab sprite fix. `pokemon_form.external_id` is the
-- upstream `pokemon-form` resource's own id (PokeAPI, set in
-- normalize.ts's `source: { externalId: String(form.id) }`) — the correct
-- key for this row's own upsert identity, but NOT reliably the same id as
-- the `pokemon` (variety) resource PokeAPI's sprite set is actually keyed
-- by (`sprites/pokemon/{id}.png`). For most 1:1 variety/form pairs (e.g. a
-- Mega Evolution) the two ids happen to coincide, but they are two
-- separate PokeAPI resources/id spaces, and a species with several
-- cosmetic `pokemon-form` entries sharing one `pokemon` variety (Unown's
-- 28 letter forms, Alcremie's flavors, etc.) is the case where they
-- provably diverge: each cosmetic form has its own `pokemon-form` id, but
-- all of them share the one `pokemon` id whose sprite set actually applies
-- to every one of them.
--
-- This column is that second, previously-discarded id — captured once per
-- PokéAPI `pokemon` variety in normalize.ts, applied to every form under
-- it — so the web layer can build an exact-form sprite URL from the same
-- production PokéAPI sprite family Explore's grid already uses, instead of
-- falling back to a different sprite source for non-default forms.
alter table public.pokemon_form
  add column pokeapi_pokemon_id integer;

comment on column public.pokemon_form.pokeapi_pokemon_id is
  'The upstream PokéAPI `pokemon` (variety) resource id this form belongs to — the id PokéAPI''s own sprite set (sprites/pokemon/{id}.png) is keyed by. Distinct from external_id (the pokemon-form resource''s own id, used for this row''s upsert identity). Null until the next ingestion run backfills it.';
