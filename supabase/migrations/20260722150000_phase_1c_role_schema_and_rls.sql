begin;

-- Phase 1C keeps public.profiles as the single persisted application identity
-- and role source. The migration is safe to prepare before an admin profile
-- exists; initial admin assignment is a separate, explicitly controlled step.

-- Stop when unexpected role data exists.
do $$
begin
  if exists (
    select 1
    from public.profiles
    where role not in ('child', 'parent', 'admin')
  ) then
    raise exception 'Phase 1C blocked: profiles contains an unsupported role';
  end if;

  if exists (
    select 1
    from public.profiles
    where role = 'child' and child_key is null
  ) then
    raise exception 'Phase 1C blocked: child profile without child_key';
  end if;

  if exists (
    select 1
    from public.profiles
    where role in ('parent', 'admin') and child_key is not null
  ) then
    raise exception 'Phase 1C blocked: administrator profile has child_key';
  end if;
end
$$;

-- Normalize the legacy schema label. No current production row uses parent,
-- but this keeps the migration safe for an equivalent environment that does.
update public.profiles
set role = 'admin', updated_at = now()
where role = 'parent';

alter table public.profiles
  drop constraint if exists profiles_child_role_consistency_check;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('child', 'admin'));

alter table public.profiles
  add constraint profiles_child_role_consistency_check
  check (
    (role = 'child' and child_key is not null)
    or
    (role = 'admin' and child_key is null)
  );

-- RLS policies need to evaluate the current account's trusted role without a
-- recursive query against public.profiles. The helper accepts no user input,
-- uses auth.uid(), has a fixed empty search_path and returns only the caller's
-- role. It cannot assign or change roles.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_application_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.auth_user_id = (select auth.uid())
  limit 1
$$;

revoke all on function private.current_application_role() from public;
grant execute on function private.current_application_role() to authenticated;

comment on function private.current_application_role() is
  'Returns the trusted public.profiles role for the current authenticated user. Used only for RLS authorization.';

-- Profiles: a child sees only its own profile; admin may read profiles for the
-- later protected administrator shell. No browser insert/update/delete policy
-- is introduced, so roles cannot be assigned or changed by authenticated users.
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_own_or_admin on public.profiles;

create policy profiles_select_own_or_admin
on public.profiles
for select
to authenticated
using (
  auth_user_id = (select auth.uid())
  or (select private.current_application_role()) = 'admin'
);

-- Collections: preserve child ownership isolation and add admin read-only
-- access. No admin mutation policy is introduced.
drop policy if exists collections_select_own on public.collections;
drop policy if exists collections_select_own_or_admin on public.collections;

create policy collections_select_own_or_admin
on public.collections
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = collections.profile_id
      and p.auth_user_id = (select auth.uid())
  )
  or (select private.current_application_role()) = 'admin'
);

-- Collection cards: preserve the existing child SELECT boundary and add admin
-- read-only access. Existing insert/update/delete policies remain unchanged and
-- continue to require ownership plus their current state-specific safeguards.
drop policy if exists collection_cards_select_own_collection on public.collection_cards;
drop policy if exists collection_cards_select_own_collection_or_admin on public.collection_cards;

create policy collection_cards_select_own_collection_or_admin
on public.collection_cards
for select
to authenticated
using (
  exists (
    select 1
    from public.collections c
    join public.profiles p on p.id = c.profile_id
    where c.id = collection_cards.collection_id
      and p.auth_user_id = (select auth.uid())
  )
  or (select private.current_application_role()) = 'admin'
);

commit;
