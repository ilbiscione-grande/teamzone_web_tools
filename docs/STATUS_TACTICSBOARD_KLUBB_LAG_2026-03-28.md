# Statusbild for klubb-, lag- och boardmodellen i Tactics Board

## Syfte

Detta dokument beskriver nulaget i Tactics Board per den 28 mars 2026.

Fokus ar:

- vad som redan ar genomfort i schema, persistence och appkod
- vad som fortfarande ar overgangslage eller legacy
- vad som bor goras klart i Tactics Board innan en verklig narmandekoppling till Teamzone blir aktuell
- vad som senare behovs for att Teamzone och Tactics Board ska kunna dela samma doman pa ett rent satt

Detta dokument ar en statusbild, inte en ny målmodell. Malmodellen och den tekniska migreringsriktningen finns redan i:

- [KLUBB_LAG_ANVANDARE_MODELL.md](/c:/Dev/projects/tacticsboard/docs/KLUBB_LAG_ANVANDARE_MODELL.md)
- [KLUBB_LAG_MIGRERING_SUPABASE.md](/c:/Dev/projects/tacticsboard/docs/KLUBB_LAG_MIGRERING_SUPABASE.md)
- [KODMIGRERING_KLUBB_LAG_BOARD.md](/c:/Dev/projects/tacticsboard/docs/KODMIGRERING_KLUBB_LAG_BOARD.md)

## Sammanfattning

Den viktigaste forandringen som redan ar gjord ar att appen inte langre bara bygger pa en los projektlokal squadmodell.

Istallet finns nu en verklig riktning mot:

- `clubs`
- `club_members`
- `teams`
- `team_members`

som gemensam organisations- och lagdoman, medan projekt och boards allt tydligare behandlas som:

- snapshot av lagets grundtrupp
- boardspecifika overrides ovanpa snapshoten

Det betyder att Tactics Board redan nu har tagit flera riktiga steg mot den modell som senare kan delas med Teamzone, men appen ar fortfarande i ett tydligt overgangslage dar legacy-strukturen lever kvar parallellt.

## Genomfort i schema och databasmigrering

Foljande ar redan genomfort i [schema.sql](/c:/Dev/projects/tacticsboard/supabase/schema.sql) och har dessutom korsts mot databasen:

- `clubs` finns
- `club_members` finns
- `teams` har byggts ut med klubbkontext och metadata
- `team_members` har byggts ut till att kunna vara den nya primara medlemskaps- och rosterkallan
- `club_role` och `team_role` ar inforda som separata begrepp
- `team_position` ar inford som separat funktion eller spelposition
- `is_club_admin` och `is_team_admin` ar separata behorighetsflaggar
- `board_team_selections` finns
- `board_player_overrides` finns
- RLS har uppdaterats sa att klubb- och lagadmin bygger pa medlemskap i stallet for bara implicit agarskap
- backfill for befintliga lag och medlemmar finns i schemat

Det viktiga resultatet ar att databasen nu kan uttrycka den doman ni faktiskt vill ha, aven om inte hela appen annu arbetar fullt ut mot den modellen i varje flode.

## Genomfort i appkoden

### 1. Stabil identitet via `teamMemberId`

Appen har fatt en stabil brygga mellan lagets personer och projektets snapshots.

Det som ar genomfort:

- `SquadPlayer` bar nu `teamMemberId`
- player tokens pa planen kan bara `teamMemberId`
- boardrendering, spelarlankning och delar av exportfloden kan sla upp spelare via `teamMemberId`
- formationer och boardtoken-logik bevarar och anvander `teamMemberId`
- serialisering och testfall har uppdaterats for detta

Praktisk betydelse:

- en spelare pa boarden ar inte langre bara en los projektrad
- appen har nu en stabil identitet som overlever battre an gamla snapshot-id:n

### 2. Projektet bar lagkontext

Projektmodellen har utokats sa att projektet vet vilka lag som faktiskt ar valda for `home` och `away`.

Det som ar genomfort:

- `project.teamContext.homeTeamId`
- `project.teamContext.awayTeamId`
- `Create project` kan spara vald `homeTeamId` och `awayTeamId`
- serialisering validerar `teamContext`
- projektstart fran lag bygger pa den nya teamkontexten

Praktisk betydelse:

- `Home` och `Away` ar inte langre bara namn pa squads
- projektet vet vilket verkligt lag som ar kopplat till respektive sida

### 3. Boardoverrides bygger allt mer pa stabil identitet

Boardlogiken arbetar nu mer konsekvent med `teamMemberId` som nyckel.

Det som ar genomfort:

- overrides for positioner och dolda spelare kan nycklas via `teamMemberId`
- Team Manager och Squad Editor anvander samma override-nyckelprincip
- boardhelpers och testfall verifierar att override-floden fungerar via `teamMemberId`

Praktisk betydelse:

- en spelare kan pa sikt overridas pa boardniva utan att det beror pa att snapshot-id:n rakat matcha

### 4. Team Manager ar omstrukturerad

`Manage teams` ar inte langre en stor sammanslagen blocksektion i `TopBar`.

Det som ar genomfort:

- modalens skal ar utbrutet till egen komponent
- roster, source/load, appearance och de tva rosterlistorna ar utbrutna i egna komponenter
- UI:t ar omstrukturerat sa att roster far huvudfokus
- source och appearance ligger som separata paneler ovanpa roster i stallet for att ta egen huvudhojd
- en stor del av det tekniska och roriga spraket ar redan forenklat

Praktisk betydelse:

- Team Manager ar fortfarande inte “klar”, men den ar nu betydligt enklare att fortsatta bygga om utan att allt ligger fast i `TopBar.tsx`

### 5. Team Manager orienterar sig nu mot verkliga lag

Den viktigaste logiska forandringen i Team Manager ar att den inte langre bara gissar pa source utifran snapshot-squaden.

Det som ar genomfort:

- `Current source` utgar i forsta hand fran `project.teamContext`
- `Load team` uppdaterar `teamContext`
- `Use for Home/Away` flyttar nu aven med lagkopplingen
- rosterordning kan folja `team_members.sort_order`
- `Team roster` kan byggas fran `managedDirectoryTeam.members` nar sidan ar länkad till ett lag
- projektsquaden fungerar da som snapshot-/override-lager ovanpa den listan

Praktisk betydelse:

- `Home` och `Away` har nu en tydligare koppling till faktiska lag
- `Team roster` beter sig allt mer som en vy ovanpa lagets medlemmar i stallet for en frikopplad squadlista

### 6. Persistence-lagret skriver nu mot `team_members` forst

Detta ar en av de viktigaste tekniska forandringarna.

Det som ar genomfort i persistence:

- lasning av lagdata kan nu ta `team_members` som primar rosterkalla
- skrivning av rosterdata sker nu forst till `team_members`
- legacy-tabeller speglas fortfarande vidare for bakatkompatibilitet
- nya lag skapar teamadmin-medlemskap i den nya modellen

Praktisk betydelse:

- den nya modellen ar nu huvudvag for rosterdata
- legacy-strukturen finns fortfarande kvar, men mer som adapter- och kompatibilitetslager

## Vad som fortfarande ar overgangslage

Trots stora framsteg ar appen inte framme vid den slutliga modellen annu.

Foljande ar fortfarande sant:

- `team_players`, `team_squads` och `team_squad_players` lever kvar
- delar av UI:t ar fortfarande mentalt formade av den gamla squadmodellen
- `Manage teams` blandar fortfarande lagvy, snapshotvy och boardoverride-vy i samma huvudsakliga arbetsflode
- boardoverrides finns delvis som logik i projekt-/boardstate, men anvander inte annu fullt ut de nya databastabellerna `board_team_selections` och `board_player_overrides`
- `Save team`/`Save reusable team` ar tydligare an tidigare, men hela spraket ar fortfarande ett overgangssprak mellan gammal och ny modell

Kort sagt:

- den nya domanen finns
- stora delar av appen vet om den
- men inte alla floden ar annu helt omskrivna sa att den gamla mentala modellen kan tas bort

## Vad som bor goras klart i Tactics Board innan narmandet mot Teamzone

Detta ar de viktigaste resterande stegen i just Tactics Board.

### 1. Lasa den nya sanningskallan helt i Team Manager

Mal:

- `Team roster` ska fullt ut uppfattas och bete sig som lagets grundtrupp
- projektets snapshot ska vara ett lokalt skillnadslager, inte en konkurrerande sanning

Det som behovs:

- tydligare redigering av länkade `team_members`
- tydligare skillnad mellan “lagets grunddata” och “detta projekts lokala avvikelse”
- enklare och renare UX for save/load/update av länkade lag

### 2. Flytta boardskillnader till en ren override-modell

Mal:

- boarden ska bara lagra skillnader

Det som behovs:

- tydligare modell for `overrideNumber`
- tydligare modell for `overridePosition`
- tydligare modell for dolda spelare och boardgaster
- gradvis flytt mot de nya taveltabellerna i schemat

### 3. Minska beroendet av legacy-tabeller i lasfloden

Mal:

- `team_members` ska vara forsta, tydliga och naturliga sanningskallan

Det som behovs:

- fler lasfloden som helt utgar fran `team_members`
- dokumenterad fallback bara dar den verkligen fortfarande behovs
- pa sikt ett beslut om nar `team_players` och `team_squad_players` inte langre ska vara primara i appen

### 4. Rensa spraket i UI:t helt

Mal:

- anvandaren ska inte behova forsta “snapshot”, “source” eller “DB” for att anvanda vyn ratt

Det som behovs:

- mindre tekniskt sprak
- tydligare skillnad mellan:
  - lagets grundtrupp
  - aktuell board
  - lokala matchandringar

### 5. Starkare testning kring nya huvudvagen

Mal:

- den nya modellen ska ha samma eller battre testskydd som gamla floden

Det som behovs:

- fler tester kring `team_members` som primar rosterkalla
- fler tester kring `teamContext`
- fler tester kring linked-team-update i Team Manager
- fler tester kring boardoverride via `teamMemberId`

## Vad som uttryckligen inte bor goras just nu

For att undvika att modellen blir rorig igen bor foljande inte prioriteras nu:

- bygga djupare Teamzone-koppling i appflodet innan Tactics Board ar renare internt
- introducera fler stora UI-floden ovanpa den gamla squadmodellen
- bygga flera parallella begrepp for lag, source, presets och snapshots

Rekommendationen ar att Tactics Board forst gor klart den interna omlaggningen mot:

- `team_members` som sanningskalla
- `teamMemberId` som identitet
- boardoverrides som skillnadslager

## Vad som senare behovs for ett rent narmande mot Teamzone

Nar Tactics Board ar renare internt kan Teamzone-narmandet borja pa ett mycket sundare satt.

Det som da behovs ar framfor allt doman- och integrationsarbete, inte mer “specialmappning”.

### 1. Gemensam organisationsdomän

Tactics Board och Teamzone bor dela:

- `users`
- `clubs`
- `club_members`
- `teams`
- `team_members`

Detta ar den viktigaste forutsattningen for att apparna ska prata om samma klubb, samma lag och samma personer.

### 2. Tydlig ansvarsfordelning mellan apparna

Rekommenderad ansvarsfördelning:

- Teamzone ager lagkommunikation, kallelser, narvaro och allman lagadministration
- Tactics Board ager projekt, boards, matchgrafik, boardobjekt och matchspecifika overrides

Det betyder att den gemensamma sanningskallan bor ligga pa organisationssidan, inte pa taktik- eller publiceringssidan.

### 3. Gemensamma identiteter for spelare och ledare

For Teamzone-narmandet ar detta helt avgorande:

- samma person i Teamzone och Tactics Board maste vara samma `team_member`
- `teamMemberId` maste fortsatta vara den stabila bryggan i Tactics Board

Annars kommer appkopplingen snabbt glida tillbaka till specialfall och dubbellagring.

### 4. Beslut om vilken app som ager vilken typ av skrivning

Detta ar en viktig framtidsfraga:

- ska lagets grundtrupp primart uppdateras i Teamzone
- eller ska Tactics Board fortsatt kunna uppdatera lagets grundtrupp direkt

Detta bor beslutas innan en djupare integration byggs.

En rimlig riktning ar:

- Teamzone ager generell lagadministration
- Tactics Board far uppdatera lagets taktiskt relevanta rosterdata sa lange samma domanmodell respekteras

### 5. Eventuell framtida API- eller synkstrategi

Detta ar inte nasta steg nu, men bor dokumenteras som framtida riktning:

- delad databasmodell med gemensamma tabeller
- eller tjanstegrans/API mellan apparna
- eller en hybrid dar Teamzone ar huvudklient for lagadministration medan Tactics Board konsumerar och kompletterar

Det viktiga ar att detta kan goras renare nu eftersom databasen och appmodellen redan har borjat flyttas mot en gemensam doman.

## Rekommenderad prioritering framåt

Forst i Tactics Board:

1. gor Team Manager fullt konsekvent mot länkade lag och `team_members`
2. gor boardoverride-modellen tydligare och mer explicit
3. minska legacy-beroenden i persistence och lasfloden
4. fortsätt stada UI/UX sa att begreppen blir begripliga

Sedan, och forst da, mot Teamzone:

1. lås gemensam organisationsdoman
2. bestam huvudansvar for roster- och medlemskapsandringar
3. definiera hur kallelser, narvaro och matchtrupp ska forhalla sig till Tactics Board-projekt och boards

## Slutsats

Tactics Board har redan gjort de viktigaste grundforflyttningarna:

- databasen kan uttrycka ratt doman
- appen bar `teamMemberId`
- projektet bar `teamContext`
- Team Manager ar omriktad mot verkliga lag
- persistence-lagret anvander `team_members` som primar vag

Det som aterstar ar inte att uppfinna modellen, utan att fullfolja den.

Det ar ocksa darfor det ar ratt beslut att pausa Teamzone-narmandet just nu.

Den storsta nyttan kommer nu av att:

- forenkla och fullborda denna apps egen modell
- minska overgangslogik och legacyberoenden
- och forst darefter bygga Teamzone-narmandet ovanpa en renare grund
