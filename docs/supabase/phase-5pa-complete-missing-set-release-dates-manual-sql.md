# Phase 5PA: complete missing set release dates manual SQL

This document provides a safe, manually reviewable SQL script for filling approved missing `release_date` values in `public.sets_catalog`.

Do not run this from the application or automation. Review and execute it manually in Supabase only when ready.

## 1. Goal

PR #80 sorts the Sets page by `release_date` descending, but several rows in `public.sets_catalog` still have `release_date = null`. This data-only SQL fills the reviewed dates for exactly the approved set names below.

This script:

- Updates only `public.sets_catalog`.
- Updates only rows where `release_date is null`.
- Matches rows by exact `name`.
- Uses a fixed `values` mapping.
- Does not insert, delete, or upsert any rows.

## 2. Pre-check SQL

Use these queries before applying the update to verify the current missing release dates.

```sql
select
  id,
  name,
  release_date
from public.sets_catalog
where release_date is null
order by name asc;
```

```sql
select count(*) as sets_missing_release_date
from public.sets_catalog
where release_date is null;
```

## 3. Transactional update SQL

Review the affected rows first, then run this transaction manually in Supabase.

```sql
begin;

with approved_release_dates(name, release_date) as (
  values
    ('Brilliant Stars', date '2022-02-25'),
    ('Astral Radiance', date '2022-05-27'),
    ('Pokémon GO', date '2022-07-01'),
    ('Lost Origin', date '2022-09-09'),
    ('Silver Tempest', date '2022-11-11'),
    ('Crown Zenith', date '2023-01-20'),
    ('Evolving Skies', date '2021-08-27'),
    ('Fusion Strike', date '2021-11-12'),
    ('Journey Together', date '2025-03-28'),
    ('Destined Rivals', date '2025-05-30')
)
update public.sets_catalog sets
set release_date = approved.release_date
from approved_release_dates approved
where sets.name = approved.name
  and sets.release_date is null;

commit;
```

## 4. Post-check SQL

Use these queries after the update to verify the final ordering and remaining null count.

```sql
select
  id,
  name,
  release_date
from public.sets_catalog
order by release_date desc nulls last, name asc;
```

```sql
select count(*) as sets_missing_release_date
from public.sets_catalog
where release_date is null;
```

## 5. Rollback SQL

Only run this rollback if the manual update needs to be reverted. It resets `release_date` to `null` for exactly the 10 approved set names.

```sql
begin;

with approved_release_dates(name) as (
  values
    ('Brilliant Stars'),
    ('Astral Radiance'),
    ('Pokémon GO'),
    ('Lost Origin'),
    ('Silver Tempest'),
    ('Crown Zenith'),
    ('Evolving Skies'),
    ('Fusion Strike'),
    ('Journey Together'),
    ('Destined Rivals')
)
update public.sets_catalog sets
set release_date = null
from approved_release_dates approved
where sets.name = approved.name;

commit;
```
