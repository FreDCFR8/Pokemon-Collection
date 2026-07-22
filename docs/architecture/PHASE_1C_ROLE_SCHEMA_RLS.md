# Pokémon Collection V3 — Phase 1C Role Schema and RLS

## Status

Phase 1C is active. This document defines the approved phase scope and the production evidence collected before implementation.

## Working method

A phase is documented once at the start with its goal, scope, boundaries and acceptance criteria. Read-only audit, implementation, migration preparation, tests and corrections then remain in the same phase and pull request while the objective is unchanged.

A separate documentation pull request is not required before implementation. Durable documentation is adjusted after execution only when:

- execution materially differs from the approved setup;
- a lasting architecture or product decision is made;
- a reusable prevention rule is discovered;
- the operational project status materially changes.

This keeps the workflow proportionate for a private family application while preserving important decisions.

## Production evidence — 2026-07-22

The production inspection was read-only and performed before any migration or database write.

Verified state:

- `public.profiles` already contains a required `role` column;
- `profiles.auth_user_id` is required and unique;
- both existing profiles are linked to confirmed Supabase Auth users;
- Lars and Lore both have role `child` and the correct `child_key`;
- no administrator auth account or administrator profile exists yet;
- RLS is enabled on `profiles`, `collections`, `collection_cards`, `cards_catalog` and `sets_catalog`;
- child access is currently restricted through `profiles.auth_user_id = auth.uid()` ownership chains;
- the current database constraint permits `parent | child`, while the approved Phase 1A contract permits only `admin | child`;
- no database function currently resolves the trusted application role.

Database writes during this inspection: `0`.

## Architecture decision

`public.profiles.role` remains the trusted persisted role source.

A separate `user_roles` table is rejected because it would duplicate the existing one-to-one account identity record and create an unnecessary second authorization source. User-editable metadata is not used for authorization. JWT claims are not selected as the primary role source because claim refresh would make role changes temporarily stale.

Approved initial roles:

- `child`;
- `admin`.

The application UI may display this role but is never the authorization source. RLS and trusted database helpers enforce access.

## Scope

- replace the legacy `parent` role contract with `admin`;
- retain `profiles.role` as the single trusted persisted role source;
- add a safe current-user role helper for RLS evaluation;
- preserve child access to only the child’s own profile, collection and collection cards;
- allow admin read access required for later protected administrator phases;
- do not grant admin browser mutations of child collection data in this phase;
- prepare a controlled initial admin-profile assignment process;
- align TypeScript role types with `child | admin`;
- add behavioral or database-level verification for child/admin separation.

## Non-goals

- administrator UI;
- profile switching;
- guest access;
- broad account-management actions;
- service-role access from the browser;
- catalog import or maintenance changes;
- activity logging;
- applying the production migration before an administrator auth account exists and the exact assignment is explicitly approved.

## Access model

### Child

- read own profile;
- read own collection and collection cards;
- use existing approved own-collection mutations;
- read shared catalog and sets while authenticated;
- cannot read another child profile or collection;
- cannot assign or change roles.

### Admin

- read profiles, collections and collection cards for later protected admin functionality;
- read shared catalog and sets;
- cannot mutate child collection state through new Phase 1C policies;
- cannot assign roles from the browser;
- receives no administrator UI in this phase.

## Stop conditions

Stop without applying production writes when:

- the administrator auth account does not yet exist;
- more than one possible administrator account is found;
- existing profile rows violate the expected child/admin invariants;
- migration verification cannot prove Lars/Lore isolation;
- the migration would weaken existing collection mutation constraints;
- the remote PR-head cannot be verified.

## Acceptance criteria

- production evidence remains read-only until explicit migration approval;
- one trusted persisted role source exists;
- only `child` and `admin` are valid application roles;
- a child resolves and reads only its own personal data;
- an admin can be identified through a trusted database path;
- admin read access is separated from mutation permissions;
- browser users cannot promote themselves;
- existing catalog access and child collection behavior remain intact;
- relevant tests, typecheck, build and migration checks pass on the verified remote PR-head;
- iPhone and desktop Preview tests pass where runtime behavior is affected.
