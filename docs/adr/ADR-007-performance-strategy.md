# ADR-007: Performance Strategy

## Status

Draft

## Context

The application will display Pokémon card collections, card images, sets, search results, and later potentially Binder views. These areas can become slow on iPhone Safari if too much data or too many images are loaded or rendered at once.

## Decision

Performance must be designed into the architecture from the start.

The app must not render unbounded card lists.

Large views must use one or more of:

- pagination
- incremental loading
- virtualization
- server-side filtering
- scoped queries

Card images must use controlled loading, appropriate sizes, and stable layout dimensions.

Binder remains deferred until core modules are stable and performance limits are known.

## Consequences

Positive:

- protects mobile experience
- prevents repeating earlier performance problems
- forces measurable data loading boundaries

Negative:

- some screens require more upfront design
- generic all-card views are avoided unless carefully limited

## Enforcement

Every feature that lists cards must define:

- default item limit
- loading behavior
- empty state
- error state
- image loading strategy
- expected mobile behavior
