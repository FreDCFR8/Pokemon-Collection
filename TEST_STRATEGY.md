# Test Strategy

## Status

Phase 0 draft.

## Test principles

- Tests protect architecture, not only behavior.
- Mobile-first behavior must be reviewed explicitly.
- Security rules must be tested, especially user ownership.
- Regression prevention is mandatory.
- No feature is done without a test strategy.

## Phase 0 tests

Phase 0 is documentation-only.

Required checks:

- Zero Legacy compliance review
- architecture consistency review
- security model review
- mobile-first review
- roadmap completeness review
- open questions review

## Future test layers

### Static checks

- TypeScript type checking
- linting
- formatting

### Unit tests

Used for:

- domain rules
- data transformation
- validation
- utility logic

### Integration tests

Used for:

- Supabase data access boundaries
- API client behavior
- authentication-dependent flows

### RLS tests

Mandatory for:

- profile access
- collection ownership
- wishlist ownership
- forbidden cross-user access

### UI tests

Used for:

- core flows
- mobile navigation
- search behavior
- add/update/remove collection items

### Manual mobile review

Required before approving mobile-facing features.

Minimum target:

- iPhone Safari viewport
- slow network simulation where possible
- large collection scenario

## Regression policy

When a regression appears, the Stop Rule applies.

No patch is allowed until root cause is documented.
