# Pokémon Collection V3 — Phase 2B Dashboard Insights

## Status

Phase 2B is implemented in PR188 and awaits Preview validation.

## Goal

Extend the Phase 2A read-only dashboards with useful collection insights for Lars, Lore and Frederik without adding logging, charts, mutations or new database objects.

## Implemented child insights

- limited set progress based only on unique `owned` catalog cards;
- recent owned-card thumbnails using existing small images;
- compact rarity summary;
- a safe “verder verzamelen” recommendation based on the highest-progress incomplete set;
- existing links to Collection, Wishlist, Sets and Search.

## Implemented administrator insights

- separate Lars and Lore summaries;
- exact combined quantity;
- exact combined unique-card count with cross-profile overlap removed;
- combined wishlist and duplicate quantities;
- limited set-progress summaries per child;
- a neutral comparison based on unique-card counts.

## Formula contract

- Wishlist rows never count as collection progress.
- Set progress counts unique catalog identities with `status = owned` only.
- Total quantity is the sum of owned quantities.
- Duplicate quantity is `max(quantity - 1, 0)` per owned row.
- Combined unique cards are calculated from the union of all owned catalog IDs, never by adding profile totals.
- Rarity totals count unique owned catalog IDs per rarity.
- Recent cards use `collection_cards.added_at`, with `created_at` as deterministic tie-breaker.
- No history, trend or “since last session” claim is made.

## Architecture rule

All derived dashboard statistics originate in `dashboardService.ts`. Components receive calculated result models and do not implement collection formulas. The durable rule is also recorded in `docs/project/ARCHITECTURE_PRINCIPLES.md`.

## Explicit non-goals

- no charts or chart library;
- no activity history or logging;
- no notifications;
- no price or marketplace recommendations;
- no mutations;
- no import controls;
- no account, role or ownership actions;
- no database migrations, objects, policies or writes.

## Database

- Database writes: `0`.
- No migration or RLS change.
- Existing authenticated RLS remains the authorization boundary.

## Acceptance criteria

- Lars and Lore receive only data visible through their resolved collection and existing RLS.
- Frederik receives separate child summaries and exact combined totals.
- UI components contain no business aggregation formulas.
- Set progress is owned-only and deterministic.
- Insight lists remain bounded to four entries.
- Existing Collection, Wishlist, Sets, Search, profile settings, authentication and logout remain unchanged.
- Vercel build succeeds on the verified remote PR head.
- Desktop and iPhone Preview are accepted before merge.

## Stop conditions

Stop and reassess when an insight requires logging, a new database object, broader RLS, unbounded catalog loading or a mutation.

## Standard merge checklist

- Scope is respected.
- Only expected files are changed.
- No migration unless explicitly approved.
- Database writes are zero.
- Tests, TypeScript and production build pass.
- Vercel Preview is green.
- Desktop and iPhone checks pass.
- Existing functionality shows no regression.
- Durable architecture documentation is updated.