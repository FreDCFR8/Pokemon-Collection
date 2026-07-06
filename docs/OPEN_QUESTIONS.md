# Open Questions

## Status

Phase 0 draft.

This document tracks unresolved or recently resolved architectural questions.

## Resolved decisions

### Parent/admin account

Decision: yes, the system will support a parent/admin account.

The parent/admin role must be designed explicitly and may not bypass security accidentally.

### Child delete permissions

Decision: children may delete cards only if they have the rights to do so.

Deletion permissions must be role- and policy-driven, not hardcoded only in the UI.

### Existing Supabase data

Decision: existing Supabase data must be analyzed read-only first.

No migration, transformation, cleanup, or destructive operation may happen before the schema and data are understood.

### First collection scope

Decision: v1 starts with viewing cards only.

Adding, editing, deleting, and importing cards are out of scope until the read-only collection flow is stable.

## Still open

### Parent/admin capabilities

To define later:

- Can parent/admin view both Lars and Lore collections?
- Can parent/admin grant and revoke child permissions?
- Can parent/admin delete cards?
- Can parent/admin import or migrate data?
- Does parent/admin have a dashboard across all children?

### Permission model details

To define later:

- Which permissions exist?
- Are permissions global or per child?
- Are delete permissions separate from edit permissions?
- Should destructive actions require confirmation?
- Should destructive actions create an audit record?

### Migration outcome

To define after read-only Supabase inspection:

- keep existing data as-is
- transform into new schema
- archive old tables
- create migration scripts
- manually re-import curated data

## Stop Rule

If the existing Supabase schema conflicts with the proposed architecture, implementation must stop. The schema must be analyzed before any migration or feature code is written.
