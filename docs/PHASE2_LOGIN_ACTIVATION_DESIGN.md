# Phase 2I Login Activation Design

## Status

Ontwerpdocument voor toekomstige login-activatie.

Dit document wijzigt geen runtimegedrag, voert geen databasewijzigingen uit en activeert geen echte login-call.

## 1. Doel

Het doel van deze fase is het ontwerp vastleggen voor een kindvriendelijke login met gebruikersnaam en wachtwoord.

- Kinderen loggen later in met een herkenbare gebruikersnaam en wachtwoord.
- Kinderen zien geen e-mailadres in de UI.
- Een parent/admin-flow kan later apart ontworpen worden.
- Supabase Auth blijft bedoeld als bron voor sessie en identiteit zodra echte login geactiveerd wordt.

## 2. Huidige status

De huidige codebasis bevat al voorbereiding voor auth en login, maar nog geen actieve productie-login.

- Supabase client boundary bestaat.
- Auth readiness check bestaat.
- Login UI bestaat.
- Login action boundary bestaat.
- `prepareLoginAction()` bestaat als voorbereiding op een toekomstige login-actie.
- Er is nog geen echte login-call.

## 3. Gewenst loginmodel

Het gewenste model voor de app is:

1. De UI vraagt om `username` en `password`.
2. De app vertaalt `username` later intern naar een auth-doel dat Supabase Auth kan gebruiken.
3. Supabase Auth maakt daarna de sessie aan.
4. Pas na een geldige sessie bepaalt de app welk profiel, welke rol en welke data bij de gebruiker horen.

Belangrijke uitgangspunten:

- Profielkeuze mag niet onveilig client-side plaatsvinden.
- Een vrij ingevoerde username mag nooit bepalen welke collectie zichtbaar is.
- Lars en Lore moeten aparte profielen/accounts blijven.
- Een parent/admin-account mag niet impliciet dezelfde rechten krijgen als een child-account zonder expliciet ontwerp.

## 4. Supabase Auth mapping-opties

### Optie A — Verborgen pseudo-email per kind

Bij deze optie krijgt ieder kind een eigen Supabase Auth-gebruiker met een intern e-mailadres, bijvoorbeeld:

- `lars@internal.local`
- `lore@internal.local`

De LoginPanel blijft `username` en `password` tonen. De toekomstige login boundary of service vertaalt de username intern naar de pseudo-email en gebruikt die voor Supabase Auth.

| Aspect | Beoordeling |
| --- | --- |
| Veiligheid | Goed, zolang RLS uitsluitend vertrouwt op `auth.uid()` en niet op de zichtbare username. |
| Eenvoud | Hoog; Supabase Auth kan standaard e-mail/wachtwoord blijven gebruiken. |
| Kindvriendelijkheid | Hoog; kinderen zien alleen username + password. |
| Risico op accountverwarring | Laag tot middel; mapping moet eenduidig zijn en usernames moeten uniek blijven. |
| Impact op RLS | Beperkt; policies kunnen gebaseerd blijven op `auth.uid()` en gekoppelde profielen. |
| Schaalbaarheid | Goed voor dit project; bij veel gebruikers is beheer van interne e-mails en uniqueness belangrijk. |

### Optie B — Parent-owned login met child profile switch na auth

Bij deze optie logt een ouder in met één Supabase Auth-account. Na login kiest de app welk child-profiel actief is.

| Aspect | Beoordeling |
| --- | --- |
| Veiligheid | Kan veilig zijn als profile switching server-side of via strikte RLS/profielrechten wordt afgedwongen. Onveilig als de client vrij een child-profiel mag kiezen. |
| Eenvoud | Middel; één login is eenvoudig, maar profielrechten en switching moeten zorgvuldig ontworpen worden. |
| Kindvriendelijkheid | Middel; kinderen kunnen mogelijk afhankelijk zijn van parent-login of extra profielkeuze. |
| Risico op accountverwarring | Middel tot hoog; dezelfde sessie kan meerdere profielen bedienen. |
| Impact op RLS | Groter; RLS moet parent-to-child-relaties expliciet modelleren. |
| Schaalbaarheid | Goed voor gezinnen, maar complexer bij meerdere rollen, gedeelde devices en auditbaarheid. |

### Optie C — Custom username mapping table vóór auth

Bij deze optie staat er een eigen mappingtabel die vóór Supabase Auth bepaalt welk auth-doel bij een username hoort.

| Aspect | Beoordeling |
| --- | --- |
| Veiligheid | Alleen veilig als de mapping lookup geen gevoelige informatie lekt en niet client-side manipuleerbaar is. |
| Eenvoud | Laag tot middel; er is extra server-side logica of een veilige boundary nodig vóór auth. |
| Kindvriendelijkheid | Hoog; de UI kan volledig username-gebaseerd blijven. |
| Risico op accountverwarring | Laag als username uniqueness en mapping goed worden afgedwongen; hoger bij zwakke beheerprocessen. |
| Impact op RLS | Indirect; na auth moet RLS nog steeds op `auth.uid()` gebaseerd blijven. |
| Schaalbaarheid | Hoog bij goed ontwerp, maar complexer voor beheer, rate limiting en enumeration-preventie. |

## 5. Aanbevolen keuze voor dit project

Voorlopige keuze voor dit project:

**Optie A — verborgen pseudo-email per kind voor Supabase Auth, gecombineerd met een toekomstige `profiles`-tabel.**

Redenen:

- Kinderen loggen in met een eenvoudige username en password.
- De app kan later intern een `username -> auth email` mapping maken binnen de login action boundary of een login service.
- Supabase Auth blijft de bron voor sessie, token en `auth.uid()`.
- Een toekomstige `profiles`-tabel bepaalt app-profiel, rol en eigenaar.
- RLS blijft gebaseerd op `auth.uid()` en gekoppelde profielrechten, niet op een zichtbare username.
- Lars en Lore kunnen aparte Supabase Auth-users en aparte profielen houden.

Deze keuze activeert nog geen echte login-call. Het is alleen een ontwerpbesluit voor een toekomstige implementatiefase.

## 6. Toekomstige tabellen, alleen ontwerp

Een toekomstige `profiles`-tabel kan conceptueel de volgende velden bevatten:

```txt
profiles
- id
- auth_user_id
- username
- display_name
- role: parent | child
- child_key: lars | lore | null
- created_at
```

Conceptuele betekenis:

- `id`: primaire sleutel van het app-profiel.
- `auth_user_id`: verwijzing naar de Supabase Auth-user.
- `username`: kindvriendelijke naam voor login en herkenning in de app.
- `display_name`: naam die de app mag tonen.
- `role`: onderscheid tussen `parent` en `child`.
- `child_key`: optionele stabiele sleutel voor bekende child-profielen zoals `lars` of `lore`.
- `created_at`: aanmaakdatum van het profiel.

Er wordt in deze fase geen SQL uitgevoerd, geen migration toegevoegd en geen databasewijziging gedaan.

## 7. Veiligheidsregels

- `username` is geen security boundary.
- `auth.uid()` is de security boundary.
- RLS mag nooit vertrouwen op een vrije client-side username.
- Child data mag alleen zichtbaar worden via gekoppelde `auth_user_id` en expliciet ontworpen profielrechten.
- Parent/admin-rechten moeten expliciet ontworpen worden voordat ze gebruikt worden.
- Login mag geen collectiegegevens ophalen.
- Login mag geen writes uitvoeren.
- Legacy tabellen, waaronder een eventuele `cards`-table, mogen niet als security-bron gebruikt worden.

## 8. Acceptatiecriteria voor toekomstige login-activatie

Een toekomstige login-activatie is pas acceptabel als aan deze criteria wordt voldaan:

- LoginPanel gebruikt `username` + `password`.
- De echte login-call zit alleen in de login action boundary of een expliciete login service.
- Er worden geen collectiegegevens geladen tijdens login zelf.
- Pas na een geldige sessie volgt profile readiness.
- De legacy `cards`-table wordt niet gebruikt voor security.
- Er gebeuren geen writes tijdens login.
- RLS en datatoegang blijven gebaseerd op `auth.uid()` en expliciete profielrechten.

## 9. Volgende fase voorstel

### Phase 2J — Login Activation Skeleton

Doel: code voorbereiden voor username mapping, maar nog zonder echte productie-login.

Mogelijke scope voor Phase 2J:

- Een duidelijke interface ontwerpen voor username mapping.
- De login action boundary voorbereiden op een toekomstige auth-service.
- Testbare placeholders toevoegen zonder Supabase `signInWithPassword` te activeren.
- Documenteren welke configuratie nodig is voor pseudo-emails en profielen.

Niet in scope voor Phase 2J, tenzij later expliciet goedgekeurd:

- Echte productie-login.
- Supabase `signInWithPassword`.
- Sign-up.
- Password reset.
- Profielgegevens ophalen uit productie.
- Collectiegegevens ophalen.
- Writes of database migrations.
