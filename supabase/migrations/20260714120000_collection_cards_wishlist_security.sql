begin;

create unique index if not exists collection_cards_one_wishlist_per_card_idx
on public.collection_cards (collection_id, card_catalog_id)
where status = 'wishlist';

drop policy if exists collection_cards_insert_wishlist_own_collection
on public.collection_cards;

create policy collection_cards_insert_wishlist_own_collection
on public.collection_cards
for insert
to authenticated
with check (
  exists (
    select 1
    from public.collections c
    join public.profiles p
      on p.id = c.profile_id
    where c.id = collection_cards.collection_id
      and p.auth_user_id = auth.uid()
  )
  and quantity = 1
  and condition is null
  and status = 'wishlist'
);

commit;
