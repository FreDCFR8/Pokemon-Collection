# Phase 0 Approval Checklist

## Status

Phase 0 review checklist.

This document decides whether the project is ready to leave Phase 0 and start Phase 1.

No application code may be written until this checklist is accepted.

## Repository and Git

- [x] New repository exists: `FreDCFR8/Pokemon-Collection`
- [x] Previous repository is treated only as functional reference
- [x] Zero Legacy policy is documented
- [x] Work happens on `phase0-blueprint`
- [x] Pull request exists toward `main`
- [x] No application code has been added
- [x] No build setup has been added
- [x] No dependencies have been added

## Core documentation

- [x] README exists
- [x] PROJECT_CONSTITUTION exists
- [x] ARCHITECTURE exists
- [x] DEVELOPMENT_RULES exists
- [x] ROADMAP exists
- [x] DATA_MODEL exists
- [x] UI_GUIDELINES exists
- [x] TEST_STRATEGY exists
- [x] SECURITY exists
- [x] PERFORMANCE exists
- [x] CODING_STANDARDS exists
- [x] CHANGELOG exists

## ADRs

- [x] ADR-001 Zero Legacy
- [x] ADR-002 Mobile First
- [x] ADR-003 Supabase Source of Truth
- [x] ADR-004 Application Architecture
- [x] ADR-005 Git Strategy
- [x] ADR-006 UI Philosophy
- [x] ADR-007 Performance Strategy
- [x] ADR-008 AI Integration
- [x] ADR-009 Authentication Strategy
- [x] ADR-010 Offline and Cache Policy
- [x] ADR-011 Pokémon TCG API Sync Strategy
- [x] ADR-012 User/Profile Separation
- [x] ADR-013 Testing Pyramid
- [x] ADR-014 Release and Rollback Strategy

## Product decisions

- [x] Lars and Lore each have separate accounts
- [x] Parent/admin account is required
- [x] v1 is online-first
- [x] AI is not required for v1
- [x] Binder is deferred
- [x] First collection feature is read-only viewing
- [x] Collection writes are deferred
- [x] Existing Supabase data is inspected read-only first

## Supabase inspection

- [x] `public.cards` table identified
- [x] Current row count known: 2190
- [x] Live column inventory documented
- [x] Collection distribution known: Lars = 2190
- [x] Status distribution known: owned = 2190
- [x] No Lore rows currently present
- [x] RLS is enabled on `public.cards`
- [x] Existing policies are not suitable as final security model
- [x] Security redesign need is documented

## Security decisions

- [x] Supabase Auth is the intended authentication provider
- [x] Supabase remains source of truth
- [x] `collection` text is legacy grouping, not final ownership
- [x] User-owned records must link to authenticated users or profiles
- [x] Parent/admin access must be explicit
- [x] Write permissions must be explicit
- [x] Current legacy security model must not be trusted as final architecture

## Remaining blockers before Phase 1

The following must be true before Phase 1 starts:

- [ ] Phase 0 PR is reviewed
- [ ] Phase 0 PR is approved
- [ ] Phase 0 PR is merged into `main`
- [ ] `main` remains documentation-only before Phase 1 starts

## Known risks accepted for Phase 1

Phase 1 may start only as an application foundation phase.

Accepted constraints:

- no collection feature yet
- no Supabase write operations
- no migration
- no AI implementation
- no Binder
- no direct trust in legacy database policies

## Phase 1 allowed scope

After Phase 0 is merged, Phase 1 may create a new branch for application foundation only.

Allowed:

- Vite setup
- TypeScript setup
- React setup
- basic project structure
- mobile-first app shell
- static navigation placeholders
- environment variable example without secrets

Not allowed:

- collection data fetching
- collection writes
- Supabase migration
- RLS changes
- AI integration
- Binder
- legacy code reuse

## Approval decision

Phase 0 can be considered ready for review if this checklist is accepted.

Phase 1 cannot begin until the Phase 0 PR is merged into `main`.
