"use client";

import { useMemo, useState } from "react";
import { useProjectStore } from "@/state/useProjectStore";
import { useEditorStore } from "@/state/useEditorStore";
import { getActiveBoard, getBoardSquads } from "@/utils/board";

type SquadSortKey = "default" | "name" | "position" | "number";

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
  const [sortKey, setSortKey] = useState<SquadSortKey>("default");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const board = useMemo(() => getActiveBoard(project ?? null), [project]);
  const boardSquads = useMemo(
    () => getBoardSquads(project ?? null, board ?? null),
    [project, board]
  );

  const activeSquad = activeSide === "home" ? boardSquads.home : boardSquads.away;
  const totalPlayers = activeSquad?.players.length ?? 0;
  const substitutes = activeSquad?.substituteIds ?? [];
  const visiblePlayers = useMemo(() => {
    const source = (activeSquad?.players ?? []).filter(
      (player) => player.active !== false
    );
    const withIndex = source.map((player, index) => ({ player, index }));
    const subs = new Set(substitutes);
    const numberValue = (value: number | undefined): number =>
      typeof value === "number" && Number.isFinite(value)
        ? value
        : Number.POSITIVE_INFINITY;
    const textValue = (value?: string) => value?.trim().toLowerCase() ?? "";
    const defaultCompare = (
      a: (typeof withIndex)[number],
      b: (typeof withIndex)[number]
    ) => {
      const aSub = subs.has(a.player.id) ? 1 : 0;
      const bSub = subs.has(b.player.id) ? 1 : 0;
      if (aSub !== bSub) {
        return aSub - bSub;
      }
      const aNumber = numberValue(a.player.number);
      const bNumber = numberValue(b.player.number);
      if (aNumber !== bNumber) {
        return aNumber - bNumber;
      }
      return textValue(a.player.name).localeCompare(textValue(b.player.name), "sv");
    };
    const compare = (a: (typeof withIndex)[number], b: (typeof withIndex)[number]) => {
      if (sortKey === "default") {
        const value = defaultCompare(a, b);
        return value !== 0 ? value : a.index - b.index;
      }
      let value = 0;
      if (sortKey === "name") {
        value = textValue(a.player.name).localeCompare(textValue(b.player.name), "sv");
      } else if (sortKey === "position") {
        value = textValue(a.player.positionLabel).localeCompare(
          textValue(b.player.positionLabel),
          "sv"
        );
      } else if (sortKey === "number") {
        value = numberValue(a.player.number) - numberValue(b.player.number);
      }
      if (value === 0) {
        value = defaultCompare(a, b);
      }
      const direction = sortDir === "asc" ? 1 : -1;
      return value * direction || a.index - b.index;
    };
    return [...withIndex].sort(compare).map((entry) => entry.player);
  }, [activeSquad, sortDir, sortKey, substitutes]);

  const toggleSort = (key: SquadSortKey) => {
    if (key === "default") {
      setSortKey("default");
      setSortDir("asc");
      return;
    }
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };
  const sortIndicator = (key: SquadSortKey) => {
    if (sortKey !== key) {
      return "";
    }
    if (key === "default") {
      return " •";
    }
    return sortDir === "asc" ? " ↑" : " ↓";
  };

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
        <div className="grid grid-cols-[28px_minmax(0,_1fr)_52px_32px_40px] items-center gap-1 px-2 pb-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
          <button
            className="text-left hover:text-[var(--accent-2)]"
            onClick={() => toggleSort("number")}
            title="Sort by number"
          >
            #{sortIndicator("number")}
          </button>
          <button
            className="min-w-0 truncate text-left hover:text-[var(--accent-2)]"
            onClick={() => toggleSort("name")}
            title="Sort by name"
          >
            Name{sortIndicator("name")}
          </button>
          <button
            className="min-w-0 truncate text-left hover:text-[var(--accent-2)]"
            onClick={() => toggleSort("position")}
            title="Sort by position"
          >
            Pos{sortIndicator("position")}
          </button>
          <span className="text-center">C</span>
          <span className="text-center">Sub</span>
        </div>
        <div className="flex justify-end px-2 pb-2">
          <button
            className="rounded-full border border-[var(--line)] px-2 py-1 text-[10px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={() => toggleSort("default")}
            title="Reset to default sort"
          >
            Default sort{sortIndicator("default")}
          </button>
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
                className="grid grid-cols-[28px_minmax(0,_1fr)_52px_32px_40px] items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5"
              >
                <span className="text-center text-[11px] text-[var(--ink-1)]">{player.number ?? ""}</span>
                <span className="min-w-0 truncate text-[11px] text-[var(--ink-0)]">{player.name}</span>
                <span className="min-w-0 truncate text-[10px] text-[var(--ink-1)]">
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
