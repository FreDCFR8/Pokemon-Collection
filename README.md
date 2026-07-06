# Pokémon Collection

Professional Pokémon Collection Manager for Lars and Lore.

## Project status

This repository is in **Phase 0 – Blueprint**.

No application code has been written yet.

This repository starts from a strict **Zero Legacy Policy**:

- The previous `Pokemon-Manager` repository is closed.
- It may only be used as a functional reference.
- No source code, architecture, styling, layout, utilities, services, configuration, or implementation details from the previous repository may be reused.

## Current scope

Before implementation starts, the project must first define and approve:

- product vision
- architecture
- data model
- security model
- Supabase strategy
- mobile-first UX principles
- performance strategy
- testing strategy
- roadmap
- ADRs

## Initial architectural direction

The current recommended direction is:

- Vite
- TypeScript
- React
- Supabase Auth
- Supabase Row Level Security
- online-first v1
- AI integration planned but not required for v1
- separate accounts for Lars and Lore

This direction is not yet implementation-approved. It must be confirmed during Phase 0.

## Branch strategy

`main` must remain stable.

All project documentation and future implementation work must happen through feature branches and pull requests.

## Phase 0 rule

No runtime application code may be added before Phase 0 is completed and approved.
