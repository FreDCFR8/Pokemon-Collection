# Pokémon Collection V3 — Project Status

_Last updated: 2026-07-19_

This document contains current operational state only. Historical direction belongs in `ROADMAP.md`; lasting reasons belong in `DECISION_LOG.md`.

## Current phase

**Current implementation state: controlled import reset — design and read-only verification only.**

PR147 (“Add controlled Phase 7B remaining-sets bulk workflow”) was closed without merge after technical review identified fundamental safety and correctness blockers. No code from PR147 is on `main`; no bulk dry-run or bulk database write from that PR was executed.

The next import step is not a new writer. It is a small, reviewable design and evidence phase that must establish one exact approved remaining-set list, mapping evidence, database transaction boundary, postchecks and true database idempotency criteria before implementation resumes.

## Verified repository position

- Current `main`: merge commit `8dffc6579f580fced1ea828690a16c6d205f10b2` (PR146).
- Latest merged import hardening: PR143, PR144, PR145 and PR146.
- PR147 is closed and unmerged.
- The repository contains production application code and controlled catalog-import tooling; Phase 0/Blueprint wording is obsolete.

## Current operational import scope

The following operational state is retained from approved import-run evidence and must be reconfirmed by a fresh read-only preflight before any future write:

- local source: `PokemonTCG/pokemon-tcg-data`;
- pinned dataset commit: `0af6250a22495e4a3e9f60ff45fc3fedc2e0563d`;
- complete dataset profile: 173 sets and 20,324 cards;
- 39 sets were processed through Batches 1–3 with completed write and idempotency evidence;
- 134 sets remain outside the approved import scope.

## Read-only baseline — 2026-07-20

The local pinned dataset and Supabase were remeasured without writes.

- report hash: `30c9044a0f52b7dba0cb164cff99ce8fbd2f8d14ca1ce7c75b1a03b60ab51288`;
- analysis hash: `dd8391f56de294adb8e47d5a56d3d770c335a8ca7fffbfd907f08bb072cf2d6e`;
- manifest hash: `c5604ffa39e017e08eca089770bce82a786b1b20ebb45ee9bc0d6d22db3b6ab3`;
- dataset profile: 173/173 sets and 20,324/20,324 cards;
- classification: 39 `PASS`, 132 `BLOCKED`, 2 `NEEDS_MANUAL_REVIEW`;
- 118 blocked sets have no reliable set mapping;
- 14 blocked sets have existing identity/reference conflicts; `sv9` and `swsh9` are in this stricter blocked category;
- manual review: `cel25c` and `zsv10pt5`, both because of duplicate incoming card numbers;
- protected table snapshot before and after was unchanged: `cards_catalog=7391`, `card_external_references=7354`, `collection_cards=1106`, `sets_catalog=55`, `set_external_references=41`;
- `databaseWritesTotal: 0`, with zero operational and postcheck errors.

All four exceptional sets remain excluded from automatic writes: `cel25c` and `zsv10pt5` require manual review; `sv9` and `swsh9` remain blocked until their conflicts are resolved.

## Source-of-truth order

1. current code and tests on `main`;
2. merged pull requests;
3. current read-only Supabase evidence;
4. explicit operational evidence approved by the project owner;
5. older reports and conversation history only as context.

## Current architecture baseline

```text
authenticated user
→ profile
→ collection
→ collection_cards
→ cards_catalog
→ sets_catalog
```

External card APIs are controlled import and synchronization sources only. Supabase is the runtime source of truth.

Core invariants:

- `cards_catalog` stores card identity and metadata;
- `collection_cards` stores collection-specific state;
- internal catalog IDs remain stable;
- catalog imports never change `collection_cards`;
- `public.cards` remains legacy;
- browser reads remain filtered, paginated and limited;
- browser writes are explicit user actions protected by RLS and database constraints.

## Verified catalog reference implementation

Pokémon TCG API set `sv3pt5` (`151`) remains the verified controlled-import reference:

- 207 expected and received cards;
- 207 stable external-reference matches after import;
- 136 new catalog records and 136 references added during the approved write;
- zero failed writes;
- post-write idempotency dry-run planned and executed zero writes;
- `collection_cards` was unchanged by the catalog import.

## Verified `sv3` import

Pokémon TCG API set `sv3` (`Obsidian Flames`) is imported and idempotency-verified:

- write result: PASS;
- 230 expected and received cards;
- 174 new `cards_catalog` records;
- 174 new `card_external_references` records;
- 348 database writes;
- zero failed writes;
- post-write reference count: 230;
- post-write unique external-reference count: 230;
- post-write catalog links: 230;
- `collection_cards` remained unchanged: 1111 → 1111;
- idempotency dry-run result: PASS;
- idempotency planned writes: 0;
- idempotency database writes: 0.

## Phase 7B-2F9C update

Phase 7B-2F9C adds typed, atomic per-set diagnostic JSON results and makes the batchrunner classify failures from that contract rather than console wording. Checkpoints and reports retain sanitized diagnostics, failure codes, setmapping evidence and limited examples; malformed subprocess results fail closed as `unexpected_runner_failure`.

De operationele 2F9C-run is afgerond: 173 sets verwerkt, 7 inhoudelijke PASS, 166 inhoudelijke blokkades, 20.324/20.324 kaarten ontvangen, 0 runnerfouten en `databaseWritesTotal: 0`. Een globale FAIL blijft correct zolang inhoudelijke blokkades bestaan.

## Product direction

Catalog coverage and collection management remain the primary product focus. Trade remains a separate future area and the lowest product priority. Remaining catalog imports stay paused until the next approved design-only phase establishes the controlled scope.

## Next approved import phase

Before a new import implementation starts, create and review a design-only specification for the remaining sets. It must keep manual-review sets blocked, define one exact approved set list and mapping-evidence format, and require transaction-safe catalog/reference writes plus exact postchecks and a real idempotency run.
