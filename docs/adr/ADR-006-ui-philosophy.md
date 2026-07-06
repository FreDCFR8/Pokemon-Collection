# ADR-006: UI Philosophy

## Status

Draft

## Context

The application needs a new mobile-first interface. The previous interface may only be used as functional inspiration, never as a technical or visual implementation source.

## Decision

The UI will be designed as a new component system optimized first for iPhone Safari.

The UI must prioritize:

- clarity over density
- touch-friendly actions
- predictable navigation
- fast perceived loading
- clear empty states
- clear error states
- progressive disclosure for complex data

The primary navigation will include:

- Dashboard
- Collection
- Sets
- Wishlist
- Pokédex

Binder is excluded until the core modules are stable.

## Consequences

Positive:

- avoids inheriting legacy layout problems
- improves mobile usability
- keeps complex views controlled

Negative:

- design work takes longer before implementation
- desktop-specific optimizations may wait

## Enforcement

Every new screen requires a mobile wireframe and acceptance criteria before implementation.
