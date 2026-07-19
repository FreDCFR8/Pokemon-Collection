create table public.set_external_references (
  id uuid primary key default gen_random_uuid(),
  set_catalog_id uuid not null references public.sets_catalog(id) on delete cascade,
  source text not null,
  external_id text not null,
  source_url text null,
  last_seen_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint set_external_references_source_not_blank check (btrim(source) <> ''),
  constraint set_external_references_external_id_not_blank check (btrim(external_id) <> ''),
  constraint set_external_references_source_external_unique unique (source, external_id),
  constraint set_external_references_set_source_unique unique (set_catalog_id, source)
);

create index if not exists set_external_references_set_catalog_id_idx
  on public.set_external_references(set_catalog_id);

alter table public.set_external_references enable row level security;

revoke all on table public.set_external_references from public, anon, authenticated;
grant select on table public.set_external_references to authenticated;

drop policy if exists set_external_references_select_authenticated on public.set_external_references;
create policy set_external_references_select_authenticated
  on public.set_external_references
  for select
  to authenticated
  using (true);

comment on table public.set_external_references is
  'Maps stable internal sets_catalog records to external set identities without overwriting legacy provenance.';
