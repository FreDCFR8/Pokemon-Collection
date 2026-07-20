-- One atomic repair for the 36 proven legacy/API duplicate pairs created by
-- Phase 7B safe-six. Collection links remain attached to legacy card IDs.
create or replace function public.phase_7b_reconcile_safe_six_legacy_duplicates(p_rows jsonb)
returns table(cards_updated integer, references_updated integer, duplicate_cards_deleted integer, duplicate_references_deleted integer)
language plpgsql security invoker set search_path = ''
as $$
declare expected_rows integer; updated_cards integer := 0; updated_references integer := 0; deleted_cards integer := 0; deleted_references integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Recovery input must be a JSON array.' using errcode = '22023'; end if;
  select count(*)::integer into expected_rows from jsonb_to_recordset(p_rows) as row(legacy_id uuid, duplicate_id uuid, external_id text, pokemon text, set_name text, set_code text, number text, rarity text, image_small text, image_large text, card_details jsonb);
  if expected_rows <> 36 then raise exception 'Recovery requires exactly 36 proven pairs.' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_to_recordset(p_rows) as row(legacy_id uuid, duplicate_id uuid, external_id text, pokemon text, set_name text, set_code text, number text, rarity text, image_small text, image_large text, card_details jsonb) group by legacy_id having count(*) > 1) or exists (select 1 from jsonb_to_recordset(p_rows) as row(legacy_id uuid, duplicate_id uuid, external_id text, pokemon text, set_name text, set_code text, number text, rarity text, image_small text, image_large text, card_details jsonb) group by duplicate_id having count(*) > 1) then raise exception 'Recovery input has duplicate identities.' using errcode = '22023'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as incoming(legacy_id uuid, duplicate_id uuid, external_id text, pokemon text, set_name text, set_code text, number text, rarity text, image_small text, image_large text, card_details jsonb)
    left join public.cards_catalog legacy on legacy.id = incoming.legacy_id
    left join public.cards_catalog duplicate on duplicate.id = incoming.duplicate_id
    left join public.card_external_references legacy_ref on legacy_ref.card_catalog_id = legacy.id and legacy_ref.source = 'pokemon_tcg_api'
    left join public.card_external_references duplicate_ref on duplicate_ref.card_catalog_id = duplicate.id and duplicate_ref.source = 'pokemon_tcg_api'
    where legacy.id is null or duplicate.id is null or legacy_ref.id is null or duplicate_ref.id is null
      or legacy.external_source is distinct from 'legacy_public_cards' or duplicate.external_source is distinct from 'pokemon_tcg_api'
      or legacy.pokemon is distinct from incoming.pokemon or legacy.set_name is distinct from incoming.set_name or legacy.set_code is distinct from incoming.set_code or legacy.number is distinct from incoming.number
      or legacy.rarity is distinct from incoming.rarity or legacy.image_small is distinct from incoming.image_small or legacy.image_large is distinct from incoming.image_large
      or legacy.card_details is distinct from '{}'::jsonb or duplicate.external_id is distinct from incoming.external_id or duplicate.pokemon is distinct from incoming.pokemon or duplicate.set_name is distinct from incoming.set_name or duplicate.set_code is distinct from incoming.set_code or duplicate.number is distinct from incoming.number
      or duplicate.rarity is distinct from incoming.rarity or duplicate.image_small is distinct from incoming.image_small or duplicate.image_large is distinct from incoming.image_large or duplicate.card_details is distinct from incoming.card_details
      or legacy_ref.external_id is distinct from lower(incoming.external_id) or duplicate_ref.external_id is distinct from incoming.external_id
      or (select count(*) from public.card_external_references r where r.card_catalog_id = legacy.id) <> 1
      or (select count(*) from public.card_external_references r where r.card_catalog_id = duplicate.id) <> 1
      or (select count(*) from public.collection_cards cc where cc.card_catalog_id = legacy.id) <> 1
      or (select count(*) from public.collection_cards cc where cc.card_catalog_id = duplicate.id) <> 0
      or (select count(*) from public.cards_catalog c where c.set_code = incoming.set_code and c.number = incoming.number and c.pokemon = incoming.pokemon) <> 2
  ) then raise exception 'Recovery precheck conflicts with current data; nothing was changed.' using errcode = 'P0001'; end if;

  delete from public.card_external_references r using jsonb_to_recordset(p_rows) as incoming(legacy_id uuid, duplicate_id uuid, external_id text, pokemon text, set_name text, set_code text, number text, rarity text, image_small text, image_large text, card_details jsonb) where r.card_catalog_id = incoming.duplicate_id;
  get diagnostics deleted_references = row_count;
  delete from public.cards_catalog c using jsonb_to_recordset(p_rows) as incoming(legacy_id uuid, duplicate_id uuid, external_id text, pokemon text, set_name text, set_code text, number text, rarity text, image_small text, image_large text, card_details jsonb) where c.id = incoming.duplicate_id;
  get diagnostics deleted_cards = row_count;
  update public.cards_catalog legacy set external_source = 'pokemon_tcg_api', external_id = incoming.external_id, card_details = incoming.card_details
  from jsonb_to_recordset(p_rows) as incoming(legacy_id uuid, duplicate_id uuid, external_id text, pokemon text, set_name text, set_code text, number text, rarity text, image_small text, image_large text, card_details jsonb) where legacy.id = incoming.legacy_id;
  get diagnostics updated_cards = row_count;
  update public.card_external_references legacy_ref set external_id = incoming.external_id
  from jsonb_to_recordset(p_rows) as incoming(legacy_id uuid, duplicate_id uuid, external_id text, pokemon text, set_name text, set_code text, number text, rarity text, image_small text, image_large text, card_details jsonb) where legacy_ref.card_catalog_id = incoming.legacy_id and legacy_ref.source = 'pokemon_tcg_api';
  get diagnostics updated_references = row_count;
  if deleted_references <> expected_rows or deleted_cards <> expected_rows or updated_cards <> expected_rows or updated_references <> expected_rows then raise exception 'Recovery row counts differ; transaction rolled back.' using errcode = 'P0001'; end if;
  return query select updated_cards, updated_references, deleted_cards, deleted_references;
end;
$$;
revoke execute on function public.phase_7b_reconcile_safe_six_legacy_duplicates(jsonb) from public;
revoke execute on function public.phase_7b_reconcile_safe_six_legacy_duplicates(jsonb) from anon;
revoke execute on function public.phase_7b_reconcile_safe_six_legacy_duplicates(jsonb) from authenticated;
grant execute on function public.phase_7b_reconcile_safe_six_legacy_duplicates(jsonb) to service_role;
