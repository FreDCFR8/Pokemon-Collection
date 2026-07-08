# Phase 2R — Collection Schema Migration Plan

## 1. Doel

Deze fase bereidt een concreet SQL-plan voor voor de nieuwe collectie-architectuur met `collections`, `cards_catalog` en `collection_cards`.

De SQL in dit document is bedoeld om later handmatig uit te voeren in de Supabase SQL Editor. Er wordt in deze fase niets automatisch uitgevoerd, er wordt geen migration-runner gebruikt en Codex voert geen SQL uit.

De app laadt nog geen collectiegegevens. `public.cards` blijft onaangeraakt en blijft uitsluitend legacy/importbron, niet de nieuwe source of truth.

## 2. Voorwaarden

Voordat dit plan handmatig wordt uitgevoerd, gelden deze voorwaarden:

- `public.profiles` bestaat al in Supabase.
- `public.profiles` bevat profielen voor Lars en Lore.
- RLS op `public.profiles` is actief.
- Auth/profile readiness werkt: de app kan na login het eigen profiel lezen.
- `public.cards` blijft legacy en wordt in deze fase niet gebruikt als nieuwe bron.
- Er vindt in deze fase geen echte data-import plaats.

## 3. SQL migration draft

> Let op: onderstaande SQL is een draft voor handmatige uitvoering later. Voer deze SQL niet automatisch uit vanuit de app, Codex, CI of een deployment workflow.

### A. `collections`

```sql
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type text not null default 'main',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint collections_type_check
    check (type in ('main', 'wishlist', 'trade', 'binder', 'custom')),

  constraint collections_profile_name_unique
    unique (profile_id, name)
);
```

### B. `cards_catalog`

```sql
create table public.cards_catalog (
  id uuid primary key default gen_random_uuid(),
  external_source text null,
  external_id text null,
  pokemon text not null,
  set_name text null,
  number text null,
  rarity text null,
  image_small text null,
  image_large text null,
  cardmarket_url text null,
  tcgplayer_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cards_catalog_external_unique
    unique (external_source, external_id)
);
```

Belangrijk:

- `external_source` en `external_id` mogen `null` zijn voor manuele records of latere legacy-importrecords.
- Een unieke constraint op nullable kolommen laat in Postgres meerdere `null`-combinaties toe.
- Later kunnen we dit verfijnen met partial unique indexes indien nodig.

### C. `collection_cards`

```sql
create table public.collection_cards (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  card_catalog_id uuid not null references public.cards_catalog(id) on delete restrict,
  quantity integer not null default 1,
  condition text null,
  status text not null default 'owned',
  added_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint collection_cards_quantity_check
    check (quantity > 0),

  constraint collection_cards_status_check
    check (status in ('owned', 'wishlist', 'trade', 'missing')),

  constraint collection_cards_collection_card_unique
    unique (collection_id, card_catalog_id, condition, status)
);
```

Belangrijk:

- `quantity` hoort hier omdat bezit per collectie verschilt.
- `condition` en `status` horen hier omdat ze per profiel/collectie verschillen.
- De unique constraint voorkomt dubbele rijen voor dezelfde kaart/status/conditie binnen één collectie.
- Als `condition` `null` is, laat Postgres meerdere `null`-combinaties toe; later kan dit eventueel met een partial unique index worden herzien.

## 4. Indexen

```sql
create index collections_profile_id_idx on public.collections (profile_id);
create index collections_type_idx on public.collections (type);

create index cards_catalog_pokemon_idx on public.cards_catalog (pokemon);
create index cards_catalog_set_name_idx on public.cards_catalog (set_name);
create index cards_catalog_external_idx on public.cards_catalog (external_source, external_id);

create index collection_cards_collection_id_idx on public.collection_cards (collection_id);
create index collection_cards_card_catalog_id_idx on public.collection_cards (card_catalog_id);
create index collection_cards_status_idx on public.collection_cards (status);
```

Deze indexes ondersteunen toekomstige read-only collection views. Performance wordt pas later gemeten op basis van echte queries en data. Indexes zijn geen security boundary; toegang blijft bepaald door RLS policies en Supabase Auth.

## 5. `updated_at` trigger plan

Gebruik de bestaande generieke functie uit Phase 2N indien aanwezig:

```sql
create trigger collections_set_updated_at
before update on public.collections
for each row
execute function public.set_updated_at();

create trigger cards_catalog_set_updated_at
before update on public.cards_catalog
for each row
execute function public.set_updated_at();

create trigger collection_cards_set_updated_at
before update on public.collection_cards
for each row
execute function public.set_updated_at();
```

`public.set_updated_at()` werd eerder voorbereid/gebruikt bij `profiles`. Controleer vóór handmatige uitvoering of deze functie bestaat. Als de functie niet bestaat, maak die dan eerst aan volgens het eerdere migration plan voor `profiles`.

## 6. RLS draft

Nog niet uitvoeren vanuit deze repository of app. Dit is alleen een SQL draft voor latere handmatige uitvoering.

### A. Enable RLS

```sql
alter table public.collections enable row level security;
alter table public.cards_catalog enable row level security;
alter table public.collection_cards enable row level security;
```

### B. `collections` select own

```sql
create policy "collections_select_own"
on public.collections
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = collections.profile_id
      and p.auth_user_id = auth.uid()
  )
);
```

### C. `collection_cards` select through own collection

```sql
create policy "collection_cards_select_own_collection"
on public.collection_cards
for select
to authenticated
using (
  exists (
    select 1
    from public.collections c
    join public.profiles p on p.id = c.profile_id
    where c.id = collection_cards.collection_id
      and p.auth_user_id = auth.uid()
  )
);
```

### D. `cards_catalog` read-only authenticated

```sql
create policy "cards_catalog_select_authenticated"
on public.cards_catalog
for select
to authenticated
using (true);
```

Belangrijk:

- Child users mogen geen `insert`, `update` of `delete` uitvoeren via de app.
- `cards_catalog` is referentiedata.
- Write policies worden bewust niet toegevoegd.
- Parent/admin policies komen later.
- Service role of beheer via het Supabase dashboard kan beheer doen buiten app-policy om.

## 7. Seed plan voor hoofdcollecties

Template zonder echte UUIDs:

```sql
insert into public.collections (
  profile_id,
  name,
  type
)
values
  ('<LARS_PROFILE_ID>', 'Lars hoofdcollectie', 'main'),
  ('<LORE_PROFILE_ID>', 'Lore hoofdcollectie', 'main');
```

Belangrijk:

- `profile_id` is het `id` uit `public.profiles`, niet `auth_user_id`.
- Vervang placeholders alleen lokaal in de Supabase SQL Editor.
- Commit geen echte profile UUIDs naar GitHub.
- Plak geen echte profile UUIDs in ChatGPT.
- Er is nog geen `cards_catalog` seed.
- Er is nog geen `collection_cards` seed.
- Er is in deze fase geen import uit `public.cards`.

## 8. Verification queries

Read-only queries na handmatige uitvoering:

```sql
select id, profile_id, name, type, created_at, updated_at
from public.collections
order by name;
```

```sql
select id, external_source, external_id, pokemon, set_name, number, rarity
from public.cards_catalog
order by pokemon
limit 20;
```

```sql
select id, collection_id, card_catalog_id, quantity, condition, status, added_at
from public.collection_cards
order by added_at desc
limit 20;
```

Ownership-controle:

```sql
select c.id, c.name, c.type, p.username, p.child_key
from public.collections c
join public.profiles p on p.id = c.profile_id
order by p.username, c.name;
```

`cards_catalog` en `collection_cards` zullen in deze fase normaal leeg zijn. `collections` zou na de seed de hoofdcollecties voor Lars en Lore moeten tonen. App-level verification komt later.

## 9. Rollback plan

Gebruik alleen indien rollback nodig is, in deze veilige volgorde:

```sql
drop policy if exists "collection_cards_select_own_collection" on public.collection_cards;
drop policy if exists "cards_catalog_select_authenticated" on public.cards_catalog;
drop policy if exists "collections_select_own" on public.collections;

drop trigger if exists collection_cards_set_updated_at on public.collection_cards;
drop trigger if exists cards_catalog_set_updated_at on public.cards_catalog;
drop trigger if exists collections_set_updated_at on public.collections;

drop table if exists public.collection_cards;
drop table if exists public.collections;
drop table if exists public.cards_catalog;
```

Belangrijk:

- `drop table` verwijdert data.
- Gebruik dit alleen vóór echte productiegegevens belangrijk zijn.
- De volgorde respecteert foreign keys.
- Drop `public.set_updated_at()` niet, omdat die door `profiles` gebruikt kan worden.

## 10. Manual execution checklist

- [ ] Confirm Supabase project.
- [ ] Confirm `public.profiles` bestaat.
- [ ] Confirm Lars/Lore profiles bestaan.
- [ ] Copy Lars profile id uit `public.profiles`.
- [ ] Copy Lore profile id uit `public.profiles`.
- [ ] Execute create table `collections`.
- [ ] Execute create table `cards_catalog`.
- [ ] Execute create table `collection_cards`.
- [ ] Execute indexes.
- [ ] Confirm `public.set_updated_at()` exists.
- [ ] Execute triggers.
- [ ] Enable RLS + select policies.
- [ ] Replace profile placeholders locally in SQL Editor only.
- [ ] Execute collections seed.
- [ ] Run verification queries.
- [ ] Do not paste UUIDs back into GitHub/ChatGPT.
- [ ] Do not import `public.cards` yet.

## 11. Niet in scope

Expliciet niet in scope voor deze fase:

- Geen runtime code.
- Geen app query.
- Geen SQL execution door Codex.
- Geen automatische migration.
- Geen `public.cards` import.
- Geen `cards_catalog` seed.
- Geen `collection_cards` seed.
- Geen writes vanuit app.
- Geen parent/admin policies.
- Geen binder/wishlist implementatie.
- Geen pricing.
- Geen scanner.
- Geen AI.

## 12. Acceptatiecriteria

- SQL plan is compleet.
- `collections` SQL aanwezig.
- `cards_catalog` SQL aanwezig.
- `collection_cards` SQL aanwezig.
- RLS ontwerp aanwezig.
- Seed template gebruikt placeholders.
- Geen echte UUIDs aanwezig.
- Rollback aanwezig.
- Manual checklist aanwezig.
- Geen runtime code gewijzigd.
- Geen SQL automatisch uitgevoerd.
- Geen app-query toegevoegd.

## 13. Volgende fase voorstel

### Phase 2S — Manual Collection Schema Execution

Doel: SQL manueel uitvoeren in Supabase en daarna output controleren.
