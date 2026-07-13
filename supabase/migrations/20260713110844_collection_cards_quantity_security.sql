begin;

drop policy if exists collection_cards_update_quantity_own_collection
on public.collection_cards;

create policy collection_cards_update_quantity_own_collection
on public.collection_cards
for update
to authenticated
using (
  exists (
    select 1
    from public.collections c
    join public.profiles p
      on p.id = c.profile_id
    where c.id = collection_cards.collection_id
      and p.auth_user_id = auth.uid()
  )
  and condition = 'Near Mint'
  and status = 'owned'
)
with check (
  exists (
    select 1
    from public.collections c
    join public.profiles p
      on p.id = c.profile_id
    where c.id = collection_cards.collection_id
      and p.auth_user_id = auth.uid()
  )
  and quantity > 0
  and condition = 'Near Mint'
  and status = 'owned'
);

drop policy if exists collection_cards_delete_last_owned_copy
on public.collection_cards;

create policy collection_cards_delete_last_owned_copy
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
      and p.auth_user_id = auth.uid()
  )
  and quantity = 1
  and condition = 'Near Mint'
  and status = 'owned'
);

create or replace function public.enforce_collection_cards_quantity_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.collection_id is distinct from old.collection_id
     or new.card_catalog_id is distinct from old.card_catalog_id
     or new.condition is distinct from old.condition
     or new.status is distinct from old.status
     or new.added_at is distinct from old.added_at
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Alleen quantity mag via deze updateflow worden gewijzigd.';
  end if;

  if new.quantity not in (old.quantity - 1, old.quantity + 1) then
    raise exception 'Quantity mag per bewerking alleen met exact 1 wijzigen.';
  end if;

  if new.quantity < 1 then
    raise exception 'Quantity moet minstens 1 blijven; verwijder de laatste kopie via DELETE.';
  end if;

  return new;
end;
$$;

drop trigger if exists collection_cards_enforce_quantity_update
on public.collection_cards;

create trigger collection_cards_enforce_quantity_update
before update on public.collection_cards
for each row
execute function public.enforce_collection_cards_quantity_update();

commit;
