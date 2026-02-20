"use client";

import { useMemo, useState } from "react";
import { useProjectStore } from "@/state/useProjectStore";
import { useEditorStore } from "@/state/useEditorStore";
import { getActiveBoard, getBoardSquads } from "@/utils/board";

const toPositionAbbreviation = (value?: string) => {
  if (!value) {
    return "-";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "-";
  }
  const match = trimmed.match(/\(([A-Za-z0-9/ -]{1,10})\)\s*$/);
  if (match?.[1]) {
    return match[1].toUpperCase();
  }
  const compact = trimmed.toUpperCase();
  if (/^[A-Z0-9/ -]{1,6}$/.test(compact)) {
    return compact;
  }
  const letters = trimmed.match(/[A-Za-z0-9]+/g);
  if (!letters || letters.length === 0) {
    return trimmed.slice(0, 3).toUpperCase();
  }
  if (letters.length === 1) {
    return letters[0].slice(0, 3).toUpperCase();
  }
  return letters
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
};

export default function SquadEditor() {
  const project = useProjectStore((state) => state.project);
  const updateSquad = useProjectStore((state) => state.updateSquad);
  const setPlayerSide = useEditorStore((state) => state.setPlayerSide);
  const [activeSide, setActiveSide] = useState<"home" | "away">("home");

  const board = useMemo(() => getActiveBoard(project ?? null), [project]);
  const boardSquads = useMemo(
    () => getBoardSquads(project ?? null, board ?? null),
    [project, board]
  );

  const activeSquad = activeSide === "home" ? boardSquads.home : boardSquads.away;
  const totalPlayers = activeSquad?.players.length ?? 0;
  const visiblePlayers = useMemo(
    () => (activeSquad?.players ?? []).filter((player) => player.active !== false),
    [activeSquad]
  );
  const substitutes = activeSquad?.substituteIds ?? [];

  const toggleCaptain = (playerId: string) => {
    if (!activeSquad) {
      return;
    }
    updateSquad(activeSquad.id, {
      captainId: activeSquad.captainId === playerId ? undefined : playerId,
    });
  };

  const toggleSubstitute = (playerId: string) => {
    if (!activeSquad) {
      return;
    }
    const next = substitutes.includes(playerId)
      ? substitutes.filter((id) => id !== playerId)
      : [...substitutes, playerId];
    updateSquad(activeSquad.id, { substituteIds: next });
  };

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
        <p className="text-sm text-[var(--ink-0)]">{activeSquad.name}</p>
        <p className="mt-1 text-[11px] text-[var(--ink-1)]">
          {visiblePlayers.length} of {totalPlayers} players shown
        </p>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/30 p-2" data-scrollable>
        <div className="grid grid-cols-[28px_minmax(0,1fr)_70px_56px_56px] items-center gap-2 px-2 pb-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
          <span>#</span>
          <span>Name</span>
          <span>Pos</span>
          <span className="text-center">C</span>
          <span className="text-center">Sub</span>
        </div>
        {visiblePlayers.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-[var(--ink-1)]">
            No players selected for Squad view. Enable &quot;Show in Squad&quot; in Manage teams.
          </p>
        ) : (
          <div className="space-y-1">
            {visiblePlayers.map((player) => (
              <div
                key={player.id}
                className="grid grid-cols-[28px_minmax(0,1fr)_70px_56px_56px] items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5"
              >
                <span className="text-center text-[11px] text-[var(--ink-1)]">{player.number ?? ""}</span>
                <span className="truncate text-[11px] text-[var(--ink-0)]">{player.name}</span>
                <span className="truncate text-[10px] text-[var(--ink-1)]">
                  {toPositionAbbreviation(player.positionLabel)}
                </span>
                <div className="flex items-center justify-center">
                  <button
                    className={`h-4 w-4 rounded-full border ${
                      activeSquad.captainId === player.id
                        ? "border-[var(--accent-0)] bg-[var(--accent-0)]"
                        : "border-[var(--line)]"
                    }`}
                    onClick={() => toggleCaptain(player.id)}
                    title="Captain"
                    aria-label="Captain"
                  />
                </div>
                <div className="flex items-center justify-center">
                  <button
                    className={`h-4 w-4 rounded-full border ${
                      substitutes.includes(player.id)
                        ? "border-[var(--accent-0)] bg-[var(--accent-0)]"
                        : "border-[var(--line)]"
                    }`}
                    onClick={() => toggleSubstitute(player.id)}
                    title="Substitute"
                    aria-label="Substitute"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
