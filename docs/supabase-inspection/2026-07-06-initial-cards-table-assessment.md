# Initial Supabase Cards Table Assessment

## Status

Phase 0 read-only assessment.

No database changes have been made.

## Source

Supplied schema for `public.cards` from Supabase.

## Existing table

```sql
create table public.cards (
  id uuid not null default gen_random_uuid(),
  pokemon text not null,
  set_name text null,
  card_number text null,
  rarity text null,
  card_condition text null,
  quantity integer not null default 1,
  status text not null default 'owned',
  owner text not null,
  added_at date not null default current_date,
  image_small text null,
  image_large text null,
  cardmarket_url text null,
  tcgplayer_url text null,
  created_at timestamp with time zone not null default now(),

  constraint cards_pkey primary key (id),
  constraint cards_quantity_check check (quantity >= 0),
  constraint cards_status_check check (
    status in ('owned', 'wishlist', 'traded', 'sold', 'missing')
  )
);
```

## Initial assessment

The table is functional as a simple collection table, but it is not sufficient as the final architecture for the new project.

The main issue is ownership.

`owner text not null` can identify Lars or Lore in a basic way, but it does not create secure ownership linked to Supabase Auth.

For the new project, user-owned records must be linked to authenticated users and protected by Row Level Security.

## Positive findings

- Primary key exists.
- Quantity has a non-negative check.
- Status has a constrained value list.
- Image URLs are stored separately for small and large images.
- Cardmarket and TCGPlayer URLs are available.
- `created_at` and `added_at` exist.
- The schema is simple enough to inspect and map.

## Risks

### Ownership risk

`owner text` is not a secure ownership model.

Risks:

- no direct link to Supabase Auth users
- RLS cannot safely compare ownership to `auth.uid()` without mapping
- spelling differences could split ownership
- parent/admin permissions cannot be modeled cleanly
- future users require schema changes or fragile conventions

### Reference data risk

The table stores card details directly in collection rows.

Risks:

- no stable Pokémon TCG API card ID is visible
- no stable Pokémon TCG API set ID is visible
- cards may be hard to deduplicate
- card names and set names may not uniquely identify cards
- reference data and user-owned state are mixed

### Status modeling risk

`status` includes both collection and lifecycle states:

- owned
- wishlist
- traded
- sold
- missing

This may be acceptable temporarily, but the new architecture separates collection items and wishlist items.

### Permission risk

The existing schema has no explicit permission model for children or parent/admin accounts.

### Migration risk

Migration risk is currently medium to high until we know whether rows can be linked to stable Pokémon TCG API identifiers.

## Provisional mapping to target architecture

| Existing column | Possible target | Notes |
| --- | --- | --- |
| id | legacy source id or collection item id | Could be preserved during migration. |
| pokemon | cards_reference.name | Not stable enough as only identifier. |
| set_name | sets_reference.name | Not stable enough as only identifier. |
| card_number | cards_reference.number | Useful with set_name, but still needs validation. |
| rarity | cards_reference.rarity or snapshot field | Could be reference data. |
| card_condition | collection_items.condition | User-owned state. |
| quantity | collection_items.quantity | User-owned state. |
| status | collection or wishlist mapping | Needs design. |
| owner | owner mapping table | Must be mapped to auth user/profile. |
| added_at | collection_items.created/added date | Useful. |
| image_small | cards_reference.image_small_url | Reference data. |
| image_large | cards_reference.image_large_url | Reference data. |
| cardmarket_url | cards_reference.market_url or external link table | Reference data. |
| tcgplayer_url | cards_reference.market_url or external link table | Reference data. |
| created_at | collection_items.created_at | Useful. |

## Required next read-only information

To continue safely, collect:

1. Row count for `cards`.
2. Distinct owners.
3. Distinct statuses.
4. Whether RLS is enabled on `cards`.
5. Existing RLS policies for `cards`.
6. Sample rows for a few cards, with private data removed if needed.
7. Whether there are other public tables.
8. Whether Supabase Auth users already exist for Lars, Lore, or parent/admin.

## Safe read-only queries

Distinct owners:

```sql
select owner, count(*)
from public.cards
group by owner
order by owner;
```

Distinct statuses:

```sql
select status, count(*)
from public.cards
group by status
order by status;
```

Total rows:

```sql
select count(*)
from public.cards;
```

Check RLS status:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'cards';
```

List policies:

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'cards'
order by policyname;
```

List all public tables:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

## Architectural recommendation

Do not use `public.cards` as the final table design.

Use it as a legacy/source table for read-only inspection and possible migration.

The target model should introduce:

- authenticated profiles
- parent/admin role
- child roles
- user-owned collection records linked to auth users
- separate reference card/set data
- permission model for future collection changes

## Stop Rule

Implementation must not start until ownership and RLS status are known.

If `owner` cannot be safely mapped to authenticated users, build a migration mapping plan before implementing collection features.
