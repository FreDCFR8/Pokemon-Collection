# Phase 3C — Collection Page UX Polish

## Doel

Phase 3C verfijnt uitsluitend de bestaande read-only Collection page. Deze clean retry vervangt de eerdere niet-proper mergebare poging en laat App shell, navigatie en Pokédex ongemoeid.

## Scope

- Verbeterde collection summary met totaal, zichtbaar bereik, pagina en vaste page size.
- Paginatie staat boven én onder de kaartlijst.
- Ontbrekende kaartafbeeldingen tonen netjes `Geen afbeelding`.
- Kaarten hebben een rustigere visuele stijl met subtiele borders, schaduw en afgeronde meta-badges.
- Een subtiele legacy-note verduidelijkt dat de collectie read-only blijft.
- `img loading="lazy"` blijft behouden.
- De bestaande page size blijft exact 24 via `COLLECTION_PAGE_SIZE`.

## Niet gewijzigd

- Geen `src/App.tsx` wijziging.
- Geen navigatiewijziging.
- Geen Pokédex-wijziging.
- Geen nieuwe Supabase query of runtime query naar `public.cards`.
- Geen database-, SQL- of RLS-wijziging.
- Geen insert, update, delete of upsert.
- Geen search/filter/sort UI.
- Geen add/edit/delete, binder, wishlist, pricing, Pokémon TCG API, AI, localStorage of cache.

## Controle

- `npm run build`
- `rg -n "insert\\(|update\\(|delete\\(|upsert\\(|\\.from\\('cards'\\)|\\.from\\(\"cards\"\\)" src docs package.json`

## Rollback

Revert deze phase om terug te keren naar de Phase 3B Collection page zonder de App shell, navigatie of Pokédex te raken.
