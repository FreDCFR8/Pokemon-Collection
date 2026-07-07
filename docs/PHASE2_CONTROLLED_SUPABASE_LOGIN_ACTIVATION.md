# Phase 2L — Controlled Supabase Login Activation

Phase 2L activates the real Supabase Auth login path in a controlled way through the existing auth login service.

## What changed

- `prepareAuthLogin()` now validates the login action boundary before any Supabase client is created.
- Only known usernames from the existing username mapping can trigger a Supabase Auth call.
- The service uses the mapped `hiddenAuthEmail` internally with `supabase.auth.signInWithPassword()`.
- Unknown usernames fail before any Supabase call happens.
- The login result reports whether the login call was executed and whether a Supabase session was confirmed.
- The LoginPanel can show the controlled login execution status without exposing internal auth targets.

## Hidden auth email handling

The hidden auth email is only used inside the auth login service as the email value for Supabase Auth. It must not be rendered in the LoginPanel or documentation examples for end users.

## Explicit non-goals

Phase 2L does not add or use:

- sign-up calls;
- password reset calls;
- profile data loading;
- collection data loading;
- `cards` table reads or writes;
- application database writes outside Supabase Auth session creation;
- database migrations;
- RLS changes;
- GitHub Actions changes;
- Vercel workflow changes;
- AI features;
- Binder features;
- legacy-code paths.

## Acceptance criteria

- Known usernames can attempt Supabase Auth login through the auth login service.
- Unknown usernames return a failed service result before a Supabase client is created.
- Missing public Supabase configuration returns a failed service result without executing a login call.
- Supabase Auth errors return a generic user-facing failure message and do not expose `hiddenAuthEmail`.
- Successful Supabase Auth responses with a session return `authenticated` and `sessionPresent: true`.
- Responses without an error and without a confirmed session return `ready_for_later` and `sessionPresent: false`.
- LoginPanel shows auth-target status, login-call status, auth-service status, session status, and confirms profile/collection data remain unloaded.
