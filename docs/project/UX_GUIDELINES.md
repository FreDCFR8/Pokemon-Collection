# Pokémon Collection V3 — UX Guidelines

This document defines lasting UX principles. It does not prescribe temporary implementation details.

## 1. Product character

Pokémon Collection V3 should feel like a focused mobile collection app, not an administrative database interface.

The experience is:

- mobile-first;
- touch-first;
- visually card-led;
- calm and predictable;
- progressively disclosed;
- understandable for children and adults.

## 2. Information hierarchy

The standard navigation model is:

```text
Sets
→ Binder
→ Card Detail
```

Overview screens answer where the user is and what is available. Detail screens answer what the selected card is and what actions are possible.

Do not place every available field and action in overview grids.

## 3. Binder guidelines

A binder grid prioritizes card imagery.

- Show card images without metadata panels below them.
- Use a consistent card aspect ratio.
- Keep spacing compact but avoid accidental touches.
- Use thumbnails in the grid.
- Keep the grid to three columns on supported iPhone widths unless evidence proves another layout is better.
- A confirmed collection state may use one subtle non-text marker.
- Unknown or failed collection state must not appear as confirmed presence.
- The complete tile is the interactive target for opening detail.
- Provide an accessible label even when visible text is absent.

Names, numbers, rarity, quantity controls and management actions belong in card detail.

## 4. Card-detail guidelines

Card detail is the primary management surface for an individual card.

It should contain, in order of importance:

1. close or back action;
2. large card image;
3. card name;
4. set and card number;
5. collection state and primary management controls;
6. concise feedback;
7. optional characteristics or secondary information.

Principles:

- Use the large image when available and a small-image fallback.
- Keep the card fully visible with `object-fit: contain` behavior.
- Use available mobile viewport space effectively.
- Keep status wording consistent across features.
- Use one stable control position instead of replacing unrelated layouts for each state.
- The definitive card-detail component should be reusable in Sets and Collection and later in Wishlist, Trade and Search.

## 5. Progressive disclosure

Show only information needed for the current decision.

Examples:

- binder: image and subtle presence;
- detail: name, set, number and ownership controls;
- characteristics: rarity, illustrator, release data, relationships and prices only when the user opens or expands the relevant section.

Do not expose internal IDs, source identifiers or database terminology.

## 6. Status and feedback

Status must be understandable through text, not color alone.

Preferred collection wording:

- `Niet in collectie`
- `In collectie`
- `N in collectie` when multiple copies matter
- `Status laden…`
- `Bijwerken…`
- `Status onbekend`
- `Beheer via collectie` when the current surface cannot safely mutate the existing state

Use calm visual distinctions:

- green for confirmed present;
- neutral for absent;
- blue or neutral for pending;
- amber or red for unknown, conflict or error.

Avoid highly saturated colors and layout shifts between states.

## 7. Touch and accessibility

- Primary touch targets are at least approximately 44 × 44 CSS pixels.
- Do not place destructive and constructive actions too close together without clear distinction.
- Use visible focus styling.
- Restore focus when dialogs close.
- Support Escape on desktop dialogs.
- Provide accessible names for icon-only actions.
- Use live regions sparingly for meaningful status changes.
- Dialog content must remain scrollable and respect safe areas.
- Disabled controls must remain visibly recognizable.

## 8. Loading, empty and error states

Every data-driven feature includes:

- loading state;
- empty state;
- search-empty state when relevant;
- error state;
- retry path where practical;
- pending mutation state;
- confirmed success or refreshed-state feedback when needed.

Never present a failed ownership query as proof that a card is absent.

## 9. Mobile, iPad and desktop

iPhone remains the compact mobile reference for user-facing development. iPad is the primary everyday device for Lars and Lore and must receive explicit manual testing before child-facing work is approved.

For iPad:

- use the additional space to improve readability and reachability, not to expose administrator complexity;
- keep card imagery dominant;
- avoid stretched single-column phone layouts when a bounded or adaptive layout is clearer;
- support portrait and landscape when the feature reasonably allows both;
- verify safe areas, modal scrolling, touch targets and keyboard appearance;
- ensure the active child profile remains clearly visible during collection-changing actions.

Desktop remains supported:

- dialogs should be centred and bounded;
- content should not stretch unnecessarily;
- hover is optional enhancement, never required interaction;
- keyboard and focus behavior must remain usable;
- desktop changes must not weaken the mobile or iPad flow.

## 10. Child and administrator modes

The child experience and administrator experience are intentionally separated.

Child mode:

- focuses on Sets, Collection, Wishlist, Search and Card Detail;
- shows no administrator navigation, technical diagnostics or import controls;
- uses friendly product language rather than role, audit or database terminology;
- makes the active child identity obvious enough to prevent editing the wrong collection;
- requires a deliberate profile-switching flow rather than an accidental one-tap switch inside a mutation flow;
- keeps destructive actions clearly distinguishable and provides confirmation or recovery only where it improves safety without adding constant friction.

Administrator mode:

- may expose child-profile management, **Activiteiten**, household statistics and settings;
- must remain understandable and must not become a general database console;
- visually distinguishes administrator-only areas from child-facing collection use;
- requires server-enforced authorization even when the controls are hidden elsewhere;
- presents activity as a readable timeline with filters, not as raw database rows.

The product term is **Activiteiten**. Terms such as audit log, event table and mutation record belong only in technical documentation.

## 11. Activity and recovery UX

- Activity items state who acted, what changed, which card or setting was affected and when it happened.
- Filters may include child profile, collection, action type and date.
- Normal browsing and search are not presented as activity by default.
- A recovery action is shown only when the operation is explicitly reversible and still safe in the current state.
- Use **Herstellen** for product-level recovery; do not imply that every historical event can be undone.
- A successful recovery creates a new visible activity item rather than removing the original one.
- Failed or no-longer-safe recovery explains the reason without exposing database internals.
- Children do not see the household-wide activity timeline unless a later product decision explicitly permits a scoped personal view.

## 12. Visual consistency

- Reuse spacing, radius, typography and status patterns.
- Avoid page-specific variants of the same ownership control.
- Cards remain the dominant visual element.
- Text hierarchy should be clear without excessive labels.
- Avoid permanent technical copy in product-facing screens.
- Prefer one reusable component over multiple near-identical detail designs after the shared behavior is understood.

## 13. UX review checklist

Before approving user-facing work, verify:

- the product goal is obvious;
- the mobile layout is calm and readable;
- primary actions are reachable and large enough;
- details are disclosed at the right level;
- status wording is consistent;
- loading, error and pending states are safe;
- accessibility behavior is present;
- iPhone testing is complete;
- iPad testing is complete for child-facing features;
- portrait and landscape are checked where relevant;
- desktop is checked when relevant;
- child and administrator controls remain correctly separated;
- the active child profile is unambiguous during mutations;
- the design can evolve without duplicating the same interaction elsewhere.

A feature is UX-complete only after explicit UX review and manual preview testing.
