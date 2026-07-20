begin;

-- Internal import RPC.  Each call is one PostgreSQL transaction: a card row
-- and its pokemon_tcg_api reference are inserted together, or neither is.
create or replace function public.phase_7b_import_catalog_card_chunk(p_rows jsonb)
returns table(cards_inserted integer, references_inserted integer, already_applied integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected_count integer;
  v_cards_inserted integer := 0;
  v_references_inserted integer := 0;
  v_already_applied integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Phase 7B chunk requires a JSON array.' using errcode = '22023';
  end if;

  select count(*)::integer into v_expected_count
  from jsonb_to_recordset(p_rows) as row(
    id uuid, external_id text, pokemon text, set_name text, number text,
    rarity text, image_small text, image_large text, card_details jsonb, set_code text
  );

  if v_expected_count < 1 or v_expected_count > 100 then
    raise exception 'Phase 7B chunk must contain 1 through 100 cards.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as row(
      id uuid, external_id text, pokemon text, set_name text, number text,
      rarity text, image_small text, image_large text, card_details jsonb, set_code text
    )
    group by row.id having count(*) <> 1
  ) or exists (
    select 1
    from jsonb_to_recordset(p_rows) as row(
      id uuid, external_id text, pokemon text, set_name text, number text,
      rarity text, image_small text, image_large text, card_details jsonb, set_code text
    )
    group by row.external_id having count(*) <> 1
  ) then
    raise exception 'Phase 7B chunk contains duplicate card identities.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as row(
      id uuid, external_id text, pokemon text, set_name text, number text,
      rarity text, image_small text, image_large text, card_details jsonb, set_code text
    )
    where row.id is null or btrim(coalesce(row.external_id, '')) = ''
      or btrim(coalesce(row.pokemon, '')) = '' or btrim(coalesce(row.set_name, '')) = ''
      or btrim(coalesce(row.number, '')) = '' or btrim(coalesce(row.set_code, '')) = ''
      or jsonb_typeof(coalesce(row.card_details, '{}'::jsonb)) <> 'object'
  ) then
    raise exception 'Phase 7B chunk contains incomplete card metadata.' using errcode = '22023';
  end if;

  -- Every requested set must remain a current canonical pokemon_tcg_api set.
  if exists (
    select 1
    from (
      select distinct row.set_code
      from jsonb_to_recordset(p_rows) as row(
        id uuid, external_id text, pokemon text, set_name text, number text,
        rarity text, image_small text, image_large text, card_details jsonb, set_code text
      )
    ) expected
    left join public.sets_catalog set_row
      on set_row.set_code = expected.set_code
     and set_row.source = 'pokemon_tcg_api'
     and set_row.source_id = expected.set_code
    where set_row.id is null
  ) then
    raise exception 'Phase 7B chunk has no exact canonical set mapping.' using errcode = 'P0001';
  end if;

  -- A row is either already completely identical or entirely absent.  Partial
  -- state and metadata drift are errors; no upsert can silently repair them.
  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as incoming(
      id uuid, external_id text, pokemon text, set_name text, number text,
      rarity text, image_small text, image_large text, card_details jsonb, set_code text
    )
    left join public.cards_catalog card on card.id = incoming.id
    left join public.cards_catalog external_card
      on external_card.external_source = 'pokemon_tcg_api'
     and external_card.external_id = incoming.external_id
    left join public.card_external_references reference
      on reference.source = 'pokemon_tcg_api'
     and reference.external_id = incoming.external_id
    where (card.id is null) <> (external_card.id is null)
       or (card.id is not null and (
            card.id <> external_card.id
         or card.external_source <> 'pokemon_tcg_api'
         or card.external_id <> incoming.external_id
         or card.pokemon <> incoming.pokemon
         or card.set_name <> incoming.set_name
         or card.set_code <> incoming.set_code
         or card.number <> incoming.number
         or card.rarity is distinct from incoming.rarity
         or card.image_small is distinct from incoming.image_small
         or card.image_large is distinct from incoming.image_large
         or card.card_details <> coalesce(incoming.card_details, '{}'::jsonb)
         or reference.card_catalog_id is distinct from incoming.id
       ))
       or (card.id is null and reference.id is not null)
  ) then
    raise exception 'Phase 7B chunk conflicts with existing catalog or reference data.' using errcode = 'P0001';
  end if;

  insert into public.cards_catalog (
    id, external_source, external_id, pokemon, set_name, set_code, number,
    rarity, image_small, image_large, card_details
  )
  select incoming.id, 'pokemon_tcg_api', incoming.external_id, incoming.pokemon,
    incoming.set_name, incoming.set_code, incoming.number, incoming.rarity,
    incoming.image_small, incoming.image_large, coalesce(incoming.card_details, '{}'::jsonb)
  from jsonb_to_recordset(p_rows) as incoming(
    id uuid, external_id text, pokemon text, set_name text, number text,
    rarity text, image_small text, image_large text, card_details jsonb, set_code text
  )
  left join public.cards_catalog card on card.id = incoming.id
  where card.id is null;
  get diagnostics v_cards_inserted = row_count;

  insert into public.card_external_references (card_catalog_id, source, external_id)
  select incoming.id, 'pokemon_tcg_api', incoming.external_id
  from jsonb_to_recordset(p_rows) as incoming(
    id uuid, external_id text, pokemon text, set_name text, number text,
    rarity text, image_small text, image_large text, card_details jsonb, set_code text
  )
  left join public.card_external_references reference
    on reference.source = 'pokemon_tcg_api'
   and reference.external_id = incoming.external_id
  where reference.id is null;
  get diagnostics v_references_inserted = row_count;

  if v_cards_inserted <> v_references_inserted then
    raise exception 'Phase 7B chunk wrote an unequal card/reference count.' using errcode = 'P0001';
  end if;

  v_already_applied := v_expected_count - v_cards_inserted;
  return query select v_cards_inserted, v_references_inserted, v_already_applied;
end;
$$;

revoke execute on function public.phase_7b_import_catalog_card_chunk(jsonb) from public;
revoke execute on function public.phase_7b_import_catalog_card_chunk(jsonb) from anon;
revoke execute on function public.phase_7b_import_catalog_card_chunk(jsonb) from authenticated;
grant execute on function public.phase_7b_import_catalog_card_chunk(jsonb) to service_role;

commit;
