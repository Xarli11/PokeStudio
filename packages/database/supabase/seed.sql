-- Deterministic seed data for local development.
-- Mirrors the output of `pnpm --filter @pokestudio/pokemon-data ingest:spike`
-- (packages/pokemon-data/data/spike-species.json) as of the fetch below.
-- Not a production import — see DATA_SOURCES.md for the real ingestion pipeline.

insert into public.data_sources (source_id, source_url, license, fetched_at, importer_version)
values (
  'pokeapi',
  'https://pokeapi.co/api/v2',
  'BSD-3-Clause (PokéAPI data license)',
  '2026-09-08T22:14:22.814Z',
  '0.1.0-spike'
)
on conflict (source_id) do nothing;

insert into public.species
  (id, national_dex_number, name_en, name_es, types, base_stats, introduced_in_generation, source_id)
values
  (
    'pokestudio-species-1', 1, 'Bulbasaur', 'Bulbasaur', array['grass', 'poison'],
    '{"hp":45,"attack":49,"defense":49,"specialAttack":65,"specialDefense":65,"speed":45}',
    1, 'pokeapi'
  ),
  (
    'pokestudio-species-6', 6, 'Charizard', 'Charizard', array['fire', 'flying'],
    '{"hp":78,"attack":84,"defense":78,"specialAttack":109,"specialDefense":85,"speed":100}',
    1, 'pokeapi'
  ),
  (
    'pokestudio-species-130', 130, 'Gyarados', 'Gyarados', array['water', 'flying'],
    '{"hp":95,"attack":125,"defense":79,"specialAttack":60,"specialDefense":100,"speed":81}',
    1, 'pokeapi'
  )
on conflict (id) do nothing;
