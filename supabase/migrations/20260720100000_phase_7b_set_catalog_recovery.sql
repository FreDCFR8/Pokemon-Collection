-- Phase 7B set-catalog recovery.
-- This function is intentionally limited to the approved 117-entry recovery batch.
-- It creates matching sets_catalog and set_external_references rows atomically.
-- It never updates or deletes existing data.

create or replace function public.apply_phase_7b_set_catalog_recovery(p_entries jsonb)
returns table (
  set_code text,
  set_catalog_id uuid,
  external_id text
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  expected_count constant integer := 117;
begin
  if jsonb_typeof(p_entries) <> 'array' then
    raise exception 'phase_7b_recovery_entries_must_be_array';
  end if;

  if jsonb_array_length(p_entries) <> expected_count then
    raise exception 'phase_7b_recovery_entry_count_mismatch: expected %, received %',
      expected_count, jsonb_array_length(p_entries);
  end if;

  -- Serialises only this recovery RPC. A database error rolls back both tables.
  perform pg_advisory_xact_lock(hashtext('phase_7b_set_catalog_recovery_v1'));

  if exists (
    select 1
    from jsonb_to_recordset(p_entries) as item(
      set_code text,
      name text,
      series text,
      generation text,
      release_date date,
      printed_total integer,
      total integer,
      symbol_url text,
      logo_url text,
      source text,
      source_id text,
      external_id text
    )
    where item.set_code is null
       or btrim(item.set_code) = ''
       or item.name is null
       or btrim(item.name) = ''
       or item.series is null
       or btrim(item.series) = ''
       or item.release_date is null
       or item.printed_total is null
       or item.printed_total < 0
       or item.total is null
       or item.total < 0
       or item.source <> 'pokemon_tcg_api'
       or item.source_id is distinct from item.set_code
       or item.external_id is distinct from item.set_code
  ) then
    raise exception 'phase_7b_recovery_invalid_entry';
  end if;

  if (
    select count(*) <> count(distinct set_code)
        or count(*) <> count(distinct external_id)
    from jsonb_to_recordset(p_entries) as item(set_code text, external_id text)
  ) then
    raise exception 'phase_7b_recovery_duplicate_identity';
  end if;

  -- Existing identities are conflicts. Do not silently upsert or repair them.
  if exists (
    select 1
    from public.sets_catalog existing
    join jsonb_to_recordset(p_entries) as item(set_code text)
      on item.set_code = existing.set_code
  ) then
    raise exception 'phase_7b_recovery_existing_set_code';
  end if;

  if exists (
    select 1
    from public.set_external_references existing
    join jsonb_to_recordset(p_entries) as item(external_id text)
      on existing.source = 'pokemon_tcg_api'
     and existing.external_id = item.external_id
  ) then
    raise exception 'phase_7b_recovery_existing_external_identity';
  end if;

  return query
  with input as (
    select *
    from jsonb_to_recordset(p_entries) as item(
      set_code text,
      name text,
      series text,
      generation text,
      release_date date,
      printed_total integer,
      total integer,
      symbol_url text,
      logo_url text,
      source text,
      source_id text,
      external_id text
    )
  ),
  inserted_sets as (
    insert into public.sets_catalog (
      set_code,
      name,
      series,
      generation,
      release_date,
      printed_total,
      total,
      symbol_url,
      logo_url,
      source,
      source_id
    )
    select
      input.set_code,
      input.name,
      input.series,
      input.generation,
      input.release_date,
      input.printed_total,
      input.total,
      input.symbol_url,
      input.logo_url,
      input.source,
      input.source_id
    from input
    order by input.set_code
    returning id, set_code
  ),
  inserted_references as (
    insert into public.set_external_references (
      set_catalog_id,
      source,
      external_id,
      source_url,
      last_seen_at
    )
    select
      inserted_sets.id,
      'pokemon_tcg_api',
      input.external_id,
      null,
      null
    from inserted_sets
    join input using (set_code)
    order by input.external_id
    returning set_catalog_id, external_id
  )
  select
    inserted_sets.set_code,
    inserted_sets.id,
    inserted_references.external_id
  from inserted_sets
  join inserted_references
    on inserted_references.set_catalog_id = inserted_sets.id
  order by inserted_sets.set_code;
end;
$$;

revoke all on function public.apply_phase_7b_set_catalog_recovery(jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_phase_7b_set_catalog_recovery(jsonb)
  to service_role;

comment on function public.apply_phase_7b_set_catalog_recovery(jsonb) is
  'Phase 7B-only atomic creation of the approved 117 missing Pokémon TCG set catalog rows and their external references.';
