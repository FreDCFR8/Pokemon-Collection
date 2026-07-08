# Changelog

## Phase 2R — Collection Schema Migration Plan

- Added a documentation-only SQL migration plan for the future `collections`, `cards_catalog`, and `collection_cards` tables.
- Included manual Supabase SQL Editor drafts for table creation, indexes, `updated_at` triggers, select-only RLS policies, placeholder-only main collection seed data, verification queries, and rollback.
- Confirmed this phase does not execute SQL, change runtime app code, import `public.cards`, seed catalog/card ownership data, add app queries, or introduce writes from the app.

## Phase 2Q — Collection Data Model Design

- Documented option B as the selected collection architecture: new `collections`, `cards_catalog`, and `collection_cards` tables around existing `profiles`.
- Clarified that legacy `public.cards` remains untouched as a possible import source only, not the source of truth or a security boundary.
- Captured conceptual relationships, security/RLS direction, out-of-scope items, and the proposed Phase 2R migration-plan follow-up without adding SQL, migrations, runtime queries, or app code.

## Phase 2P — Profile Readiness Service

- Added a profile readiness service that checks the active Supabase session and reads the signed-in user's own `public.profiles` record through the existing browser client boundary.
- Added a UI card that reports signed-out, missing config, missing profile, ready profile, and error states while showing display name, username, role, and child key when available.
- Confirmed this phase does not load collection data, does not use the cards table, does not write data, and does not change migrations, RLS, GitHub Actions, or Vercel workflows.

## Phase 2N — Profile Schema Migration Plan

- Added a documentation-only SQL migration plan for the future `public.profiles` table.
- Included manual Supabase SQL Editor steps for table creation, indexes, `updated_at` trigger, select-own RLS policy, placeholder-only seed data, verification queries, and rollback.
- Confirmed no real UUIDs, runtime code, Supabase app queries, collection reads, cards-table usage, automatic migration execution, RLS production changes, or workflow changes are included.

## Phase 2M — Profile Schema Design

- Added documentation for the future `profiles` table, roles, Lars/Lore/parent records, profile readiness flow, and RLS direction.
- Clarified that `auth.uid()` is the security boundary and that collection data must remain unloaded until profile ownership and access rules are safely designed.
- Confirmed this phase is documentation-only with no runtime code, SQL, migrations, RLS changes, queries, writes, cards access, or workflow changes.

## Phase 2L — Controlled Supabase Login Activation

- Activated controlled Supabase Auth sign-in through the existing auth login service for known usernames only.
- Kept `hiddenAuthEmail` internal while reporting login execution and confirmed session status in LoginPanel.
- Confirmed this phase does not load profile data, collection data, cards-table data, migrations, RLS changes, or workflow changes.

## Phase 2K — Auth Login Service Skeleton

- Added a disabled Auth Login Service Skeleton that reuses the login action boundary without importing Supabase clients or executing auth calls.
- Updated LoginPanel to prepare login through the new service while keeping login execution, profile data, and collection data disabled/not loaded.
- Documented that `loginExecuted` remains `false` and `hiddenAuthEmail` is not used for an auth call in this phase.

## Phase 2J — Login Activation Skeleton

- Added a local username-to-hidden-auth-target mapping skeleton for `lars` and `lore`.
- Updated the login action boundary and LoginPanel status display without enabling Supabase Auth calls, profile reads, collection reads, writes, migrations, or RLS changes.
- Documented the Phase 2J acceptance criteria and confirmed the hidden auth email remains internal only.

## Phase 2I — Login Activation Design

- Added a documentation-only design for future username + password login activation.
- Recommended hidden per-child pseudo-email mapping for Supabase Auth combined with a future `profiles` table.
- Confirmed that no runtime login call, database migration, writes, RLS changes, GitHub Actions changes, or Vercel workflow changes are part of this phase.
