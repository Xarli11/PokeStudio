select json_build_object(
  'natures', (select count(*) from public.nature where source_id = 'pokeapi'),
  'items', (select count(*) from public.item where source_id = 'pokeapi'),
  'learnsets', (select count(*) from public.pokemon_form_move where source_id = 'pokeapi'),
  'species', (select count(*) from public.species where source_id = 'pokeapi'),
  'bad_defaults', (
    select count(*) from public.species s where s.source_id = 'pokeapi'
    and (select count(*) from public.pokemon_form f where f.species_id = s.id and f.is_default) <> 1
  ),
  'missing_sentinels', (
    select count(*) from (values ('bulbasaur'), ('mew'), ('garchomp')) expected(slug)
    where not exists (select 1 from public.species s where s.slug = expected.slug and s.source_id = 'pokeapi')
  )
);
