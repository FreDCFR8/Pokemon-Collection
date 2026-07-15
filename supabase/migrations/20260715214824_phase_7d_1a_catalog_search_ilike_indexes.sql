create index if not exists cards_catalog_pokemon_ilike_trgm_idx
  on public.cards_catalog
  using gin (pokemon extensions.gin_trgm_ops);

create index if not exists cards_catalog_set_name_ilike_trgm_idx
  on public.cards_catalog
  using gin (set_name extensions.gin_trgm_ops);

create index if not exists cards_catalog_number_ilike_trgm_idx
  on public.cards_catalog
  using gin (number extensions.gin_trgm_ops);
