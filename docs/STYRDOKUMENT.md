# Styrdokument for Tacticsboard

## 1. Syfte och omfattning

Tacticsboard ar en webbaserad taktikbrada for fotboll. Appen ar byggd for att latta skapa, spara, presentera och dela taktiska upplagg for match, traning och utbildning. Produkten fungerar dels som ett rit- och presentationsverktyg, dels som ett enklare system for projektstyrning av tavlor, laguppstallningar, anteckningar, delning och publicering.

Detta dokument beskriver:

- vad appen gor ur anvandarperspektiv
- hur appen fungerar tekniskt bakom ytan
- vilka delar som ar centrala for drift, data och affarslogik
- vilka buggar och risker som bor prioriteras
- hur nuvarande funktioner bor vidareutvecklas
- vilka framtida funktioner som ar mest relevanta att planera for

## 2. Produktbeskrivning

### 2.1 Vad appen ar

Appen ar en onlineeditor for fotbollstaktik dar anvandaren arbetar i projekt. Varje projekt innehaller en eller flera boards. Varje board kan vara statisk eller dynamisk och innehalla objekt, spelare, bollar, former, pilar, frihandsritning, text, anteckningar, laguppstallningar och delningsinformation.

### 2.2 Vad anvandaren kan gora

Anvandaren kan i dagens kodbas:

- skapa projekt for match, traning eller utbildning
- skapa och hantera flera boards per projekt
- valja planvy, planoverlay, rotation och etikettvisning
- placera ut spelare, boll, koner, mal, pole, mannequin och text
- rita linjer, streckade linjer, pilar, streckade pilar, former och frihandslinjer
- markera, flytta, rotera, skala, lasa och ta bort objekt
- kopiera och klistra in objekt med tangentbordskommandon
- arbeta med lag och trupper, inklusive lagfarger, nummer, positioner och gaster
- koppla boll till spelare vid placering
- skapa formationer och utgangspositioner
- skapa dynamiska sekvenser med frames, spela upp dem och justera frame-metadata
- skriva projekt- och boardspecifika anteckningar med markdownstod
- anvanda fullskarmslage med ritlager ovanpa presentationen
- autospara lokalt
- synka projekt till molnet for inloggade betalande anvandare
- dela boards via e-post till andra anvandare
- kommentera delade boards
- publicera boards och projekt i publikt bibliotek
- skapa publik projektlank for delning via token
- exportera/importera projektdata
- oppna utskrifts-/PDF-flode
- installera appen som PWA

### 2.3 Primara anvandarlagen

Appen utgar i praktiken fran tre produktlagen:

- `Match`: fokus pa matchplan, spelmodell, fasta situationer och matchanteckningar
- `Training`: fokus pa traningsplanering, organisation, utrustning och delmal
- `Education`: fokus pa principer, reflektion och pedagogiskt material

Dessa lagen paverkar vilka forval, mallar och anteckningsfalt som visas i UI:t.

## 3. Synlig funktionalitet

### 3.1 Projektkonsol

Nar ingen aktiv board ar oppen visas projektkonsolen. Dar hanteras:

- skapande av nya projekt
- val av forinstallda boardmallar per produkttyp
- val av lagfarger och startformation
- lista over senaste projekt och favoriter
- oppning av sparade projekt och sampleprojekt
- import/export av projekt
- oversikt over delade boards
- publikt bibliotek for boards och projekt
- kontaktformular
- administrativa vyer for rapporter, anvandare och analytics

Projektkonsolen fungerar darfor bade som startsida och som enkel produktportal.

### 3.2 Editor

Editorn bestar av tre huvuddelar:

- toppbar med projekt- och boardkommandon
- canvas for taktiktavlan
- verktygspanel med ritverktyg, trupphantering, anteckningar, delning och framehantering

Pa mobil anvands en mer komprimerad layout med flytande toolbox och anpassad pitchvisning.

### 3.3 Canvas och board

Canvasen ar hjartat i appen. Den bygger pa `react-konva` och har funktioner for:

- rendering av plan och overlay
- drag and drop av objekt
- markeringsruta
- zoomyta och viewportstyrning
- rotering med snapping
- skalning med handtag
- highlight-effekter
- objektmeny for lasning och borttagning
- hantering av spelar-lankar
- enkel presentationsanimering i playback
- 3D-lage per board

Det finns skydd for renderingsfel genom en error boundary som faller tillbaka till sakert lage om canvasen kraschar.

### 3.4 Notes och presentationsstod

Anteckningar finns pa projekt- och boardniva. For traning, match och utbildning finns strukturerade falt ut over fri text. I fullskarmslage kan board visas tillsammans med anteckningar i delad layout eller overlay for mobil.

Det finns ocksa ett separat ritlager i fullskarmslaget for snabb coach-annotation ovanpa tavlan under presentation.

### 3.5 Delning och bibliotek

Appen har tre olika delningsmodeller:

- privat boarddelning till mottagare via e-post
- publik boardpublicering till bibliotek
- publik projektlank via token

For boarddelning finns rattigheter for `view` och `comment`. Det finns ocksa kommentarsflode per delad board.

### 3.6 PWA och mobilanvandning

Appen har manifest, service worker och klientregistrering for PWA. Det finns ocksa:

- pull-to-refresh i standalone/mobile
- notice for skarmstorlek
- knapp for att stanga app i standalone-lage
- layoutanpassning for coarse pointers och mindre viewport

## 4. Teknisk funktion bakom ytan

### 4.1 Frontend- och apparkitektur

Teknikstack:

- Next.js App Router
- React 19
- TypeScript
- Zustand med Immer
- Konva/react-konva
- Tailwind CSS
- Supabase
- Stripe

Appen ar huvudsakligen klientdriven. `src/app/page.tsx` laddar `AppShell`, som sedan vaxlar mellan projektkonsol och editor beroende pa om ett projekt ar oppet.

### 4.2 State management

Det finns tva centrala Zustand-stores:

- `useProjectStore`: innehaller projektdata, index, auth-anvandare, plan och synkstatus
- `useEditorStore`: innehaller aktivt verktyg, selection, viewport, playback, linking/highlighting och undo/redo-historik

Ansvarsfordelning:

- projektstore hanterar affarsobjekt och persistensnara operationer
- editorstore hanterar interaktionsnara UI-state

Detta ar en rimlig uppdelning och en av kodbasens tydligare styrkor.

### 4.3 Datamodell

Den centrala datamodellen bestar av:

- `Project`
- `Board`
- `BoardFrame`
- `DrawableObject`
- `Squad`
- delnings- och publiceringsmodeller

En `Project` innehaller metadata, installningar, boards och squads. En `Board` innehaller pitchinstallningar, anteckningar, spelaroverrides, frames, highlights och links. Varje `BoardFrame` innehaller en snapshot av objektlistan for just den framen.

Viktigt:

- frames lagrar hela objektuppsattningar, inte diffar
- boards sparas bade som projektdel och separat i en egen molntabell
- schemaVersion finns for migrering men nagon utvecklad migreringskedja syns inte i kodgenomgangen

### 4.4 Persistens

Appen har tva lagringslager:

- lokal lagring i `localStorage`
- molnlagring via Supabase

Lokal lagring ar grundlagret och fungerar aven utan inloggning. Molnlagring aktiveras framst for inloggade anvandare med betald plan.

Lokallagringens egenskaper:

- projektindex lagras separat
- projekt kan namespacas per anvandare
- vid kvotproblem kastas aldre projekt bort for att gora plats

Molnlagringens egenskaper:

- projektmetadata sparas i tabellen `projects`
- boards sparas separat i `project_boards`
- endast andrade boards skrivs om
- borttagna boards rensas separat
- synk anvander en ko per projekt for att undvika samtidiga skrivningar

### 4.5 Synk och offlinehantering

Online-synk ar byggd ovanpa lokal lagring och arbetar defensivt:

- lokalt arbete sparas forst
- vid online och betald plan triggas molnsynk
- offline-andringar markeras som dirty
- vid konflikt mellan lokal och moln visas losningsdialog
- anvandaren kan valja att behalla cloud, skriva over med lokal version eller exportera lokal backup

Detta ar en relativt mogen synkmodell for ett mindre projekt och visar att appen ar designad for intermittenta natverksscenarier.

### 4.6 Autentisering och planlogik

Autentisering sker via Supabase Auth. `AuthListener` skoter:

- initial sessionlasning
- auth-state change
- profilhamtning
- plansynk mot `profiles`
- enkel single-session-bevakning via tabellen `user_sessions`
- routing till password recovery

Planmodellen ar:

- `FREE`
- `AUTH`
- `PAID`

Kapabiliteter styrs i kod, bland annat for:

- sparning
- import/export
- videoexport
- formationer
- squad import/export
- board sharing
- kommentarer

Nuvarande grans:

- `FREE` och `AUTH` ar begransade till 1 projekt och 2 boards
- `PAID` har obegransade projekt och boards

### 4.7 Betalflode

Stripe anvands for abonnemang:

- checkout-session skapas via API-route
- webhook uppdaterar `profiles.plan`
- `stripe_customer_id` lagras i profil

Planstatus paverkar bade UI och vilka operationer som tillats i runtime.

### 4.8 Delning, publik data och moderation

Supabase-schemat visar att appen ocksa ar byggd som en liten delningsplattform:

- `board_shares` och `board_comments`
- `public_boards` och `public_board_reports`
- `public_projects` och `public_project_reports`
- `bug_reports`
- `contact_messages`
- `app_analytics_events`

Databasen anvander Row Level Security i stor omfattning, vilket ar positivt for dataskydd och fleranvandarlogik.

### 4.9 Analytics och driftinsyn

Appen skickar analytics-event for bland annat:

- session start
- heartbeat
- session end
- tool selection
- login

Det finns ocksa administrativa endpoints och vyer for:

- anvandarhantering
- rapporter
- analytics

Det betyder att produkten inte bara ar ett ritverktyg utan ocksa har embryot till intern drift- och supportfunktion.

## 5. Bedomning av nulaget

### 5.1 Styrkor

- tydlig produktkarn med stark editorfunktion
- bra separation mellan projektstate och editorstate
- genomtankt offline-first-tank
- flera delningsmodeller redan pa plats
- PWA-stod och mobilanpassning
- RLS-baserad dataskyddsmodell i databasen
- relativt rik domanmodell for trupper, boards och presentationsmaterial

### 5.2 Svagheter och teknisk skuld

- flera centrala komponenter ar mycket stora, framst `ProjectList`, `TopBar`, `Toolbox` och `BoardCanvas`
- mycket affarslogik ligger i UI-komponenter i stallet for i tjanstelager eller separata hooks
- import/export- och publiceringsfloden verkar till stor del klientdrivna och beroende av korrekt frontend-state
- dokumentation av arkitektur, ansvar, drift och roadmap saknades innan detta dokument
- testtackning verkar mycket begransad; endast en tydlig testfil syns i persistence-lagret
- schemaVersion finns men migreringsstrategi framstar som ofullstandig

### 5.3 Produktmassiga risker

- Free/Auth-begransningarna ar hardkodade i appen och kan bli svarta att utveckla utan central feature-flag-strategi
- publika bibliotek riskerar kvalitetsproblem utan tydligare moderationsfloden
- kommentarer ar bundna till delning men saknar tydliga notifikations- och arbetsfloden utover polling
- single-session-logiken kan skapa friktion om anvandare jobbar parallellt pa flera enheter

## 6. Prioriterat arbete: buggfix

Foljande bugg- och stabilitetsarbete bor prioriteras for att minska supportbehov och datarisk:

### 6.1 Kritiska buggfixar

1. Sakerstall dataintegritet mellan frame-snapshots, board-data och molnsynk.
2. Verifiera att export/import alltid bevarar `boards`, `frames`, `squads`, `notesFields`, `playerLinks` och `squadOverrides`.
3. Hardtesta konfliktlosning mellan lokal dirty-data och cloud-data.
4. Granska kvotbeteende i `localStorage` sa att projekt inte forsvinner pa ett ovantat satt for anvandaren.
5. Verifiera att fullskarmslage, 3D-lage och thumbnail-capture inte kan hamna i inkonsekvent state efter avbrutna operationer.

### 6.2 Hoga prioriteringar

1. Gora robust felhantering runt Supabase-anrop, sarskilt i delning, publicering och admin.
2. Sakerstalla att mobile toolbox, flytande paneler och pointer-interaktioner beter sig konsekvent pa iOS/Android.
3. Validera att single-session-guard inte oavsiktligt loggar ut aktiv anvandare med osparat arbete.
4. Hardna publiceringsfloden sa att ofullstandiga boards/projekt inte kan publiceras.

### 6.3 Rekommenderade tekniska atgarder

- infor fler integrationstester for serialize/deserialize och sync
- lagg till e2e-tester for skapa projekt, editera board, dela board och publicera board
- bygg central felrapportering med tydligare felkoder

## 7. Prioriterat arbete: vidareutveckling av nuvarande funktioner

### 7.1 Editor och canvas

- bryt ut `BoardCanvas` i mindre delar: rendering, interaction, playback, overlays, object actions
- bygg tydligare object inspector med separata sektioner for position, stil, animation och relationer
- ersatt prompt-liknande eller enkla textfloden med tydligare inline-redigering dar det ar relevant
- utveckla 3D-vyn till ett mer kontrollerat presentationslage i stallet for enbart board-flagga

### 7.2 Notes och planering

- standardisera anteckningsmallar per `match`, `training` och `education`
- lagg till mojlighet att exportera notes tillsammans med board/projekt i ett presentationspaket
- koppla frames tydligare till notes och coachbudskap

### 7.3 Delning och samarbete

- infor tydligare inkorg for delade boards och kommentarer
- bygg notifikationsmodell for nya shares och nya kommentarer
- forbattra oversikten for "delat av mig" med status, senaste aktivitet och snabbaterkallelse

### 7.4 Projektkonsol

- bryt ut admin, bibliotek, delning och projektlista till separata moduler eller routes
- gor filtrering, favoriter och templates mer konsekventa
- lyft fram skillnaden mellan privata projekt, publika projekt och delade boards tydligare i UX

### 7.5 Kodstruktur

- flytta affarslogik ur stora UI-komponenter till services/hooks
- skapa tydligt domanskikt for sharing, publishing, analytics, templates och squads
- inforskrivna granskriterier for nya features: test, dokumentation, telemetri och fallback

## 8. Prioriterat arbete: framtida funktioner

### 8.1 Hogsannolika produktsteg

1. Realtidssamarbete pa samma board eller projekt.
2. Versionshistorik med named snapshots och aterstallning.
3. Battrre videoexport eller presentationsspelare med overganger.
4. Rikare mallsystem for klubbar, sessioner och motstandaranalys.
5. Rollstyrning for teamkonton, flera coacher och delade arbetsytor.

### 8.2 Strategiskt viktiga funktioner

1. Kommentarer kopplade till specifik frame eller objekt med visuell markering i canvas.
2. Bibliotek med kvalitetssakring, moderation och curatorfloden.
3. Molnbaserad backup/restore for alla planer, inte bara betald synk.
4. Avancerad sokning i publika boards/projekt baserat pa kategori, taggar, formation, fas och kontext.
5. Bredare exportsystem: PDF-layoutmallar, bildserier, presentationsslides och match-/traningsrapporter.

### 8.3 Tekniska framtidsinvesteringar

- migrationsramverk for `schemaVersion`
- central feature-flag- och planmotor
- serverdriven moderations- och adminmodell
- observability for syncfel, exportfel och publiceringsfel
- teststrategi med enhetstest, integrations- och e2e-test

## 9. Rekommenderad styrning framover

For att appen ska kunna forvaltas och utvecklas kontrollerat bor projektet styras efter foljande principer:

### 9.1 Produktprinciper

- offline-first ska bevaras
- ingen ny premiumfunktion ska byggas utan tydlig planregel och fallback
- delning och publik publicering ska behandlas som separata produktomraden
- mobil anvandning ska ses som primar presentationsyta, inte sekundar

### 9.2 Tekniska principer

- ny affarslogik ska i forsta hand ligga utanfor stora UI-komponenter
- datamodellandringar ska alltid foljas av migreringsplan
- alla synk- och delningsfloden ska vara testbara utan manuell UI-verifiering
- felvagar ska vara explicita och loggbara

### 9.3 Leveransprinciper

Varje storre andring bor innehalla:

- teknisk beskrivning
- paverkan pa plan/behorighet
- testfall
- fallback vid offline eller API-fel
- uppdatering av detta styrdokument vid behov

## 10. Sammanfattning

Tacticsboard ar redan mer an en enkel taktikbrada. Kodbasen visar en produkt med editor, projektmodell, anteckningssystem, laghantering, delning, publik publicering, betalplaner, PWA-stod och administrativ uppfoljning.

Nasta steg bor inte i forsta hand vara att lagga till manga nya funktioner snabbt. Det viktigaste ar att stabilisera synk, bryta upp de stora komponenterna, oka testtackningen och gora delning/publicering mer robusta. Nar det ar gjort finns goda forutsattningar att bygga realtidssamarbete, versionshantering och starkare presentations- och exportfloden ovanpa en betydligt mer hallbar grund.
