# Migration Plan

## Status

Phase 0 draft. No migration is approved yet.

## Context

Existing Supabase data likely contains Lars's collection and may already reference Pokémon TCG API data.

The existing data is valuable, but it must not force the new architecture into legacy assumptions.

## Decision

The first migration step is read-only analysis.

No data changes may happen before the analysis is complete and reviewed.

## Migration phases

### Phase M0 – Read-only inspection

Goal: understand the current Supabase database without changing it.

Inspect:

- tables
- columns
- primary keys
- foreign keys
- current row counts
- Pokémon TCG API identifiers
- ownership fields
- RLS settings
- policies
- Lars collection records
- Lore collection records, if any

Output:

- schema inventory
- ownership assessment
- risk list
- recommended migration route

### Phase M1 – Mapping design

Goal: map old data concepts to the new schema.

No writes yet.

Output:

- source-to-target mapping
- fields to keep
- fields to transform
- fields to ignore
- unknown data risks

### Phase M2 – Safe migration plan

Goal: design the actual migration.

Output:

- backup requirement
- dry-run approach
- rollback strategy
- validation queries
- success criteria

### Phase M3 – Migration execution

Only allowed after explicit approval.

## Possible outcomes

After read-only inspection, the team may choose to:

- keep existing data and adapt only access policies
- migrate data into a new schema
- create new reference tables and relink collection records
- archive old tables
- manually re-import a curated subset
- start clean if the existing structure is unsafe

## Acceptance criteria before migration

Migration may only proceed when:

- target schema is approved
- backup plan exists
- rollback plan exists
- data ownership is clear
- RLS strategy is approved
- validation queries are defined

## Stop Rule

If ownership cannot be proven, migration must stop.

If existing data is inconsistent, migration must stop until a cleanup strategy is approved.
