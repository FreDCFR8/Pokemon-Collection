# Phase 2T Collection Readiness Service

## Doel

Deze fase voegt een veilige collection readiness service toe. Na een actieve Supabase login controleert de app eerst het eigen app-profiel en leest daarna alleen de collecties die aan dat profiel gekoppeld zijn.

## Flow: session → profile → collections

1. De bestaande profile readiness flow controleert de Supabase browserconfiguratie en actieve sessie.
2. De app zoekt het eigen profiel via de bestaande veilige profielcontrole.
3. Alleen als een profiel bestaat, maakt de collection readiness service een Supabase browser client aan.
4. De service leest uitsluitend `public.collections` met `profile_id = profile.id`.
5. De UI toont de status, alle gevonden collection namen met type, en of er een hoofdcollectie bestaat.

## Waarom `profile.id` gebruikt wordt

Collecties zijn app-data en zijn gekoppeld aan het app-profiel. Daarom filtert de query op `profile.id` via `profile_id`. De service gebruikt bewust niet `auth_user_id` voor collection lookup, omdat `auth_user_id` alleen de Supabase auth-gebruiker identificeert en niet de app-profielrelatie in `public.collections`.

## RLS-vertrouwen

De service doet geen parent/admin bypass en gebruikt alleen de browserclient van de ingelogde gebruiker. Toegang tot rijen blijft daarmee afhankelijk van de bestaande Row Level Security policies in Supabase.

## Wat wel geladen wordt

- Actieve Supabase sessiestatus via de bestaande profile readiness flow.
- Eigen app-profiel via de bestaande profile readiness flow.
- `public.collections` kolommen: `id`, `profile_id`, `name`, `type`, `created_at`, `updated_at`.

## Wat bewust niet geladen wordt

- Geen kaarten.
- Geen `cards_catalog` query.
- Geen `collection_cards` query.
- Geen `public.cards` query.
- Geen import of runtime legacy data.
- Geen writes, inserts, updates of deletes.
- Geen SQL, migration of RLS-wijziging.
- Geen Binder-, wishlist-, AI-, GitHub Actions- of Vercel-workflow wijziging.

## Acceptatiecriteria

- `npm run build` slaagt.
- Zonder login toont de kaart `signed-out`.
- Na login met Lars toont de kaart Lars hoofdcollectie.
- Na login met Lore toont de kaart Lore hoofdcollectie.
- Als een hoofdcollectie ontbreekt toont de kaart `collection-missing`.
- Er is geen query naar `cards_catalog`, `collection_cards` of `public.cards`.
- Er zijn geen writes, SQL/migrations, RLS-wijzigingen of runtime legacy imports.

## Volgende fase voorstel

Een volgende fase kan read-only kaartkoppelingen ontwerpen voor `collection_cards` en `cards_catalog`, zonder terug te vallen op legacy `public.cards` en zonder writes toe te voegen.
