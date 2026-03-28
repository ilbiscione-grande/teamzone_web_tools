# Kodmigrationsplan for klubb-, lag- och boardmodell

## Syfte

Detta dokument oversatter den nya datamodellen i:

- [KLUBB_LAG_ANVANDARE_MODELL.md](/c:/Dev/projects/tacticsboard/docs/KLUBB_LAG_ANVANDARE_MODELL.md)
- [KLUBB_LAG_MIGRERING_SUPABASE.md](/c:/Dev/projects/tacticsboard/docs/KLUBB_LAG_MIGRERING_SUPABASE.md)
- [STATUS_TACTICSBOARD_KLUBB_LAG_2026-03-28.md](/c:/Dev/projects/tacticsboard/docs/STATUS_TACTICSBOARD_KLUBB_LAG_2026-03-28.md)

till en konkret kodmigrationsplan for appen.

## Status kontra plan

Detta dokument beskriver malriktning och rekommenderad migrationsordning.

Den faktiska nulagesbilden for vad som redan ar genomfort i schema och kod, vad som fortfarande ar overgangslage, och vad som senare behovs for Teamzone-narmande finns i:

- [STATUS_TACTICSBOARD_KLUBB_LAG_2026-03-28.md](/c:/Dev/projects/tacticsboard/docs/STATUS_TACTICSBOARD_KLUBB_LAG_2026-03-28.md)

Målet ar att stegvis flytta Tacticsboard fran dagens blandade squad/source-upplagg till en modell dar:

- klubb och lag ar sanningskalla for medlemskap
- lagets grundtrupp ar sanningskalla for spelare
- projektet arbetar med snapshots
- boarden lagrar overrides i stallet for att aga spelarna

## Overgripande princip

Kodmigreringen ska folja denna riktning:

1. bygg lasning mot nya tabeller
2. bevara kompatibilitet med nuvarande projektmodell under overgang
3. lagg till stabila referenser till `teamMemberId`
4. flytta boardlogik till explicita overrides
5. forenkla Team Manager nar den nya modellen ar fullt inkopplad

## Malbild i koden

Nar migreringen ar klar ska appen fungera sa har:

- en anvandare kan hamta flera klubbar och lag
- `Create project` valjer lag, inte bara lokala squadpresets
- varje `SquadPlayer` kan spåras till en `team_member`
- boardens `home` och `away` baseras pa valt lag
- boardens skillnader uttrycks som override-data
- `Manage teams` blir egentligen ett lager ovanpa `team_members`

## Migrationsprinciper

- bryt inte gamla projekt direkt
- håll adaptrar mellan gammal och ny modell under en overgang
- byt identitetsmodell fore UI-finputs
- låt persistence-lagret bytas ut innan boardinteraktioner skrivs om

## Etapp 1: Stabil lasning mot ny doman

### Mål

Appen ska kunna lasa klubb-, lag- och medlemskapsdata konsekvent fran nya tabeller.

### Filer

- [teamDirectory.ts](/c:/Dev/projects/tacticsboard/src/persistence/teamDirectory.ts)
- [club.ts](/c:/Dev/projects/tacticsboard/src/models/club.ts)
- [index.ts](/c:/Dev/projects/tacticsboard/src/models/index.ts)

### Arbete

1. Gora `teamDirectory.ts` till primar lasadapter for:
   - `clubs`
   - `club_members`
   - `teams`
   - `team_members`
2. Lata legacy-fallback vara kvar tillfalligt men isolerat.
3. Utoka modellerna sa att de uttrycker:
   - `clubRole`
   - `teamRole`
   - `teamPosition`
   - `isClubAdmin`
   - `isTeamAdmin`

### Resultat

Resten av frontend ska slippa veta om gamla tabeller.

## Etapp 2: Inför stabil identitet pa squadspelare

### Mål

Projektets squadspelare ska kunna kopplas till verkliga lagmedlemmar.

### Filer

- [squad.ts](/c:/Dev/projects/tacticsboard/src/models/squad.ts)
- [project.ts](/c:/Dev/projects/tacticsboard/src/models/project.ts) eller motsvarande projektmodell
- [projectHelpers.ts](/c:/Dev/projects/tacticsboard/src/state/projectHelpers.ts)
- [serialize.ts](/c:/Dev/projects/tacticsboard/src/persistence/serialize.ts)

### Arbete

1. Utoka `SquadPlayer` med:
   - `teamMemberId?: string`
   - eventuellt `teamRole?: string`
   - eventuellt `basePosition?: string`
2. Se till att snapshots fran lag alltid fyller `teamMemberId`.
3. Uppdatera serialisering/deserialisering sa att fältet bevaras.
4. Hålla kompatibilitet med gamla projekt som saknar `teamMemberId`.

### Resultat

Spelaren pa boarden kan spåras tillbaka till lagets grundtrupp.

## Etapp 3: Skapa projekt fran valt lag pa riktigt

### Mål

Nya projekt ska byggas fran lagets grundtrupp i nya modellen.

### Filer

- [ProjectList.tsx](/c:/Dev/projects/tacticsboard/src/components/ProjectList.tsx)
- [defaultTeamSquads.ts](/c:/Dev/projects/tacticsboard/src/persistence/defaultTeamSquads.ts)
- [teamDirectory.ts](/c:/Dev/projects/tacticsboard/src/persistence/teamDirectory.ts)
- [projectHelpers.ts](/c:/Dev/projects/tacticsboard/src/state/projectHelpers.ts)

### Arbete

1. Lata `Create project` valja:
   - klubb
   - home team
   - away team
2. Skapa projektsquads direkt fran `team_members`.
3. Spara teamkontext i projektet, till exempel:
   - `homeTeamId`
   - `awayTeamId`
4. Behall fallback till defaults medan overgangen pagar.

### Resultat

Projektets squads blir tydliga snapshots fran riktiga lag.

## Etapp 4: Rensa upp persistence for teamlagring

### Mål

Gamla squadpreset-floden ska minska i betydelse och ersattas av lagbaserad persistence.

### Filer

- [teamSquads.ts](/c:/Dev/projects/tacticsboard/src/persistence/teamSquads.ts)
- [defaultTeamSquads.ts](/c:/Dev/projects/tacticsboard/src/persistence/defaultTeamSquads.ts)
- [teamDirectory.ts](/c:/Dev/projects/tacticsboard/src/persistence/teamDirectory.ts)

### Arbete

1. Avgor vilka funktioner som ska leva kvar endast som adapterlager.
2. Introducera nytt skrivlager mot:
   - `teams`
   - `team_members`
3. Lata `Save reusable team` i praktiken uppdatera lagets grundtrupp, inte skapa en parallell modell.
4. Fas ut beroenden till:
   - `team_players`
   - `team_squads`
   - `team_squad_players`

### Resultat

Ett lag har en grundtrupp, inte flera konkurrerande representationsformer.

## Etapp 5: Skriv om Team Manager mot nya sanningskallan

### Mål

`Manage teams` ska hantera lagmedlemmar och boardoverrides, inte blanda ihop dem.

### Filer

- [TopBar.tsx](/c:/Dev/projects/tacticsboard/src/components/TopBar.tsx)
- [ManageTeamsModal.tsx](/c:/Dev/projects/tacticsboard/src/components/ManageTeamsModal.tsx)
- [ManageTeamsRoster.tsx](/c:/Dev/projects/tacticsboard/src/components/manage-teams/ManageTeamsRoster.tsx)
- [ManageTeamsBaseRoster.tsx](/c:/Dev/projects/tacticsboard/src/components/manage-teams/ManageTeamsBaseRoster.tsx)
- [ManageTeamsBoardRoster.tsx](/c:/Dev/projects/tacticsboard/src/components/manage-teams/ManageTeamsBoardRoster.tsx)
- [ManageTeamsSourcePanel.tsx](/c:/Dev/projects/tacticsboard/src/components/manage-teams/ManageTeamsSourcePanel.tsx)
- [ManageTeamsTeamSetup.tsx](/c:/Dev/projects/tacticsboard/src/components/manage-teams/ManageTeamsTeamSetup.tsx)

### Arbete

1. Lata `Team roster` vara en ren vy ovanpa `team_members`.
2. Lata `Match board` vara en ren vy ovanpa boardoverride-data.
3. Visa tydligt:
   - `teamRole`
   - `teamPosition`
   - adminstatus
4. Sluta behandla `source` som ett halvdolt squadlager.
5. Lata `Save reusable team` bytas ut till lagbegrepp, till exempel:
   - `Save team changes`
   - `Save to team`

### Resultat

Team Manager speglar domanmodellen i stallet for den gamla squadmodellen.

## Etapp 6: Flytta boardskillnader till explicit override-modell

### Mål

Boarden ska bara lagra matchspecifika skillnader.

### Filer

- [TopBar.tsx](/c:/Dev/projects/tacticsboard/src/components/TopBar.tsx)
- [board.ts](/c:/Dev/projects/tacticsboard/src/models/board.ts) eller motsvarande
- [useProjectStore.ts](/c:/Dev/projects/tacticsboard/src/state/useProjectStore.ts)
- [projectHelpers.ts](/c:/Dev/projects/tacticsboard/src/state/projectHelpers.ts)
- [objectActions.ts](/c:/Dev/projects/tacticsboard/src/state/projectActions/objectActions.ts)

### Arbete

1. Gora boardoverrides tydliga for:
   - `overridePosition`
   - `overrideNumber`
   - `hiddenPlayerIds`
   - `guestPlayers`
2. Koppla overrides till `teamMemberId` i stallet for losa spelarkopior.
3. Se till att boardtoken-lankar ocksa bygger pa stabil identitet.

### Resultat

En `CAM` kan spela `CF` i en board utan att lagets grundtrupp andras.

## Etapp 7: Uppdatera boardobjekt och token-lankning

### Mål

Objekt pa planen ska peka mot lagmedlemmar, inte bara projektlokala spelarrader.

### Filer

- [BoardCanvas.tsx](/c:/Dev/projects/tacticsboard/src/board/BoardCanvas.tsx)
- [BoardObject.tsx](/c:/Dev/projects/tacticsboard/src/board/objects/BoardObject.tsx)
- [PropertiesPanel.tsx](/c:/Dev/projects/tacticsboard/src/components/panels/PropertiesPanel.tsx)
- [objectActions.ts](/c:/Dev/projects/tacticsboard/src/state/projectActions/objectActions.ts)

### Arbete

1. Lata spelarlankning bygga pa `teamMemberId`.
2. Behall projektlokal snapshotdata for snabb rendering.
3. Se till att om home/away-squads byts, overlever lankarna sa langt det ar rimligt via `teamMemberId`.

### Resultat

Spelarcirklar och lagmedlemmar far stabil relation over tid.

## Etapp 8: Match graphics, exports och andra beroenden

### Mål

Sekundara funktioner ska lasa fran den nya modellen utan att dubblera spelarinformation.

### Filer

- [MatchGraphicsModal.tsx](/c:/Dev/projects/tacticsboard/src/components/MatchGraphicsModal.tsx)
- [ShareBoardModal.tsx](/c:/Dev/projects/tacticsboard/src/components/ShareBoardModal.tsx)
- exportrelaterade helpers

### Arbete

1. Hamta nummer, namn och position i forsta hand via:
   - lagets grundtrupp
   - boardens overrides
2. Se till att `show in squad`, `substituteIds` och lineup-logik fortsatt fungerar nar `teamMemberId` ar primar identitet.

### Resultat

Export- och publiceringsfloden fortsatter fungera utan att aga separat squadlogik.

## Etapp 9: Fasa ut gammal modell i appen

### Mål

Legacytabeller och gamla adapters ska till slut inte vara primara.

### Filer

- [teamSquads.ts](/c:/Dev/projects/tacticsboard/src/persistence/teamSquads.ts)
- [defaultTeamSquads.ts](/c:/Dev/projects/tacticsboard/src/persistence/defaultTeamSquads.ts)
- eventuella gamla squadpreset-adapters

### Arbete

1. Markera gamla funktioner som legacy i kod och dokumentation.
2. Flytta skrivfloden helt till nya tabeller.
3. Ta bort fallback nar den inte langre behovs.

### Resultat

Appen arbetar konsekvent mot den nya modellen.

## Rekommenderad filordning att genomfora i

For att minimera regressionsrisk rekommenderas denna ordning:

1. [teamDirectory.ts](/c:/Dev/projects/tacticsboard/src/persistence/teamDirectory.ts)
2. [squad.ts](/c:/Dev/projects/tacticsboard/src/models/squad.ts)
3. [serialize.ts](/c:/Dev/projects/tacticsboard/src/persistence/serialize.ts)
4. [ProjectList.tsx](/c:/Dev/projects/tacticsboard/src/components/ProjectList.tsx)
5. [teamSquads.ts](/c:/Dev/projects/tacticsboard/src/persistence/teamSquads.ts)
6. `Manage teams`-komponenterna
7. board/store/action-lagret
8. export- och delningsfloden

## Rekommenderad forsta konkreta implementation

Den forsta faktiska kodetappen bor vara:

1. införa `teamMemberId` i squadmodellen
2. skapa snapshots fran `team_members`
3. lata `Create project` och `Manage teams` lasa denna data konsekvent

Det ar den minsta riktiga vändpunkten dar appen borjar arbeta utifran nya sanningskallan.

## Beslut som bor hallas fasta under implementationen

- lagets grundtrupp ar sanningskallan
- boarden far overrida men inte aga spelaren
- klubbroll, lagroll och position ar olika saker
- admin ar rattighet, inte roll
- Teamzone och Tacticsboard ska kunna dela organisationsdatan

## Rekommendation

Bygg inte fler stora UI-floden ovanpa den gamla squadmodellen nu.

Bygg i stallet nasta riktiga etapp pa:

- `team_members` som sanningskalla
- `teamMemberId` som stabil identitet
- boardoverride som separat skillnadslager

Da kommer resten av appen bli betydligt enklare att forsta, utveckla och koppla ihop med Teamzone.
