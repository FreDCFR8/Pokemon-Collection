# ADR-005: Git Strategy

## Status

Draft

## Context

The previous project suffered from risky changes and unclear patch boundaries.

## Decision

`main` remains stable.

All changes use a dedicated branch and pull request.

One branch has one purpose.

## Consequences

Positive:

- safer review process
- clearer rollback
- better traceability

Negative:

- slower than direct commits
- requires discipline for small branches
