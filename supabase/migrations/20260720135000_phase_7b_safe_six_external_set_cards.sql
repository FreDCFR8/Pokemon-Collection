-- Internal-only import primitive for six legacy catalog sets whose exact
-- pokemon_tcg_api identity is stored in set_external_references. This function
-- never creates or changes a set mapping.
create or replace function public.phase_7b_insert_catalog_card_chunk_external_set_reference(p_rows jsonb)
returns table(cards_inserted integer, references_inserted integer, already_present integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected_rows integer;
  inserted_cards integer := 0;
  inserted_references integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Phase 7B input must be a JSON array.' using errcode = '22023';
  end if;

  select count(*)::integer into expected_rows from jsonb_to_recordset(p_rows) as row(
    id uuid, external_id text, pokemon text, set_name text, set_code text, number text,
    rarity text, image_small text, image_large text, card_details jsonb
  );
  if expected_rows < 1 or expected_rows > 100 then
    raise exception 'Phase 7B chunks contain 1 through 100 cards.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_rows) as row(
      id uuid, external_id text, pokemon text, set_name text, set_code text, number text,
      rarity text, image_small text, image_large text, card_details jsonb
    ) group by row.id having count(*) > 1
  ) or exists (
    select 1 from jsonb_to_recordset(p_rows) as row(
      id uuid, external_id text, pokemon text, set_name text, set_code text, number text,
      rarity text, image_small text, image_large text, card_details jsonb
    ) group by row.external_id having count(*) > 1
  ) then
    raise exception 'Phase 7B chunk has duplicate card identities.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_rows) as row(
      id uuid, external_id text, pokemon text, set_name text, set_code text, number text,
      rarity text, image_small text, image_large text, card_details jsonb
    ) where row.id is null or btrim(coalesce(row.external_id, '')) = ''
      or btrim(coalesce(row.pokemon, '')) = '' or btrim(coalesce(row.set_name, '')) = ''
      or btrim(coalesce(row.set_code, '')) = '' or btrim(coalesce(row.number, '')) = ''
      or jsonb_typeof(coalesce(row.card_details, '{}'::jsonb)) <> 'object'
  ) then
    raise exception 'Phase 7B chunk has incomplete card metadata.' using errcode = '22023';
  end if;

  -- The pre-existing canonical set and its exact external identity must agree.
  if exists (
    select 1 from (select distinct row.set_code, row.set_name from jsonb_to_recordset(p_rows) as row(
      id uuid, external_id text, pokemon text, set_name text, set_code text, number text,
      rarity text, image_small text, image_large text, card_details jsonb
    )) incoming
    left join public.sets_catalog set_row on set_row.set_code = incoming.set_code and set_row.name = incoming.set_name
    left join public.set_external_references set_reference on set_reference.set_catalog_id = set_row.id
      and set_reference.source = 'pokemon_tcg_api' and set_reference.external_id = incoming.set_code
    where set_row.id is null or set_reference.id is null
  ) then
    raise exception 'Phase 7B chunk has no matching external set reference.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_rows) as incoming(
      id uuid, external_id text, pokemon text, set_name text, set_code text, number text,
      rarity text, image_small text, image_large text, card_details jsonb
    )
    left join public.cards_catalog card_by_id on card_by_id.id = incoming.id
    left join public.cards_catalog card_by_external on card_by_external.external_source = 'pokemon_tcg_api' and card_by_external.external_id = incoming.external_id
    left join public.card_external_references reference on reference.source = 'pokemon_tcg_api' and reference.external_id = incoming.external_id
    where (card_by_id.id is null) <> (card_by_external.id is null)
      or (card_by_id.id is null and reference.id is not null)
      or (card_by_id.id is not null and (
        card_by_id.id <> card_by_external.id or card_by_id.external_source <> 'pokemon_tcg_api'
        or card_by_id.external_id <> incoming.external_id or card_by_id.pokemon <> incoming.pokemon
        or card_by_id.set_name <> incoming.set_name or card_by_id.set_code <> incoming.set_code
        or card_by_id.number <> incoming.number or card_by_id.rarity is distinct from incoming.rarity
        or card_by_id.image_small is distinct from incoming.image_small or card_by_id.image_large is distinct from incoming.image_large
        or card_by_id.card_details <> incoming.card_details or reference.card_catalog_id is distinct from incoming.id
      ))
  ) then
    raise exception 'Phase 7B chunk conflicts with existing data; nothing was changed.' using errcode = 'P0001';
  end if;

  insert into public.cards_catalog (id, external_source, external_id, pokemon, set_name, set_code, number, rarity, image_small, image_large, card_details)
  select id, 'pokemon_tcg_api', external_id, pokemon, set_name, set_code, number, rarity, image_small, image_large, card_details
  from jsonb_to_recordset(p_rows) as row(id uuid, external_id text, pokemon text, set_name text, set_code text, number text, rarity text, image_small text, image_large text, card_details jsonb)
  on conflict (id) do nothing;
  get diagnostics inserted_cards = row_count;

  insert into public.card_external_references (card_catalog_id, source, external_id)
  select id, 'pokemon_tcg_api', external_id
  from jsonb_to_recordset(p_rows) as row(id uuid, external_id text, pokemon text, set_name text, set_code text, number text, rarity text, image_small text, image_large text, card_details jsonb)
  on conflict (source, external_id) do nothing;
  get diagnostics inserted_references = row_count;
  if inserted_cards <> inserted_references then
    raise exception 'Phase 7B chunk card/reference counts differ; transaction rolled back.' using errcode = 'P0001';
  end if;
  return query select inserted_cards, inserted_references, expected_rows - inserted_cards;
end;
$$;

revoke execute on function public.phase_7b_insert_catalog_card_chunk_external_set_reference(jsonb) from public;
revoke execute on function public.phase_7b_insert_catalog_card_chunk_external_set_reference(jsonb) from anon;
revoke execute on function public.phase_7b_insert_catalog_card_chunk_external_set_reference(jsonb) from authenticated;
grant execute on function public.phase_7b_insert_catalog_card_chunk_external_set_reference(jsonb) to service_role;
