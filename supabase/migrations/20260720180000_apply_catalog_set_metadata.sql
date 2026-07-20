create or replace function public.apply_catalog_set_metadata(p_rows jsonb)
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare expected_rows integer; updated_rows integer;
begin
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Metadata input must be a JSON array.' using errcode = '22023'; end if;
  select count(*)::integer into expected_rows from jsonb_to_recordset(p_rows) as r(id uuid, expected_series text, expected_release_date text, expected_printed_total integer, expected_total integer, expected_symbol_url text, expected_logo_url text, series text, release_date text, printed_total integer, total integer, symbol_url text, logo_url text);
  if expected_rows < 1 then raise exception 'Metadata input must not be empty.' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_to_recordset(p_rows) as r(id uuid, expected_series text, expected_release_date text, expected_printed_total integer, expected_total integer, expected_symbol_url text, expected_logo_url text, series text, release_date text, printed_total integer, total integer, symbol_url text, logo_url text) group by id having count(*) > 1) then raise exception 'Metadata input has duplicate set IDs.' using errcode = '22023'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as r(id uuid, expected_series text, expected_release_date text, expected_printed_total integer, expected_total integer, expected_symbol_url text, expected_logo_url text, series text, release_date text, printed_total integer, total integer, symbol_url text, logo_url text)
    left join public.sets_catalog s on s.id = r.id
    where s.id is null or s.series is distinct from r.expected_series or s.release_date is distinct from r.expected_release_date::date or s.printed_total is distinct from r.expected_printed_total or s.total is distinct from r.expected_total or s.symbol_url is distinct from r.expected_symbol_url or s.logo_url is distinct from r.expected_logo_url
      or nullif(btrim(r.series), '') is null or nullif(btrim(r.release_date), '') is null or r.printed_total is null or r.total is null or nullif(btrim(r.symbol_url), '') is null or nullif(btrim(r.logo_url), '') is null
  ) then raise exception 'Metadata precheck conflicts with current data; nothing was changed.' using errcode = 'P0001'; end if;
  update public.sets_catalog s set series = r.series, release_date = r.release_date::date, printed_total = r.printed_total, total = r.total, symbol_url = r.symbol_url, logo_url = r.logo_url
  from jsonb_to_recordset(p_rows) as r(id uuid, expected_series text, expected_release_date text, expected_printed_total integer, expected_total integer, expected_symbol_url text, expected_logo_url text, series text, release_date text, printed_total integer, total integer, symbol_url text, logo_url text)
  where s.id = r.id;
  get diagnostics updated_rows = row_count;
  if updated_rows <> expected_rows then raise exception 'Metadata update count differs; transaction rolled back.' using errcode = 'P0001'; end if;
  return updated_rows;
end;
$$;
revoke execute on function public.apply_catalog_set_metadata(jsonb) from public;
revoke execute on function public.apply_catalog_set_metadata(jsonb) from anon;
revoke execute on function public.apply_catalog_set_metadata(jsonb) from authenticated;
grant execute on function public.apply_catalog_set_metadata(jsonb) to service_role;
