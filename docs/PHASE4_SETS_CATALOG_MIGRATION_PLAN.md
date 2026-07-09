# Phase 4C — Sets Catalog Migration Plan

## Scope

Phase 4C is a documentation-only migration plan for the future canonical sets catalog table `public.sets_catalog`.

This phase does not execute SQL, does not create or alter Supabase objects, does not seed data, does not change RLS in Supabase, and does not change runtime application code.

## 1. Doel

The goal of this plan is to turn the Phase 4B canonical sets catalog design into a reviewable future SQL migration draft.

The future table should provide stable read-only reference data for Pokémon sets so the app can later support:

- A complete Sets overview that is not derived from owned cards.
- Stable set identity independent from `cards_catalog.set_name`.
- Set metadata such as series, totals, release date, logos, symbols, and traceable source information.
- Future set-detail pages and collection progress calculations.
- Future card-to-set mapping after a reliable linking strategy exists.

## 2. Uitvoeringsregels

This document is a plan only.

- Do not execute the SQL from this phase automatically.
- Do not run the SQL from Codex, CI, the app, or a deployment workflow.
- Do not create `public.sets_catalog` during Phase 4C.
- Do not change `cards_catalog`, `collection_cards`, `profiles`, or any other existing Supabase table during Phase 4C.
- Do not add runtime Supabase queries during Phase 4C.
- Do not seed set rows during Phase 4C.

Manual execution belongs to a later approved phase, currently proposed as Phase 4D.

## 3. Preconditions before future manual execution

Before this migration is manually executed in Supabase, confirm:

- Phase 4C has been reviewed and accepted.
- The project still wants `public.sets_catalog` as the canonical table name.
- The selected external source policy is understood well enough to choose initial uniqueness rules.
- `gen_random_uuid()` is available in the Supabase project.
- `public.sets_catalog` does not already exist.
- The shared `public.set_updated_at()` trigger function exists, or the future executor has a separate approved plan to create it first.
- Existing public tables are checked so the future executor can confirm the expected project state before creating a new catalog table.
- No runtime code depends on `sets_catalog` yet, so the migration can be created safely before app integration.
- The write path is admin/manual/service-role only; child users must not write catalog rows from the app.

## 4. Future pre-check SQL draft

> Let op: onderstaande SQL is a draft for later manual execution in the Supabase SQL Editor after review. Phase 4C does not execute it.

Before creating anything in a later phase, run read-only checks to confirm the current Supabase state.

### A. Check whether `sets_catalog` already exists

```sql
select to_regclass('public.sets_catalog') as sets_catalog_regclass;
```

Expected before first manual creation: `null`. If this returns `public.sets_catalog`, stop and inspect the existing table before continuing.

### B. Check existing updated timestamp routines

```sql
select routine_schema, routine_name, routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('set_updated_at', 'update_updated_at_column')
order by routine_name;
```

Use this to confirm whether `public.set_updated_at()` already exists or whether the future migration needs to create it with the reviewed option B below.

### C. Check existing public tables

```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
order by table_name;
```

Use this to verify the expected public schema context before manually adding a new catalog table.

## 5. Future SQL migration draft

> Let op: onderstaande SQL is a draft for later manual execution in the Supabase SQL Editor after review. Phase 4C does not execute it.

### A. Table

```sql
create table public.sets_catalog (
  id uuid primary key default gen_random_uuid(),
  external_source text not null,
  external_id text null,
  set_code text null,
  name text not null,
  series text null,
  printed_total integer null,
  total integer null,
  release_date date null,
  generation integer null,
  logo_url text null,
  symbol_url text null,
  source_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sets_catalog_external_unique
    unique (external_source, external_id),

  constraint sets_catalog_printed_total_non_negative
    check (printed_total is null or printed_total >= 0),

  constraint sets_catalog_total_non_negative
    check (total is null or total >= 0),

  constraint sets_catalog_total_not_smaller_than_printed_total
    check (
      printed_total is null
      or total is null
      or total >= printed_total
    ),

  constraint sets_catalog_generation_range
    check (generation is null or generation between 1 and 9)
);
```

Notes:

- `name` is required because every set needs a user-visible display name.
- `external_source` is required so every row remains traceable to a source policy such as `pokemon_tcg_api`, `manual`, or `curated`.
- `external_id` may remain `null` for manual or curated rows when no stable external identifier exists.
- In PostgreSQL, `unique(external_source, external_id)` still allows multiple rows with the same `external_source` when `external_id` is `null`. This is acceptable for manual/curated rows unless a later seed/import policy requires stricter partial indexes.
- `name` is intentionally not unique. Display names may overlap, vary by language or region, or have special variants.
- `set_code` is intentionally not unique in the first draft. It can become unique only if the selected source proves that codes are globally stable and collision-free.
- `generation` is optional and should remain unused by runtime filters until a documented mapping policy exists.

### B. Optional future uniqueness refinements

If the seed/import policy later needs stricter source identity, consider replacing or supplementing the table-level unique constraint with a partial unique index:

```sql
create unique index sets_catalog_external_not_null_unique_idx
on public.sets_catalog (external_source, external_id)
where external_source is not null
  and external_id is not null;
```

If `set_code` is proven globally reliable for the chosen source, consider:

```sql
create unique index sets_catalog_set_code_unique_idx
on public.sets_catalog (set_code)
where set_code is not null;
```

These refinements are not required for the first manual table creation unless the accepted seed plan depends on them.

## 6. Index plan

Initial read patterns are expected to be lightweight set-list and set-detail queries. Future indexes should support sorting, grouping, and filtering without loading cards for every set.

```sql
create index sets_catalog_name_idx on public.sets_catalog (name);
create index sets_catalog_series_idx on public.sets_catalog (series);
create index sets_catalog_release_date_idx on public.sets_catalog (release_date);
create index sets_catalog_generation_idx on public.sets_catalog (generation);
create index sets_catalog_set_code_idx on public.sets_catalog (set_code);
create index sets_catalog_external_idx on public.sets_catalog (external_source, external_id);
```

Index notes:

- Keep indexes simple until real query patterns exist.
- `release_date` supports timeline sorting and recent/older grouping.
- `series` and `generation` support future grouping or filters.
- `external_source, external_id` supports future import reconciliation.
- Indexes are not a security boundary; RLS remains responsible for access control.

## 7. `updated_at` trigger plan

Do not execute either option in Phase 4C. Choose the correct option in Phase 4D only after the pre-check routines query has confirmed the current Supabase state.

### Option A — Reuse existing `public.set_updated_at()`

Use this option only if the pre-check confirms that the shared timestamp function already exists:

```sql
create trigger sets_catalog_set_updated_at
before update on public.sets_catalog
for each row
execute function public.set_updated_at();
```

### Option B — Create reviewed helper function, then create trigger

Use this option only in Phase 4D after checking that the helper function does not exist and after confirming that creating it matches the accepted migration plan:

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sets_catalog_set_updated_at
before update on public.sets_catalog
for each row
execute function public.set_updated_at();
```

Before manual execution, confirm whether `public.set_updated_at()` exists. If it does not exist, option B must still be treated as reviewed Phase 4D SQL, not as SQL to execute during Phase 4C.

## 8. RLS direction

`sets_catalog` is catalog/reference data. Runtime app users should be able to read it after login, but they should not create, update, or delete rows through the app.

### A. Enable RLS

```sql
alter table public.sets_catalog enable row level security;
```

### B. Authenticated read policy

```sql
create policy "sets_catalog_select_authenticated"
on public.sets_catalog
for select
to authenticated
using (true);
```

### C. Write policy direction

Do not add app write policies in the first migration.

- No `insert` policy for authenticated users.
- No `update` policy for authenticated users.
- No `delete` policy for authenticated users.
- Admin, service-role, or manual Supabase dashboard workflows can manage rows outside normal app user policies.
- If a future admin UI is added, it needs a separate security design and migration plan.

## 9. Relationship to existing tables

Phase 4C does not add foreign keys or backfills.

Future relationship options remain:

- Add `cards_catalog.set_id references public.sets_catalog(id)` after a reliable mapping exists.
- Keep an external source/id mapping during import and enrichment.
- Maintain `cards_catalog.set_name` as legacy/import display data until it can be safely linked or cleaned.

Do not infer canonical set identity from `cards_catalog.set_name` alone.

## 10. Seed/import is explicitly deferred

This migration plan creates the structure only in a later phase. It does not decide or execute the initial catalog dataset.

A later seed plan should define:

- The source of truth for first rows: Pokémon TCG API, manual entry, or a curated project-owned dataset.
- How source data is reviewed before insertion.
- How generation values are assigned.
- How logo and symbol URLs are validated.
- Whether `set_code` can be treated as globally unique.
- How future source updates are reconciled without breaking stable app ids.

## 11. Verification after future manual execution

After the SQL is manually executed in a later phase, verify in Supabase:

```sql
select count(*) as sets_catalog_row_count
from public.sets_catalog;
```

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'sets_catalog'
order by ordinal_position;
```

```sql
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'sets_catalog'
order by indexname;
```

```sql
select policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename = 'sets_catalog'
order by policyname;
```

These verification queries are for the future manual execution phase only, not for Phase 4C. The expected row count immediately after structure-only creation is `0` unless a later approved seed phase has also run.

## 12. Rollback direction for future manual execution

If the table is created manually in a later phase, this rollback is only safe while there is no production data, no foreign key dependency, and no runtime dependency on the table:

```sql
drop table if exists public.sets_catalog;
```

If future phases add production data, foreign keys, seed/import history, runtime code, or user-visible dependencies, rollback must be redesigned and must not rely on this simple drop-table direction.

## 13. Explicit non-goals

Phase 4C explicitly does not include:

- SQL execution.
- Database changes.
- Supabase migrations.
- Supabase dashboard changes.
- Seed data.
- Runtime Supabase queries.
- Runtime code changes.
- UI changes.
- Pokémon TCG API calls.
- External runtime dependencies.
- `cards_catalog` changes.
- `collection_cards` changes.
- Set detail pages.
- Set progress calculation.
- Collection filtering by set.
- Generation filter implementation.
- Type filter implementation.
