# Project Constitution

## Purpose

Pokémon Collection is a professional, maintainable, mobile-first collection manager for Lars and Lore.

The project is not a continuation of `Pokemon-Manager`. It is a complete restart.

## Non-negotiable principles

1. Architecture before implementation.
2. Quality before speed.
3. Maintainability before short-term convenience.
4. Mobile-first decisions before desktop extensions.
5. Supabase is the only source of truth.
6. Every user owns their own data.
7. No application code before Phase 0 is approved.
8. No direct changes to `main` after repository initialization.
9. No patches without root-cause analysis.
10. No legacy implementation reuse.

## Zero Legacy Policy

The previous `Pokemon-Manager` repository may only be used as a functional reference.

The following may not be reused:

- source code
- HTML
- CSS
- JavaScript
- architecture
- layouts
- styling
- components
- services
- utilities
- state management
- configuration
- debugging tools
- recovery tools
- workarounds
- AI-generated implementation fragments

Only knowledge may be reused:

- desired functionality
- user experience lessons
- known data requirements
- known performance risks
- external services already selected

## Stop Rule

Development must stop immediately when any of the following occurs:

- unexpected regression
- unexpected layout change
- performance degradation
- unclear root cause
- architectural mismatch
- need for a larger refactor
- security concern
- data ownership ambiguity

No patching is allowed before analysis and an explicit decision.

## Definition of Done

A phase is only complete when:

- functional requirements are met
- no known regressions exist
- mobile behavior is reviewed
- architecture remains intact
- tests are planned or passing, depending on phase
- documentation is updated
- risks are documented
- rollback is possible
- PR is reviewed and approved
