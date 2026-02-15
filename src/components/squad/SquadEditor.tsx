"use client";

import { useMemo, useState } from "react";
import { useProjectStore } from "@/state/useProjectStore";
import { useEditorStore } from "@/state/useEditorStore";
import { getActiveBoard, getBoardSquads } from "@/utils/board";

export default function SquadEditor() {
  const project = useProjectStore((state) => state.project);
  const setPlayerSide = useEditorStore((state) => state.setPlayerSide);
  const [activeSide, setActiveSide] = useState<"home" | "away">("home");

  const board = useMemo(() => getActiveBoard(project ?? null), [project]);
  const boardSquads = useMemo(
    () => getBoardSquads(project ?? null, board ?? null),
    [project, board]
  );

  const activeSquad = activeSide === "home" ? boardSquads.home : boardSquads.away;

  if (!activeSquad) {
    return (
      <div className="flex h-full flex-col text-xs text-[var(--ink-1)]">
        <div className="flex items-center justify-between">
          <span className="display-font text-sm text-[var(--accent-0)]">Squad</span>
          <button
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={() =>
              window.dispatchEvent(new Event("tacticsboard:open-manage-teams"))
            }
          >
            Manage teams
          </button>
        </div>
        <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/40 p-3">
          No squad assigned on this board.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col text-xs text-[var(--ink-1)]">
      <div className="flex items-center justify-between">
        <span className="display-font text-sm text-[var(--accent-0)]">Squad</span>
        <button
          className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
          onClick={() =>
            window.dispatchEvent(new Event("tacticsboard:open-manage-teams"))
          }
        >
          Manage teams
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-wide ${
            activeSide === "home"
              ? "border-[var(--accent-0)] text-[var(--ink-0)]"
              : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
          }`}
          onClick={() => {
            setActiveSide("home");
            setPlayerSide("home");
          }}
        >
          Home
        </button>
        <button
          className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-wide ${
            activeSide === "away"
              ? "border-[var(--accent-0)] text-[var(--ink-0)]"
              : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
          }`}
          onClick={() => {
            setActiveSide("away");
            setPlayerSide("away");
          }}
        >
          Away
        </button>
      </div>

      <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/40 p-3">
        <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">Current squad</p>
        <p className="mt-1 text-sm text-[var(--ink-0)]">{activeSquad.name}</p>
        <p className="mt-1 text-[11px] text-[var(--ink-1)]">
          {activeSquad.players.length} players
        </p>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/30 p-2" data-scrollable>
        <div className="grid grid-cols-[28px_minmax(0,1fr)_70px] items-center gap-2 px-2 pb-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
          <span>#</span>
          <span>Name</span>
          <span>Pos</span>
        </div>
        <div className="space-y-1">
          {activeSquad.players.map((player) => (
            <div
              key={player.id}
              className="grid grid-cols-[28px_minmax(0,1fr)_70px] items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5"
            >
              <span className="text-center text-[11px] text-[var(--ink-1)]">{player.number ?? ""}</span>
              <span className="truncate text-[11px] text-[var(--ink-0)]">{player.name}</span>
              <span className="truncate text-[10px] text-[var(--ink-1)]">{player.positionLabel || "-"}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-2 text-[10px] text-[var(--ink-1)]">
        Squad editing is managed in Manage teams.
      </p>
    </div>
  );
}
