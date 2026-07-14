create table if not exists public.card_external_references (
  id uuid primary key default gen_random_uuid(),
  card_catalog_id uuid not null references public.cards_catalog(id) on delete cascade,
  source text not null,
  external_id text not null,
  source_url text null,
  last_seen_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_external_references_source_not_blank check (btrim(source) <> ''),
  constraint card_external_references_external_id_not_blank check (btrim(external_id) <> ''),
  constraint card_external_references_source_external_unique unique (source, external_id),
  constraint card_external_references_card_source_unique unique (card_catalog_id, source)
);

create index if not exists card_external_references_card_catalog_id_idx
  on public.card_external_references(card_catalog_id);

alter table public.card_external_references enable row level security;

create policy card_external_references_select_authenticated
  on public.card_external_references
  for select
  to authenticated
  using (true);

comment on table public.card_external_references is
  'Maps stable internal cards_catalog records to one or more external data sources without changing collection links.';

comment on column public.card_external_references.source is
  'Stable source key such as pokemon_tcg_api, tcgdex, or legacy_public_cards.';

comment on column public.card_external_references.external_id is
  'Source-specific card identifier, unique within source.';;
