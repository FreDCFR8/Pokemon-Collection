begin;

-- Controlled Phase 1C bootstrap for the explicitly approved administrator
-- Auth identity. This migration must run after the role/RLS migration.

-- Expected administrator identity:
-- auth_user_id: 4b298356-0cef-4606-a6c8-c7fff65ff6fc
-- username: frederik
-- display_name: Frederik

do $$
declare
  target_auth_user_id constant uuid := '4b298356-0cef-4606-a6c8-c7fff65ff6fc'::uuid;
  existing_profile public.profiles%rowtype;
begin
  if not exists (
    select 1
    from auth.users
    where id = target_auth_user_id
  ) then
    raise exception 'Phase 1C admin bootstrap blocked: approved Auth user does not exist';
  end if;

  select *
  into existing_profile
  from public.profiles
  where auth_user_id = target_auth_user_id;

  if found then
    if existing_profile.username = 'frederik'
      and existing_profile.display_name = 'Frederik'
      and existing_profile.role = 'admin'
      and existing_profile.child_key is null
    then
      return;
    end if;

    raise exception 'Phase 1C admin bootstrap blocked: approved Auth user is already linked to a different profile';
  end if;

  if exists (
    select 1
    from public.profiles
    where username = 'frederik'
  ) then
    raise exception 'Phase 1C admin bootstrap blocked: username frederik is already in use';
  end if;

  insert into public.profiles (
    auth_user_id,
    username,
    display_name,
    role,
    child_key
  ) values (
    target_auth_user_id,
    'frederik',
    'Frederik',
    'admin',
    null
  );
end
$$;

-- Transactional postconditions. Any mismatch rolls the complete migration back.
do $$
begin
  if (
    select count(*)
    from public.profiles
    where auth_user_id = '4b298356-0cef-4606-a6c8-c7fff65ff6fc'::uuid
      and username = 'frederik'
      and display_name = 'Frederik'
      and role = 'admin'
      and child_key is null
  ) <> 1 then
    raise exception 'Phase 1C admin bootstrap postcheck failed';
  end if;

  if exists (
    select auth_user_id
    from public.profiles
    group by auth_user_id
    having count(*) > 1
  ) then
    raise exception 'Phase 1C admin bootstrap postcheck failed: duplicate Auth profile links';
  end if;
end
$$;

commit;
