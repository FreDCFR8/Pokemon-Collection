# Phase 2 Auth Readiness

## Status

Design and implementation branch in progress.

## Goal

Prepare the app to safely understand whether a browser user has an auth session, without loading collection data.

## Scope

This branch may add:

- auth readiness types
- a small auth status service boundary
- safe loading, ready, signed-out, and error states
- UI copy for auth readiness
- no-op behavior when public config is missing
- documentation for the first safe auth check

## Explicit non-goals

This branch does not add:

- collection viewing
- collection writes
- card import
- database migration
- profile table loading
- child profile switching
- AI integration
- Binder
- legacy code reuse

## Architecture rules

The auth readiness layer may call only Supabase Auth session status.

It must not query application tables.

It must not use service keys.

It must not assume that a session equals a valid app profile.

A valid app profile remains a later step.

## Expected UI states

- config missing
- checking auth status
- signed out
- session present but app profile not loaded yet
- auth check failed

## Acceptance criteria

- app builds
- no collection data is fetched
- no collection write exists
- no profile table query exists
- auth status has clear loading and error states
- app still renders safely when public config is missing

## Stop rule

Stop if the implementation requires collection access, profile table access, policy changes, database writes, or a broader auth design change.
