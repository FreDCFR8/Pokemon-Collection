# Pokémon Collection V3 — Phase 1A Identity, Access and Administration Contract

## 1. Status and purpose

Phase 1A is an architecture and implementation-contract phase only.

It defines the approved identity, access, administration, settings and logging model before runtime code, database migrations or Row Level Security changes are introduced.

This document does not authorize:

- runtime authentication changes;
- database writes or migrations;
- new RLS policies;
- administrator UI implementation;
- activity-log tables;
- guest access;
- profile switching.

The earlier Dashboard D2 attempt exposed that login, profile resolution, logout, roles and public access were not yet complete product contracts. Dashboard implementation remains blocked until the relevant Identity and Access phases are completed.

## 2. Decisions approved in Phase 1A

### 2.1 Account model

Pokémon Collection V3 uses separate authenticated accounts:

- Lars has one Supabase Auth account linked to exactly one Lars profile;
- Lore has one Supabase Auth account linked to exactly one Lore profile;
- the parent or responsible adult has a separate administrator account;
- a child account cannot switch to another child profile;
- the administrator may later manage both child profiles through explicitly protected administrator flows.

The existing relationship remains foundational:

```text
auth.users.id
→ profiles.auth_user_id
→ collections.profile_id
→ collection_cards.collection_id
```

No second identity system may be introduced.

### 2.2 Guest access

Guest access is explicitly out of scope and has no current priority.

Until a later separately approved security phase changes this:

- the application is authentication-first;
- no anonymous access to Sets, Search, card details, Collection or Wishlist is assumed;
- existing authenticated RLS boundaries remain authoritative;
- client-side hiding is never used to simulate public access.

### 2.3 Initial roles

The initial role set is deliberately limited to:

- `child`;
- `admin`.

No `guest`, `viewer`, `parent`, `operator` or custom permission role is approved in this phase.

A role must be resolved from a trusted server-side source and enforced by RLS or another trusted server boundary. The UI may reflect a role but may never be the authorization source.

### 2.4 Child access

A child account may:

- authenticate with its own account;
- resolve only its own profile;
- access the shared catalog and sets while authenticated;
- view and mutate only its own collection and wishlist through approved services and policies;
- view child-facing settings approved in a later phase.

A child account may not:

- access the administrator area;
- resolve or select the other child profile;
- read another profile's collection, wishlist, activity or settings;
- assign roles;
- view operational logs;
- perform maintenance or import actions.

### 2.5 Administrator access

The administrator account may later receive explicitly protected capabilities for:

- opening an administrator dashboard;
- viewing Lars and Lore profile summaries;
- managing approved user and profile settings;
- reviewing meaningful product activity;
- viewing safe operational status;
- performing only those administration actions introduced by separately reviewed phases.

Administrator access does not automatically grant a general database console, unrestricted browser writes, service-role access or catalog-import execution.

## 3. Current verified foundation

The current codebase already contains parts of the future model:

- `prepareAuthLogin()` performs the existing Supabase password-login call;
- `LoginPanel` invokes that functional login service, but its presentation is technical and not product-ready;
- profile readiness uses `supabase.auth.getSession()`;
- `checkProfileReadiness()` resolves one profile by `profiles.auth_user_id`;
- collection resolution continues from the resolved profile and identifies its main collection;
- signed-out, missing-profile and error states already exist in parts of the readiness flow.

The following foundations are not yet complete:

- no central reactive application auth provider or equivalent state source;
- no application-wide `onAuthStateChange` subscription;
- no approved logout service or product flow;
- no trusted persisted role source is confirmed;
- no administrator route guard exists;
- no product-ready login dialog exists;
- no activity or audit event infrastructure exists;
- no operational logging contract is implemented;
- no user-settings architecture is implemented.

## 4. Central identity state contract

A later runtime phase must introduce one app-wide identity state source. Dashboard, Collection, Wishlist, Settings and Admin must consume this contract instead of independently querying sessions and profiles.

Required states:

```text
initializing
signed_out
authenticated_profile_loading
authenticated_ready
authenticated_profile_missing
error
```

The ready state must provide only verified information:

- authenticated user ID;
- resolved role;
- resolved child profile for child accounts, when applicable;
- resolved main collection where required;
- safe display data needed by the interface.

The central state must:

- initialize from the current Supabase session;
- react to Supabase auth-state changes;
- clear profile, collection and role state on logout;
- prevent stale Lars data from remaining visible after Lore or admin authentication;
- expose loading and error states explicitly;
- avoid storing authoritative identity or role data in `localStorage`.

## 5. Login and logout contract

### 5.1 Login

The existing `prepareAuthLogin()` service remains the functional login boundary unless a later review proves it unsafe.

The product login presentation must:

- be separated from technical readiness diagnostics;
- use child- and parent-appropriate wording;
- never display auth targets, table names, configuration status or internal call states;
- show safe validation and authentication errors;
- support keyboard and touch use;
- avoid logging credentials or tokens.

### 5.2 Logout

A dedicated logout service must be added in a later phase using the existing Supabase client and `supabase.auth.signOut()`.

Successful logout must:

- clear the central auth, role, profile and collection state;
- return the interface to the signed-out product state;
- prevent stale personal content from remaining visible;
- produce a safe user-facing result.

Whether login and logout events belong in the durable product activity timeline remains a later privacy and retention decision. Security-relevant operational reporting may be handled separately.

## 6. Role and permission architecture

### 6.1 Trusted role source

Phase 1A does not select a final schema without a fresh read-only production inspection.

The next schema-design phase must compare at least:

1. a dedicated `user_roles` table keyed by `auth_user_id`;
2. a role field on an existing account-identity record, only if that record has clear ownership and RLS semantics;
3. trusted auth claims managed through a secure server process.

The selected design must support:

- exactly one approved initial role per account;
- server-side role checks;
- safe administrator assignment;
- no browser-side self-promotion;
- testable child/admin separation;
- future extension without weakening current policies.

### 6.2 Initial permission matrix

| Capability | Child | Admin |
|---|---:|---:|
| Sign in and sign out | Yes | Yes |
| Resolve own account identity | Yes | Yes |
| Resolve own child profile | Yes | Not assumed |
| View shared catalog and sets while authenticated | Yes | Yes |
| Manage own collection and wishlist | Yes | Only through explicit admin functionality introduced later |
| Read other child's personal data | No | Only after explicit admin policies |
| Open administrator area | No | Yes |
| Assign roles | No | Only through a trusted future admin process |
| View product activity | Own activity only if later approved | Household activity after explicit policy |
| View operational diagnostics | No | Safe admin diagnostics only |
| Run catalog imports from browser | No | No |

## 7. Administrator area contract

The administrator experience must be visually and technically separate from the child application.

Initial navigation may later include:

- Overview;
- Users and profiles;
- Settings;
- Activities;
- Application status.

The administrator area must not become:

- a database table editor;
- a Supabase console replacement;
- a place where service-role credentials are exposed;
- an unrestricted catalog-import interface;
- a debug dump containing secrets or unnecessary personal data.

Every administrator route and action requires trusted authorization. Hiding links from child users is insufficient.

## 8. User and profile settings contract

Settings are split into two categories.

### 8.1 Child-facing settings

Potential initial settings:

- display name, when safely editable;
- approved avatar or avatar style;
- interface preferences such as theme or reduced motion;
- other non-sensitive presentation preferences approved later.

Child settings may never change:

- role;
- `auth_user_id` ownership;
- another profile;
- RLS scope;
- administrator privileges.

### 8.2 Administrator-managed settings

Potential later capabilities:

- view profile status;
- manage approved profile presentation values;
- manage access state through a trusted server process;
- configure application-level product preferences;
- inspect activity retention or logging settings after those contracts are approved.

Direct browser manipulation of `auth.users` or service-role operations is forbidden. Sensitive account-management actions require a trusted server-side boundary such as an Edge Function or equivalent reviewed mechanism.

## 9. Logging architecture

Two distinct logging domains are required.

### 9.1 Product activity and audit history

The product label is **Activiteiten**.

It records meaningful successful state changes such as:

- collection card added or removed;
- quantity, condition or status changed;
- wishlist state changed;
- approved profile or setting changed;
- administrator access or setting changed;
- supported recovery action executed.

It does not record routine browsing, opening cards or search typing by default.

Durable events must be created at the trusted mutation boundary. Scattered frontend logging is prohibited because it can diverge from database truth.

Minimum event concepts:

- event timestamp;
- authenticated actor;
- actor role;
- affected child profile and collection where applicable;
- stable action code;
- affected entity type and ID;
- concise safe description;
- required before/after information;
- correlation ID;
- reversibility and restoration relationship where applicable.

### 9.2 Operational logging

Operational logging is separate from user activity and may cover:

- failed data loading;
- categorized authentication failures without credentials;
- unexpected application errors;
- integration or import status;
- safe health and diagnostic signals.

Operational logs must not be shown to child users and must not contain:

- passwords;
- access or refresh tokens;
- service-role keys;
- raw sensitive payloads;
- unnecessary personal data.

A later phase must decide the storage, retention, visibility and redaction rules before implementation.

## 10. Privacy and retention decisions still required

Before durable logging is implemented, explicitly approve:

- detailed activity retention period;
- operational-log retention period;
- whether children can view their own activities;
- whether login and logout events are shown in product activity;
- which administrator actions require stronger re-authentication;
- data export and deletion behavior;
- which events are reversible;
- which before/after fields are necessary and proportionate.

Default rule: collect the minimum needed for trust, support, security and approved recovery.

## 11. Implementation phases after 1A

### Phase 1B — Central auth and profile runtime

Scope:

- central reactive identity state;
- reuse of the existing login service in a product presentation;
- logout service;
- safe profile and collection resolution;
- child-facing authenticated shell;
- no administrator database role implementation yet.

### Phase 1C — Role schema and RLS

Scope:

- fresh read-only schema and policy evidence;
- final trusted role source;
- migration and constraints;
- child/admin RLS tests;
- initial admin account assignment through a controlled process;
- no admin UI beyond minimum testability.

### Phase 1D — Administrator shell

Scope:

- protected admin routes;
- admin navigation and empty/loading/error states;
- no broad user mutations yet.

### Phase 1E — User and profile settings

Scope:

- approved child presentation settings;
- approved admin profile-management functions;
- trusted server boundary for sensitive account actions.

### Phase 1F — Product activity foundation

Scope:

- event schema and indexes;
- trusted mutation-boundary event creation;
- retention and visibility policies;
- first limited event types;
- no universal undo promise.

### Phase 1G — Admin activities and operational status

Scope:

- administrator activity timeline;
- filtering and safe diagnostics;
- strict separation between activity and operational logs.

### Phase 1H — Dashboard restart

Only after the relevant auth, role and profile contracts are implemented:

- redesign the child dashboard from the approved visual reference;
- show the correct authenticated child identity;
- place login/account access through the profile control;
- preserve collection and wishlist boundaries;
- remove technical readiness UI without removing functional identity flows.

Guest mode remains excluded.

## 12. Required evidence for later phases

Each implementation phase must include applicable evidence for:

- exact verified remote PR head SHA;
- current production schema and policies before database work;
- session initialization and auth-state transitions;
- login success, validation failure and auth failure;
- logout clearing all personal state;
- Lars account resolving only Lars;
- Lore account resolving only Lore;
- child role blocked from administrator routes and data;
- admin role allowed only explicitly approved access;
- cross-profile RLS denial;
- no secrets or sensitive payloads in logs;
- mobile and iPad UX;
- accessibility and keyboard behavior;
- build, type checking, tests and diff validation.

## 13. Stop conditions

Stop implementation and report before proceeding when:

- the production role source or current policies are not proven;
- child accounts are not uniquely linked to profiles;
- an account resolves multiple profiles unexpectedly;
- administrator access would rely only on UI hiding;
- a required sensitive action has no trusted server boundary;
- logging cannot be atomic with the mutation it represents;
- the requested scope requires guest access;
- a phase starts mixing auth foundation, role migrations, admin UI and broad activity logging into one PR.

## 14. Lasting prevention rules

- A technical readiness component may not be removed until its functional user flows have been identified and preserved or replaced.
- A user-facing screen may not hardcode Lars, Lore or another active identity.
- A visual dashboard phase may not begin before auth, profile and permission dependencies are explicitly proven.
- Public or guest behavior may not be promised before current grants and RLS policies prove it.
- UI visibility is never authorization.
- Logging must be designed at the trusted mutation boundary, not added as scattered frontend calls.
