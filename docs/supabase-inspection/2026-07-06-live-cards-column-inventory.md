# Live Supabase Cards Column Inventory

## Status

Phase 0 read-only inspection.

No database changes were made.

## Result

The live `public.cards` table contains 2190 rows and has the following columns:

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() |
| pokemon | text | NO | null |
| set_name | text | YES | null |
| number | text | YES | null |
| rarity | text | YES | null |
| condition | text | YES | null |
| quantity | integer | YES | 1 |
| status | text | YES | 'owned'::text |
| collection | text | NO | null |
| added_at | date | YES | CURRENT_DATE |
| image_small | text | YES | null |
| image_large | text | YES | null |
| cardmarket_url | text | YES | null |
| tcgplayer_url | text | YES | null |
| created_at | timestamp with time zone | YES | now() |

## Correction to earlier assessment

An earlier supplied schema used `owner` as the ownership-like field.

The live table does not contain `owner`.

The live ownership-like field is:

```sql
collection text not null
```

## Architecture impact

`collection` can likely identify a collection such as Lars or Lore, but it is not a final security ownership model.

It is a legacy/source field that must be mapped to authenticated users or profiles before secure multi-user access can be implemented.

## Positive findings

- The live schema is now confirmed.
- The table has a UUID primary key.
- The table has a collection-like grouping column.
- Basic card fields are present.
- Quantity, status, condition, images, and market URLs are available.
- The schema is simple enough to support a read-only migration analysis.

## Remaining risks

### Security ownership risk

`collection text` is not equivalent to authenticated ownership.

It cannot by itself prove that a logged-in user owns the rows.

### Reference identity risk

The table does not include a visible stable Pokémon TCG API card ID.

Potential lookup keys are:

- pokemon
- set_name
- number

This may be sufficient for matching many cards, but it must be validated.

### Constraint uncertainty

The column inventory does not show table constraints except defaults and nullability.

The actual check constraints and indexes still need to be confirmed if needed.

### RLS uncertainty

RLS returned one row and policies returned four rows, but exact values are still needed.

## Required next read-only queries

Distinct collections:

```sql
select collection, count(*)
from public.cards
group by collection
order by collection;
```

Distinct statuses:

```sql
select status, count(*)
from public.cards
group by status
order by status;
```

RLS status:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'cards';
```

Policies:

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'cards'
order by policyname;
```

Public tables:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

## Provisional recommendation

Do not mutate `public.cards`.

Use `public.cards` as a legacy read-only source table until a secure target model is approved.

A first read-only viewer may become possible if:

- `collection` values clearly map to Lars and Lore
- RLS is safe or app access is constrained during development
- parent/admin behavior is explicitly defined
- no write actions are exposed

## Stop Rule

Do not implement collection viewing until collection values and RLS policies are known.
