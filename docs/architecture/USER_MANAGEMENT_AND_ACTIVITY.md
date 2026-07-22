# Pokémon Collection V3 — User Management and Activity

## 1. Purpose

This document is the architectural source of truth for user roles, child-facing access, administrator capabilities, activity history and future recovery behavior in Pokémon Collection V3.

It defines the intended product and security model before implementation. It does not authorize database migrations, policy changes or runtime code changes by itself.

## 2. Existing foundation

Pokémon Collection V3 already has authentication, profiles, collections and Row Level Security as part of its foundation.

Future user-management work must extend that existing model. It must not introduce a second identity system, duplicate profile ownership or bypass the established authenticated user → profile → collection relationship.

## 3. Product roles

### 3.1 Administrator

The administrator is the parent or responsible adult who manages the household application.

Intended capabilities:

- access administrator-only settings;
- manage child profiles and their access;
- view activity across Lars and Lore;
- review meaningful collection and wishlist changes;
- restore supported reversible actions when recovery is implemented;
- access maintenance and import functions that are explicitly exposed in the product;
- view household-level statistics without weakening child-data isolation.

Administrator privileges must be enforced server-side. Hiding controls in the interface is not authorization.

### 3.2 Child profile: Lars

Lars uses the application primarily on iPad and manages only his own collection-related state.

Intended capabilities:

- browse the shared card catalog and sets;
- manage his own collection;
- manage his own wishlist;
- use future child-approved features linked to his profile;
- view only information intentionally shared with child users.

### 3.3 Child profile: Lore

Lore has the same product capabilities and restrictions as Lars, but all collection-specific state remains scoped to her own profile and collections.

### 3.4 Future roles

No additional role is approved yet. Possible future roles such as a read-only guest, family member or trade partner require a separate architectural decision.

## 4. Identity and access principles

- Authentication identifies the signed-in account.
- Authorization determines which profiles, collections and administrative functions that account may access.
- Child-facing actions must always resolve to the active child profile and an authorized collection.
- Administrator access must be explicit and independently testable.
- Client-provided profile, collection or user identifiers are never trusted without server-side ownership verification.
- Row Level Security remains the final database boundary for user-owned data.
- Shared catalog data remains separate from collection-specific user state.
- Internal roles, IDs and policy terminology are not shown in child-facing screens.

The precise household account model — for example one parent login with selectable child profiles versus separate authenticated child accounts — remains a design decision for the implementation phase. It must be resolved before schema or policy changes.

## 5. Activity history

### 5.1 Product purpose

The activity history provides a clear record of meaningful actions in the application. In the user interface it is named **Activiteiten**. Internally, implementation names may use `activity_log` or `activity_events`.

The activity history is intended for:

- understanding what changed;
- recovering from accidental supported actions;
- diagnosing incorrect state;
- showing useful household statistics;
- providing trustworthy feedback after mutations.

It is not intended as covert surveillance or as a replacement for database backups.

### 5.2 Actions that should be recorded

Meaningful state changes include, when those features exist:

- card added to a collection;
- card removed from a collection;
- quantity changed;
- card added to or removed from a wishlist;
- card moved from wishlist to collection;
- condition or status changed;
- note, folder or favorite state changed;
- administrator setting changed;
- child-profile access changed;
- supported restore action executed.

Routine reads such as opening a set, viewing a card or typing in search should not be logged by default. Authentication events may be recorded separately when they provide a clear security or support benefit.

### 5.3 Minimum event information

Each durable activity event should be able to identify:

- when the event happened;
- which authenticated actor initiated it;
- which child profile and collection were affected;
- the action type;
- the affected entity type and stable internal identifier;
- a concise user-facing description;
- the relevant before-state and after-state needed for audit or supported recovery;
- whether the action is reversible;
- whether a later event restored or superseded it;
- a correlation identifier for one logical operation when several database mutations belong together.

Sensitive credentials, tokens, secret configuration and unnecessary personal data must never be stored in the activity history.

### 5.4 Integrity requirements

- A successful user-facing mutation and its required activity record must be committed atomically where practical.
- A failed mutation must not produce a misleading success event.
- Activity events are append-only for normal users.
- Existing activity must not be editable by child profiles.
- Administrator visibility and retention require explicit policies.
- Display labels may evolve, but stable action codes must remain suitable for querying and testing.
- Import and maintenance logs must not be mixed blindly with child activity; they may use the same infrastructure only when actor, scope and presentation remain unambiguous.

## 6. Recovery and undo

Undo is a future capability built on explicit reversible operations. An activity log alone does not make every action safely reversible.

Principles:

- Only actions with a defined inverse and validated current state may show **Herstellen**.
- Recovery creates a new compensating event; it does not erase or rewrite history.
- Undo must re-check authorization and current database state.
- If later changes make the original inverse unsafe, recovery is blocked with a clear explanation.
- Destructive operations require stronger safeguards than additive operations.
- Database backups and operational recovery remain separate from product-level undo.

The first implementation should support a deliberately small set of reversible collection actions rather than promising universal undo.

## 7. Administrator experience

Administrator functions must be visually and technically separated from the child experience.

The future administrator area may include:

- child-profile overview;
- recent activity timeline;
- filtering by child, collection, action type and date;
- review of reversible actions;
- household-level collection statistics;
- access and settings management;
- diagnostics that are understandable without exposing database internals.

Administrator screens must not become a general-purpose database console. Catalog import and technical maintenance remain controlled operational workflows unless a later phase explicitly productizes them.

## 8. Child experience

- iPad is the primary device for Lars and Lore.
- Child navigation stays focused on catalog, sets, collection, wishlist and card detail.
- Administrator controls are not shown in child mode.
- Children should not need to understand accounts, roles, audit terminology or internal collection IDs.
- The active child identity must be obvious enough to prevent editing the wrong collection.
- Switching child profiles requires a deliberate flow and must not rely only on a decorative name in the interface.
- Destructive actions receive clear feedback and, where appropriate, confirmation or a short-lived recovery affordance.

## 9. Privacy, retention and visibility

Before implementation, the project must define:

- who may view each activity event;
- how long detailed events are retained;
- whether old events are summarized or archived;
- which authentication events are necessary;
- how exported or deleted user data affects retained history;
- how administrator actions are distinguished from child actions.

The default principle is data minimization: record what is needed for product trust, recovery and support, and nothing more.

## 10. Implementation boundaries

A future implementation phase must separately design and review:

1. household authentication and profile-selection flow;
2. role and permission model;
3. database schema and indexes for activity events;
4. Row Level Security and server-side mutation paths;
5. transaction or database-function boundaries for atomic mutation plus event creation;
6. administrator and child UX;
7. retention and privacy rules;
8. recovery contracts and supported inverse operations;
9. migration and test strategy.

No broad activity logging should be added through scattered frontend calls. The event must be produced at the trusted mutation boundary so it cannot silently diverge from database truth.

## 11. Required acceptance evidence

Before the feature is considered complete, evidence must include:

- permission matrix for administrator, Lars and Lore;
- RLS tests proving cross-profile access is blocked;
- mutation tests proving activity events match successful writes;
- failure tests proving no false event is created;
- recovery tests for every supported reversible action;
- iPad manual testing for child flows;
- mobile and desktop testing for administrator flows;
- accessibility checks for profile selection, timeline filters and recovery controls;
- explicit verification that catalog and collection separation remains intact.

## 12. Open decisions

The following are intentionally unresolved and require design before implementation:

- one household login with protected child-profile switching or separate authenticated accounts;
- administrator re-authentication or PIN requirements;
- exact activity retention period;
- initial list of reversible actions;
- whether authentication events belong in the same product timeline;
- whether children may view their own activity history;
- whether household statistics derive directly from current state, activity events or both.

These open points must not be guessed during implementation. They require an approved product and security decision first.
