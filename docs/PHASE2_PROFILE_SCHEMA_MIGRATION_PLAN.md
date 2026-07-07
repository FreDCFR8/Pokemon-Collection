# Phase 2N — Profile Schema Migration Plan

## 1. Doel

Deze fase bereidt een concreet SQL-plan voor de toekomstige `public.profiles`-tabel voor.

- De SQL is bedoeld om later manueel uit te voeren in de Supabase SQL Editor.
- Er is in deze fase nog geen automatische execution.
- Er is in deze fase nog geen runtime integratie.
- De app mag nog geen profielgegevens of collectiegegevens laden.
- `auth.uid()` blijft de security boundary; `username` en `child_key` zijn geen security boundary.

## 2. Voorwaarden

Voor manuele uitvoering moeten de Supabase Auth users al bestaan:

- `lars@internal.local`
- `lore@internal.local`

De UUIDs van deze users moeten manueel worden opgezocht in Supabase via **Authentication > Users**.

Belangrijke voorwaarden:

- Commit geen echte Supabase Auth UUIDs naar de repo.
- Gebruik in dit document en in commits uitsluitend placeholders.
- Documenteer nooit passwords.
- Voer de seed pas uit nadat de Auth users en hun UUIDs handmatig zijn gecontroleerd.

## 3. SQL migration draft

> Niet automatisch uitvoeren. Kopieer dit later bewust naar de Supabase SQL Editor en controleer eerst project, Auth users en placeholders.

```sql
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  username text not null unique,
  display_name text not null,
  role text not null,
  child_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_role_check
    check (role in ('parent', 'child')),

  constraint profiles_child_key_check
    check (child_key is null or child_key in ('lars', 'lore')),

  constraint profiles_child_role_consistency_check
    check (
      (role = 'child' and child_key is not null)
      or
      (role = 'parent' and child_key is null)
    )
);
```

## 4. Indexen

```sql
create index profiles_auth_user_id_idx on public.profiles (auth_user_id);
create index profiles_child_key_idx on public.profiles (child_key);
create index profiles_role_idx on public.profiles (role);
```

Toelichting:

- De `unique` constraint op `auth_user_id` maakt technisch al een index aan.
- De expliciete `profiles_auth_user_id_idx` mag later eventueel worden herzien als deze dubbel of overbodig blijkt.
- `child_key` en `role` zijn handig voor toekomstige parent/admin flows.
- Deze indexen geven nog geen toegang en zijn geen security boundary.

## 5. `updated_at` trigger plan

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();
```

Toelichting:

- De functie is generiek en kan ook door andere tabellen worden gebruikt.
- Controleer vóór uitvoering of `public.set_updated_at()` al bestaat.
- Als de functie al bestaat, is `create or replace function` normaal oké, maar dit moet bewust gebeuren omdat bestaande trigger-functies daardoor kunnen worden aangepast.

## 6. RLS draft

```sql
alter table public.profiles enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = auth_user_id);
```

Toelichting:

- Ingelogde users mogen alleen hun eigen profiel lezen.
- De app mag profielen niet zelf schrijven.
- Voeg in deze fase geen `insert`, `update` of `delete` policies toe.
- Parent policies komen later en moeten expliciet worden ontworpen.
- De service role en het Supabase dashboard kunnen records beheren buiten deze app-policy om.
- `username` en `child_key` mogen niet als security boundary worden gebruikt.

## 7. Seed plan zonder echte UUIDs

```sql
insert into public.profiles (
  auth_user_id,
  username,
  display_name,
  role,
  child_key
)
values
  ('<LARS_AUTH_USER_UUID>', 'lars', 'Lars', 'child', 'lars'),
  ('<LORE_AUTH_USER_UUID>', 'lore', 'Lore', 'child', 'lore');
```

Belangrijk:

- Vervang de placeholders alleen lokaal in de Supabase SQL Editor vóór manuele uitvoering.
- Commit geen echte UUIDs naar GitHub.
- Plak geen echte UUIDs terug in ChatGPT of andere tooling.
- Het parent record komt later.
- Voer de seed niet uit zolang de UUIDs niet handmatig zijn gecontroleerd.

## 8. Verification queries

```sql
select id, auth_user_id, username, display_name, role, child_key, created_at, updated_at
from public.profiles
order by username;
```

```sql
select username, role, child_key
from public.profiles
where auth_user_id = auth.uid();
```

Toelichting:

- De eerste query is een algemene read-only controle van de aangemaakte records.
- De tweede query werkt alleen binnen een authenticated context of via een aangepaste testcontext.
- In de Supabase SQL Editor is `auth.uid()` mogelijk `null`, afhankelijk van de context waarin de query draait.
- App-level verification komt later en hoort niet bij deze fase.

## 9. Rollback plan

```sql
drop policy if exists "profiles_select_own" on public.profiles;
drop trigger if exists profiles_set_updated_at on public.profiles;
drop table if exists public.profiles;
```

Toelichting:

- `drop table` verwijdert alle `profiles` data.
- Gebruik dit alleen voordat productiegegevens belangrijk zijn.
- Na productiegebruik is later een migration-based rollback nodig in plaats van een simpele table drop.
- De generieke `public.set_updated_at()` functie wordt hier bewust niet gedropt, omdat die door andere tabellen gebruikt kan worden.

## 10. Manual execution checklist

- [ ] Confirm project.
- [ ] Confirm Auth users exist.
- [ ] Copy Lars UUID from Supabase Authentication > Users.
- [ ] Copy Lore UUID from Supabase Authentication > Users.
- [ ] Replace placeholders locally in SQL Editor only.
- [ ] Execute create table.
- [ ] Execute indexes.
- [ ] Execute trigger.
- [ ] Enable RLS + select policy.
- [ ] Execute seed.
- [ ] Run verification select.
- [ ] Do not paste UUIDs back into GitHub/ChatGPT.

## 11. Niet in scope

Deze fase bevat expliciet niet:

- geen app query;
- geen profile readiness UI;
- geen collection read;
- geen cards migration;
- geen parent profile;
- geen admin dashboard;
- geen actual execution door Codex;
- geen secrets of UUIDs in repo;
- geen runtime code wijziging;
- geen Supabase query vanuit de app;
- geen writes vanuit app-code;
- geen migration automatisch uitvoeren;
- geen RLS effectief wijzigen in productie;
- geen GitHub Actions wijziging;
- geen Vercel workflow wijziging;
- geen AI;
- geen Binder;
- geen legacy-code.

## 12. Acceptatiecriteria

- SQL plan is compleet.
- SQL gebruikt placeholders voor UUIDs.
- Geen echte UUIDs zijn aanwezig.
- RLS select-own policy is beschreven.
- Rollback is beschreven.
- Manual checklist is aanwezig.
- Geen runtime code is gewijzigd.
- Geen migration is automatisch uitgevoerd.

## 13. Volgende fase voorstel

**Phase 2O — Manual Profiles Migration Execution**

Doel: de SQL manueel uitvoeren in Supabase en daarna de output controleren.
