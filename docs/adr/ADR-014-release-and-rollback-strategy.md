# ADR-014: Release and Rollback Strategy

## Status

Draft

## Context

The project must remain stable as it grows. Changes must be reversible and reviewed before reaching `main`.

## Decision

`main` represents the stable project state.

All changes must go through pull requests.

Each pull request must include a rollback plan.

Application releases must only happen from reviewed and stable code.

For documentation-only phases, rollback means closing or reverting the PR.

For implementation phases, rollback may include:

- reverting the PR
- disabling a feature flag
- rolling back a deployment
- reverting a Supabase migration, if safe
- applying a documented corrective migration

## Consequences

Positive:

- safer releases
- clear recovery path
- less uncontrolled patching

Negative:

- slower release flow
- migrations require careful planning

## Enforcement

No PR may be approved without a rollback plan.
