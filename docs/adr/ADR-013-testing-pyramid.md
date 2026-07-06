# ADR-013: Testing Pyramid

## Status

Draft

## Context

The project must avoid regressions as it grows. Testing must cover architecture, behavior, data ownership, and mobile usability.

## Decision

The project will use a layered test strategy.

Planned layers after implementation begins:

1. static checks
2. unit tests
3. integration tests
4. Row Level Security tests
5. UI flow tests
6. manual mobile review

Security-sensitive data ownership rules require explicit tests.

## Consequences

Positive:

- better regression control
- safer refactoring
- stronger user data isolation

Negative:

- implementation takes longer
- test infrastructure must be maintained

## Enforcement

Every feature must define its test strategy before implementation.

Any feature touching user-owned data must include RLS/security test coverage.
