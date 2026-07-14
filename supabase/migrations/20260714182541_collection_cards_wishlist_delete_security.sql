begin;

create policy collection_cards_delete_wishlist_own_collection
on public.collection_cards
for delete
to authenticated
using (
  exists (
    select 1
    from public.collections c
    join public.profiles p
      on p.id = c.profile_id
    where c.id = collection_cards.collection_id
      and p.auth_user_id = (select auth.uid())
  )
  and status = 'wishlist'
  and quantity = 1
  and condition is null
);

commit;
