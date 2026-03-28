"use client";

import type { SquadPlayer } from "@/models";

type ManageTeamsBoardRosterProps = {
  sortedManageBoardPlayers: SquadPlayer[];
  onSetBoardPlayerPosition: (playerId: string, value: string) => void;
  onToggleBoardPlayerVisible: (playerId: string, nextVisible: boolean) => void;
  onPromoteBoardGuest: (player: SquadPlayer) => void;
  onRemoveBoardGuest: (playerId: string) => void;
};

export default function ManageTeamsBoardRoster({
  sortedManageBoardPlayers,
  onSetBoardPlayerPosition,
  onToggleBoardPlayerVisible,
  onPromoteBoardGuest,
  onRemoveBoardGuest,
}: ManageTeamsBoardRosterProps) {
  return (
    <>
      <div className="space-y-3 lg:hidden">
        <p className="text-[10px] leading-relaxed text-[var(--ink-1)]">
          Match board focuses on visibility, guest players and board-only position labels.
        </p>
        <div className="max-h-[52vh] space-y-3 overflow-auto pr-1" data-scrollable>
          {sortedManageBoardPlayers.map((player) => (
            <div
              key={player.id}
              className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/60 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-[var(--ink-0)]">{player.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1 text-[9px] uppercase tracking-wide">
                    {player.guest ? (
                      <span className="rounded-full border border-[var(--accent-0)] px-1.5 py-0.5 text-[var(--accent-0)]">
                        Guest
                      </span>
                    ) : (
                      <span className="rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[var(--ink-1)]">
                        Linked
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className={`rounded-full border px-2 py-1 text-[10px] ${
                    player.active === false
                      ? "border-[var(--line)] text-[var(--ink-1)]"
                      : "border-[var(--accent-0)] text-[var(--accent-0)]"
                  }`}
                  onClick={() =>
                    onToggleBoardPlayerVisible(player.id, player.active === false)
                  }
                >
                  {player.active === false ? "Show" : "Hide"}
                </button>
              </div>
              <input
                className="h-9 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--ink-0)]"
                value={player.positionLabel}
                onChange={(event) =>
                  onSetBoardPlayerPosition(player.id, event.target.value)
                }
              />
              {player.guest ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="rounded-xl border border-[var(--accent-2)] px-3 py-2 text-[11px] text-[var(--accent-2)]"
                    onClick={() => onPromoteBoardGuest(player)}
                  >
                    Promote
                  </button>
                  <button
                    className="rounded-xl border border-[var(--accent-1)] px-3 py-2 text-[11px] text-[var(--accent-1)]"
                    onClick={() => onRemoveBoardGuest(player.id)}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="hidden grid-cols-[minmax(0,1fr)_120px_160px] items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)] lg:grid">
        <span>Name</span>
        <span>Board pos</span>
        <span>Actions</span>
      </div>
      <div className="hidden max-h-56 space-y-2 overflow-auto pr-1 lg:block" data-scrollable>
        {sortedManageBoardPlayers.map((player) => (
          <div
            key={player.id}
            className="grid grid-cols-[minmax(0,1fr)_120px_160px] items-center gap-2"
          >
            <div className="truncate text-[11px] text-[var(--ink-0)]">
              {player.name}
              {player.guest ? (
                <span className="ml-1 rounded-full border border-[var(--accent-0)] px-1 text-[9px] uppercase text-[var(--accent-0)]">
                  Guest
                </span>
              ) : null}
            </div>
            <input
              className="h-7 rounded-md border border-[var(--line)] bg-transparent px-2 text-[11px] text-[var(--ink-0)]"
              value={player.positionLabel}
              onChange={(event) =>
                onSetBoardPlayerPosition(player.id, event.target.value)
              }
            />
            <div className="flex items-center gap-2">
              <button
                className={`rounded-full border px-2 py-1 text-[10px] ${
                  player.active === false
                    ? "border-[var(--line)] text-[var(--ink-1)]"
                    : "border-[var(--accent-0)] text-[var(--accent-0)]"
                }`}
                onClick={() =>
                  onToggleBoardPlayerVisible(player.id, player.active === false)
                }
              >
                {player.active === false ? "Show" : "Hide"}
              </button>
              {player.guest ? (
                <>
                  <button
                    className="rounded-full border border-[var(--accent-2)] px-2 py-1 text-[10px] text-[var(--accent-2)]"
                    onClick={() => onPromoteBoardGuest(player)}
                  >
                    Promote
                  </button>
                  <button
                    className="rounded-full border border-[var(--accent-1)] px-2 py-1 text-[10px] text-[var(--accent-1)]"
                    onClick={() => onRemoveBoardGuest(player.id)}
                  >
                    Remove
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
