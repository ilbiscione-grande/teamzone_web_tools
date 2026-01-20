"use client";

import { useState, type ReactNode } from "react";
import { useEditorStore, type Tool } from "@/state/useEditorStore";
import SquadEditor from "@/components/squad/SquadEditor";
import { useProjectStore } from "@/state/useProjectStore";
import { clone } from "@/utils/clone";
import { getActiveBoard, getBoardSquads } from "@/utils/board";
import { createPlayer } from "@/board/objects/objectFactory";
import { createId } from "@/utils/id";
import type { PlayerToken, Squad } from "@/models";

const iconClass = "h-4 w-4";
const iconStroke = "2";

const PlayerIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);
const BallIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <circle cx="12" cy="12" r="7" />
    <path d="M5 12h14M12 5v14M7 7l10 10M17 7L7 17" />
  </svg>
);
const ConeIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M12 4l7 16H5L12 4z" />
    <path d="M7 14h10" />
  </svg>
);
const GoalIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <rect x="4" y="8" width="16" height="8" />
    <path d="M8 8v8M16 8v8" />
  </svg>
);
const TextIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M5 7h14M12 7v12M8 19h8" />
  </svg>
);
const LineIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M4 18L20 6" />
  </svg>
);
const DashedLineIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M4 18L8 14M10 12l4-4M16 6l4-4" />
  </svg>
);
const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M4 18L18 4" />
    <path d="M12 4h6v6" />
  </svg>
);
const DashedArrowIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M4 18l4-4M10 12l4-4" />
    <path d="M12 4h6v6" />
  </svg>
);
const CircleIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <circle cx="12" cy="12" r="6" />
  </svg>
);
const RectIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <rect x="6" y="7" width="12" height="10" />
  </svg>
);
const TriangleIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M12 6l8 12H4l8-12z" />
  </svg>
);
const SquadIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <circle cx="8" cy="9" r="2" />
    <circle cx="16" cy="9" r="2" />
    <path d="M4 18c0-2 2-3 4-3s4 1 4 3" />
    <path d="M12 18c0-2 2-3 4-3s4 1 4 3" />
  </svg>
);

const itemTools: { id: Tool; label: string; hint: string; icon: ReactNode }[] = [
  { id: "player", label: "Player", hint: "Double-click to add", icon: <PlayerIcon /> },
  { id: "ball", label: "Ball", hint: "Double-click to add", icon: <BallIcon /> },
  { id: "cone", label: "Cone", hint: "Double-click to add", icon: <ConeIcon /> },
  { id: "goal", label: "Mini-goal", hint: "Double-click to add", icon: <GoalIcon /> },
  { id: "text", label: "Text", hint: "Double-click to add", icon: <TextIcon /> },
];

const lineTools: { id: Tool; label: string; hint: string; icon: ReactNode }[] = [
  { id: "line", label: "Solid line", hint: "Drag to draw", icon: <LineIcon /> },
  { id: "line_dashed", label: "Dashed line", hint: "Drag to draw", icon: <DashedLineIcon /> },
  { id: "arrow", label: "Arrow", hint: "Drag to draw", icon: <ArrowIcon /> },
  { id: "arrow_dashed", label: "Dashed arrow", hint: "Drag to draw", icon: <DashedArrowIcon /> },
];

const formTools: { id: Tool; label: string; hint: string; icon: ReactNode }[] = [
  { id: "circle", label: "Circle", hint: "Drag to draw", icon: <CircleIcon /> },
  { id: "rect", label: "Rect", hint: "Drag to draw", icon: <RectIcon /> },
  { id: "triangle", label: "Triangle", hint: "Drag to draw", icon: <TriangleIcon /> },
];

const PITCH_LENGTH = 105;
const PITCH_WIDTH = 68;

const formations: Record<string, number[]> = {
  "4-3-3": [4, 3, 3],
  "4-4-2": [4, 4, 2],
  "3-5-2": [3, 5, 2],
  "4-2-3-1": [4, 2, 3, 1],
  "3-4-3": [3, 4, 3],
};

const getLineYs = (count: number) => {
  const margin = 8;
  if (count <= 1) {
    return [PITCH_WIDTH / 2];
  }
  const spacing = (PITCH_WIDTH - margin * 2) / (count - 1);
  return Array.from({ length: count }, (_, index) => margin + spacing * index);
};

const getLineXs = (lineCount: number) => {
  if (lineCount <= 1) {
    return [PITCH_LENGTH * 0.5];
  }
  const minX = 22;
  const maxX = 88;
  const spacing = (maxX - minX) / (lineCount - 1);
  return Array.from({ length: lineCount }, (_, index) => minX + spacing * index);
};

const getFormationPositions = (formation: number[], side: "home" | "away") => {
  const positions: { x: number; y: number }[] = [];
  const gkX = side === "home" ? 8 : PITCH_LENGTH - 8;
  positions.push({ x: gkX, y: PITCH_WIDTH / 2 });
  const lineXs = getLineXs(formation.length).map((x) =>
    side === "home" ? x : PITCH_LENGTH - x
  );
  formation.forEach((count, index) => {
    const ys = getLineYs(count);
    ys.forEach((y) => positions.push({ x: lineXs[index]!, y }));
  });
  return positions;
};

const NotesIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M6 4h9l3 3v13H6z" />
    <path d="M9 12h6M9 16h6M9 8h3" />
  </svg>
);
const HighlightIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <circle cx="12" cy="12" r="6" />
    <path d="M12 6v12M6 12h12" />
  </svg>
);
const LinkIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M10 14l4-4" />
    <path d="M7 17a4 4 0 0 1 0-6l3-3a4 4 0 0 1 6 6l-1 1" />
  </svg>
);

export default function Toolbox() {
  const activeTool = useEditorStore((state) => state.activeTool);
  const setTool = useEditorStore((state) => state.setTool);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const playerTokenSize = useEditorStore((state) => state.playerTokenSize);
  const setPlayerTokenSize = useEditorStore(
    (state) => state.setPlayerTokenSize
  );
  const [activeTab, setActiveTab] = useState<
    "items" | "lines" | "forms" | "squad" | "notes"
  >(
    "items"
  );
  const project = useProjectStore((state) => state.project);
  const setFrameObjects = useProjectStore((state) => state.setFrameObjects);
  const updateBoard = useProjectStore((state) => state.updateBoard);
  const selection = useEditorStore((state) => state.selection);
  const isLinkingPlayers = useEditorStore((state) => state.isLinkingPlayers);
  const linkingPlayerIds = useEditorStore(
    (state) => state.linkingPlayerIds
  );
  const setLinkingPlayers = useEditorStore(
    (state) => state.setLinkingPlayers
  );
  const clearLinkingPlayers = useEditorStore(
    (state) => state.clearLinkingPlayers
  );

  const board = getActiveBoard(project);
  const frameIndex = board?.activeFrameIndex ?? 0;
  const objects = board?.frames[frameIndex]?.objects ?? [];
  const noteTemplates: Record<"TRAINING" | "MATCH" | "EDUCATION", string> = {
    TRAINING: `TRÄNING – Fokus & genomförande

📌 Huvudfokus
- Vad tränar vi på idag?
  Ex: Speluppbyggnad från målvakt, rätt avstånd i första fas

🎯 Delmål
- Skapa spelbarhet centralt
- Våga spela igenom första press
- Rätt kroppsställning vid mottag

⚙️ Organisation
- Spelform: 7v7 / 9v9 / 11v11
- Yta: Halvplan / zonindelad
- Bollstart: Målvakt / mittback

🧠 Nyckelbeteenden
- Scanna innan mottag
- Första touch bort från press
- Spelbar direkt efter pass

🔄 Vanliga korrigeringar
- För långa avstånd mellan lagdelar
- Spelare gömmer sig bakom motståndare
- För få spelvändningar

🗣️ Coachens instruktioner
- ”Spela på första möjligheten”
- ”Sätt bolltempo – inte löptempo”
- ”Hitta nästa passningsvinkel direkt”`,
    MATCH: `MATCH – Matchplan & riktlinjer

🆚 Motstånd
- Lag:
- Förväntad formation:
- Styrkor/svagheter:

⚽ Vårt spel – med boll
- Utgångsformation:
- Hur bygger vi spel?
- Vilka ytor vill vi attackera?

🛡️ Vårt spel – utan boll
- Försvarshöjd: Låg / Mellan / Hög
- Pressignaler:
- Vem sätter första press?

🔁 Omställningar
- Vid bollvinst:
- Vid bollförlust:

🎯 Nyckelroller
- Spelare med extra ansvar:
- Matchups att utnyttja:

⏱️ Viktiga påminnelser
- Första 10 minuterna
- Sista 15 minuterna
- Vid ledning / underläge

🧠 Matchbudskap
- ”Var modiga med bollen”
- ”Vi gör jobbet tillsammans”
- ”Nästa aktion är alltid viktigast”`,
    EDUCATION: `UTBILDNING – Princip & förståelse

📚 Tema
- Vad handlar detta om?
  Ex: Spelbarhet mellan lagdelar

🧭 Grundprincip
- Varför är detta viktigt i vårt spel?
- När uppstår situationen?

👀 Vad ska spelaren se?
- Position på med-/motspelare
- Avstånd och vinklar
- Motståndarens rörelser

🦶 Vad ska spelaren göra?
- Placering
- Tajming
- Beslut (spela, driva, vända)

⚠️ Vanliga misstag
- För tidig löpning
- Spel i samma linje
- Bolltempo utan rörelse

🔄 Koppling till match
- När ser vi detta i match?
- Hur påverkar det nästa aktion?

🗣️ Reflektionsfrågor
- Vad händer om vi inte gör detta?
- Hur hjälper detta lagkamraten?`,
  };
  const selectedPlayers = objects.filter(
    (item) => item.type === "player" && selection.includes(item.id)
  ) as PlayerToken[];

  const handleUndo = () => {
    if (!board) {
      return;
    }
    const snapshot = undo(clone(objects));
    if (snapshot) {
      setFrameObjects(board.id, frameIndex, snapshot);
    }
  };

  const handleRedo = () => {
    if (!board) {
      return;
    }
    const snapshot = redo(clone(objects));
    if (snapshot) {
      setFrameObjects(board.id, frameIndex, snapshot);
    }
  };

  const handleToggleHighlights = () => {
    if (!board || selectedPlayers.length === 0) {
      return;
    }
    const current = board.playerHighlights ?? [];
    const ids = selectedPlayers.map((player) => player.id);
    const allHighlighted = ids.every((id) => current.includes(id));
    const next = allHighlighted
      ? current.filter((id) => !ids.includes(id))
      : Array.from(new Set([...current, ...ids]));
    updateBoard(board.id, { playerHighlights: next });
  };

  const toggleLinkMode = () => {
    if (!board) {
      return;
    }
    if (isLinkingPlayers) {
      if (linkingPlayerIds.length >= 2) {
        const nextLinks = [
          ...(board.playerLinks ?? []),
          { id: createId(), playerIds: [...linkingPlayerIds] },
        ];
        updateBoard(board.id, { playerLinks: nextLinks });
      }
      setLinkingPlayers(false);
      clearLinkingPlayers();
      return;
    }
    clearLinkingPlayers();
    setLinkingPlayers(true);
  };


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="display-font text-sm text-[var(--accent-0)]">
          Toolbox
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={handleUndo}
          >
            Undo
          </button>
          <button
            className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={handleRedo}
          >
            Redo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {[
          { id: "items", label: "Items", icon: <PlayerIcon /> },
          { id: "lines", label: "Lines", icon: <LineIcon /> },
          { id: "forms", label: "Forms", icon: <CircleIcon /> },
          { id: "squad", label: "Squad", icon: <SquadIcon /> },
          { id: "notes", label: "Notes", icon: <NotesIcon /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex h-20 flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-2 text-[11px] uppercase tracking-wide ${
              activeTab === tab.id
                ? "border-[var(--accent-0)] text-[var(--ink-0)]"
                : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "items" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              className="flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-center transition border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
              onClick={handleToggleHighlights}
              disabled={selectedPlayers.length === 0}
            >
              <span className="mt-1">
                <HighlightIcon />
              </span>
              <span className="text-xs font-semibold">Highlight</span>
              <span className="text-[10px] text-[var(--ink-1)]">
                Toggle selected
              </span>
            </button>
            <button
              className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-center transition ${
                isLinkingPlayers
                  ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                  : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
              }`}
              onClick={toggleLinkMode}
            >
              <span className="mt-1">
                <LinkIcon />
              </span>
              <span className="text-xs font-semibold">Link line</span>
              <span className="text-[10px] text-[var(--ink-1)]">
                {isLinkingPlayers ? "Click players, press again" : "Start linking"}
              </span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
          {itemTools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setTool(tool.id)}
              className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-center transition ${
                activeTool === tool.id
                  ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                  : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
              }`}
            >
              <span className="mt-1">{tool.icon}</span>
              <span className="text-xs font-semibold">{tool.label}</span>
              <span className="text-[10px] text-[var(--ink-1)]">{tool.hint}</span>
            </button>
          ))}
          </div>
          <div className="rounded-2xl border border-[var(--line)] p-3 text-xs text-[var(--ink-1)]">
            <p className="mb-2 text-[11px] uppercase text-[var(--ink-1)]">
              Player size
            </p>
            <input
              type="range"
              min={1.4}
              max={4}
              step={0.1}
              value={playerTokenSize}
              onChange={(event) => setPlayerTokenSize(Number(event.target.value))}
              className="w-full"
            />
            <div className="mt-1 text-[11px] text-[var(--ink-1)]">
              {playerTokenSize.toFixed(1)}x
            </div>
          </div>
        </div>
      )}

      {activeTab === "lines" && (
        <div className="grid grid-cols-2 gap-2">
          {lineTools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setTool(tool.id)}
              className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-center transition ${
                activeTool === tool.id
                  ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                  : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
              }`}
            >
              <span className="mt-1">{tool.icon}</span>
              <span className="text-xs font-semibold">{tool.label}</span>
              <span className="text-[10px] text-[var(--ink-1)]">{tool.hint}</span>
            </button>
          ))}
        </div>
      )}

      {activeTab === "forms" && (
        <div className="grid grid-cols-2 gap-2">
          {formTools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setTool(tool.id)}
              className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-center transition ${
                activeTool === tool.id
                  ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                  : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
              }`}
            >
              <span className="mt-1">{tool.icon}</span>
              <span className="text-xs font-semibold">{tool.label}</span>
              <span className="text-[10px] text-[var(--ink-1)]">{tool.hint}</span>
            </button>
          ))}
        </div>
      )}

      {activeTab === "squad" && <SquadEditor />}

      {activeTab === "notes" && (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <p className="mb-2 text-[11px] uppercase text-[var(--ink-1)]">Notes</p>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink-1)]">
            <select
              className="h-8 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
              value={board?.notesTemplate ?? "TRAINING"}
              onChange={(event) => {
                if (!board) {
                  return;
                }
                useProjectStore.getState().updateBoard(board.id, {
                  notesTemplate: event.target.value as NonNullable<
                    typeof board
                  >["notesTemplate"],
                });
              }}
            >
              <option value="TRAINING" className="bg-[var(--panel-2)] text-[var(--ink-0)]">
                Träning
              </option>
              <option value="MATCH" className="bg-[var(--panel-2)] text-[var(--ink-0)]">
                Match
              </option>
              <option value="EDUCATION" className="bg-[var(--panel-2)] text-[var(--ink-0)]">
                Utbildning
              </option>
            </select>
            <button
              className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              onClick={() => {
                if (!board) {
                  return;
                }
                const template =
                  noteTemplates[board.notesTemplate ?? "TRAINING"];
                if (board.notes.trim().length > 0) {
                  const ok = window.confirm(
                    "Replace the current notes with the selected template?"
                  );
                  if (!ok) {
                    return;
                  }
                }
                useProjectStore.getState().updateBoard(board.id, {
                  notes: template,
                });
              }}
            >
              Apply template
            </button>
          </div>
          <textarea
            className="h-40 w-full resize-none rounded-2xl border border-[var(--line)] bg-transparent px-3 py-2 text-sm text-[var(--ink-0)]"
            placeholder="Write notes for this board..."
            value={board?.notes ?? ""}
            onChange={(event) => {
              if (board) {
                useProjectStore.getState().updateBoard(board.id, {
                  notes: event.target.value,
                });
              }
            }}
          />
        </div>
      )}

    </div>
  );
}
