# Utvecklingsdokument for Tacticsboard

## Syfte

Detta dokument ar ett arbetsdokument baserat pa styrdokumentet. Det ar framtaget for att kunna anvandas stegvis i utvecklingen och uppdateras lopande genom att uppgifter markeras som klara.

Varje steg innehaller:

- en checklista med konkreta uppgifter
- en forklaring av vad steget ar
- vad det innebar for koden
- varfor det behovs

## Hur dokumentet ska anvandas

- Markera en uppgift som klar genom att andra `[ ]` till `[x]`.
- Uppdatera status nar kod, test och verifiering faktiskt ar gjord.
- Om ett steg delas upp ytterligare, lagg till nya delpunkter under samma etapp.
- Om en uppgift andras i omfattning, uppdatera forklaringen sa att dokumentet fortsatter vara styrande.

## Statusnivaer

- `[ ]` Ej paborjad
- `[x]` Klar

## Etapp 1: Stabilisering och datatillit

### Mal

Sakerstalla att appens viktigaste datafloden ar stabila innan fler storre funktioner byggs vidare.

### Varfor denna etapp behovs

Appen ar stark funktionellt, men den bygger pa flera komplexa floden samtidigt: lokal lagring, molnsynk, frame-snapshots, delning, publicering och export. Om datan inte ar stabil riskerar framtida utveckling att bygga vidare pa felaktiga antaganden.

### Vad det innebar for koden

Denna etapp ror framst:

- `src/persistence/*`
- `src/state/useProjectStore.ts`
- `src/persistence/useOnlineSync.ts`
- serialisering, import/export och conflict handling

### Nulagesobservationer

Efter genomgang av kodbasen finns redan nagra tydliga observationer som ska styra arbetet i Etapp 1:

- `serialize.ts` gor idag bara en grund validering av projektets toppniva.
- Det finns bara en enkel testfil for serialisering och den verifierar inte avancerade falt.
- Synklogiken ar relativt mogen, men konflikt- och fallbackfloden ar komplexa nog att kravja fler tester.
- Avancerade boardfalt som `playerLinks`, `notesFields` och `squadOverrides` finns i modellen men ar inte tydligt hardtestade.
- Lokal lagring har fallback vid kvotproblem, men den ar produktmassigt kanslig eftersom den kan ta bort aldre projekt.

### Genomforandeordning for Etapp 1

Vi genomfor Etapp 1 i foljande ordning for att minska risk:

1. Kartlagga exakt vilka datatyper och floden som maste skyddas.
2. Skriva tester som beskriver onskat beteende.
3. Harda serialisering, import/export och synk dar tester visar luckor.
4. Verifiera edge cases for lokal lagring, conflict handling och presentationslagen.

### Delsteg for att starta Etapp 1

- [x] Kartlagga Etapp 1 mot faktisk kodbas.
  Vad det ar: En teknisk genomlysning av serialize, project actions, board actions, object actions, squad actions och online sync.
  Vad det innebar for koden: Ingen produktionskod andras i detta steg, men det definierar var riskerna faktiskt finns.
  Varfor det behovs: Utan den kartlaggningen riskerar vi att skriva fel tester eller missa kritiska datafalt.

- [ ] Ta fram en testmatris for dataintegritet.
- [x] Ta fram en testmatris for dataintegritet.
  Vad det ar: En konkret lista over vilka falt och floden som maste verifieras.
  Vad det innebar for koden: Nya testfall ska formuleras for save/load, export/import, cloud sync och conflict handling.
  Varfor det behovs: Det gor Etapp 1 matbar och avgransad.

- [x] Utoka serialiseringstesterna med avancerade boardfalt.
  Vad det ar: Nya tester som verifierar att riktiga projekt med komplex boarddata overlever roundtrip.
  Vad det innebar for koden: `src/persistence/serialize.test.ts` eller nya testfiler byggs ut kraftigt.
  Varfor det behovs: Nuvarande testtackning ar for tunn for att skydda kritisk data.

- [x] Verifiera save/load via `storage.ts` med anvandarscope och kvotscenarier.
  Vad det ar: Testning av lokal persistens, indexuppdatering och fallbacklogik.
  Vad det innebar for koden: Lokallagring maste goras testbar och verifieras pa riktigt.
  Varfor det behovs: Lokal lagring ar appens baslager och far inte vara en blind flack.

- [x] Verifiera att board- och object-actions inte skapar inkonsekvent state.
  Vad det ar: Testning av hur boards, frames, objects och squads uppdateras i store-actions.
  Vad det innebar for koden: Nya tester kring stateforandringar och eventuella justeringar i actions.
  Varfor det behovs: Mycket datalogik ligger direkt i stores och maste vara tillforlitlig.

- [x] Verifiera sync- och konfliktfloden i isolerade tester.
  Vad det ar: Testning av dirty-state, cloud/local-val och konfliktupplosning.
  Vad det innebar for koden: Synclagret kan behova delas upp eller mockas tydligare for att bli testbart.
  Varfor det behovs: Det ar har de dyraste dataproblemen uppstar.

### Testmatris for Etapp 1

Foljande matris definierar miniminivan for dataintegritet i denna etapp.

#### A. Projektets toppniva

- [ ] Projekt roundtrip bevarar `id`, `name`, `schemaVersion`, `settings`, `sessionNotes`, `sessionNotesFields`, `boards`, `squads` och `activeBoardId`.
  Vad det ar: Basverifiering av hela projektets struktur.
  Vad det innebar for koden: Serialize/deserialize maste klara ett komplett projekt, inte bara en minimal struktur.
  Varfor det behovs: Detta ar baskontraktet for all lagring och import/export.

- [ ] Projekt med flera boards och flera squads roundtrippar utan att relationer tappas.
  Vad det ar: Kontroll av referenser mellan boards och squads.
  Vad det innebar for koden: `homeSquadId`, `awaySquadId` och squad-listan maste forbli konsekventa.
  Varfor det behovs: Relationstapp ger snabbt trasiga boards i UI.

#### B. Boardniva

- [ ] Board roundtrip bevarar `mode`, `pitchView`, `pitchRotation`, `pitchOverlay`, `pitchOverlayText`, `threeDView`, `threeDStrength`, `watermarkEnabled` och `watermarkText`.
  Vad det ar: Kontroll av boardens visnings- och presentationsinstallningar.
  Vad det innebar for koden: Alla boardfalt maste overleva serialisering och import/export.
  Varfor det behovs: Dessa installningar styr bade rendering och export.

- [ ] Board roundtrip bevarar `notes`, `notesTemplate` och `notesFields`.
  Vad det ar: Kontroll av fri text och strukturerade notesmallar.
  Vad det innebar for koden: Notesmodellen maste behandlas som forstklassig data, inte bara UI-state.
  Varfor det behovs: Notes ar ett eget produktvarde i appen.

- [ ] Board roundtrip bevarar `playerLabel`, `playerHighlights`, `playerLinks` och `squadOverrides`.
  Vad det ar: Kontroll av de mer avancerade boardrelationerna.
  Vad det innebar for koden: Testerna maste inkludera komplex boarddata, inte bara sampleprojektets nuvarande grundfall.
  Varfor det behovs: Detta ar de falt som mest sannolikt missas vid framtida andringar.

#### C. Frameniva

- [ ] Frame roundtrip bevarar `id`, `name`, `action`, `notes`, `durationMs`, `playerHighlights` och `playerLinks`.
  Vad det ar: Kontroll av frame metadata ut over objektlistan.
  Vad det innebar for koden: Frameobjekt maste testas som egna enheter i boardstrukturen.
  Varfor det behovs: Dagens app bygger dynamiska tavlor pa just dessa snapshots.

- [ ] Frame roundtrip bevarar objektordning och object count.
  Vad det ar: Kontroll av att inget tappas eller flyttas i listor.
  Vad det innebar for koden: Tester ska jamfora antal och identitet per frame.
  Varfor det behovs: Objektordning kan paverka rendering och anvandarupplevelse.

#### D. Objekt- och drawable-niva

- [ ] Samtliga drawables ska testas i minst ett roundtrip-fall.
  Vad det ar: Ett testunderlag som inkluderar `player`, `ball`, `cone`, `pole`, `mannequin`, `goal`, `circle`, `rect`, `triangle`, `arrow`, `text` och `path`.
  Vad det innebar for koden: Vi behover ett rikare testprojekt an dagens sampledata.
  Varfor det behovs: Alla objekt maste vara skyddade mot regressionsfel.

- [ ] Player-specifika falt ska verifieras: `squadPlayerId`, `boardPositionLabel`, `hasBall`, `showName`, `showPosition`, `showNumber`, `tokenSize`, `vestColor`, `moveControl`.
  Vad det ar: Kontroll av spelarobjektets domanspecifika data.
  Vad det innebar for koden: Testdata maste inkludera bade enkla och avancerade player tokens.
  Varfor det behovs: Spelarobjektet ar det viktigaste objektet i produkten.

- [ ] Arrow- och path-specifika falt ska verifieras: `points`, `head`, `dashed`, `curved`, `control`, `linkedToId`.
  Vad det ar: Kontroll av ritobjekt med mer komplex geometri.
  Vad det innebar for koden: Testdata maste inkludera bade raka och kurvade fall.
  Varfor det behovs: Just dessa objekt riskerar ofta att skadas i serialisering eller kloning.

- [ ] Text- och shape-specifika falt ska verifieras: `text`, `fontSize`, `bold`, `background`, `align`, `width`, `height`, `cornerRadius`, `radius`.
  Vad det ar: Kontroll av objekt med egenskaper som avviker fran standardobjekt.
  Vad det innebar for koden: Testerna maste ha verkligt varierad objectdata.
  Varfor det behovs: Dessa falt ar typiska regressionskandidater nar modellen utvecklas.

#### E. Squad- och relationniva

- [ ] Squad roundtrip bevarar `kit`, `clubLogo`, `captainId`, `substituteIds` och samtliga spelarfalt.
  Vad det ar: Kontroll av squadmodellen och dess spelare.
  Vad det innebar for koden: Testprojektet maste innehalla mer an bara grundspelare.
  Varfor det behovs: Boards och squads ar tatt kopplade via referenser.

- [ ] Import av delad board via snapshot skapar nya squad- och player-id:n utan att relationer bryts.
  Vad det ar: Kontroll av `addBoardFromSnapshot`.
  Vad det innebar for koden: Store-actions och snapshotimport maste testas isolerat.
  Varfor det behovs: Delning och bibliotek bygger pa att denna kloning ar korrekt.

#### F. Persistensfloden

- [ ] `serialize -> deserialize` verifieras for ett komplett projekt med komplex data.
  Vad det ar: Basflodet for projektdata.
  Vad det innebar for koden: Testerna bor utvecklas i `serialize.test.ts` eller delas upp i flera testfiler.
  Varfor det behovs: Detta ar den enklaste men viktigaste kontraktsnivån.

- [ ] `saveProject -> loadProject` verifieras for komplext projektdata och anvandarscope.
  Vad det ar: Kontroll av lokal lagring.
  Vad det innebar for koden: `storage.ts` behover sannolikt mockad eller kontrollerad localStorage i tester.
  Varfor det behovs: Lokal persistens ar grunden for offline-first.

- [ ] `saveProjectIndex -> loadProjectIndex` verifieras for sortering och anvandarscope.
  Vad det ar: Kontroll av indexets beteende.
  Vad det innebar for koden: Testerna ska kontrollera sortering pa `updatedAt`.
  Varfor det behovs: Projektkonsolen ar beroende av att indexet ar korrekt.

- [ ] Kvotscenarier i lokal lagring verifieras.
  Vad det ar: Test av fallback nar `localStorage` ar full.
  Vad det innebar for koden: Behova simulera kvotfel i tester.
  Varfor det behovs: Det ar ett explicit riskomrade i dagens implementation.

#### G. Synk- och konfliktfloden

- [ ] Sync verifierar att lokal nyare data inte skrivs over felaktigt av molndata.
  Vad det ar: Kontroll av merge- och pick-logik mellan local och cloud.
  Vad det innebar for koden: `cloud.ts` och `coreActions.ts` behover testas med mockad clouddata.
  Varfor det behovs: Detta ar ett av de viktigaste dataskydden i appen.

- [ ] Konfliktvalen `cloud`, `local` och `export` verifieras.
  Vad det ar: Kontroll av alla utfall i konfliktmodalens logik.
  Vad det innebar for koden: `useOnlineSync.ts` och konfliktbridge maste bli testbara via mockning.
  Varfor det behovs: Alla val ska vara begripliga och sakerhetsmassigt korrekta.

- [ ] Offline dirty-markering och aterstallning vid lyckad sync verifieras.
  Vad det ar: Kontroll av dirty-listan fore och efter synk.
  Vad det innebar for koden: `offlineDirty.ts` och synkfloden maste testas tillsammans.
  Varfor det behovs: Offline-first fungerar bara om dirty-state ar korrekt.

#### H. Store actions

- [ ] `boardActions`, `objectActions` och `squadActions` verifieras med fokus pa uppdaterad `updatedAt` och konsekvent state.
  Vad det ar: Testning av store-actions som manipulerar projektets data direkt.
  Vad det innebar for koden: Nya tester kring mutationer, framebyte, object updates och squadrelationer.
  Varfor det behovs: En stor del av affarslogiken ligger direkt i state-lagret.

### Uppgifter

- [ ] Verifiera att frame-data alltid sparas och aterlases korrekt i alla board-lagen.
  Vad det ar: En kontroll av att varje frame behaller sina objekt, metadata och relationer.
  Vad det innebar for koden: Serialize/deserialize, boarduppdateringar och framehantering maste granskas och testas.
  Varfor det behovs: Frames ar centrala for dynamiska tavlor och far inte forlora innehall.

- [ ] Verifiera att `playerLinks`, `playerHighlights`, `notesFields` och `squadOverrides` overlever save/load/export/import.
  Vad det ar: En dataintegritetskontroll for de mer avancerade boardfalten.
  Vad det innebar for koden: Testfall och sannolikt hardning i import/export- och persistence-lagret.
  Varfor det behovs: Dessa falt ar latta att missa i serialisering och orsakar annars tysta dataforluster.

- [ ] Granska conflict flow mellan lokal dirty-data och cloud-data.
  Vad det ar: En genomgang av hur appen beter sig nar lokal offline-data skiljer sig fran molnversionen.
  Vad det innebar for koden: `useOnlineSync`, `cloud.ts`, dirty-markering och konfliktmodalen kan behova justeras.
  Varfor det behovs: Konflikter ar en av de hogsta riskerna for dataforlust och anvandarfrustration.

- [x] Sakerstalla att kvotproblem i `localStorage` inte leder till overaskande dataforlust.
  Vad det ar: En kontroll av nuvarande fallback som tar bort aldre projekt nar plats saknas.
  Vad det innebar for koden: Lokallagring och indexhantering kan behova tydligare regler eller varningar.
  Varfor det behovs: Nuvarande beteende kan vara tekniskt rimligt men produktmassigt riskabelt.

- [x] Verifiera att thumbnail-capture, fullskarmslage och 3D-lage alltid aterstaller state korrekt.
  Vad det ar: En stabilitetsgranskning av mer tillfalliga presentationslagen.
  Vad det innebar for koden: `BoardCanvas`, `EditorLayout` och `ShareBoardModal` bor testas och eventuellt hardas.
  Varfor det behovs: Temporara UI-lagen far inte lamna appen i fel state efter avbrott eller fel.

- [ ] Lagg till integrationstester for serialisering, synk och import/export.
  Vad det ar: Testning av de viktigaste dataflodena utanfor UI.
  Vad det innebar for koden: Nya testfiler och testbar struktur i persistence-lagret.
  Varfor det behovs: Datatillit maste verifieras automatiskt, inte bara manuellt.

## Etapp 2: Hardning av delning, publicering och kommentarer

### Mal

Gora samarbets- och publiceringsfunktionerna tillforlitliga och enklare att forvalta.

### Varfor denna etapp behovs

Delning och publik publicering ar redan centrala delar av produkten, men de medfor risker kring behorighet, felhantering, moderation och anvandarforstaelse.

### Vad det innebar for koden

Denna etapp ror framst:

- `src/components/ShareBoardModal.tsx`
- `src/components/CommentsModal.tsx`
- `src/components/ProjectList.tsx`
- `src/persistence/shares.ts`
- `src/persistence/publicLibrary.ts`
- `src/persistence/publicProjects.ts`
- Supabase-tabeller for shares, comments, public boards och public projects

### Uppgifter

- [ ] Gora felhanteringen tydligare i board sharing och project sharing.
  Vad det ar: Tydligare hantering av API-fel, offline-lage och valideringsfel.
  Vad det innebar for koden: Fler enhetliga felmeddelanden och tydligare statusflode i delningskomponenterna.
  Varfor det behovs: Delning ar en premiumfunktion och maste upplevas som stabil.

- [ ] Hardna publiceringsflodet sa att ofullstandigt eller trasigt innehall inte kan publiceras.
  Vad det ar: Validering innan board eller projekt skickas till publikt bibliotek.
  Vad det innebar for koden: Publiceringsfunktionerna bor fa tydligare preflight-kontroller.
  Varfor det behovs: Publikt innehall speglar produktens kvalitet utat.

- [ ] Forbattra kommentarflodet for delade boards.
  Vad det ar: Tydligare laddning, tomma lagen, permissionlogik och uppdatering av kommentarer.
  Vad det innebar for koden: Kommentarlogik bor brytas ut och goras mer robust.
  Varfor det behovs: Kommentarer ar samarbetsytan och far inte vara otydliga eller opalitliga.

- [ ] Lagg till tester for behorighet och permissionfloden runt `view` och `comment`.
  Vad det ar: Verifiering av vem som far lasa, kommentera och hantera delade boards.
  Vad det innebar for koden: Testning kring persistence-lager och eventuella guardfunktioner.
  Varfor det behovs: Behorighetsfel blir snabbt bade produkt- och supportproblem.

- [ ] Definiera en enklare moderationsrutin for publikt bibliotek.
  Vad det ar: Ett forsta praktiskt arbetsflode for rapporterat innehall.
  Vad det innebar for koden: Kan innebara mindre adminforbattringar och tydligare statusfloden.
  Varfor det behovs: Publikt innehall utan moderation skapar kvalitetsrisker.

## Etapp 3: Refaktorering av stora komponenter

### Mal

Minska teknisk skuld genom att bryta upp stora och svarforvaltade UI-komponenter.

### Varfor denna etapp behovs

Kodbasens storsta forvaltningsrisk just nu ar att flera nyckelkomponenter ar mycket stora och innehaller for mycket blandad logik. Det forsvagar testbarhet, lasbarhet och vidareutveckling.

### Vad det innebar for koden

Denna etapp ror framst:

- `src/components/ProjectList.tsx`
- `src/components/TopBar.tsx`
- `src/components/toolbox/Toolbox.tsx`
- `src/board/BoardCanvas.tsx`

### Uppgifter

- [ ] Bryt ut `BoardCanvas` i mindre moduler.
  Vad det ar: Dela upp rendering, interactions, overlays, playback och object actions i separata enheter.
  Vad det innebar for koden: Fler filer och tydligare ansvar for canvaslagret.
  Varfor det behovs: `BoardCanvas` ar idag for stor for att vara latt att utveckla sakert.

- [ ] Bryt ut `ProjectList` i separata delar for projekt, delning, bibliotek, kontakt och admin.
  Vad det ar: Strukturering av startsidan i mindre komponenter eller routes.
  Vad det innebar for koden: En tydligare modulstruktur i komponentlagret.
  Varfor det behovs: Projektkonsolen har blivit ett helt produktomrade och bor inte ligga i en enda fil.

- [ ] Bryt ut `TopBar` i separata ansvarsomraden.
  Vad det ar: Separera board actions, project actions, export, share, squad management och settings.
  Vad det innebar for koden: Mindre komponenter och tydligare statefloden.
  Varfor det behovs: Topbaren har vuxit till en kontrollcentral med for mycket blandad logik.

- [ ] Bryt ut `Toolbox` i egna sektioner for tools, notes, squad, frames och shared/comments.
  Vad det ar: En uppdelning efter faktisk funktion.
  Vad det innebar for koden: Lattare att testa, lasa och vidareutveckla varje panel for sig.
  Varfor det behovs: Toolboxen blandar idag ritfunktioner och affarslogik i samma komponent.

- [ ] Flytta affarslogik fran UI-komponenter till hooks eller services.
  Vad det ar: Separera presentationskod fran verksamhetslogik.
  Vad det innebar for koden: Fler domannara hjalpmoduler och mindre komponenter.
  Varfor det behovs: Det ger battre testbarhet och minskar risken for regressionsfel.

## Etapp 4: Forbattring av editorupplevelsen

### Mal

Gora editorn snabbare att anvanda, mer begriplig och enklare att utoka.

### Varfor denna etapp behovs

Editorn ar produktens karnfunktion. Nar grundstabiliteten ar saker ska fokus flyttas till arbetsflode, tydlighet och anvandbarhet.

### Vad det innebar for koden

Denna etapp ror framst:

- canvasinteraktioner
- properties panel
- toolbox
- notes och framehantering

### Uppgifter

- [ ] Bygg en tydligare object inspector.
  Vad det ar: En battre egenskapspanel for markerade objekt.
  Vad det innebar for koden: `PropertiesPanel` kan behova ny struktur for position, stil, animation och relationer.
  Varfor det behovs: Det blir enklare att justera objekt utan att sprida logik over flera ytor.

- [ ] Forbattra textredigering och inline-redigering dar det ar relevant.
  Vad det ar: Smidigare redigering av text, namn och metadata direkt i relevanta sammanhang.
  Vad det innebar for koden: UI-floden for text och metadata kan behova skrivas om delvis.
  Varfor det behovs: Nuvarande floden ar funktionella men inte sarskilt effektiva.

- [ ] Forbattra frameflodet for dynamiska boards.
  Vad det ar: Tydligare arbete med frameordning, metadata, duration och playhead.
  Vad det innebar for koden: `FramesBar`, playback-state och frameeditor kan behova forbattras.
  Varfor det behovs: Dynamiska tavlor ar en viktig skillnad mot enklare whiteboard-verktyg.

- [ ] Forbattra mobilupplevelsen i editor och toolbox.
  Vad det ar: Finjustering av interaktioner, paneloppning, scroll, touch och viewport.
  Vad det innebar for koden: Mobile layout i `EditorLayout` och canvasens pointerlogik bor trimmas.
  Varfor det behovs: Mobil ar redan en viktig presentationsyta i appen.

- [ ] Utveckla 3D-laget till en tydligare presentationsfunktion.
  Vad det ar: Ett mer avsiktligt presentationslage i stallet for en ensam board-flagga.
  Vad det innebar for koden: Tydligare state och sannolikt separat presentationlogik.
  Varfor det behovs: Funktionen blir mer begriplig och enklare att bygga vidare pa.

## Etapp 5: Notes, planering och mallar

### Mal

Gora appen starkare som verktyg for planering, utbildning och coachkommunikation.

### Varfor denna etapp behovs

Tacticsboard ar inte bara en ritboard. Den innehaller redan strukturerade anteckningar och produktlagen `match`, `training` och `education`. Det bor utvecklas till en tydligare planeringsprodukt.

### Vad det innebar for koden

Denna etapp ror framst:

- notesfalten pa projekt- och boardniva
- templates
- export av presentationsmaterial

### Uppgifter

- [ ] Standardisera notesmallarna for match, training och education.
  Vad det ar: En genomgang av falt, namn och forval sa att de blir konsekventa.
  Vad det innebar for koden: Datamodell och formularkomponenter kan behova justeras.
  Varfor det behovs: Konsekventa mallar ger tydligare anvandarfloden och battre datakvalitet.

- [ ] Koppla notes tydligare till frames och boards.
  Vad det ar: En starkare relation mellan visuellt innehall och coachens budskap.
  Vad det innebar for koden: Frame- och noteslogik kan behova knytas samman battre.
  Varfor det behovs: Det gor tavlorna mer anvandbara i presentation och planering.

- [ ] Forbattra templatehanteringen for projekt och boards.
  Vad det ar: Smidigare skapande, sparning, namnbyte och ateranvandning av mallar.
  Vad det innebar for koden: Templatefloden i `TopBar`, `ProjectList` och persistence-lagret kan utvecklas vidare.
  Varfor det behovs: Mallar ar en nyckel for att oka vardet for aterkommande anvandare.

- [ ] Planera ett gemensamt exportflode for board + notes.
  Vad det ar: Ett mer komplett presentations- eller rapportuttag.
  Vad det innebar for koden: PDF/print-flodet kan behova byggas ut med notes och ordnad layout.
  Varfor det behovs: Anvandaren vill ofta exportera mer an bara sjalva tavlan.

## Etapp 6: Test, observability och driftstod

### Mal

Bygga en mer professionell grund for kvalitetssakring och drift.

### Varfor denna etapp behovs

Ju fler premium-, sync- och delningsfunktioner appen far, desto viktigare blir testbarhet och driftinsyn.

### Vad det innebar for koden

Denna etapp ror framst:

- testkonfiguration
- analytics
- adminfloden
- felrapportering

### Uppgifter

- [ ] Etablera en tydlig teststrategi for unit, integration och e2e.
  Vad det ar: En definierad modell for vad som ska testas pa vilken niva.
  Vad det innebar for koden: Fler tester, tydligare struktur och sannolikt testhjalpare.
  Varfor det behovs: Testning maste bli en del av utvecklingsprocessen, inte en eftertanke.

- [ ] Bygg ut integrationstester for sync, auth och sharing.
  Vad det ar: Testning av de mest affarskritiska flodena.
  Vad det innebar for koden: Testbarare abstrahering runt persistence och auth.
  Varfor det behovs: Dessa floden ar svara att validera endast manuellt.

- [ ] Definiera en enklare observability-modell.
  Vad det ar: Besluta vilka fel och handelser som ska kunna foljas upp systematiskt.
  Vad det innebar for koden: Analytics och felrapportering kan behova kompletteras.
  Varfor det behovs: Utan driftinsyn blir premiumfloden svara att forvalta.

- [ ] Forbattra adminstoden for rapporter och analys.
  Vad det ar: Tydligare arbetsyta for support, moderation och produktuppfoljning.
  Vad det innebar for koden: Adminflodena i projektkonsolen eller separata routes kan utvecklas vidare.
  Varfor det behovs: Produktens backendfunktioner ar redan pa vag att bli affarskritiska.

## Etapp 7: Produktfunktioner for nasta fas

### Mal

Forbereda de storre funktionerna som kan lyfta produkten efter att grunden ar stabil.

### Varfor denna etapp behovs

Nar stabilitet, delning och kodstruktur ar under kontroll oppnas utrymme for strategiska funktioner som kan skilja produkten fran enklare konkurrenter.

### Vad det innebar for koden

Denna etapp ar framtung och bor paborjas forst nar tidigare etapper ar tillrackligt langt komna.

### Uppgifter

- [ ] Utred realtidssamarbete.
  Vad det ar: Mojlighet for flera anvandare att arbeta i samma board eller projekt samtidigt.
  Vad det innebar for koden: Ny syncmodell, konflikthantering och sannolikt serverdriven narvaro.
  Varfor det behovs: Det ar en naturlig premium- och teamfunktion.

- [ ] Utred versionshistorik och snapshots.
  Vad det ar: Mojlighet att spara, namnge och aterstalla tidigare lagen.
  Vad det innebar for koden: Datamodell, lagring och UI for historik.
  Varfor det behovs: Det minskar risk vid experimenterande och okar tryggheten i arbetet.

- [ ] Utred starkare export- och presentationsfloden.
  Vad det ar: Export till PDF, bildserier, presentationsslides eller video med tydlig layout.
  Vad det innebar for koden: Nya exportpipeline-floden och eventuellt serverside-generering.
  Varfor det behovs: Presentationsvardet ar centralt for produktens nytta.

- [ ] Utred teamkonton och rollstyrning.
  Vad det ar: Flera coacher, gemensamma arbetsytor och tydliga roller.
  Vad det innebar for koden: Datan, authfloden och behorighetsmodellen blir mer avancerade.
  Varfor det behovs: Det ar ett naturligt steg om produkten ska vaxa mot organisationer och klubbar.

- [ ] Utred mer avancerad moderation och kvalitetssakring for publikt bibliotek.
  Vad det ar: Ett mer moget flode for granskning, flaggning och curatorarbete.
  Vad det innebar for koden: Adminverktyg, statusfloden och regler for synlighet.
  Varfor det behovs: Det publika biblioteket blir annars svart att skala utan kvalitetsproblem.

## Lopande arbetsregler

Foljande punkter ska galla i varje etapp:

- [ ] Alla storre andringar ska dokumenteras kort i relevant dokumentation.
  Vad det ar: En enkel regel for att undvika att kunskap fastnar i kod eller huvud.
  Vad det innebar for koden: Ingen direkt kodpaverkan, men starkare forvaltning.
  Varfor det behovs: Dokumentation ar en del av leveransen.

- [ ] Alla datamodellandringar ska foljas av migreringsplan.
  Vad det ar: Krav pa att schema- eller modellandringar inte blir halvfardiga.
  Vad det innebar for koden: `schemaVersion`, serialisering och lagring maste beaktas samtidigt.
  Varfor det behovs: Det skyddar befintlig data och minskar regressionsrisk.

- [ ] Alla nya premiumfunktioner ska ha tydlig planlogik och fallback.
  Vad det ar: Funktioner maste vara korrekt gated for `FREE`, `AUTH` och `PAID`.
  Vad det innebar for koden: UI, guards och affarsregler maste linjera.
  Varfor det behovs: Det skyddar bade produktlogik och kundupplevelse.

- [ ] Alla synk- och delningsfloden ska testas innan release.
  Vad det ar: Ett minimikrav for riskomraden.
  Vad det innebar for koden: Testning och verifiering blir en fast del av leveransen.
  Varfor det behovs: Dessa delar har hogst konsekvens vid fel.

## Rekommenderad ordning

Folj arbetet i denna ordning:

1. Etapp 1: Stabilisering och datatillit
2. Etapp 2: Hardning av delning, publicering och kommentarer
3. Etapp 3: Refaktorering av stora komponenter
4. Etapp 4: Forbattring av editorupplevelsen
5. Etapp 5: Notes, planering och mallar
6. Etapp 6: Test, observability och driftstod
7. Etapp 7: Produktfunktioner for nasta fas

## Relation till styrdokumentet

Detta dokument ar en operativ nedbrytning av [docs/STYRDOKUMENT.md](/c:/Dev/projects/tacticsboard/docs/STYRDOKUMENT.md). Om styrdokumentet andras pa ett satt som paverkar prioriteringar eller malbild ska detta dokument uppdateras samtidigt.
