# Tactics Board Web

Digital taktiktavla for fotboll med statiskt och dynamiskt lage (frames).

## Tech stack och motiv
- Next.js (App Router) + TypeScript: snabb routing, modern build, strict typing.
- react-konva/konva: canvas-baserad rendering med React-komponenter och bra transformer/drag.
- Zustand + immer: litet och snabbt state, enkel undo/redo och snapshots.
- Tailwind CSS: snabbt UI-bygge med låg overhead.

## Kom igang
```bash
npm install
npm run dev
```
Appen startar pa `http://localhost:3000`.

Build:
```bash
npm run build
npm run start
```

Tester:
```bash
npm run test
```

## Arkitektur (kort)
- `src/app` routes
- `src/components` UI (toolbox, panels, frames, list)
- `src/board` canvas och pitch-rendering
- `src/state` Zustand stores
- `src/models` datatyper
- `src/persistence` serialize/deserialize, localStorage, sample data
- `src/utils` delade helpers

## Datamodell (kort)
- `Project`: id, name, createdAt, updatedAt, schemaVersion, boards, squads
- `Board`: id, name, mode, pitchView, notes, layers, frames, activeFrameIndex
- `BoardFrame`: id, name, objects (snapshot per frame i MVP)
- `DrawableObject`: player, ball, shapes, arrow, text, path
- `Squad`: name, kit colors, clubLogo (dataURL), players

`schemaVersion` finns for framtida migrering.

## MVP-funktioner
- Pitch vyer: full plan, offensiv/defensiv half, tom gronyta
- Zoom/drag-pan + reset view
- Tools: select, player, ball, shapes, arrow, text
- Selection, drag, resize/rotate (Konva Transformer)
- Squad editor med logo och kit colors
- Dynamic boards med frame list, play/stop
- Autosave i localStorage
- Export/import av JSON
- Undo/redo (50 steg)

## Kända begränsningar
- Inga snapshots per lager (endast objektlista per frame)
- Text editor ar prompt-baserad (ingen inline editor)
- Interpolering mellan frames ar ej implementerad
- Full validering av importer ar minimal

## Roadmap
- Backend-lagring och projekt-sync
- Realtime collaboration
- Export till bild/PDF
- Forbattrad anim interpolation
- Bättre inlinetext-editor och rich text
