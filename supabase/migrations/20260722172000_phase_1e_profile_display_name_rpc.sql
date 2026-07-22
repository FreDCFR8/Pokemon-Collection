begin;

create or replace function public.update_profile_display_name(
  target_profile_id uuid,
  new_display_name text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
  normalized_name text := btrim(new_display_name);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if char_length(normalized_name) < 2 or char_length(normalized_name) > 40 then
    raise exception 'Invalid display name';
  end if;

  select p.role into caller_role
  from public.profiles p
  where p.auth_user_id = auth.uid();

  if caller_role is null then
    raise exception 'Profile not found';
  end if;

  update public.profiles p
  set display_name = normalized_name,
      updated_at = now()
  where p.id = target_profile_id
    and (
      p.auth_user_id = auth.uid()
      or caller_role = 'admin'
    );

  if not found then
    raise exception 'Profile update not allowed';
  end if;

  return normalized_name;
end;
$$;

revoke all on function public.update_profile_display_name(uuid, text) from public;
revoke execute on function public.update_profile_display_name(uuid, text) from anon;
grant execute on function public.update_profile_display_name(uuid, text) to authenticated;

comment on function public.update_profile_display_name(uuid, text) is
  'Updates only display_name for the caller own profile or for an admin-authorized target profile.';

commit;
