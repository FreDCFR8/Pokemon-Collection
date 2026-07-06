# ADR-010: Offline and Cache Policy

## Status

Draft

## Context

Supabase is the only source of truth. Local browser storage can improve perceived speed, but it must not become an uncontrolled second database.

## Decision

Version 1 is online-first.

Offline writes are explicitly out of scope for v1.

Local storage, IndexedDB, memory cache, and HTTP cache may only be used for:

- temporary read cache
- faster loading
- preserving harmless UI preferences
- future offline read support

Any offline write queue requires a separate ADR update and conflict-resolution design.

## Consequences

Positive:

- simpler data consistency
- avoids sync conflicts
- protects Supabase as source of truth

Negative:

- app requires network connection for mutations
- offline usage is limited in early versions

## Enforcement

No feature may store user-owned collection or wishlist changes locally as authoritative state.
