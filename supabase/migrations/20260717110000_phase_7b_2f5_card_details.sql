alter table public.cards_catalog
  add column if not exists card_details jsonb not null default '{}'::jsonb;

alter table public.cards_catalog
  drop constraint if exists cards_catalog_card_details_object_check;

alter table public.cards_catalog
  add constraint cards_catalog_card_details_object_check
  check (jsonb_typeof(card_details) = 'object');
