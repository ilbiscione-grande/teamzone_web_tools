# Datadokument for klubb-, lag- och anvandarmodell

## Syfte

Detta dokument beskriver en ny domanmodell for hur klubbar, lag, anvandare och trupper ska struktureras i Tacticsboard. Malet ar att ersatta dagens forenklande modell dar ett lag i praktiken ar kopplat direkt till en anvandare, med en modell som speglar verklig forenings- och lagstruktur.

Dokumentet beskriver:

- onskad datamodell
- ansvar per entitet
- hur roller, positioner, admin och gast ska lagras
- hur grundtrupp och board-lokala andringar ska samexistera
- en migrationsplan fran nuvarande struktur

## Bakgrund

Nuvarande modell bygger i praktiken pa:

- en anvandare ager ett eller flera lag
- ett lag innehaller en squad
- squaden innehaller spelare

Det fungerar for enkel personlig lagring, men det ar for begransat for en verklig klubb- och lagmiljo.

Begransningar i nuvarande modell:

- ett lag ar for starkt kopplat till en enskild anvandare
- samma person kan inte naturligt ha olika roller i olika lag
- klubbniva saknas helt
- adminrattigheter ar inte tydligt modellerade pa klubb- eller lagniva
- `guest` ar idag mer ett squad-/boardbegrepp an ett tydligt medlemskapsbegrepp
- projektets grundtrupp och organisationens verkliga lagstruktur ar inte samma sak

## Malbild

Den framtida modellen ska stotta:

- en klubb med flera lag
- flera anvandare i samma lag
- att samma anvandare kan vara med i flera klubbar
- att samma anvandare kan vara med i flera lag, i samma eller olika klubbar
- olika roller och positioner per lag
- olika roller pa klubbniva och lagniva for samma anvandare
- klubbadmin och lagadmin
- att samma anvandare kan vara kopplad till flera lag
- att samma anvandare kan ha olika roller i olika lag
- att projekt far en grundtrupp fran valt lag
- att boards fortfarande kan ha lokala overrides utan att skriva over grunddatan
- att modellen pa sikt kan delas med Teamzone som gemensam klubb-/lagdomän

## Grundprinciper

Foljande principer ska styra implementationen:

- auth-anvandaren ar inte samma sak som lagmedlem i domanmodellen
- roller och admin ska ligga pa medlemskap, inte globalt pa anvandaren
- klubbroll, lagroll och position/funktion ar tre olika begrepp och ska inte blandas ihop
- klubb och lag ska vara egna entiteter
- lagets grundtrupp ar den primara sanningskallan for spelare
- projektets `squads` ska vara arbetskopior/snapshots, inte den primara sanningskallan for organisationsdata
- board-lokala avvikelser ska fortsatt lagras separat via overrides
- en board ska referera till lagets spelare, inte aga dem

## Rekommenderad datamodell

### 1. Clubs

Representerar en forening eller organisation.

Foreslagna falt:

- `id`
- `name`
- `slug`
- `created_at`
- `updated_at`
- `created_by_user_id`
- `primary_admin_user_id`
- `logo_url`
- `status`

Ansvar:

- samlar flera lag under samma organisation
- bar klubbniva for admin och identitet
- fungerar som overordnad aggregatniva for lag

### 2. Teams

Representerar ett specifikt lag i en klubb.

Foreslagna falt:

- `id`
- `club_id`
- `name`
- `slug`
- `team_type`
- `age_group`
- `season_label`
- `status`
- `created_at`
- `updated_at`

Exempel pa `team_type`:

- `boys`
- `girls`
- `men`
- `women`
- `academy`
- `staff`
- `other`

Ansvar:

- ett lag tillhor exakt en klubb
- ett lag ar källan till projektets grundtrupp
- laget ar den primara platsen for roller, positioner och medlemskap

### 3. Users

Detta ar fortsatt auth/profil-objektet som finns idag via Supabase Auth och `profiles`.

Ansvar:

- identitet och inloggning
- global profilinformation
- inte domanens slutliga sanning om roll eller position i ett specifikt lag

### 4. Club Members

Representerar att en anvandare ar medlem i en klubb.

Foreslagna falt:

- `id`
- `club_id`
- `user_id`
- `club_role`
- `is_club_admin`
- `created_at`
- `updated_at`

Exempel pa `club_role`:

- `member`
- `staff`
- `board`
- `guardian`
- `other`

Ansvar:

- avgor om en anvandare hor till klubben
- ger klubbniva for adminrattigheter
- gor att klubbadmin inte maste hardkodas pa endast ett fält i `clubs`

Notering:

`club_role` beskriver vilken typ av medlem personen ar i klubben.
`is_club_admin` beskriver om personen far administrera klubben.

Detta betyder att nagon till exempel kan vara:

- `club_role = staff`
- `is_club_admin = true`

Notering:

`primary_admin_user_id` i `clubs` kan finnas kvar som snabb referens, men verklig rattighetsmodell bor bygga pa `club_members.is_club_admin`.

### 5. Team Members

Detta ar den viktigaste nya relationen. Den kopplar en anvandare eller person till ett lag.

Foreslagna falt:

- `id`
- `team_id`
- `club_member_id` nullable
- `user_id` nullable
- `display_name`
- `team_role`
- `team_position`
- `is_team_admin`
- `is_guest`
- `is_active`
- `shirt_number`
- `photo_url`
- `email`
- `phone`
- `created_at`
- `updated_at`

Exempel pa `team_role`:

- `leader`
- `player`
- `guardian`
- `relative`
- `staff`
- `other`

Exempel pa `team_position`:

- `head_coach`
- `assistant_coach`
- `team_manager`
- `goalkeeper`
- `center_back`
- `central_midfielder`
- `central_forward`
- `right_forward`
- `parent`
- `guardian_contact`
- `other`

Ansvar:

- beskriver vilken typ av person nagon ar i laget via `team_role`
- beskriver personens funktion eller spelposition i laget via `team_position`
- gor det mojligt att ha olika roller och positioner i olika lag
- ar den naturliga källan till grundtruppen i projekt

Viktig princip:

- `team_role` svarar pa vem personen ar i laget
- `team_position` svarar pa vad personen gor i laget
- `is_team_admin` svarar pa vilka rattigheter personen har i laget

Exempel:

- `team_role = leader`, `team_position = head_coach`
- `team_role = player`, `team_position = goalkeeper`
- `team_role = guardian`, `team_position = parent`

Detta ar avgorande for att undvika att roller, funktioner och rattigheter blandas i samma fält.

## Skillnaden mellan klubbroll, lagroll och position

Den framtida modellen ska uttryckligen skilja pa tre olika nivaer:

### Klubbroll

Ligger pa `club_members.club_role`.

Exempel:

- `member`
- `staff`
- `board`
- `guardian`

Beskriver hur personen hor till klubben.

### Lagroll

Ligger pa `team_members.team_role`.

Exempel:

- `leader`
- `player`
- `guardian`
- `relative`

Beskriver vilken typ av person personen ar i laget.

### Position eller funktion

Ligger pa `team_members.team_position`.

Exempel:

- `head_coach`
- `team_manager`
- `goalkeeper`
- `central_forward`
- `parent`
- `guardian_contact`

Beskriver personens funktion eller spelposition i laget.

### Adminflaggar

Ska fortsatt vara separata boolska rattighetsfalt:

- `club_members.is_club_admin`
- `team_members.is_team_admin`

Detta gor att samma anvandare kan vara:

- klubbadmin i klubb A
- vanlig medlem i klubb B
- ledare och huvudtranare i lag 1
- vardnadshavare i lag 2
- lagadmin i lag 1 men inte i lag 2

## Var `guest` bor ligga

`guest` ska inte vara ett globalt anvandarfalt.

Rekommendation:

- `is_guest` ska ligga pa `team_members`

Motivering:

- en person kan vara ordinarie i ett lag men gast i ett annat
- gaststatus ar ett lagmedlemskapstillstand, inte en identitet

Board-lokala gastspelare som bara finns for en enskild tavla ska dock fortsatt kunna finnas i `board.squadOverrides.guestPlayers`.

Det ger tva nivaer:

- laggast: en faktisk tillfallig medlem i laget
- boardgast: en temporar taktisk spelare som bara finns pa tavlan

## Rekommenderad koppling till projekt och boards

### Projektets grundtrupp

Ett projekt ska kopplas till valt lag och initialt skapa en projektlokal arbetskopia av lagets medlemmar.

Rekommendation:

- ett projekt ska spara referens till valt `team_id`
- projektets `squads` skapas som snapshots fran lagets `team_members`

Det gor att:

- nya projekt far korrekt grundtrupp
- projektet kan arbeta offline och lokalt
- tavlan ar fortfarande snabb att jobba i utan att varje rendering gor databasuppslag

Viktig princip:

- lagets grundtrupp ar sanningskallan
- projektets squad ar en arbetskopia
- boarden ska inte aga spelaren, bara referera till den eller overrida den

### Board-lokala andringar

Board-lokala andringar ska fortsatt ligga i `board.squadOverrides`.

Det omfattar exempelvis:

- dolda spelare
- board-specifika positionsetiketter
- board-specifika nummer
- board-gaster

Detta ska inte skriva over:

- klubbens lagstruktur
- lagets grundtrupp
- team members i databasen

Rekommendation pa sikt:

- `SquadPlayer` bor kunna innehalla `teamMemberId`
- boardens objekt och tokens bor i slutandan referera till `teamMemberId`
- boardoverride ska bara lagra skillnader, till exempel:
  - `override_number`
  - `override_position`
  - `hidden`
  - `display_name_override`

Detta ar precis den modell som behovs for att en spelare normalt ar `CAM` i laget men spelar `CF` i en viss matchboard.

## Rekommenderade tabeller

Miniminiva for ny databasstruktur:

- `clubs`
- `club_members`
- `teams`
- `team_members`

Taktikdelen bor pa sikt kompletteras med:

- `projects`
- `boards`
- `board_team_selections`
- `board_player_overrides`

Detta gor det mojligt att halla organisationsdata och taktisk presentationsdata separerade.

Mojliga kompletteringar senare:

- `team_member_guardians`
- `team_invites`
- `team_seasons`
- `club_settings`
- `team_settings`

## Hur nuvarande modell mappar mot ny modell

Nuvarande entiteter:

- `teams`
- `team_squads`
- `team_players`
- `team_squad_players`
- `team_members` anvands idag mer som agarskaps-/medlemskapstabell pa teamniva

Foreslagen riktning:

- dagens `teams` blir framtida lag, men maste fa `club_id`
- dagens `team_players` bor pa sikt ersattas eller byggas om till `team_members`
- dagens `team_squads` blir overflodig eller reduceras kraftigt om varje lag bara har en grundtrupp
- dagens `team_squad_players` blir overflodig om medlemskap och ordning ligger direkt i `team_members`

## Rekommenderad slutmodell for lagets personer

Pa sikt bor laget inte lagra:

- separata player rows plus separat relationstabell for att beskriva vilka som ingar i grundtruppen

I stallet bor laget lagra:

- en `team_members`-rad per person i laget

Detta forenklar:

- admin
- roller
- positioner
- gaststatus
- koppling till auth-anvandare
- framtida funktioner som narvaro, laguttagning och kommunikation

## Gemensam domän med Teamzone

For att modellen ska kunna delas mellan Tacticsboard och Teamzone bor ansvaret delas sa har:

### Gemensam domän mellan apparna

Tabeller och begrepp som bor vara gemensamma:

- `users`
- `clubs`
- `club_members`
- `teams`
- `team_members`

Detta ar den gemensamma organisations- och lagdomänen.

### Tacticsboard-specifik domän

Begrepp som primart hor till taktikappen:

- `projects`
- `boards`
- `board objects`
- `board_team_selections`
- `board_player_overrides`

### Teamzone-specifik domän

Begrepp som Teamzone sedan kan bygga vidare pa:

- kallelser till match och traning
- narvaro
- lagkommunikation
- spelar- och vardnadshavarkontakter

Rekommenderad riktning:

- Teamzone och Tacticsboard ska dela samma klubb-/lag-/medlemskapsmodell
- Tacticsboard ska konsumera lagets grundtrupp från den delade modellen
- Teamzone ska pa sikt kunna lasa samma lag och medlemmar utan specialmappning

## Rekommenderad migrationsstrategi

Migrationen bor goras stegvis for att undvika att befliga projekt och teamfloden gar sonder.

### Fas 1: Introducera ny modell parallellt

Skapa nya tabeller:

- `clubs`
- `club_members`
- ny eller ombyggd `team_members` for medlemskap

Bevara nuvarande teamtabeller under en overgangsperiod.

Mal:

- den nya modellen kan existera utan att editorn direkt maste skrivas om

### Fas 2: Backfill av befintliga lag

For varje befintligt team:

1. skapa en default-klubb om ingen klubb finns
2. koppla teamet till klubben
3. skapa klubbmedlemskap for teamets agare
4. skapa teammedlemskap for dagens spelare i `team_players`

Regler for backfill:

- tidigare `owner_id` blir initial klubbadmin och teamadmin
- spelare utan auth-konto migreras med `user_id = null`
- namn, nummer, position, aktivstatus och bild flyttas till teammedlemmen

### Fas 3: Introducera nya rattighetsregler

Bygg accesskontroll pa:

- `club_members.is_club_admin`
- `team_members.is_team_admin`

Mal:

- agarskap flyttas fran “den som skapade laget” till explicita medlemskapsregler

### Fas 4: Knyt nya projekt till valt lag

Vid nytt projekt:

1. anvandaren valjer klubb och lag, eller sa valjs senaste/default lag
2. projektets `squads` skapas fran lagets `team_members`
3. `project.teamId` eller motsvarande sparas

Mal:

- grundtruppen i nya projekt kommer alltid fran lagets faktiska medlemslista
- boarden kan sedan overrida nummer och position utan att skriva over lagets grunddata

### Fas 5: Behall board-overrides som separat lager

Editorn ska fortsatt arbeta som idag med:

- projekt-squads
- board-overrides

Mal:

- nya domanmodellen forstorar inte tavlans flexibilitet

### Fas 6: Avveckla gammal teamstruktur

Nar UI, persistence och projektflode ar migrerade:

- fasa ut `team_squads`
- fasa ut `team_players`
- fasa ut `team_squad_players`

Detta bor goras sist, efter verifierad datamigrering.

## Rekommenderad implementation i appen

### Steg 1

Bygg datamodell och migration utan att andra editorn.

### Steg 2

Uppdatera `Manage teams` sa att den arbetar mot:

- klubb
- lag
- lagmedlemmar

### Steg 3

Uppdatera projektkonsolen sa att nytt projekt kan:

- valja klubb
- valja lag
- hamta grundtrupp fran det laget

### Steg 4

Uppdatera editorn sa att `SquadPlayer` pa sikt kan peka mot ett stabilt lagmedlemskap, exempelvis `teamMemberId`.

### Steg 5

Uppdatera board- och exportfloden sa att de i forsta hand arbetar mot:

- lagets grundtrupp
- boardens overrides

i stallet for att behandla projektlokala squadkopior som primar sanningskalla.

## Foreslagna modellandringar i frontend

Nuvarande `SquadPlayer` bor pa sikt utokas med en stabil referens:

- `teamMemberId?: string`

Nuvarande `Project` bor pa sikt kunna innehalla:

- `clubId?: string`
- `teamContext?: { homeTeamId?: string; awayTeamId?: string }`

Detta ar inte ett krav i fas 1, men bor vara malbilden.

Pa sikt bor boardoverride kunna uttryckas uttryckligen som:

- `teamMemberId`
- `overrideNumber`
- `overridePosition`
- `hidden`
- `guest`

## Oppna beslut

Foljande frgor maste beslutas innan implementation:

- ska ett projekt kunna ha lag fran olika klubbar samtidigt
- ska vardnadshavare alltid vara kopplad till auth-anvandare eller kunna vara kontaktpost utan konto
- ska ett lag kunna ha flera admins
- ska klubbadmin automatiskt vara admin i alla lag eller bara kunna tilldelas det
- ska `team_position` vara fri text, enum eller kombination
- om laget har flera sasonger, ska medlemskap vara sasongsbundet

## Rekommendation

Rekommenderad forsta implementation:

1. bygg `clubs`, `club_members`, `teams`, `team_members`
2. lat `club_members.club_role` och `team_members.team_role` beskriva medlemskapstyper
3. lat `team_members.team_position` beskriva funktion eller spelposition
4. lagg admin pa klubb- och lagniva i medlemskapen via separata adminflaggor
5. lat `team_members` vara primar sanningskalla for lagets personer
6. lat projekt skapa snapshots fran valt lag
7. behall board-overrides som lokalt presentationslager
8. bygg pa sikt Tacticsboard och Teamzone mot samma gemensamma klubb-/lagdomän

Detta ger en modell som ar tillrackligt stark for verkliga klubb- och lagfloden utan att tvinga editorn att bli tung eller databasberoende i varje interaktion.
