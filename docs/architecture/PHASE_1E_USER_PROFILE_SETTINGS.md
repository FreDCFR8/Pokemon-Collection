# Pokémon Collection V3 — Phase 1E User and Profile Settings

## Status

Phase 1E is active. This document defines the implementation boundary before runtime or database changes are introduced.

## Goal

Introduce the first safe user- and profile-settings experience on top of the proven identity, role, RLS and administrator-shell foundation.

## Approved first scope

### Child-facing settings

A child may view and update only approved presentation values of the authenticated child profile:

- display name;
- a constrained avatar or avatar-style choice;
- non-sensitive interface preferences only when an existing safe storage location is confirmed.

A child may never change:

- role;
- `auth_user_id`;
- profile ownership;
- another child profile;
- RLS scope;
- administrator privileges.

### Administrator-facing profile management

The administrator may:

- view safe summaries for Lars and Lore;
- open a protected profile-settings screen;
- update only the same approved presentation values through explicit admin functionality;
- receive clear loading, success, validation and error feedback.

## Security rules

- `profiles.role` remains the trusted role source.
- The central identity runtime remains the only client-side identity source.
- RLS or another reviewed trusted boundary must authorize every read and write.
- UI hiding is not authorization.
- No service-role credential may enter the browser.
- No direct browser manipulation of `auth.users` is permitted.
- No role assignment, account creation, password reset, email change or account disabling is included.

## Required investigation before implementation

Before any migration or write path is added, inspect read-only:

- current `profiles` columns and constraints;
- existing policies for child-own and admin access;
- whether approved presentation fields already exist;
- whether interface preferences need a new table or should remain out of scope;
- current profile consumers that could regress when display values change.

## Explicit non-goals

- no Auth account administration;
- no role management;
- no activity-log implementation;
- no operational diagnostics;
- no catalog or import controls;
- no broad application-settings system;
- no dashboard redesign;
- no profile switching for child accounts.

## Recommended implementation order

1. Read-only schema and policy evidence.
2. Confirm the smallest approved editable field set.
3. Add or reuse a typed profile-settings service.
4. Implement child-own settings UI.
5. Implement protected admin profile summaries and editing.
6. Add validation, authorization and regression tests.
7. Run build, tests and Preview acceptance for Frederik, Lars and Lore.

## Acceptance criteria

- Lars can view and edit only Lars-approved presentation settings.
- Lore can view and edit only Lore-approved presentation settings.
- Neither child can read or mutate the other profile.
- Frederik can view both safe profile summaries and edit only approved fields.
- No account, ownership or role field is exposed as editable.
- Logout and account switching clear stale profile-settings state.
- Existing Collection, Wishlist, Sets and Search flows remain functional.
- Mobile Preview is accepted for all three accounts.

## Database rule

No database migration or production write is authorized merely by this document. Any schema change or data write requires fresh evidence and explicit approval.
