# ADR-012: User and Profile Separation

## Status

Draft

## Context

The application starts with Lars and Lore, includes a parent/admin account, and must be designed so additional users can be added later.

A simple profile switcher without real user ownership would be easier but would not provide strong separation.

## Decision

Each person has a separate Supabase Auth account.

Required account types:

- parent/admin
- Lars
- Lore

Each authenticated account has one application profile.

Collections, wishlist items, and future user-owned records belong to the authenticated user, not to a client-selected profile value.

Parent/admin access to multiple collections must be explicit and policy-driven.

## Consequences

Positive:

- strong data separation
- future multi-user support
- simpler RLS model
- less risk of mixing Lars and Lore data
- parent/admin account can be designed safely

Negative:

- onboarding is more complex
- parent/admin flows require explicit design
- permission management adds complexity

## Resolved decisions

- A parent/admin account will exist.
- v1 collection behavior starts with viewing cards only.
- Existing Supabase data is analyzed read-only first.
- Change permissions for collection records must be explicit.

## Remaining questions

- Can parent/admin view both collections in the first read-only version?
- Can parent/admin grant and revoke permissions?
- Should sensitive record changes create an audit trail?

## Enforcement

Client-side profile selection may not be used as the security boundary.
