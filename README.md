# Pokémon Collection V3

Professional, mobile-first Pokémon Collection Manager for Lars and Lore.

## Current status

The application is implemented with Vite, React, TypeScript, Supabase and Vercel. Operational project status, active import scope and the next approved phase are maintained in [PROJECT_STATUS.md](docs/project/PROJECT_STATUS.md).

The catalog-import workflow is currently paused for a focused redesign after PR147 was closed without merge. No remaining-set bulk import is approved until its mapping evidence, transaction boundary and real idempotency checks are independently reviewed.

## Project governance

- `main` remains stable.
- Every change uses a focused branch and pull request.
- Read-only verification precedes database writes.
- Catalog metadata and collection state remain separate.
- Secrets never enter repository files, browser code or reports.

## Core documentation

- [Project Charter](docs/project/PROJECT_CHARTER_V2.md)
- [Project Status](docs/project/PROJECT_STATUS.md)
- [Roadmap](docs/project/ROADMAP.md)
- [Decision Log](docs/project/DECISION_LOG.md)
- [AI Working Agreement](docs/project/AI_WORKING_AGREEMENT.md)
