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

## 9. Mobile and desktop

iPhone is the primary reference for user-facing development.

Desktop remains supported:

- dialogs should be centred and bounded;
- content should not stretch unnecessarily;
- hover is optional enhancement, never required interaction;
- keyboard and focus behavior must remain usable;
- desktop changes must not weaken the mobile flow.

## 10. Visual consistency

- Reuse spacing, radius, typography and status patterns.
- Avoid page-specific variants of the same ownership control.
- Cards remain the dominant visual element.
- Text hierarchy should be clear without excessive labels.
- Avoid permanent technical copy in product-facing screens.
- Prefer one reusable component over multiple near-identical detail designs after the shared behavior is understood.

## 11. UX review checklist

Before approving user-facing work, verify:

- the product goal is obvious;
- the mobile layout is calm and readable;
- primary actions are reachable and large enough;
- details are disclosed at the right level;
- status wording is consistent;
- loading, error and pending states are safe;
- accessibility behavior is present;
- iPhone testing is complete;
- desktop is checked when relevant;
- the design can evolve without duplicating the same interaction elsewhere.

A feature is UX-complete only after explicit UX review and manual preview testing.