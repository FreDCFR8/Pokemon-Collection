# Phase 2M — Profile Schema Design

## 1. Doel

Na een succesvolle login moet de app veilig kunnen bepalen welk app-profiel bij de ingelogde gebruiker hoort. Supabase Auth levert daarbij alleen de sessie en de betrouwbare `auth.uid()`-waarde.

De toekomstige `profiles`-tabel koppelt `auth.uid()` aan een applicatierol en, indien van toepassing, aan een kindprofiel. Profielen zijn nodig voordat collectiegegevens getoond mogen worden, omdat de app eerst moet weten welk profiel en welke expliciete rechten bij de sessie horen.

## 2. Huidige status

- Supabase login werkt gecontroleerd via username voor bekende gebruikers.
- De login gebruikt intern een hidden auth email.
- De hidden auth email wordt niet getoond aan de gebruiker.
- Er is nog geen `profiles`-tabel.
- Er is nog geen profile readiness-status.
- Er wordt nog geen profieldata geladen.
- Er wordt nog geen collectiegegevens geladen.

## 3. Conceptueel datamodel

Toekomstige tabel: `profiles`

| Kolom | Type | Constraints / betekenis |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `auth_user_id` | `uuid` | `not null unique`; verwijst conceptueel naar Supabase Auth user |
| `username` | `text` | `not null unique`; app-loginnaam / herkenbare profielnaam |
| `display_name` | `text` | `not null`; naam die in de app getoond mag worden |
| `role` | `text` | `not null`; applicatierol |
| `child_key` | `text` | `null` toegestaan; kindprofiel-sleutel indien rol `child` |
| `created_at` | `timestamptz` | `not null default now()` |
| `updated_at` | `timestamptz` | `not null default now()` |

### Rollen

- `parent`
- `child`

### Child keys

- `lars`
- `lore`
- `null` voor `parent`

## 4. Verwachte eerste records

De eerste records worden conceptueel als volgt verwacht. Er worden in deze fase geen echte UUIDs ingevuld.

### Lars

- `auth_user_id`: verwijst naar de Supabase Auth user van Lars
- `username`: `lars`
- `display_name`: `Lars`
- `role`: `child`
- `child_key`: `lars`

### Lore

- `auth_user_id`: verwijst naar de Supabase Auth user van Lore
- `username`: `lore`
- `display_name`: `Lore`
- `role`: `child`
- `child_key`: `lore`

### Parent

- `auth_user_id`: later te bepalen
- `username`: later te bepalen
- `display_name`: later te bepalen
- `role`: `parent`
- `child_key`: `null`

## 5. Security regels

- `auth.uid()` is de security boundary.
- `username` is geen security boundary.
- `child_key` is geen security boundary op zichzelf.
- Client-side profielkeuze mag geen toegang bepalen.
- RLS moet gebaseerd zijn op `auth.uid()` en expliciete profielrechten.
- De bestaande `public.cards` policies zijn niet veilig als eindoplossing.
- De legacy `cards.collection` waarde mag niet als securitybron gebruikt worden.

De app mag collectiegegevens pas laden nadat server-side beveiliging en RLS duidelijk koppelen welke gebruiker welk profiel en welke collectie mag lezen. Een username of client-side selectie is daarvoor onvoldoende, omdat die waarden door de client beïnvloedbaar of niet-authentiek genoeg zijn.

## 6. Profile readiness flow

Toekomstige flow:

1. User logt in via Supabase Auth.
2. App heeft een Supabase session/user.
3. App vraagt één profiel op waar `profiles.auth_user_id = auth.uid()`.
4. Als het profiel bestaat:
   - toon profile ready;
   - toon `display_name`;
   - toon `role`;
   - toon `child_key` indien `role` gelijk is aan `child`.
5. Als het profiel ontbreekt:
   - toon profiel niet gekoppeld;
   - laad geen collectiegegevens.

## 7. Toekomstige RLS-richting

Deze fase bevat nog geen SQL en geen RLS-wijzigingen. Dit is alleen een ontwerp-richting.

### Profiles read policy

Een gebruiker mag alleen het eigen profiel lezen via `auth.uid()`. Conceptueel betekent dit dat een profiel leesbaar is wanneer de ingelogde Supabase Auth user overeenkomt met `profiles.auth_user_id`.

### Parent access

Parent-toegang moet later expliciet ontworpen worden. Daarbij moet duidelijk worden vastgelegd welke parent welk kindprofiel of welke collectiegegevens mag zien, zonder te vertrouwen op client-side keuzes.

### Cards access

Cards access mag pas na herontwerp worden toegevoegd. De app mag niet rechtstreeks vertrouwen op een vrije `collection` text-waarde. De oude `cards`-tabel moet eerst veilig gekoppeld worden aan een ownership- of profielmodel voordat collectiegegevens geladen of getoond mogen worden.

## 8. Niet in scope

Deze fase bevat expliciet niet:

- geen migration;
- geen RLS wijziging;
- geen profile query;
- geen collectie query;
- geen cards access;
- geen writes;
- geen admin dashboard;
- geen runtime code wijziging;
- geen Supabase query;
- geen SQL uitvoeren;
- geen GitHub Actions wijziging;
- geen Vercel workflow wijziging;
- geen AI;
- geen Binder;
- geen legacy-code wijziging.

## 9. Acceptatiecriteria voor deze fase

- Het document beschrijft het toekomstige `profiles` schema.
- Het document beschrijft de rollen `parent` en `child`.
- Het document beschrijft Lars, Lore en parent conceptueel.
- Het document beschrijft dat `auth.uid()` de security boundary is.
- Het document beschrijft waarom collectiegegevens nog niet geladen mogen worden.
- Er is geen runtime code gewijzigd.
- Er is geen SQL of migration toegevoegd.

## 10. Volgende fase voorstel

**Phase 2N — Profile Schema Migration Plan**

Doel: een concrete SQL-migration voorbereiden voor `profiles`, maar nog niet automatisch uitvoeren.
