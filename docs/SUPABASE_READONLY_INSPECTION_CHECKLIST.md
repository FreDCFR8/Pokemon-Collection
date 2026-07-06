# Supabase Read-only Inspection Checklist

## Status

Phase 0 checklist.

This checklist is for analysis only.

No data may be inserted, updated, deleted, migrated, renamed, or cleaned up during this step.

## Goal

Understand the existing Supabase project before any schema design, migration, or application implementation starts.

The existing database may contain Lars's collection data and Pokémon TCG API references. This data is valuable but must be inspected safely.

## Rules

- Read-only inspection only.
- Do not share service role keys.
- Do not commit secrets.
- Do not change database settings.
- Do not disable or modify RLS.
- Do not run migrations.
- Do not clean data.
- Do not manually edit rows.
- Do not connect application code yet.

## Required outputs

The inspection should produce:

- table inventory
- column inventory
- relationship overview
- row count overview
- ownership assessment
- Pokémon TCG API mapping assessment
- RLS status overview
- risk list
- recommended migration direction

## 1. Project overview

Collect the following information:

- Supabase project name
- environment type, if known: production, test, old app, or unknown
- whether this project was used by `Pokemon-Manager`
- whether this project contains only Lars data or also Lore data
- whether authentication is already configured

## 2. Table inventory

For every visible table, record:

- table name
- purpose, if known
- approximate row count
- whether it looks like user-owned app data
- whether it looks like Pokémon reference data
- whether it looks temporary or legacy

Example output format:

| Table | Purpose | Row count | User-owned? | Reference data? | Notes |
| --- | --- | ---: | --- | --- | --- |
| unknown | unknown | unknown | unknown | unknown | to inspect |

## 3. Column inventory

For every relevant table, record:

- column name
- data type
- nullable or required
- default value
- primary key
- foreign key
- unique constraints
- indexes, if visible

Special attention:

- user ID fields
- owner fields
- profile fields
- Pokémon TCG card IDs
- Pokémon TCG set IDs
- card image URLs
- quantity fields
- condition fields
- language fields
- variant fields
- timestamps

## 4. Existing ownership model

Determine whether existing records are connected to a user.

Check for fields such as:

- user_id
- owner_id
- owner_user_id
- profile_id
- child_id
- player_id
- name fields such as Lars or Lore

Questions:

- Can we prove which records belong to Lars?
- Can we prove which records belong to Lore?
- Is ownership stored structurally or only implied by naming?
- Are multiple users already supported?
- Is there any parent/admin concept already present?

## 5. Pokémon TCG API mapping

Inspect whether existing data contains stable external identifiers.

Look for:

- Pokémon TCG API card ID
- Pokémon TCG API set ID
- card name
- set name
- set number
- collector number
- rarity
- image URLs
- raw API payloads

Questions:

- Can collection records be linked to Pokémon TCG API cards?
- Is the link stored by stable ID or only by card name?
- Is reference data duplicated inside collection records?
- Are images stored as URLs or files?

## 6. RLS status

For every table, record:

- whether Row Level Security is enabled
- existing policies, if visible
- policy names
- policy operation: select, insert, update, delete, all
- policy target role: anon, authenticated, service_role, public

Questions:

- Can authenticated users only see their own data?
- Are tables accidentally public?
- Are policies too broad?
- Are policies missing?

## 7. Authentication status

Check:

- whether Supabase Auth users already exist
- whether Lars has an auth user
- whether Lore has an auth user
- whether a parent/admin auth user exists
- whether profiles are already linked to auth users

Do not export private user details into the repository.

## 8. Data volume and performance risk

Record approximate counts:

- number of collection rows
- number of unique cards
- number of sets
- number of reference cards, if present
- number of image URLs

Questions:

- Would a naive full fetch be too large for iPhone Safari?
- Which tables need pagination?
- Which tables need indexes?
- Which views need server-side filtering?

## 9. Data quality

Inspect without changing:

- duplicate collection rows
- missing card IDs
- missing set IDs
- missing image URLs
- invalid quantities
- inconsistent names
- inconsistent variants
- records that cannot be linked to a card

## 10. Migration risk assessment

Classify migration risk:

- low: ownership and card IDs are clear
- medium: data mostly clear but needs transformation
- high: ownership or card identity is unclear
- blocked: data cannot be safely mapped

## 11. Recommended migration direction

After inspection, recommend one of:

- keep existing tables temporarily and build read-only access
- create new schema and migrate later
- create reference tables first, then map collection rows
- archive existing tables and re-import curated data
- start clean if existing structure is unsafe

## 12. Read-only SQL examples

These examples are read-only. Run only if you are comfortable in Supabase SQL editor.

List public tables:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

List columns:

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

Check approximate row counts by table manually using Supabase table editor or safe count queries.

Check RLS status:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

List policies:

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

## 13. Completion criteria

The inspection is complete when:

- all tables are listed
- relevant columns are documented
- ownership model is understood or marked as unknown
- Pokémon TCG API mapping is understood or marked as unknown
- RLS status is documented
- migration risk is classified
- next architecture decision is recommended

## Stop Rule

If ownership is unclear, stop.

If RLS is missing or unsafe, stop.

If existing collection data cannot be linked to stable card identifiers, stop.

Do not implement collection features until the issue is analyzed and resolved.
