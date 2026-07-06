# ADR-012: User and Profile Separation

## Status

Draft

## Context

The application starts with Lars and Lore but must be designed so additional users can be added later.

A simple profile switcher without real user ownership would be easier but would not provide strong separation.

## Decision

Each user has a separate Supabase Auth account.

Each authenticated account has one application profile.

Collections, wishlist items, and future user-owned records belong to the authenticated user, not to a client-selected profile value.

## Consequences

Positive:

- strong data separation
- future multi-user support
- simpler RLS model
- less risk of accidentally mixing Lars and Lore data

Negative:

- onboarding is more complex
- parent/admin flows require explicit design later

## Open questions

- Should a parent/admin account exist?
- Should a parent/admin account be allowed to view both collections?
- Should children be allowed to delete records?
- Should destructive actions require confirmation or parent approval?

## Enforcement

Client-side profile selection may not be used as the security boundary.
