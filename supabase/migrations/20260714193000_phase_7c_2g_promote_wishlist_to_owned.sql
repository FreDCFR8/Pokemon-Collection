begin;

create or replace function public.promote_wishlist_to_owned(
  p_collection_id uuid,
  p_card_catalog_id uuid
)
returns setof public.collection_cards
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owned public.collection_cards;
  v_wishlist_count integer;
  v_deleted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authenticatie is vereist.' using errcode = '42501';
  end if;

  -- Lock the collection row so two promotions for the same collection/card
  -- cannot both pass the state checks before either transaction writes.
  perform 1
  from public.collections c
  join public.profiles p on p.id = c.profile_id
  where c.id = p_collection_id
    and p.auth_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'De actieve collectie is niet van de ingelogde gebruiker.' using errcode = '42501';
  end if;

  select count(*)::integer
    into v_wishlist_count
  from public.collection_cards cc
  where cc.collection_id = p_collection_id
    and cc.card_catalog_id = p_card_catalog_id
    and cc.status = 'wishlist';

  if v_wishlist_count <> 1 then
    raise exception 'Exact één geldige wishlistrij is vereist voor promotie.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.collection_cards cc
    where cc.collection_id = p_collection_id
      and cc.card_catalog_id = p_card_catalog_id
      and cc.status in ('owned', 'trade', 'missing')
  ) then
    raise exception 'Promotie geblokkeerd: de kaart heeft al een conflicterende collectiestatus.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.collection_cards cc
    where cc.collection_id = p_collection_id
      and cc.card_catalog_id = p_card_catalog_id
      and cc.status = 'wishlist'
      and cc.quantity = 1
      and cc.condition is null
  ) then
    raise exception 'De wishlistrij heeft geen geldige promotie-eigenschappen.' using errcode = 'P0001';
  end if;

  delete from public.collection_cards cc
  where cc.collection_id = p_collection_id
    and cc.card_catalog_id = p_card_catalog_id
    and cc.status = 'wishlist'
    and cc.quantity = 1
    and cc.condition is null;

  get diagnostics v_deleted_count = row_count;
  if v_deleted_count <> 1 then
    raise exception 'De wishlistrij is intussen gewijzigd.' using errcode = 'P0001';
  end if;

  insert into public.collection_cards (collection_id, card_catalog_id, quantity, condition, status)
  values (p_collection_id, p_card_catalog_id, 1, 'Near Mint', 'owned')
  returning * into v_owned;

  return next v_owned;
end;
$$;

revoke execute on function public.promote_wishlist_to_owned(uuid, uuid) from public;
revoke execute on function public.promote_wishlist_to_owned(uuid, uuid) from anon;
grant execute on function public.promote_wishlist_to_owned(uuid, uuid) to authenticated;

commit;
