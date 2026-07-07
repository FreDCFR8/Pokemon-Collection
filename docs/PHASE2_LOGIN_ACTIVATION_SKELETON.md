# Phase 2J — Login Activation Skeleton

## Doel

Deze fase voegt een login activation skeleton toe voor de bestaande username + password loginvoorbereiding. De skeleton bereidt lokaal voor welke bekende kind-gebruikersnaam later aan een verborgen Supabase Auth-target gekoppeld kan worden.

## Wat de skeleton doet

- Normaliseert een ingevoerde gebruikersnaam lokaal door whitespace te trimmen en lowercase te gebruiken.
- Herkent voorlopig alleen de bekende kind-gebruikersnamen `lars` en `lore`.
- Lost een bekende gebruikersnaam lokaal op naar een intern auth-target object.
- Geeft aan de login action boundary door of een auth-target voorbereid is.
- Laat de LoginPanel UI zien of het auth-target voorbereid of niet voorbereid is.

## Lokale username mapping

De username mapping is volledig lokaal voorbereid. De mapping koppelt per bekende kind-gebruikersnaam aan een verborgen pseudo-email die later als Supabase Auth-loginidentifier gebruikt kan worden.

De verborgen pseudo-email is alleen bedoeld als interne technische mapping. De UI toont deze waarde niet en de login action boundary gebruikt deze waarde nog niet om een echte login uit te voeren.

## Geen echte login-call

Deze fase activeert nog geen Supabase Auth-login. Er is dus geen call naar `signInWithPassword`, geen sign-up call, geen password reset call en geen sessie- of tokenverwerking.

## Geen data ophalen of schrijven

De skeleton haalt geen profielgegevens op, haalt geen collectiegegevens op en schrijft niets weg. Er zijn ook geen database migrations, RLS-wijzigingen, GitHub Actions-wijzigingen of Vercel workflow-wijzigingen in deze fase.

## RLS-impact

RLS wordt nog niet geraakt. Omdat er geen echte Supabase Auth-login en geen databasequery wordt uitgevoerd, verandert deze skeleton niets aan de huidige database- of toegangsregels.

## Acceptatiecriteria

- Een lege of incomplete username + password invoer blijft lokaal falen met de bestaande validatieboodschappen.
- Een onbekende gebruikersnaam met wachtwoord faalt lokaal met de melding dat de gebruikersnaam nog niet voorbereid is voor login.
- `lars` en `lore` worden lokaal herkend, ook wanneer de invoer hoofdletters of extra whitespace bevat.
- Een bekende gebruikersnaam met wachtwoord levert `ready_for_later`, `resolvedUsername` en `authTargetPrepared: true` op.
- De UI toont `Auth-target: Voorbereid` of `Auth-target: Niet voorbereid`.
- Het verborgen auth e-mailadres wordt nergens in de UI getoond.
- De UI blijft tonen dat de login-call niet uitgevoerd is, profieldata niet geladen is en collectiegegevens niet geladen zijn.
- Er wordt geen Supabase Auth-call, database read of database write uitgevoerd.
