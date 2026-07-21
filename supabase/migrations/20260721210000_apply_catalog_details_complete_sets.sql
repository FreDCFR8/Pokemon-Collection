create or replace function public.apply_catalog_details_complete_sets(p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  expected_rows integer;
  updated_rows integer;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) <> 607 then
    raise exception 'Expected exactly 607 detail rows.';
  end if;

  select count(*) into expected_rows
  from jsonb_to_recordset(p_rows) as r(
    id uuid,
    expected_external_id text,
    expected_set_code text,
    target_card_details jsonb
  );

  if expected_rows <> 607 then
    raise exception 'Expected exactly 607 valid detail rows.';
  end if;

  update public.cards_catalog as c
  set card_details = r.target_card_details
  from jsonb_to_recordset(p_rows) as r(
    id uuid,
    expected_external_id text,
    expected_set_code text,
    target_card_details jsonb
  )
  where c.id = r.id
    and c.set_code = r.expected_set_code
    and (c.card_details is null or c.card_details = '{}'::jsonb)
    and exists (
      select 1
      from public.card_external_references as cer
      where cer.card_catalog_id = c.id
        and cer.source = 'pokemon_tcg_api'
        and cer.external_id = r.expected_external_id
    )
    and jsonb_typeof(r.target_card_details) = 'object'
    and r.target_card_details <> '{}'::jsonb;

  get diagnostics updated_rows = row_count;
  if updated_rows <> 607 then
    raise exception 'Detail backfill precondition failed: updated % rows, expected 607.', updated_rows;
  end if;
  return updated_rows;
end;
$$;

revoke all on function public.apply_catalog_details_complete_sets(jsonb) from public;
revoke all on function public.apply_catalog_details_complete_sets(jsonb) from anon;
revoke all on function public.apply_catalog_details_complete_sets(jsonb) from authenticated;
grant execute on function public.apply_catalog_details_complete_sets(jsonb) to service_role;
