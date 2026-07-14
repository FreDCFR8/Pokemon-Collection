create policy "collection_cards_insert_own_collection"
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
      and p.auth_user_id = (select auth.uid())
  )
  and quantity = 1
  and condition = 'Near Mint'
  and status = 'owned'
);;
