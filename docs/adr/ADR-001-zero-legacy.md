# ADR-001: Zero Legacy

## Status

Draft

## Context

The previous `Pokemon-Manager` project accumulated technical debt, patches, overlapping responsibilities, and performance risks.

This project is a complete restart.

## Decision

No implementation from the previous repository may be reused.

The previous repository may only be used as a functional reference.

## Consequences

Positive:

- clean architecture
- no inherited technical debt
- no accidental copying of broken assumptions

Negative:

- slower start
- existing functionality must be redesigned
- migration must be deliberate

## Enforcement

Pull requests must be reviewed for Zero Legacy compliance.
