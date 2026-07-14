create extension if not exists pg_trgm with schema extensions;

create index if not exists cards_catalog_set_code_number_idx
  on public.cards_catalog (set_code, number)
  where set_code is not null and btrim(set_code) <> '';

create index if not exists cards_catalog_pokemon_trgm_idx
  on public.cards_catalog
  using gin (lower(pokemon) extensions.gin_trgm_ops);

create index if not exists cards_catalog_set_name_trgm_idx
  on public.cards_catalog
  using gin (lower(set_name) extensions.gin_trgm_ops);

create index if not exists cards_catalog_number_trgm_idx
  on public.cards_catalog
  using gin (lower(number) extensions.gin_trgm_ops);;
