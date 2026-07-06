# Coding Standards

## Status

Phase 0 draft.

## Principles

- readability over cleverness
- explicit types over hidden assumptions
- small files over large mixed-responsibility files
- feature boundaries over global scripts
- domain rules outside visual components

## Recommended future standards

These apply after implementation is approved:

- TypeScript strict mode
- clear folder boundaries
- no direct Supabase calls inside visual components
- no direct Pokémon TCG API calls inside visual components
- no secrets in source control
- no unrelated refactors inside feature branches

## Naming

Names should describe intent, not implementation tricks.

## Comments

Comments should explain why, not repeat what the code says.

## Dependency rule

No external dependency may be added without a documented reason.
