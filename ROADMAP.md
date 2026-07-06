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
- Adding write features before read-only collection access is proven.

### Dependencies

- Existing Supabase schema inspection.
- Confirmation of authentication strategy.
- Confirmation of parent/admin strategy.
- Confirmation of v1 read-only scope.
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
- Supabase read-only inspection plan exists.
- Migration plan exists.

### Test plan

- Documentation review.
- Architecture consistency review.
- Zero Legacy compliance review.
- Mobile-first review.
- Supabase ownership review.
- Read-only v1 scope review.

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
- no collection writes
- no AI
- no Binder

### Acceptance criteria

- App runs locally.
- Mobile shell renders on iPhone-sized viewport.
- No legacy code exists.
- No business feature is implemented prematurely.

## Phase 2 – Authentication, Profiles, and Roles

### Goal

Implement secure login and user-owned access foundations.

### Scope

- Supabase Auth
- separate accounts for Lars and Lore
- parent/admin account support
- profile model
- role model
- initial permission model design
- Row Level Security validation

### Acceptance criteria

- User identity is available to the app.
- Parent/admin and child roles are represented.
- No collection data is exposed across users accidentally.
- Mutating permissions are not implemented before explicit approval.

## Phase 3 – Supabase Read-only Inspection

### Goal

Understand the existing Supabase database before migration or collection implementation.

### Scope

- inspect existing tables read-only
- identify Lars collection data
- identify whether Lore data exists
- identify Pokémon TCG API references
- identify ownership fields
- identify RLS and policies
- document risks and migration route

### Acceptance criteria

- schema inventory exists
- data ownership assessment exists
- migration recommendation exists
- no data changes were made

## Phase 4 – Collection Read-only Viewer

### Goal

Implement the first stable collection workflow: viewing owned cards only.

### Scope

- view own collection
- mobile-first collection list
- read-only card detail view if approved
- no add card
- no edit quantity
- no delete
- no import

### Acceptance criteria

- Lars can view Lars collection only.
- Lore can view Lore collection only, if data exists.
- Parent/admin access behavior is defined before use.
- No write action is available in the UI or data layer.
- Mobile performance is acceptable for existing collection size.

## Phase 5 – Sets and Pokédex

### Goal

Provide reference browsing without harming mobile performance.

### Scope

- Pokémon TCG API integration boundary
- set list
- card search
- pagination or virtualization strategy
- Supabase reference cache decision

## Phase 6 – Permission-based Collection Writes

### Goal

Add collection mutations only after read-only flows, ownership, and permissions are stable.

### Scope

- add card to own collection
- update quantity
- delete card only when permission allows it
- safeguards for destructive actions
- audit strategy if required

## Phase 7 – Wishlist

### Goal

Allow each user to manage wanted cards separately.

## Phase 8 – Dashboard

### Goal

Create a useful overview based on stable collection data.

## Phase 9 – AI Assistant Preparation

### Goal

Design AI integration safely after the core app is stable.

Implementation only after ADR approval.

## Phase 10 – Binder

### Goal

Design and build Binder only after all previous modules are stable and performance limits are known.
