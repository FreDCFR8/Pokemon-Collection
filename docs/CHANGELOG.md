# Changelog

## Phase 2K — Auth Login Service Skeleton

- Added a disabled Auth Login Service Skeleton that reuses the login action boundary without importing Supabase clients or executing auth calls.
- Updated LoginPanel to prepare login through the new service while keeping login execution, profile data, and collection data disabled/not loaded.
- Documented that `loginExecuted` remains `false` and `hiddenAuthEmail` is not used for an auth call in this phase.

## Phase 2J — Login Activation Skeleton

- Added a local username-to-hidden-auth-target mapping skeleton for `lars` and `lore`.
- Updated the login action boundary and LoginPanel status display without enabling Supabase Auth calls, profile reads, collection reads, writes, migrations, or RLS changes.
- Documented the Phase 2J acceptance criteria and confirmed the hidden auth email remains internal only.

## Phase 2I — Login Activation Design

- Added a documentation-only design for future username + password login activation.
- Recommended hidden per-child pseudo-email mapping for Supabase Auth combined with a future `profiles` table.
- Confirmed that no runtime login call, database migration, writes, RLS changes, GitHub Actions changes, or Vercel workflow changes are part of this phase.
