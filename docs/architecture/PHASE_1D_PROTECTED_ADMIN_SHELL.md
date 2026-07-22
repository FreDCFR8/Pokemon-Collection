# Pokémon Collection V3 — Phase 1D Protected Administrator Shell

## Status

Phase 1D is active. This document defines the implementation scope for the first protected administrator experience after the completed Phase 1B identity runtime and Phase 1C trusted role/RLS foundation.

## Verified starting point — 2026-07-22

- `main` is at merge commit `4369ea01f03a24e49287e0cc756d002f153ac35c` (PR184).
- The central identity runtime resolves `child | admin` from `profiles.role`.
- Frederik can authenticate as `admin` without requiring a personal main collection.
- Lars and Lore continue to authenticate as `child` with exactly one own main collection.
- Child/admin RLS separation is active and database-tested.
- Phase 1C added no administrator product interface.

## Goal

Introduce a visually and technically separate administrator shell that is reachable only for a trusted authenticated `admin` identity.

The shell establishes the protected product boundary for later administrator phases without adding broad management actions yet.

## Scope

- route or application-level guard based on the verified central identity state;
- admin-only shell that is distinct from the child application;
- administrator header and navigation foundation;
- initial sections:
  - Overview;
  - Users and profiles;
  - Settings;
  - Activities;
  - Application status;
- safe empty, loading, missing-profile and error states;
- explicit denial or safe redirect when a child attempts to reach administrator UI;
- logout through the existing central identity runtime;
- responsive mobile-first layout with usable desktop presentation;
- behavioral tests for admin access and child denial.

## Non-goals

- no user or profile mutations;
- no role assignment;
- no account creation, password reset or Auth administration;
- no profile switching inside the child application;
- no settings implementation beyond placeholders;
- no activity timeline or logging infrastructure;
- no operational diagnostics implementation;
- no catalog import controls;
- no service-role access from the browser;
- no database migration, RLS change or database write;
- no child dashboard redesign.

## Access contract

### Admin

- may enter the administrator shell after the central identity runtime reaches `authenticated_ready` with `profile.role === 'admin'`;
- sees administrator navigation and safe placeholder content;
- may log out;
- receives no new mutation capability in this phase.

### Child

- remains in the existing child application;
- cannot render administrator navigation or content;
- direct attempts to open an administrator route fail closed and return to a safe child-facing state;
- cannot infer administrator-only data from hidden UI or client-side state.

## UX direction

The administrator experience must look intentionally different from the child collection interface while remaining consistent with the Pokémon Collection V3 product.

Principles:

- clear label that the user is in the administrator area;
- visible current administrator identity;
- compact navigation suitable for iPhone first;
- no technical readiness diagnostics, table names, role internals or raw errors;
- placeholders describe future capabilities without presenting inactive controls as functional;
- navigation and controls meet touch-target and keyboard requirements.

## Security rules

- the central identity runtime is the only client identity source;
- route protection must evaluate the trusted resolved role, not username or local storage;
- UI hiding alone is not presented as authorization;
- no new browser database writes are introduced;
- no secrets, tokens, Supabase internals or service-role operations are exposed;
- stale child data must not remain visible when the administrator shell opens.

## Acceptance criteria

- Frederik opens a distinct administrator shell after login;
- Lars and Lore continue to open only the child application;
- child identities cannot render administrator routes or navigation through direct URL/hash manipulation;
- administrator navigation contains only the approved initial sections;
- all sections use safe placeholders with no inactive destructive or misleading actions;
- logout works from the administrator shell and clears identity state;
- loading, signed-out, missing-profile and error behavior remain fail-closed;
- relevant behavioral tests pass;
- TypeScript validation and production build pass;
- exact changed-file scope and remote PR head are verified;
- Vercel Preview passes desktop and iPhone acceptance;
- database writes remain `0`.

## Stop conditions

Stop and reassess when:

- implementation requires a second auth or role runtime;
- administrator access depends on username instead of trusted role;
- child behavior or collection ownership must be weakened;
- a database or RLS change appears necessary;
- profile management, settings, activities or operational tooling expand beyond placeholder shell scope;
- the child dashboard is redesigned in the same PR.
