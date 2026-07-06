# Supabase Read-only Query Results 01

## Status

Phase 0 read-only inspection.

No database changes were made.

## User-supplied results

### Query 1: total rows

Result: 2190 rows in `public.cards`.

### Query 2: distinct owners

Result: failed.

Error:

```text
ERROR: 42703: column "owner" does not exist
LINE 1: select owner, count(*)
```

### Query 3: distinct statuses

Result: 1 row returned.

Exact values were not supplied yet.

### Query 4: RLS status

Result: 1 row returned.

Exact values were not supplied yet.

### Query 5: policies

Result: 4 rows returned.

Exact policy details were not supplied yet.

### Query 6: public tables

Result: 1 row returned.

Exact table name was not supplied yet, but likely `cards`.

## Architecture impact

The read-only inspection reveals an important inconsistency.

The earlier supplied `create table public.cards` statement included:

```sql
owner text not null
```

But the live query reports that `owner` does not exist.

This means at least one of the following is true:

- the supplied `create table` statement does not match the active table
- the active table was changed after the statement was copied
- the actual ownership column has another name, such as `collection`, `profile`, `user_id`, or similar
- the query was run against a different Supabase project or schema
- the table was recreated with a different structure

## Stop Rule

This is a Stop Rule event.

No implementation may start until the actual live schema is known.

The project cannot safely design authentication, RLS, migration, or read-only collection access while the ownership column is unknown.

## Risk classification

Migration risk is now classified as high until the live schema is confirmed.

Reasons:

- ownership model is unknown
- RLS policy behavior cannot be assessed without exact policy details
- distinct owner counts cannot be produced
- parent/admin access cannot be modeled yet
- Lars and Lore separation cannot be proven yet

## Required next information

The next step is to capture the actual live column list.

Run this read-only query:

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards'
order by ordinal_position;
```

Also provide the exact output of these previously run queries:

```sql
select status, count(*)
from public.cards
group by status
order by status;
```

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'cards';
```

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'cards'
order by policyname;
```

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

## Temporary conclusion

The database contains 2190 card rows, but the ownership model is not yet confirmed.

Do not build read-only collection access yet.

First confirm the actual `public.cards` columns and policy definitions.
