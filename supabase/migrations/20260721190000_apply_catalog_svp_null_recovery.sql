create or replace function public.apply_catalog_svp_null_recovery(p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected_rows integer;
  updated_rows integer;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'SVP recovery input must be a JSON array.' using errcode = '22023';
  end if;

  select count(*)::integer
  into expected_rows
  from jsonb_to_recordset(p_rows) as r(
    id uuid,
    expected_external_id text,
    expected_pokemon text,
    expected_set_name text,
    expected_number text,
    target_set_code text
  );

  if expected_rows <> 11 then
    raise exception 'SVP recovery requires exactly 11 rows.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as r(
      id uuid,
      expected_external_id text,
      expected_pokemon text,
      expected_set_name text,
      expected_number text,
      target_set_code text
    )
    group by r.id
    having count(*) > 1
  ) then
    raise exception 'SVP recovery input has duplicate card IDs.' using errcode = '22023';
  end if;

  if (
    select count(*)
    from public.sets_catalog s
    where s.set_code = 'svp'
      and s.name = 'Scarlet & Violet Black Star Promos'
  ) <> 1 then
    raise exception 'Canonical SVP set identity is missing or ambiguous.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as r(
      id uuid,
      expected_external_id text,
      expected_pokemon text,
      expected_set_name text,
      expected_number text,
      target_set_code text
    )
    left join public.cards_catalog c on c.id = r.id
    where c.id is null
      or r.target_set_code is distinct from 'svp'
      or r.expected_set_name is distinct from 'Scarlet & Violet Black Star Promos'
      or c.set_code is not null
      or c.pokemon is distinct from r.expected_pokemon
      or c.set_name is distinct from r.expected_set_name
      or c.number is distinct from r.expected_number
      or (
        select count(*)
        from public.card_external_references x
        where x.card_catalog_id = r.id
          and x.source = 'pokemon_tcg_api'
          and x.external_id = r.expected_external_id
      ) <> 1
      or exists (
        select 1
        from public.card_external_references x
        where x.card_catalog_id = r.id
          and x.source = 'pokemon_tcg_api'
          and x.external_id is distinct from r.expected_external_id
      )
  ) then
    raise exception 'SVP recovery precheck conflicts with current data; nothing was changed.' using errcode = 'P0001';
  end if;

  update public.cards_catalog c
  set set_code = r.target_set_code
  from jsonb_to_recordset(p_rows) as r(
    id uuid,
    expected_external_id text,
    expected_pokemon text,
    expected_set_name text,
    expected_number text,
    target_set_code text
  )
  where c.id = r.id
    and c.set_code is null;

  get diagnostics updated_rows = row_count;
  if updated_rows <> expected_rows then
    raise exception 'SVP recovery update count differs; transaction rolled back.' using errcode = 'P0001';
  end if;

  return updated_rows;
end;
$$;

revoke execute on function public.apply_catalog_svp_null_recovery(jsonb) from public;
revoke execute on function public.apply_catalog_svp_null_recovery(jsonb) from anon;
revoke execute on function public.apply_catalog_svp_null_recovery(jsonb) from authenticated;
grant execute on function public.apply_catalog_svp_null_recovery(jsonb) to service_role;
