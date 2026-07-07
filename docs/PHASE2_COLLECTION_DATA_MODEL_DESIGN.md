# Phase 2Q — Collection Data Model Design

## 1. Doel

Na de profile readiness-fase is het volgende blok een veilige collectiearchitectuur. De app kan inmiddels na Supabase Auth-login het eigen profiel lezen via `public.profiles`, maar collectiegegevens worden nog bewust niet geladen.

Deze fase ontwerpt daarom eerst het datamodel voordat collectiegegevens in de applicatie worden opgehaald. De nieuwe structuur moet meerdere jaren kunnen meegroeien met functies zoals hoofdcollecties, verlanglijsten, ruilkaarten, binders, duplicaten, pricing en scannerflows.

`public.cards` wordt niet gebruikt als nieuwe source of truth. Die tabel blijft voorlopig alleen bestaan als legacy tabel en mogelijke importbron voor een latere, gecontroleerde migratie.

## 2. Architectuurbeslissing

De gekozen richting is **optie B — een nieuwe collectie-structuur**.

Dit betekent:

- Nieuwe collectie-tabellen worden de definitieve basis voor collectiebeheer.
- `public.cards` blijft legacy/importbron.
- `public.cards` wordt niet uitgebreid als definitieve basis.
- Er komt in deze fase geen read-only appkoppeling naar legacy `cards`.

De nieuwe source of truth wordt conceptueel opgebouwd rond:

- `profiles`
- `collections`
- `cards_catalog`
- `collection_cards`

Deze keuze is nodig omdat kaartdefinitie en bezit verschillende concepten zijn. Een Pokémonkaart als algemene kaartdefinitie hoort één keer in een catalogus te staan, terwijl Lars en Lore ieder hun eigen bezit, aantallen, status en conditie kunnen hebben.

Lars/Lore ownership hoort niet in een vrije textkolom zoals een legacy `collection`-waarde. RLS moet kunnen steunen op formele profiel- en collectie-eigendom, niet op client-side gebruikersnamen, child keys of vrije tekst uit een importtabel.

Deze scheiding maakt toekomstige features eenvoudiger en veiliger:

- wishlist
- binder
- duplicates
- trade
- pricing
- scanner
- Pokémon TCG API metadata
- gecontroleerde importflows

## 3. Conceptueel model

### `profiles`

`profiles` bestaat al en bepaalt de app-gebruiker, rol en `child_key`.

Conceptuele verantwoordelijkheid:

- koppeling met Supabase Auth via de bestaande profielstructuur
- identificeren van Lars, Lore of toekomstige gebruikers
- vastleggen van rol, bijvoorbeeld child of later parent/admin
- basis voor collectie-eigendom

### `collections`

Conceptuele velden:

- `id`
- `profile_id`
- `name`
- `type`
- `created_at`
- `updated_at`

Doel:

- Eén profiel kan meerdere collecties hebben.
- Eerste collecties zijn waarschijnlijk:
  - Lars hoofdcollectie
  - Lore hoofdcollectie
- `type` kan later bijvoorbeeld zijn:
  - `main`
  - `wishlist`
  - `trade`
  - `binder`
  - `custom`

`collections` is de ownership-laag tussen een profiel en de kaarten die bij dat profiel horen.

### `cards_catalog`

Conceptuele velden:

- `id`
- `external_source`
- `external_id`
- `pokemon`
- `set_name`
- `number`
- `rarity`
- `image_small`
- `image_large`
- `cardmarket_url`
- `tcgplayer_url`
- `created_at`
- `updated_at`

Doel:

- Algemene kaartdefinitie vastleggen.
- Niet gekoppeld aan Lars of Lore.
- Eén kaartdefinitie kan in meerdere collecties voorkomen.
- Later uitbreidbaar met metadata uit bijvoorbeeld de Pokémon TCG API.

`cards_catalog` beschrijft wat een kaart is, niet wie de kaart bezit.

### `collection_cards`

Conceptuele velden:

- `id`
- `collection_id`
- `card_catalog_id`
- `quantity`
- `condition`
- `status`
- `added_at`
- `created_at`
- `updated_at`

Doel:

- Koppelt bezit aan een collectie.
- Bevat kind-specifieke gegevens.
- `quantity`, `condition` en `status` horen hier omdat ze per collectie kunnen verschillen.
- `status` kan later bijvoorbeeld zijn:
  - `owned`
  - `wishlist`
  - `trade`
  - `missing`

`collection_cards` beschrijft dus de relatie tussen een collectie en een kaartdefinitie.

## 4. Relaties

De relaties zijn:

- `profiles` 1 → many `collections`
- `collections` 1 → many `collection_cards`
- `cards_catalog` 1 → many `collection_cards`

Concreet:

```text
Lars profile
→ Lars hoofdcollectie
→ collection_cards
→ cards_catalog
```

```text
Lore profile
→ Lore hoofdcollectie
→ collection_cards
→ cards_catalog
```

Hierdoor kunnen Lars en Lore dezelfde kaartdefinitie in `cards_catalog` delen, terwijl hun bezit, aantallen, conditie en status gescheiden blijven in hun eigen `collection_cards` records.

## 5. Security model

Het security model moet op server-afdwingbare eigendom steunen:

- `auth.uid()` bepaalt het toegestane profiel via `public.profiles`.
- `profile.id` bepaalt welke `collections` zichtbaar zijn.
- `collection_cards` zijn alleen zichtbaar via toegestane `collections`.
- `cards_catalog` is algemene referentiedata en kan later mogelijk read-only beschikbaar zijn voor publieke of authenticated reads.
- Client-side `child_key` of `username` mag geen security boundary zijn.
- Legacy `public.cards.collection` mag geen security boundary zijn.

De client mag dus niet zelf bepalen of een kaart bij Lars of Lore hoort. Die beslissing moet later via RLS en database-relaties afdwingbaar zijn.

## 6. RLS-richting

Deze fase bevat geen SQL en wijzigt geen RLS. Onderstaande punten zijn alleen ontwerp voor toekomstig beleid.

### `profiles`

- Een gebruiker mag het eigen profiel lezen.
- Het profiel blijft de brug tussen Supabase Auth en app-specifieke eigendom.

### `collections`

- Een child mag eigen `collections` lezen via `profile_id`.
- Parent access wordt later expliciet ontworpen en hoort niet impliciet in deze fase.

### `collection_cards`

- Records zijn leesbaar als de gebruiker toegang heeft tot de bijhorende `collection`.
- Toegang loopt dus via `collection_id` → `collections.profile_id` → `profiles.auth_user_id`.

### `cards_catalog`

- Read-only referentiedata.
- Insert/update later alleen via admin/import/service flow.
- Niet door gewone child users.

## 7. Legacy `public.cards`

`public.cards` blijft voorlopig onaangeraakt.

Afspraken:

- Geen app-query naar `public.cards`.
- Geen nieuwe features bouwen op `public.cards`.
- Geen uitbreiding van `public.cards` als definitieve architectuur.
- Een latere importfase kan `public.cards` gebruiken als bron.
- Import moet gecontroleerd, idempotent en rollbackbaar zijn.
- De legacy `collection` text uit `public.cards` is hoogstens een mapping-hint.
- De legacy `collection` text is geen securitybron.

Dit voorkomt dat oude data-structuren alsnog de basis worden voor nieuwe RLS- of ownershiplogica.

## 8. Eerste migratievolgorde, conceptueel

Voorgestelde toekomstige fases:

### Phase 2R — Collection Schema Migration Plan

SQL voorbereiden voor `collections`, `cards_catalog` en `collection_cards`, maar nog niet uitvoeren.

### Phase 2S — Manual Collection Schema Execution

De voorbereide SQL manueel uitvoeren in Supabase.

### Phase 2T — Initial Collection Seed Plan

Lars/Lore hoofdcollecties voorbereiden, nog zonder card import.

### Phase 2U — Legacy Cards Import Design

`public.cards` analyseren als importbron en mapping naar `cards_catalog` en `collection_cards` ontwerpen.

### Phase 2V — Read-only Collection Service

Pas in deze fase een app-query naar de nieuwe tabellen toevoegen.

## 9. Niet in scope

Expliciet niet in scope voor deze fase:

- geen SQL
- geen migration
- geen runtime code
- geen collection service
- geen cards query
- geen import
- geen writes
- geen RLS uitvoering
- geen parent/admin
- geen binder
- geen wishlist implementatie
- geen pricing
- geen scanner
- geen AI

## 10. Acceptatiecriteria

- Document legt optie B vast.
- Document beschrijft waarom `public.cards` legacy blijft.
- Document beschrijft `collections`, `cards_catalog` en `collection_cards`.
- Document beschrijft relaties.
- Document beschrijft security model.
- Document beschrijft RLS-richting.
- Document beschrijft toekomstige fases.
- Geen runtime code gewijzigd.
- Geen SQL/migration toegevoegd.
- Geen app-query toegevoegd.

## 11. Volgende fase voorstel

**Phase 2R — Collection Schema Migration Plan**

Doel: concrete SQL voorbereiden voor `collections`, `cards_catalog` en `collection_cards`, maar nog niet uitvoeren.
