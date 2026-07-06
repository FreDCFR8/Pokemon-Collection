# ADR-003: Supabase Source of Truth

## Status

Draft

## Context

The application manages personal collection data for separate users.

Local browser storage cannot be trusted as the source of truth.

## Decision

Supabase is the only source of truth for user-owned application data.

Local storage may only be used for temporary cache, faster loading, or future offline read support.

Offline writes are out of scope for v1.

## Consequences

Positive:

- clearer data ownership
- safer multi-device behavior
- simpler conflict model in v1

Negative:

- online connection required in v1
- Supabase schema and RLS must be correct before features scale
