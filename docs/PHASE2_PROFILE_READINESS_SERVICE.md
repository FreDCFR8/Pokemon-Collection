# Phase 2P — Profile Readiness Service

## Doel

Deze fase voegt een kleine profile readiness service toe die na een actieve Supabase Auth-sessie het eigen app-profiel ophaalt uit `public.profiles`. De UI toont daarmee of de ingelogde gebruiker klaar is voor profielgebonden app-functionaliteit.

## Flow

1. De browser maakt alleen gebruik van de bestaande publieke Supabase browser client boundary.
2. De service controleert de actieve Supabase sessie via `supabase.auth.getSession()`.
3. Bij een actieve sessie gebruikt de service `session.user.id` als app-equivalent van `auth.uid()`.
4. De service leest exact één record uit `public.profiles` met:
   - `select('id, auth_user_id, username, display_name, role, child_key')`
   - `eq('auth_user_id', session.user.id)`
   - `maybeSingle()`
5. De uitkomst wordt vertaald naar één profile readiness status:
   - `config-missing`
   - `signed-out`
   - `profile-ready`
   - `profile-missing`
   - `error`

## RLS

De service vertrouwt op de bestaande RLS-policy `profiles_select_own`. De browser gebruikt geen service role en vraagt geen profielen van andere gebruikers op. Supabase blijft verantwoordelijk voor het afdwingen dat authenticated users alleen hun eigen profiel kunnen lezen.

## Wat wordt getoond

De nieuwe `ProfileReadinessCard` toont:

- De actuele profile readiness status.
- Een duidelijke Nederlandse statusboodschap.
- Een veilige foutmelding als Supabase of configuratie faalt.
- Bij een gevonden profiel:
  - Display name
  - Username
  - Role
  - Child key

## Bewust niet geladen

Deze fase laadt bewust geen collectiegegevens en gebruikt de `cards` table niet. De service doet geen writes en bevat geen insert, update of delete. Er zijn ook geen database migrations, RLS-aanpassingen, parent/admin access, profile switcher, legacy-code, AI, Binder, GitHub Actions-wijzigingen of Vercel workflow-wijzigingen toegevoegd.

## Acceptatiecriteria

- `npm run build` slaagt.
- Zonder login toont de kaart `signed-out`.
- Na login met Lars kan de kaart het profiel van Lars tonen.
- Na login met Lore kan de kaart het profiel van Lore tonen.
- Als geen profiel gekoppeld is aan de Supabase gebruiker, toont de kaart `profile-missing`.
- Collectiegegevens blijven expliciet `Niet geladen`.
- De `cards` table blijft expliciet `Niet gebruikt`.
- De implementatie doet geen writes, migrations of RLS-wijzigingen.

## Volgende fase voorstel

Een volgende fase kan de gelezen profielstatus gebruiken als harde toegangspoort voor toekomstige kind-specifieke collectieviews. Die fase moet nog steeds eerst de gewenste collectie-RLS, ownership-regels en parent/admin-toegang expliciet ontwerpen voordat collectiegegevens worden geladen.
