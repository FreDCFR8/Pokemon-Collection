# Phase 2K — Auth Login Service Skeleton

## Doel

Deze fase voegt een Auth Login Service Skeleton toe tussen de bestaande login action boundary en de LoginPanel UI. De service maakt de toekomstige plek voor Supabase Auth-login expliciet, zonder nu al een echte login-call te activeren.

## Wat de service skeleton doet

- Ontvangt lokaal een `username` en `password` via `prepareAuthLogin`.
- Hergebruikt de bestaande `prepareLoginAction(input)` validatie en username mapping.
- Geeft validatiefouten ongewijzigd door als `failed` resultaat.
- Zet een succesvol voorbereide login action om naar een bewust `disabled` auth-service resultaat.
- Rapporteert expliciet `loginExecuted: false` bij elk resultaat.

## Echte Supabase login blijft disabled

De service importeert geen Supabase browser client en roept geen Supabase Auth API aan. De toekomstige plek voor `signInWithPassword` is hiermee architecturaal voorbereid, maar blijft bewust uitgeschakeld in deze fase.

Er wordt dus geen echte Supabase login-call, sign-up call, password reset call of sessieverwerking uitgevoerd.

## Login execution status

`loginExecuted` is in deze fase altijd `false`:

- bij ontbrekende invoer;
- bij een onbekende gebruikersnaam;
- bij een lokaal voorbereid auth-target voor `lars` of `lore`.

De LoginPanel UI blijft daarom tonen dat de login-call niet uitgevoerd is.

## Geen profieldata of collectiegegevens

De service skeleton haalt geen profielgegevens op en haalt geen collectiegegevens op. De LoginPanel UI blijft tonen:

- `Profieldata: Niet geladen`;
- `Collectiegegevens: Niet geladen`.

## Hidden auth email

De bestaande `hiddenAuthEmail` blijft beperkt tot de username auth mapping. De Auth Login Service Skeleton gebruikt deze waarde nog niet voor een auth-call en toont deze waarde nergens in de UI.

## Acceptatiecriteria

- `prepareAuthLogin(input)` gebruikt de bestaande `prepareLoginAction(input)`.
- Fouten uit `prepareLoginAction(input)` worden teruggegeven als `status: failed` met dezelfde `message` en `errorMessage`.
- Een lokaal voorbereide login action resulteert in `status: disabled`.
- Een lokaal voorbereide login action toont de melding: `Auth login service is voorbereid, maar echte Supabase login blijft uitgeschakeld in deze fase.`
- `authTargetPrepared` is `true` wanneer de bestaande login action klaar is voor later.
- `authTargetPrepared` is `false` wanneer de bestaande login action faalt zonder voorbereid target.
- `loginExecuted` is altijd `false`.
- Er wordt geen `createBrowserSupabaseClient` geïmporteerd.
- Er wordt geen Supabase client geïmporteerd.
- Er wordt nergens `signInWithPassword` aangeroepen.
- Er worden geen profielgegevens of collectiegegevens geladen.
- Er worden geen writes, migrations, RLS-wijzigingen, GitHub Actions-wijzigingen of Vercel workflow-wijzigingen toegevoegd.
