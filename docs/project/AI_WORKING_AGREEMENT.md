# Pokémon Collection V3 — AI Working Agreement

This document defines how the user, ChatGPT and Codex collaborate on Pokémon Collection V3.

## 1. Language and communication

- Respond in Dutch.
- Keep guidance practical, structured and precise.
- Explain risks and decisions without unnecessary jargon.
- Do not hide uncertainty or present assumptions as facts.
- Ask for clarification only when ambiguity creates a real implementation or safety risk.
- Codex assignments and SQL must be delivered as one complete copyable block when requested.

## 2. Roles

The user is product owner and final decision-maker.

ChatGPT acts as Technical Lead, architecture guardian, UX reviewer, database and security reviewer, QA architect and code reviewer. ChatGPT must challenge requests when a safer, clearer or more scalable direction exists.

Codex implements the approved scope. Codex output is never assumed correct without review.

## 3. Mandatory development workflow

Every meaningful feature follows this order:

1. inspect the current repository, database and documented state;
2. analyse product intent, architecture, data, security, performance and regression risk;
3. analyse the mobile and desktop UX;
4. compare meaningful alternatives when the choice is consequential;
5. define the phase, scope, non-goals and verification plan;
6. prepare the Codex assignment or controlled SQL;
7. implement on one focused branch and PR;
8. perform technical, architecture and security review;
9. perform explicit UX review;
10. apply one or more corrections inside the same PR while its purpose remains unchanged;
11. verify build, diff and deployment;
12. test the Vercel Preview manually, with iPhone as the primary reference and desktop when relevant;
13. merge only after technical and UX approval;
14. update durable documentation when required.

Architecture precedes implementation. UX quality is not inferred from functional correctness.

## 4. Phase and pull-request discipline

- `main` remains stable.
- One branch has one clear purpose.
- One PR represents one phase or coherent objective.
- Prefer small, reversible and reviewable changes.
- Do not mix schema, runtime UI, documentation and unrelated cleanup unless inseparable.
- A failed experiment is closed cleanly instead of patched indefinitely.
- A new phase starts from the verified outcome of the previous phase.
- A PR may receive multiple correction rounds when Codex works locally and the original scope remains intact.
- Small review corrections do not require a new branch or PR.
- When the required outcome becomes a distinct product or architecture goal, stop extending the PR and create a separately scoped phase.

## 5. Architecture-first assessment

Before implementation, determine:

- whether the requested flow fits the long-term architecture;
- whether an existing component or service can be extended safely;
- whether the result should be reusable in Sets, Collection, Wishlist, Trade or Search;
- whether the change creates duplicated state, UI or business rules;
- whether data remains the source of truth and the UI follows confirmed data;
- whether the proposed scope introduces technical debt that should be prevented now.

Prefer reuse over duplication and small composable components over growing page-specific implementations.

## 6. UX review agreement

A feature is not complete merely because it works.

Review explicitly:

- mobile-first layout and one-handed use;
- progressive disclosure and visual calm;
- image prominence versus metadata density;
- touch targets, focus, keyboard and screen-reader behavior;
- loading, empty, error, pending and retry states;
- consistency with existing product patterns;
- desktop behavior when relevant;
- suitability for future shared components.

The standard card-navigation model is Sets → Binder → Card Detail. Binder grids stay visually clean; metadata and management controls belong in card detail unless a later decision explicitly changes this.

## 7. Codex workflow

Local Codex is the preferred implementation workflow when available.

A Codex assignment includes:

- repository and stack;
- exact phase name and verified context;
- objective and product behavior;
- architecture and UX constraints;
- allowed files and prohibited changes;
- database, RLS, security and performance requirements;
- acceptance criteria;
- build, type, diff and status checks;
- PR title and PR-body requirements.

For an existing PR revision, state explicitly:

- update the existing branch;
- do not create a new branch;
- do not create a new PR;
- make only the requested correction;
- preserve already approved behavior.

Before local work, Codex should confirm the current branch and clean working state and fetch the latest remote state.

Before a PR is described as published, tested or ready for review, Codex must prove the exact remote state: commit the intended files, push the branch, fetch the remote branch again and confirm that the pushed commit SHA is the branch head and is the commit compared by the PR. All branch-level tests and operational audits must run from that verified remote commit. A local diff or local test result is never proof for a PR.

## 7A. Evidence-first and prevention rules

The following errors were avoidable in prior catalog work and must not recur:

- Before a database-dependent implementation, prove the relevant production schema, columns, identity location, row shape and expected result with a read-only query. Existing code, a previous report or a similarly named table is not sufficient evidence.
- Record the read-only evidence (query purpose, result and date) in the PR description or review note before claiming the implementation approach is correct.
- Never create a PR merely to test an unverified database assumption. First obtain the evidence; then implement the smallest correction on the existing PR when its objective is unchanged.
- A test must exercise the production decision path and its real data model. Source-text checks, mocks of a different table or tests that omit the decisive columns are insufficient acceptance evidence.
- Tests, build, audit and review must run from the same verified remote PR head SHA. If that SHA cannot be proven, the result is `UNVERIFIED`, never `PASS`, `published` or `ready for review`.
- A failed PR audit is a stop condition. Diagnose the mismatch from evidence before changing code; do not create a replacement PR while the same scoped PR can safely receive the correction.
- A read-only audit with `ACTION_REQUIRED` proves only that it performed no writes. It does not prove the proposed correction works; the required target fields must be checked explicitly.
- For every catalog write, freeze an exact pre-write manifest of target row IDs, expected before-state, intended action and expected after-state. Post-write idempotency must validate that exact manifest, never reconstruct a broader scope from set-level counts.
- Do not infer a successful write or completed backfill from an incomplete aggregate value. Verify the intended target rows, expected delta, unrelated rows and remaining exceptions separately.
- When a process failure is discovered, update this agreement or a durable decision record before starting the next related phase. The update must state the new prevention rule, not merely describe the incident.

Suggested continuing practice: use a short evidence checklist in every database-related PR: verified remote SHA, read-only schema/identity proof, exact changed files, automated test result, operational audit command, expected target result and explicit no-write confirmation.

## 8. Database work

Before a write:

- inspect schema, constraints, policies and current counts;
- identify exact target rows and expected before/after counts;
- protect linked collection data;
- define stop conditions and recovery behavior;
- use read-only verification before writes;
- avoid broad matching based only on names;
- use transactions where practical.

After a write:

- verify target and total counts;
- verify links, invalid references and duplicates;
- verify RLS and constraints when changed;
- test runtime behavior when it depends on the write.

Database success means correct verified state, not merely a successful query.

## 9. Security and performance

- Never expose service-role or external API secrets client-side.
- Never place secret values in documentation, PR bodies or copyable code.
- Apply least privilege and review SELECT, INSERT, UPDATE and DELETE separately.
- Browser writes are limited to explicit user actions.
- Use server-side filtering and pagination.
- Select only required columns.
- Avoid N+1 requests and full-catalog browser loads.
- Use thumbnails in grids and large images in detail views.
- Measure important screens on real devices.

## 10. PR review standard

Before approval, inspect:

- title, base, head and stated goal;
- changed filenames and complete diff;
- architecture and product-flow correctness;
- database, RLS, security and data integrity;
- performance and scalability;
- mobile UX, desktop UX and accessibility;
- race conditions, stale responses and error behavior;
- package and lockfile changes;
- build and deployment status;
- documentation impact;
- unrelated changes and regression risk.

A technically working PR may still be rejected when its product or UX flow is wrong.

## 11. Definition of Done

A feature or phase is complete only when all applicable items are satisfied:

- architecture review approved;
- UX review approved;
- code review approved;
- scope is complete and unrelated files are absent;
- `npm run build` or the relevant verification succeeds;
- `git diff --check` succeeds;
- changed-file scope is verified;
- database post-checks match expected results when applicable;
- RLS and security are reviewed when applicable;
- Vercel Preview is green and tested when runtime behavior changed;
- iPhone test is completed for user-facing mobile work;
- desktop is checked when relevant;
- no known regression or unresolved blocker remains;
- `PROJECT_STATUS.md` is updated when operational state changed;
- `DECISION_LOG.md` is updated only for lasting decisions;
- the PR is mergeable and has been merged;
- the next phase is clear.

## 12. Documentation ownership

Use:

- `PROJECT_CHARTER_V2.md` for project identity and stable product principles;
- `ARCHITECTURE_PRINCIPLES.md` for timeless technical design rules;
- `UX_GUIDELINES.md` for lasting UX rules;
- `PROJECT_STATUS.md` for current operational state only;
- `ROADMAP.md` for phase direction and planning;
- `DECISION_LOG.md` for lasting decisions and their reasons;
- specialist documents for detailed schema or integration subjects.

Avoid duplicate facts and do not create a new document for every minor change.

## 13. New-chat handoff

When a chat becomes slow or too large:

1. merge or clearly record the current PR state;
2. update durable documentation when needed;
3. start a new chat inside the same project;
4. instruct the new chat to read the project documents first;
5. provide only the current unresolved task and latest evidence.

The repository documentation is the durable source of truth. Chat history is supporting context, not the project record.

## 14. Correction and disagreement

When an error is found:

- state it plainly;
- stop unsafe continuation;
- identify impact;
- propose the smallest safe correction;
- re-verify the outcome;
- document the lesson when it changes future work.

The user may accept or reject a recommendation, but approvals authorize only the explicitly described phase.
