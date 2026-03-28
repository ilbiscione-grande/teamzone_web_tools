# Teknisk migrationsplan for klubb-, lag- och anvandarmodell i Supabase

## Syfte

Detta dokument kompletterar [KLUBB_LAG_ANVANDARE_MODELL.md](/c:/Dev/projects/tacticsboard/docs/KLUBB_LAG_ANVANDARE_MODELL.md) med en teknisk migrationsplan for Supabase.

Det beskriver:

- nuvarande schema och dess begransningar
- foreslaget framtida schema
- rekommenderade SQL-forandringar
- forslag pa RLS-riktning
- stegvis migrering av befintlig data
- hur appkoden bor fasas over
- hur den gemensamma domanen med Teamzone bor forhallla sig till taktiska board-overrides

## Nuvarande schema

Nuvarande teamrelaterade tabeller i [schema.sql](/c:/Dev/projects/tacticsboard/supabase/schema.sql) ar:

- `teams`
- `team_members`
- `team_squads`
- `team_players`
- `team_squad_players`

Nuvarande modell i praktiken:

- `teams.owner_id` definierar vem som ager laget
- `team_members` beskriver medlemskap pa teamniva men har idag bara enkel rollmodell
- `team_players` beskriver spelare i laget
- `team_squads` beskriver lagets squadmetadata
- `team_squad_players` kopplar spelare till lagets squad

## Problem i nuvarande schema

Nuvarande schema ar inte fel, men det ar optimerat for ett enklare personligt lagflode snarare an en riktig klubbmodell.

Begransningar:

- `teams.owner_id` gor laget beroende av en primar anvandare
- klubbniva saknas
- klubbroll, lagroll och position/funktion ar inte tydligt separerade
- `team_players` ar inte samma sak som anvandare eller lagmedlemmar
- det finns ingen tydlig modell for vardnadshavare, ledare eller flera typer av roller i samma lag
- adminrattigheter pa klubb- och lagniva ar inte explicit modellerade
- boarden arbetar fortfarande for mycket med projektlokala squadkopior i stallet for att tydligt referera till lagets grundtrupp

## Malbild for schema

Malet ar att ga mot fyra primara tabeller:

- `clubs`
- `club_members`
- `teams`
- `team_members`

Pa sikt bor `team_members` vara primar sanningskalla for alla personer i laget.

Taktiklagret bor ovanpa detta ga mot:

- `projects`
- `boards`
- `board_team_selections`
- `board_player_overrides`

## Rekommenderad slutmodell

### 1. `clubs`

```sql
create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  logo_url text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  primary_admin_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Rekommenderade index:

```sql
create index if not exists clubs_primary_admin_idx on clubs(primary_admin_user_id);
create index if not exists clubs_created_by_idx on clubs(created_by_user_id);
```

### 2. `club_members`

```sql
create table if not exists club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  club_role text not null default 'member',
  is_club_admin boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, user_id)
);
```

Rekommenderade index:

```sql
create index if not exists club_members_user_idx on club_members(user_id);
create index if not exists club_members_club_idx on club_members(club_id);
create index if not exists club_members_admin_idx on club_members(club_id, is_club_admin);
```

### 3. `teams`

Nuvarande `teams` bor byggas ut i stallet for att ersattas direkt.

Rekommenderade nya kolumner:

```sql
alter table teams add column if not exists club_id uuid references clubs(id) on delete set null;
alter table teams add column if not exists slug text;
alter table teams add column if not exists team_type text not null default 'other';
alter table teams add column if not exists age_group text;
alter table teams add column if not exists season_label text;
alter table teams add column if not exists status text not null default 'active';
```

Rekommenderade index:

```sql
create index if not exists teams_club_id_idx on teams(club_id);
create index if not exists teams_club_status_idx on teams(club_id, status);
```

Notering:

`owner_id` kan finnas kvar under migrering, men bor pa sikt fasas ut som primar auktoritetsmodell.

### 4. `team_members`

Det finns redan en tabell med detta namn. Den bor byggas om stegvis sa att den blir den centrala medlemskapstabellen for lagets personer.

Rekommenderade nya kolumner:

```sql
alter table team_members add column if not exists club_member_id uuid references club_members(id) on delete set null;
alter table team_members add column if not exists display_name text;
alter table team_members add column if not exists team_role text not null default 'other';
alter table team_members add column if not exists team_position text;
alter table team_members add column if not exists is_team_admin boolean not null default false;
alter table team_members add column if not exists is_guest boolean not null default false;
alter table team_members add column if not exists is_active boolean not null default true;
alter table team_members add column if not exists shirt_number integer;
alter table team_members add column if not exists photo_url text;
alter table team_members add column if not exists email text;
alter table team_members add column if not exists phone text;
alter table team_members add column if not exists sort_order integer not null default 0;
alter table team_members add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table team_members add column if not exists updated_at timestamptz not null default now();
```

Rekommenderade index:

```sql
create index if not exists team_members_team_idx on team_members(team_id);
create index if not exists team_members_team_role_idx on team_members(team_id, team_role);
create index if not exists team_members_team_admin_idx on team_members(team_id, is_team_admin);
create index if not exists team_members_club_member_idx on team_members(club_member_id);
create index if not exists team_members_team_position_idx on team_members(team_id, team_position);
```

## Rekommenderade enum-liknande textvarder

For enkel migrering rekommenderas textkolumner med appvalidering i forsta fas, snarare an Postgres enum direkt.

### `club_role`

Foreslagna varden:

- `member`
- `staff`
- `board`
- `guardian`
- `other`

`club_role` beskriver hur personen hor till klubben.
`is_club_admin` beskriver behorighet.

### `team_role`

Foreslagna varden:

- `leader`
- `player`
- `guardian`
- `relative`
- `staff`
- `other`

`team_role` beskriver vilken typ av person personen ar i laget.

### `team_position`

Foreslagna varden:

- `head_coach`
- `assistant_coach`
- `team_manager`
- `goalkeeper`
- `right_back`
- `center_back`
- `left_back`
- `defensive_midfielder`
- `central_midfielder`
- `attacking_midfielder`
- `right_forward`
- `central_forward`
- `left_forward`
- `striker`
- `parent`
- `guardian_contact`
- `other`

`team_position` beskriver funktion eller spelposition i laget.

## Rekommenderad domanindelning

For att Tacticsboard och Teamzone ska kunna dela samma grundmodell bor domanen delas upp sa har:

### Gemensam organisationsdomän

Gemensamma tabeller:

- `users`
- `clubs`
- `club_members`
- `teams`
- `team_members`

Detta ar sanningskallan for:

- klubbar
- lag
- medlemskap
- klubbroller
- lagroller
- positioner/funktioner
- klubbadmin och lagadmin

### Tacticsboard-specifikt lager

Taktikappen bor ovanpa den gemensamma domanen arbeta med:

- `projects`
- `boards`
- `board_team_selections`
- `board_player_overrides`

Det ar i detta lager som matchspecifika avvikelser ska ligga.

## Rekommenderad syn pa gamla tabeller

Under overgangen:

- `team_squads` behalls
- `team_players` behalls
- `team_squad_players` behalls

Pa sikt:

- `team_members` blir primar sanningskalla
- `team_players` och `team_squad_players` kan fasas ut
- `team_squads` kan reduceras till lagets visuella squadinställningar eller tas bort helt

## Rekommenderad migreringsordning

### Fas 1: Lagg till nya tabeller och kolumner

Mal:

- inga befintliga floden bryts
- schema kan ta emot ny struktur parallellt

SQL-riktning:

1. skapa `clubs`
2. skapa `club_members`
3. lagg till `club_id` och metadata i `teams`
4. bygg ut `team_members`

### Fas 2: Skapa default-klubb per befintlig teamagare

For varje unik `teams.owner_id`:

1. skapa en klubb, exempelvis `"Personal club"` eller `"User club"`
2. satt `clubs.created_by_user_id = owner_id`
3. satt `clubs.primary_admin_user_id = owner_id`
4. skapa `club_members` med `is_club_admin = true`

Exempel pa backfill-riktning:

```sql
insert into clubs (name, created_by_user_id, primary_admin_user_id)
select distinct
  coalesce(p.name, 'My club'),
  t.owner_id,
  t.owner_id
from teams t
left join profiles p on p.id = t.owner_id
where not exists (
  select 1 from clubs c where c.created_by_user_id = t.owner_id
);
```

Sedan kopplas `teams.club_id` till den skapade klubben.

### Fas 3: Backfill av klubbmedlemskap

Skapa `club_members` for:

- teamens nuvarande `owner_id`
- eventuella personer som redan finns i gamla `team_members` med auth-konto

Riktning:

- `owner_id` blir klubbadmin
- ovriga blir vanliga klubbmedlemmar om de hor till samma klubb

### Fas 4: Backfill av lagmedlemmar fran spelardata

Detta ar den viktigaste delen.

For varje rad i `team_players`:

1. skapa en `team_members`-rad
2. satt `display_name = team_players.name`
3. satt `team_role = 'player'`
4. satt `team_position = team_players.position_label`
5. satt `shirt_number = team_players.number`
6. satt `photo_url = team_players.photo_url`
7. satt `is_active = team_players.is_active`
8. satt `is_guest = false`

Obs:

`user_id` blir ofta `null` i denna fas, eftersom dagens spelare inte nodvandigtvis har auth-konto.

### Fas 5: Backfill av administrativa lagroller

For att inte tappa dagens lagagarskap:

1. skapa eller uppdatera en `team_members`-rad for `teams.owner_id`
2. satt:
   - `team_role = 'leader'`
   - `team_position = 'head_coach'`
   - `is_team_admin = true`

Det gor att dagens implicit agande blir explicit medlemskap.

### Fas 6: Uppdatera appen till dubbel-lagring

Under en overgangsperiod bor appen kunna:

- lasa fran gammal struktur
- skriva till ny struktur
- eller synka mellan dem i adapterlager

Rekommendation:

- nya team-/lagfloden skriver till ny modell
- gammal modell behalls endast for lasning tills UI ar migrerat

### Fas 7: Projekt och tavlor borjar lasa grundtrupp fran `team_members`

Nar admin- och lagfloden ar uppdaterade:

- nytt projekt valjer `team_id`
- projektets `squads` skapas som snapshot fran `team_members`
- board-lokala overrides fortsatter som idag

### Fas 7b: Tydlig separation mellan grundtrupp och boardoverride

Efter att projekt borjat lasa fran `team_members` bor modellen i koden flyttas mot:

- lagets grundtrupp som sanningskalla
- boardoverride som skillnadslager

Rekommenderad riktning:

- `SquadPlayer` far stabil referens till `teamMemberId`
- boardobjekt och spelarlankar bor pa sikt referera till `teamMemberId`
- boardens avvikelser uttrycks separat, till exempel:
  - `override_number`
  - `override_position`
  - `hidden`
  - `guest`

Detta ar nodvandigt for att exempelvis en `CAM` i lagets grundtrupp ska kunna spela `CF` pa en specifik board utan att lagets basdata skrivs over.

### Fas 8: Fasa ut gammal lagersmodell

Nar ny modell ar verifierad:

- stoppa skrivning till `team_players`
- stoppa skrivning till `team_squad_players`
- migrera sista beroenden i frontend
- ta bort eller frysa gammal struktur

## Rekommenderad RLS-riktning

### `clubs`

Select:

- anvandaren far se klubbar dar den ar klubbmedlem

Insert:

- inloggad anvandare far skapa klubb om `created_by_user_id = auth.uid()`

Update/Delete:

- endast klubbadmin

### `club_members`

Select:

- klubbmedlemmar far se medlemmar i samma klubb

Insert/Update/Delete:

- endast klubbadmin

### `teams`

Select:

- anvandaren far se lag dar den ar klubbmedlem eller teammedlem

Insert/Update/Delete:

- klubbadmin eller teamadmin beroende pa operation

### `team_members`

Select:

- teammedlemmar och klubbmedlemmar far se lagets medlemmar

Insert/Update/Delete:

- teamadmin eller klubbadmin

RLS bor uttryckligen tillata att samma anvandare:

- ar klubbadmin i flera klubbar
- ar lagadmin i flera lag
- har olika `club_role` och `team_role` i olika medlemskap

## Exempel pa RLS-logik

Exempel pa riktning for `team_members` select:

```sql
using (
  exists (
    select 1
    from team_members tm
    where tm.team_id = team_members.team_id
      and tm.user_id = auth.uid()
  )
  or exists (
    select 1
    from teams t
    join club_members cm on cm.club_id = t.club_id
    where t.id = team_members.team_id
      and cm.user_id = auth.uid()
  )
)
```

Exempel pa riktning for `team_members` mutation:

```sql
using (
  exists (
    select 1
    from team_members tm
    where tm.team_id = team_members.team_id
      and tm.user_id = auth.uid()
      and tm.is_team_admin = true
  )
  or exists (
    select 1
    from teams t
    join club_members cm on cm.club_id = t.club_id
    where t.id = team_members.team_id
      and cm.user_id = auth.uid()
      and cm.is_club_admin = true
  )
)
```

## Rekommenderade kodandringar efter schema

### Persistence-lager

Filer som sannolikt behover ny struktur:

- `src/persistence/teamSquads.ts`
- `src/persistence/defaultTeamSquads.ts`

Ny riktning:

- lagta adapters som hamtar `clubs -> teams -> team_members`
- mappa `team_members` till projektets `SquadPlayer` snapshot

### Frontend

Filer som paverkas:

- `src/components/TopBar.tsx`
- `src/components/ProjectList.tsx`
- `src/components/squad/SquadEditor.tsx`

Ny riktning:

- `Manage teams` blir pa sikt `Manage club and teams`
- nytt projekt far val av klubb och lag
- grundtruppen kommer fran valt lag
- boarden overlagrar bara lagets grundtrupp i stallet for att aga en separat spelarmodell

### Editor och boardflode

Kodfloden bor pa sikt justeras sa att:

- tokens pa planen pekar mot `teamMemberId`
- projektets squad ar en snapshot for arbetsflode och offline-stod
- boarden bara sparar de avvikelser som behovs for den aktuella matchen eller tavlan

## Rekommenderad forsta SQL-release

Den forsta tekniska releasen bor inte forsoka avveckla gamla tabeller direkt.

Den bor endast:

1. skapa `clubs`
2. skapa `club_members`
3. bygga ut `teams`
4. bygga ut `team_members`
5. backfilla klubb och medlemskap

Det minskar risken dramatiskt.

## Beslut som bor fattas innan implementation

Innan schemaforandringen genomfors bor foljande beslutas:

- om ett lag alltid maste tillhora en klubb
- om `primary_admin_user_id` ska finnas kvar eller bara vara en av flera klubbadmins
- om `team_position` ska vara fri text eller styrd lista
- om `club_role`, `team_role` och `team_position` ska valideras via appkod, check constraints eller separata referenstabeller
- om vardnadshavare maste kunna existera utan auth-konto
- om en och samma person kan ha flera medlemskap i samma lag over tid
- om sasongstillhorighet ska in redan nu eller vanta

## Rekommenderad praktisk ordning efter detta dokument

1. lagg till ny etapp eller delsteg i utvecklingsdokumentet for klubb/lag-migrering
2. skriv en konkret SQL-migration mot [schema.sql](/c:/Dev/projects/tacticsboard/supabase/schema.sql)
3. skriv backfill-script for befintliga `teams` och `team_players`
4. bygg nytt persistence-lager ovanpa nya tabeller
5. uppdatera UI-floden stegvis

Detta dokument ar avsett att vara underlaget for steg 2 och 3.
