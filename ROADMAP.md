# Roadmap

## Phase 0 – Blueprint

### Goal

Create and approve the complete project blueprint before application code exists.

### Architecture

Documentation-only phase.

No runtime files, package manager setup, build configuration, or application source code may be added.

### Risks

- Starting implementation too early.
- Underestimating Supabase data ownership and migration.
- Designing desktop-first by accident.
- Treating Pokémon TCG API as source of truth.
- Introducing AI before the core app is stable.

### Dependencies

- Existing Supabase schema inspection.
- Confirmation of authentication strategy.
- Confirmation of v1 scope.
- Approval of stack decision.

### Acceptance criteria

- Required documentation files exist.
- ADRs 001 through 014 are drafted.
- Stack recommendation is explicit.
- Data model draft exists.
- Security model draft exists.
- Performance strategy exists.
- Testing strategy exists.
- Open questions are documented.

### Test plan

- Documentation review.
- Architecture consistency review.
- Zero Legacy compliance review.
- Mobile-first review.
- Supabase ownership review.

### Definition of Done

Phase 0 is complete only when the blueprint PR is reviewed and approved.

## Phase 1 – Foundation

### Goal

Create the minimal application foundation after Phase 0 approval.

### Scope

- Vite + TypeScript + React setup
- basic routing
- minimal mobile shell
- Supabase client boundary
- no real collection features yet
- no AI
- no Binder

### Acceptance criteria

- App runs locally.
- Mobile shell renders on iPhone-sized viewport.
- No legacy code exists.
- No business feature is implemented prematurely.

## Phase 2 – Authentication and Profiles

### Goal

Implement secure login and user-owned access.

### Scope

- Supabase Auth
- separate accounts for Lars and Lore
- profile model
- Row Level Security validation

## Phase 3 – Collection Core

### Goal

Implement the first stable collection workflow.

### Scope

- view own collection
- add card to own collection
- update quantity
- remove own item with safeguards
- mobile-first list design

## Phase 4 – Sets and Pokédex

### Goal

Provide reference browsing without harming mobile performance.

### Scope

- Pokémon TCG API integration boundary
- set list
- card search
- pagination or virtualization strategy
- Supabase reference cache decision

## Phase 5 – Wishlist

### Goal

Allow each user to manage wanted cards separately.

## Phase 6 – Dashboard

### Goal

Create a useful overview based on stable collection data.

## Phase 7 – AI Assistant Preparation

### Goal

Design AI integration safely after the core app is stable.

Implementation only after ADR approval.

## Phase 8 – Binder

### Goal

Design and build Binder only after all previous modules are stable and performance limits are known.
