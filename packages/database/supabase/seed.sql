-- Deterministic seed data for local development.
-- Mirrors the output of `pnpm --filter @pokestudio/pokemon-data ingest:explore`
-- (packages/pokemon-data/data/explore-species.json) as of the fetch below.
-- Not a production import — see DATA_SOURCES.md for the real ingestion pipeline.

insert into public.data_sources (source_id, source_url, license, fetched_at, importer_version)
values (
  'pokeapi',
  'https://pokeapi.co/api/v2',
  'BSD-3-Clause (PokéAPI data license)',
  '2026-09-09T15:05:54.807Z',
  '0.2.0-phase-1a'
)
on conflict (source_id) do update set
  source_url = excluded.source_url,
  license = excluded.license,
  fetched_at = excluded.fetched_at,
  importer_version = excluded.importer_version;

insert into public.species
  (slug, national_dex_number, name_en, name_es, source_id, external_id)
values
  ('bulbasaur', 1, 'Bulbasaur', 'Bulbasaur', 'pokeapi', '1'),
  ('rotom', 479, 'Rotom', 'Rotom', 'pokeapi', '479'),
  ('meowth', 52, 'Meowth', 'Meowth', 'pokeapi', '52')
on conflict (slug) do nothing;

insert into public.pokemon_form
  (species_id, slug, name_en, name_es, is_default, form_category, types, base_stats, source_id, external_id)
select
  species.id,
  v.slug, v.name_en, v.name_es, v.is_default, v.form_category, v.types, v.base_stats, v.source_id, v.external_id
from (
  values
    ('bulbasaur', 'bulbasaur', 'Bulbasaur', 'Bulbasaur', true, 'default', array['grass','poison'], '{"hp": 45, "attack": 49, "defense": 49, "specialAttack": 65, "specialDefense": 65, "speed": 45}'::jsonb, 'pokeapi', '1'),
    ('rotom', 'rotom', 'Rotom', 'Rotom', true, 'default', array['electric','ghost'], '{"hp": 50, "attack": 50, "defense": 77, "specialAttack": 95, "specialDefense": 77, "speed": 91}'::jsonb, 'pokeapi', '479'),
    ('rotom', 'rotom-heat', 'Heat Rotom', 'Rotom Calor', false, 'battle', array['electric','fire'], '{"hp": 50, "attack": 65, "defense": 107, "specialAttack": 105, "specialDefense": 107, "speed": 86}'::jsonb, 'pokeapi', '10008'),
    ('rotom', 'rotom-wash', 'Wash Rotom', 'Rotom Lavado', false, 'battle', array['electric','water'], '{"hp": 50, "attack": 65, "defense": 107, "specialAttack": 105, "specialDefense": 107, "speed": 86}'::jsonb, 'pokeapi', '10009'),
    ('rotom', 'rotom-frost', 'Frost Rotom', 'Rotom Frío', false, 'battle', array['electric','ice'], '{"hp": 50, "attack": 65, "defense": 107, "specialAttack": 105, "specialDefense": 107, "speed": 86}'::jsonb, 'pokeapi', '10010'),
    ('rotom', 'rotom-fan', 'Fan Rotom', 'Rotom Ventilador', false, 'battle', array['electric','flying'], '{"hp": 50, "attack": 65, "defense": 107, "specialAttack": 105, "specialDefense": 107, "speed": 86}'::jsonb, 'pokeapi', '10011'),
    ('rotom', 'rotom-mow', 'Mow Rotom', 'Rotom Corte', false, 'battle', array['electric','grass'], '{"hp": 50, "attack": 65, "defense": 107, "specialAttack": 105, "specialDefense": 107, "speed": 86}'::jsonb, 'pokeapi', '10012'),
    ('meowth', 'meowth', 'Meowth', 'Meowth', true, 'default', array['normal'], '{"hp": 40, "attack": 45, "defense": 35, "specialAttack": 40, "specialDefense": 40, "speed": 90}'::jsonb, 'pokeapi', '52'),
    ('meowth', 'meowth-alola', 'Alolan Meowth', 'Meowth de Alola', false, 'regional', array['dark'], '{"hp": 40, "attack": 35, "defense": 35, "specialAttack": 50, "specialDefense": 40, "speed": 90}'::jsonb, 'pokeapi', '10107'),
    ('meowth', 'meowth-galar', 'Galarian Meowth', 'Meowth de Galar', false, 'regional', array['steel'], '{"hp": 50, "attack": 65, "defense": 55, "specialAttack": 40, "specialDefense": 40, "speed": 40}'::jsonb, 'pokeapi', '10161')
) as v(species_slug, slug, name_en, name_es, is_default, form_category, types, base_stats, source_id, external_id)
join public.species on species.slug = v.species_slug
on conflict (slug) do nothing;
