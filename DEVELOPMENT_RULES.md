# Development Rules

## Branch strategy

`main` must remain stable.

No direct changes to `main` are allowed after the initial repository setup.

Every change must use a dedicated branch.

One branch has one purpose.

## Pull requests

Every pull request must include:

- goal
- architecture impact
- risk analysis
- test plan
- acceptance criteria
- rollback plan

## Design before development

Every feature must go through:

1. analysis
2. architecture
3. data model
4. wireframe
5. component design
6. acceptance criteria
7. test strategy
8. implementation

Implementation may not start before the first seven steps are complete.

## Forbidden behavior

The following are forbidden:

- copying legacy code
- large unreviewed rewrites
- patching without root-cause analysis
- mixing unrelated goals in one branch
- hiding business logic inside UI components
- using local storage as source of truth
- adding external dependencies without architectural approval
- implementing AI features without a dedicated approved ADR
- implementing Binder before core modules are stable

## Review standard

Code and documentation must be reviewed as if the project will be maintained for multiple years.

A technically poor decision must be rejected even if it appears faster.
