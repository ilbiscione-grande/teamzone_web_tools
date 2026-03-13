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
- olika roller och positioner per lag
- klubbadmin och lagadmin
- att samma anvandare kan vara kopplad till flera lag
- att samma anvandare kan ha olika roller i olika lag
- att projekt far en grundtrupp fran valt lag
- att boards fortfarande kan ha lokala overrides utan att skriva over grunddatan

## Grundprinciper

Foljande principer ska styra implementationen:

- auth-anvandaren ar inte samma sak som lagmedlem i domanmodellen
- roller och positioner ska ligga pa relationen mellan anvandare och lag, inte globalt pa anvandaren
- klubb och lag ska vara egna entiteter
- projektets `squads` ska vara arbetskopior/snapshots, inte den primara sanningskallan for organisationsdata
- board-lokala avvikelser ska fortsatt lagras separat via overrides

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
- `membership_role`
- `is_club_admin`
- `created_at`
- `updated_at`

Exempel pa `membership_role`:

- `member`
- `staff`
- `board`
- `support`

Ansvar:

- avgor om en anvandare hor till klubben
- ger klubbniva for adminrattigheter
- gor att klubbadmin inte maste hardkodas pa endast ett fält i `clubs`

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
- `member_role`
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

Exempel pa `member_role`:

- `player`
- `leader`
- `guardian`
- `other`

Exempel pa `team_position`:

- `head_coach`
- `assistant_coach`
- `team_manager`
- `goalkeeper`
- `right_forward`
- `center_midfielder`
- `parent`
- `other`

Ansvar:

- beskriver en persons roll i just detta lag
- gor det mojligt att ha olika roller och positioner i olika lag
- ar den naturliga källan till grundtruppen i projekt

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

### Board-lokala andringar

Board-lokala andringar ska fortsatt ligga i `board.squadOverrides`.

Det omfattar exempelvis:

- dolda spelare
- board-specifika positionsetiketter
- board-gaster

Detta ska inte skriva over:

- klubbens lagstruktur
- lagets grundtrupp
- team members i databasen

## Rekommenderade tabeller

Miniminiva for ny databasstruktur:

- `clubs`
- `club_members`
- `teams`
- `team_members`

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

## Foreslagna modellandringar i frontend

Nuvarande `SquadPlayer` bor pa sikt utokas med en stabil referens:

- `teamMemberId?: string`

Nuvarande `Project` bor pa sikt kunna innehalla:

- `clubId?: string`
- `teamContext?: { homeTeamId?: string; awayTeamId?: string }`

Detta ar inte ett krav i fas 1, men bor vara malbilden.

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
2. lat `team_members` vara primar sanningskalla for lagets personer
3. lagg admin pa klubb- och lagniva i medlemskapen
4. lat projekt skapa snapshots fran valt lag
5. behall board-overrides som lokalt presentationslager

Detta ger en modell som ar tillrackligt stark for verkliga klubb- och lagfloden utan att tvinga editorn att bli tung eller databasberoende i varje interaktion.
