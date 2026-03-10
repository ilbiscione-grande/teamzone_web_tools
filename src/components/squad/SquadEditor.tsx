"use client";

import { useMemo, useState } from "react";
import type { SquadPlayer } from "@/models";
import { useProjectStore } from "@/state/useProjectStore";
import { useEditorStore } from "@/state/useEditorStore";
import { getActiveBoard, getBoardSquads } from "@/utils/board";
import { createId } from "@/utils/id";

type SquadSortKey = "default" | "name" | "position" | "number";
type RosterFilter = "all" | "visible" | "hidden" | "guests" | "regular";
type ViewMode = "board" | "base";

const textValue = (value?: string) => value?.trim().toLowerCase() ?? "";
const numberValue = (value: number | undefined): number =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : Number.POSITIVE_INFINITY;

export default function SquadEditor() {
  const project = useProjectStore((state) => state.project);
  const updateSquad = useProjectStore((state) => state.updateSquad);
  const updateBoard = useProjectStore((state) => state.updateBoard);
  const addSquadPlayer = useProjectStore((state) => state.addSquadPlayer);
  const setPlayerSide = useEditorStore((state) => state.setPlayerSide);

  const [activeSide, setActiveSide] = useState<"home" | "away">("home");
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [sortKey, setSortKey] = useState<SquadSortKey>("default");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>("all");
  const [search, setSearch] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPosition, setGuestPosition] = useState("");
  const [guestNumber, setGuestNumber] = useState("");

  const board = useMemo(() => getActiveBoard(project ?? null), [project]);
  const boardSquads = useMemo(
    () => getBoardSquads(project ?? null, board ?? null),
    [project, board]
  );

  const activeSquad = activeSide === "home" ? boardSquads.home : boardSquads.away;
  const baseSquad = useMemo(() => {
    if (!project || !board || !activeSquad) {
      return null;
    }
    const squadId = activeSide === "home" ? board.homeSquadId : board.awaySquadId;
    return project.squads.find((item) => item.id === squadId) ?? null;
  }, [activeSide, activeSquad, board, project]);

  const currentOverride = useMemo(() => {
    if (!board || !activeSquad) {
      return null;
    }
    return board.squadOverrides?.[activeSquad.id] ?? null;
  }, [activeSquad, board]);

  const substitutes = activeSquad?.substituteIds ?? [];

  const sortPlayers = (players: SquadPlayer[]) => {
    const withIndex = players.map((player, index) => ({ player, index }));
    const subs = new Set(substitutes);
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
  };

  const sortedBoardPlayers = useMemo(
    () => sortPlayers(activeSquad?.players ?? []),
    [activeSquad, sortDir, sortKey, substitutes]
  );

  const filteredBoardPlayers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sortedBoardPlayers.filter((player) => {
      if (rosterFilter === "visible" && player.active === false) {
        return false;
      }
      if (rosterFilter === "hidden" && player.active !== false) {
        return false;
      }
      if (rosterFilter === "guests" && !player.guest) {
        return false;
      }
      if (rosterFilter === "regular" && player.guest) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack = `${player.name} ${player.positionLabel} ${player.number ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [sortedBoardPlayers, rosterFilter, search]);

  const sortedBasePlayers = useMemo(
    () => sortPlayers(baseSquad?.players ?? []),
    [baseSquad, sortDir, sortKey, substitutes]
  );

  const filteredBasePlayers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return sortedBasePlayers;
    }
    return sortedBasePlayers.filter((player) => {
      const haystack = `${player.name} ${player.positionLabel} ${player.number ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [search, sortedBasePlayers]);

  const updateActiveOverride = (
    updater: (current: {
      hiddenPlayerIds?: string[];
      guestPlayers?: SquadPlayer[];
      positionOverrides?: Record<string, string>;
    }) => {
      hiddenPlayerIds?: string[];
      guestPlayers?: SquadPlayer[];
      positionOverrides?: Record<string, string>;
    }
  ) => {
    if (!board || !activeSquad) {
      return;
    }
    const nextCurrent = updater(
      currentOverride ?? {
        hiddenPlayerIds: [],
        guestPlayers: [],
        positionOverrides: {},
      }
    );
    const nextOverrides = {
      ...(board.squadOverrides ?? {}),
      [activeSquad.id]: nextCurrent,
    };
    updateBoard(board.id, { squadOverrides: nextOverrides });
  };

  const togglePlayerVisible = (playerId: string, nextVisible: boolean) => {
    updateActiveOverride((current) => {
      const hidden = new Set(current.hiddenPlayerIds ?? []);
      if (nextVisible) {
        hidden.delete(playerId);
      } else {
        hidden.add(playerId);
      }
      return {
        ...current,
        hiddenPlayerIds: Array.from(hidden),
      };
    });
  };

  const setPlayerBoardPosition = (playerId: string, value: string) => {
    const trimmed = value.trim();
    updateActiveOverride((current) => {
      const guests = [...(current.guestPlayers ?? [])];
      const guestIndex = guests.findIndex((item) => item.id === playerId);
      if (guestIndex >= 0) {
        guests[guestIndex] = {
          ...guests[guestIndex],
          positionLabel: trimmed,
        };
        return { ...current, guestPlayers: guests };
      }
      const nextOverrides = { ...(current.positionOverrides ?? {}) };
      const basePosition =
        baseSquad?.players.find((item) => item.id === playerId)?.positionLabel ?? "";
      if (!trimmed || trimmed === basePosition) {
        delete nextOverrides[playerId];
      } else {
        nextOverrides[playerId] = trimmed;
      }
      return { ...current, positionOverrides: nextOverrides };
    });
  };

  const addGuestPlayer = () => {
    if (!guestName.trim()) {
      return;
    }
    const nextNumber = Number(guestNumber);
    updateActiveOverride((current) => ({
      ...current,
      guestPlayers: [
        ...(current.guestPlayers ?? []),
        {
          id: createId(),
          name: guestName.trim(),
          positionLabel: guestPosition.trim() || "Guest",
          guest: true,
          active: true,
          number: Number.isFinite(nextNumber) && nextNumber > 0 ? nextNumber : undefined,
        },
      ],
    }));
    setGuestName("");
    setGuestPosition("");
    setGuestNumber("");
  };

  const removeGuestPlayer = (playerId: string) => {
    updateActiveOverride((current) => {
      const nextGuests = (current.guestPlayers ?? []).filter((item) => item.id !== playerId);
      const nextHidden = (current.hiddenPlayerIds ?? []).filter((id) => id !== playerId);
      const nextPositionOverrides = { ...(current.positionOverrides ?? {}) };
      delete nextPositionOverrides[playerId];
      return {
        ...current,
        guestPlayers: nextGuests,
        hiddenPlayerIds: nextHidden,
        positionOverrides: nextPositionOverrides,
      };
    });
  };

  const promoteGuestToBase = (player: SquadPlayer) => {
    if (!baseSquad || !activeSquad || !player.guest) {
      return;
    }
    if (baseSquad.players.some((item) => item.id === player.id)) {
      removeGuestPlayer(player.id);
      return;
    }
    const promoted: SquadPlayer = {
      ...player,
      guest: false,
      active: true,
    };
    addSquadPlayer(baseSquad.id, promoted);
    removeGuestPlayer(player.id);
  };

  const showAllPlayers = () => {
    updateActiveOverride((current) => ({
      ...current,
      hiddenPlayerIds: [],
    }));
  };

  const hideAllRegularPlayers = () => {
    const regularIds = (baseSquad?.players ?? []).map((player) => player.id);
    updateActiveOverride((current) => {
      const hidden = new Set(current.hiddenPlayerIds ?? []);
      regularIds.forEach((id) => hidden.add(id));
      return {
        ...current,
        hiddenPlayerIds: Array.from(hidden),
      };
    });
  };

  const resetBoardPositions = () => {
    updateActiveOverride((current) => ({
      ...current,
      positionOverrides: {},
      guestPlayers: (current.guestPlayers ?? []).map((player) => ({
        ...player,
        positionLabel: player.positionLabel || "Guest",
      })),
    }));
  };

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
          onClick={() => window.dispatchEvent(new Event("tacticsboard:open-manage-teams"))}
        >
          Manage teams
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {[
          { id: "home" as const, label: "Home" },
          { id: "away" as const, label: "Away" },
        ].map((side) => (
          <button
            key={side.id}
            className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-wide ${
              activeSide === side.id
                ? "border-[var(--accent-0)] text-[var(--ink-0)]"
                : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
            }`}
            onClick={() => {
              setActiveSide(side.id);
              setPlayerSide(side.id);
            }}
          >
            {side.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {[
          { id: "board" as const, label: "Board roster" },
          { id: "base" as const, label: "Base squad" },
        ].map((mode) => (
          <button
            key={mode.id}
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-wide ${
              viewMode === mode.id
                ? "border-[var(--accent-0)] text-[var(--ink-0)]"
                : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
            }`}
            onClick={() => setViewMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/40 p-3">
        <p className="text-sm text-[var(--ink-0)]">{activeSquad.name}</p>
        <p className="mt-1 text-[11px] text-[var(--ink-1)]">
          {viewMode === "board"
            ? `${filteredBoardPlayers.filter((item) => item.active !== false).length} visible / ${sortedBoardPlayers.length} total on board`
            : `${filteredBasePlayers.length} players in base squad`}
        </p>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          className="h-8 flex-1 rounded-lg border border-[var(--line)] bg-transparent px-2 text-xs text-[var(--ink-0)]"
          placeholder={viewMode === "board" ? "Search board roster..." : "Search base squad..."}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {viewMode === "board" ? (
          <select
            className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2 text-[11px]"
            value={rosterFilter}
            onChange={(event) => setRosterFilter(event.target.value as RosterFilter)}
          >
            <option value="all">All</option>
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
            <option value="guests">Guests</option>
            <option value="regular">Regular</option>
          </select>
        ) : null}
      </div>

      {viewMode === "board" && (
        <div className="mt-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/40 p-3">
          <p className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">Board actions</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              onClick={showAllPlayers}
            >
              Show all
            </button>
            <button
              className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] uppercase tracking-wide hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
              onClick={hideAllRegularPlayers}
            >
              Hide all regular
            </button>
            <button
              className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              onClick={resetBoardPositions}
            >
              Reset positions
            </button>
            <button
              className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] uppercase tracking-wide hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
              onClick={() =>
                updateActiveOverride(() => ({
                  hiddenPlayerIds: [],
                  guestPlayers: [],
                  positionOverrides: {},
                }))
              }
            >
              Reset board roster
            </button>
          </div>

          <p className="mt-3 text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
            Add guest player (board only)
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <input
              className="h-8 rounded-lg border border-[var(--line)] bg-transparent px-2 text-[11px] text-[var(--ink-0)]"
              placeholder="Name"
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
            />
            <input
              className="h-8 rounded-lg border border-[var(--line)] bg-transparent px-2 text-[11px] text-[var(--ink-0)]"
              placeholder="Position"
              value={guestPosition}
              onChange={(event) => setGuestPosition(event.target.value)}
            />
            <input
              className="h-8 rounded-lg border border-[var(--line)] bg-transparent px-2 text-[11px] text-[var(--ink-0)]"
              placeholder="#"
              value={guestNumber}
              onChange={(event) => setGuestNumber(event.target.value)}
            />
          </div>
          <button
            className="mt-2 rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={addGuestPlayer}
          >
            Add guest
          </button>
        </div>
      )}

      {viewMode === "base" && (
        <div className="mt-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/40 p-3">
          <p className="text-[11px] text-[var(--ink-1)]">
            Base squad is your persistent team squad. Board roster changes do not overwrite base positions.
          </p>
        </div>
      )}

      <div
        className="mt-3 min-h-0 flex-1 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/30 p-2"
        data-scrollable
      >
        <div className="grid grid-cols-[28px_minmax(0,_1fr)_64px_64px_32px_40px] items-center gap-1 px-2 pb-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
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
          <span className="text-center">State</span>
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

        {(viewMode === "board" ? filteredBoardPlayers : filteredBasePlayers).length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-[var(--ink-1)]">No players match this filter.</p>
        ) : (
          <div className="space-y-1">
            {(viewMode === "board" ? filteredBoardPlayers : filteredBasePlayers).map((player) => (
              <div
                key={player.id}
                className={`grid grid-cols-[28px_minmax(0,_1fr)_64px_64px_32px_40px] items-center gap-1 rounded-lg border px-2 py-1.5 ${
                  player.active === false
                    ? "border-[var(--line)] bg-[var(--panel)]/50"
                    : "border-[var(--line)] bg-[var(--panel)]"
                }`}
              >
                <span className="text-center text-[11px] text-[var(--ink-1)]">{player.number ?? ""}</span>
                <span className="min-w-0 truncate text-[11px] text-[var(--ink-0)]">
                  {player.name}
                  {player.guest ? (
                    <span className="ml-1 rounded-full border border-[var(--accent-0)] px-1 text-[9px] uppercase text-[var(--accent-0)]">
                      Guest
                    </span>
                  ) : null}
                </span>

                {viewMode === "board" ? (
                  <input
                    className="h-7 rounded-lg border border-[var(--line)] bg-transparent px-2 text-[10px] text-[var(--ink-1)]"
                    value={player.positionLabel ?? ""}
                    onChange={(event) => setPlayerBoardPosition(player.id, event.target.value)}
                  />
                ) : (
                  <span className="truncate text-[10px] text-[var(--ink-1)]">{player.positionLabel}</span>
                )}

                <div className="flex items-center justify-center gap-1">
                  {viewMode === "board" ? (
                    <>
                      <button
                        className={`h-5 rounded-full border px-2 text-[9px] ${
                          player.active === false
                            ? "border-[var(--line)] text-[var(--ink-1)]"
                            : "border-[var(--accent-0)] text-[var(--accent-0)]"
                        }`}
                        onClick={() => togglePlayerVisible(player.id, player.active === false)}
                        title={player.active === false ? "Show on board" : "Hide on board"}
                        aria-label={player.active === false ? "Show player" : "Hide player"}
                      >
                        {player.active === false ? "Show" : "Hide"}
                      </button>
                      {player.guest ? (
                        <>
                          <button
                            className="h-5 rounded-full border border-[var(--accent-2)] px-2 text-[9px] text-[var(--accent-2)]"
                            onClick={() => promoteGuestToBase(player)}
                            title="Promote guest to base squad"
                            aria-label="Promote guest"
                          >
                            Promote
                          </button>
                          <button
                            className="h-5 w-5 rounded-full border border-[var(--accent-1)] text-[10px] text-[var(--accent-1)]"
                            onClick={() => removeGuestPlayer(player.id)}
                            title="Remove guest"
                            aria-label="Remove guest"
                          >
                            x
                          </button>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-[10px] text-[var(--ink-1)]">Base</span>
                  )}
                </div>

                <div className="flex items-center justify-center">
                  <button
                    className={`h-4 w-4 rounded-full border ${
                      !player.guest && activeSquad.captainId === player.id
                        ? "border-[var(--accent-0)] bg-[var(--accent-0)]"
                        : "border-[var(--line)]"
                    }`}
                    onClick={() => !player.guest && toggleCaptain(player.id)}
                    title="Captain"
                    aria-label="Captain"
                    disabled={player.guest}
                  />
                </div>

                <div className="flex items-center justify-center">
                  <button
                    className={`h-4 w-4 rounded-full border ${
                      !player.guest && substitutes.includes(player.id)
                        ? "border-[var(--accent-0)] bg-[var(--accent-0)]"
                        : "border-[var(--line)]"
                    }`}
                    onClick={() => !player.guest && toggleSubstitute(player.id)}
                    title="Substitute"
                    aria-label="Substitute"
                    disabled={player.guest}
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
