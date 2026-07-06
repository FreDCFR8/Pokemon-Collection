# ADR-011: Pokémon TCG API Sync Strategy

## Status

Draft

## Context

The Pokémon TCG API provides card and set reference data. The application owns user collection and wishlist state in Supabase.

Existing Supabase data may already be related to Pokémon TCG API card IDs, especially for Lars's collection.

## Decision

The Pokémon TCG API is a reference data provider, not the application source of truth.

User-owned data remains in Supabase.

Reference card and set data may be cached or mirrored in Supabase if needed for performance, stability, or querying.

Before implementation, the existing Supabase schema must be inspected.

## Consequences

Positive:

- protects user data from external API instability
- enables mobile-friendly queries
- supports future caching and sync

Negative:

- requires sync strategy
- requires handling stale reference data
- requires migration analysis for existing Lars data

## Required design before implementation

- identify existing tables
- identify card ID format
- identify set ID format
- decide what reference data is stored locally
- decide refresh frequency
- define fallback behavior when API is unavailable
- define rate-limit behavior

## Enforcement

No direct all-card fetch may be used as a primary screen-loading strategy.
