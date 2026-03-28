"use client";

import type { SquadPlayer } from "@/models";

type LinkedMember = {
  memberRole: string;
  teamPosition?: string | null;
  isTeamAdmin: boolean;
};

type ManageTeamsBaseRosterProps = {
  manageSquadId: string;
  filteredManageBasePlayers: SquadPlayer[];
  editableSquadSubstituteIds: string[];
  editableSquadCaptainId?: string;
  manageSortIndicator: (key: "default" | "name" | "position" | "number") => string;
  managedDirectoryMemberMap: Map<string, LinkedMember>;
  onToggleManagePlayersSort: (key: "default" | "name" | "position" | "number") => void;
  onUpdateSquadPlayer: (
    squadId: string,
    playerId: string,
    payload: Partial<SquadPlayer>
  ) => void;
  onUpdateEditableSquad: (payload: {
    captainId?: string;
    substituteIds?: string[];
  }) => void;
  onRemoveSquadPlayer: (squadId: string, playerId: string) => void;
  positionOptions: readonly string[];
};

const compactPositionLabel = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }
  const codeMatch = trimmed.match(/\(([A-Z/]+)\)/);
  if (codeMatch?.[1]) {
    return codeMatch[1];
  }
  return trimmed
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 4);
};

export default function ManageTeamsBaseRoster({
  manageSquadId,
  filteredManageBasePlayers,
  editableSquadSubstituteIds,
  editableSquadCaptainId,
  manageSortIndicator,
  managedDirectoryMemberMap,
  onToggleManagePlayersSort,
  onUpdateSquadPlayer,
  onUpdateEditableSquad,
  onRemoveSquadPlayer,
  positionOptions,
}: ManageTeamsBaseRosterProps) {
  return (
    <>
      <div className="space-y-3 lg:hidden">
        <p className="text-[10px] leading-relaxed text-[var(--ink-1)]">
          Edit players as compact cards on mobile.
        </p>
        <div className="max-h-[52vh] space-y-3 overflow-auto pr-1" data-scrollable>
          {filteredManageBasePlayers.map((player) => {
            const linkedMember =
              managedDirectoryMemberMap.get(player.id) ??
              (player.sourcePlayerId
                ? managedDirectoryMemberMap.get(player.sourcePlayerId)
                : undefined);
            const isCaptain = editableSquadCaptainId === player.id;
            const isSub = editableSquadSubstituteIds.includes(player.id);
            return (
              <div
                key={player.id}
                className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/60 p-3"
              >
                <div className="grid grid-cols-[56px_minmax(0,1fr)_34px] gap-2">
                  <input
                    className="h-9 rounded-xl border border-[var(--line)] bg-transparent px-2 text-center text-sm text-[var(--ink-0)]"
                    value={player.number ?? ""}
                    onChange={(event) =>
                      onUpdateSquadPlayer(manageSquadId, player.id, {
                        number: event.target.value ? Number(event.target.value) : undefined,
                      })
                    }
                  />
                  <input
                    className="h-9 rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--ink-0)]"
                    value={player.name}
                    onChange={(event) =>
                      onUpdateSquadPlayer(manageSquadId, player.id, {
                        name: event.target.value,
                      })
                    }
                  />
                  <button
                    className={`h-9 rounded-xl border text-[10px] font-semibold ${
                      player.guest
                        ? "border-[var(--accent-0)] bg-[var(--accent-0)] text-black"
                        : "border-[var(--line)] text-[var(--ink-1)]"
                    }`}
                    onClick={() =>
                      onUpdateSquadPlayer(manageSquadId, player.id, {
                        guest: !player.guest,
                      })
                    }
                  >
                    G
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 text-[9px] uppercase tracking-wide">
                  {linkedMember ? (
                    <>
                      <span className="rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[var(--ink-1)]">
                        Linked
                      </span>
                      {compactPositionLabel(linkedMember.teamPosition) ? (
                        <span className="rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[var(--ink-1)]">
                          {compactPositionLabel(linkedMember.teamPosition)}
                        </span>
                      ) : null}
                      {linkedMember.isTeamAdmin ? (
                        <span className="rounded-full border border-[var(--accent-2)] px-1.5 py-0.5 text-[var(--accent-2)]">
                          Admin
                        </span>
                      ) : null}
                    </>
                  ) : null}
                  {player.guest ? (
                    <span className="rounded-full border border-[var(--accent-0)] px-1.5 py-0.5 text-[var(--accent-0)]">
                      Guest
                    </span>
                  ) : null}
                </div>
                <select
                  className="h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 text-sm text-[var(--ink-0)]"
                  value={player.positionLabel}
                  onChange={(event) =>
                    onUpdateSquadPlayer(manageSquadId, player.id, {
                      positionLabel: event.target.value,
                    })
                  }
                >
                  <option value="" className="bg-[var(--panel-2)] text-[var(--ink-0)]" />
                  {positionOptions.map((pos) => (
                    <option
                      key={pos}
                      value={pos}
                      className="bg-[var(--panel-2)] text-[var(--ink-0)]"
                    >
                      {pos}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
                  <label className="flex flex-col items-center gap-1 rounded-xl border border-[var(--line)] py-2">
                    <span>Shown</span>
                    <input
                      type="checkbox"
                      checked={player.active !== false}
                      onChange={(event) =>
                        onUpdateSquadPlayer(manageSquadId, player.id, {
                          active: event.target.checked,
                        })
                      }
                    />
                  </label>
                  <button
                    className={`rounded-xl border py-2 ${
                      isCaptain
                        ? "border-[var(--accent-0)] text-[var(--accent-0)]"
                        : "border-[var(--line)] text-[var(--ink-1)]"
                    }`}
                    onClick={() =>
                      onUpdateEditableSquad({
                        captainId: isCaptain ? undefined : player.id,
                      })
                    }
                  >
                    Captain
                  </button>
                  <button
                    className={`rounded-xl border py-2 ${
                      isSub
                        ? "border-[var(--accent-0)] text-[var(--accent-0)]"
                        : "border-[var(--line)] text-[var(--ink-1)]"
                    }`}
                    onClick={() => {
                      const next = isSub
                        ? editableSquadSubstituteIds.filter((id) => id !== player.id)
                        : [...editableSquadSubstituteIds, player.id];
                      onUpdateEditableSquad({ substituteIds: next });
                    }}
                  >
                    Sub
                  </button>
                  <button
                    className="rounded-xl border border-[var(--line)] py-2 text-[var(--ink-1)] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                    onClick={() => onRemoveSquadPlayer(manageSquadId, player.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="hidden grid-cols-[40px_minmax(0,1fr)_170px_72px_60px_60px_24px] items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)] lg:grid">
        <button
          className="text-left hover:text-[var(--accent-2)]"
          onClick={() => onToggleManagePlayersSort("number")}
          title="Sort by number"
        >
          #{manageSortIndicator("number")}
        </button>
        <button
          className="text-left hover:text-[var(--accent-2)]"
          onClick={() => onToggleManagePlayersSort("name")}
          title="Sort by name"
        >
          Name{manageSortIndicator("name")}
        </button>
        <button
          className="text-left hover:text-[var(--accent-2)]"
          onClick={() => onToggleManagePlayersSort("position")}
          title="Sort by position"
        >
          Position{manageSortIndicator("position")}
        </button>
        <span className="text-center">Shown</span>
        <span className="text-center">Cap</span>
        <span className="text-center">Sub</span>
        <span />
      </div>
      <p className="text-[10px] text-[var(--ink-1)]">
        All players are listed here. Use &quot;Shown&quot; to control who appears in the squad list.
      </p>
      <div className="hidden max-h-56 space-y-2 overflow-auto pr-1 lg:block" data-scrollable>
        {filteredManageBasePlayers.map((player) => {
          const linkedMember =
            managedDirectoryMemberMap.get(player.id) ??
            (player.sourcePlayerId
              ? managedDirectoryMemberMap.get(player.sourcePlayerId)
              : undefined);
          const isCaptain = editableSquadCaptainId === player.id;
          const isSub = editableSquadSubstituteIds.includes(player.id);
          return (
            <div
              key={player.id}
              className="grid grid-cols-[40px_minmax(0,1fr)_170px_72px_60px_60px_24px] items-center gap-2"
            >
              <input
                className="h-8 rounded-md border border-[var(--line)] bg-transparent px-1 text-center text-[11px] text-[var(--ink-0)]"
                value={player.number ?? ""}
                onChange={(event) =>
                  onUpdateSquadPlayer(manageSquadId, player.id, {
                    number: event.target.value ? Number(event.target.value) : undefined,
                  })
                }
              />
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1">
                  <input
                    className="h-8 w-full rounded-md border border-[var(--line)] bg-transparent px-2 text-[11px] text-[var(--ink-0)]"
                    value={player.name}
                    onChange={(event) =>
                      onUpdateSquadPlayer(manageSquadId, player.id, {
                        name: event.target.value,
                      })
                    }
                  />
                  <button
                    className={`h-8 min-w-[28px] rounded-md border px-1 text-[10px] font-semibold ${
                      player.guest
                        ? "border-[var(--accent-0)] bg-[var(--accent-0)] text-black"
                        : "border-[var(--line)] text-[var(--ink-1)]"
                    }`}
                    onClick={() =>
                      onUpdateSquadPlayer(manageSquadId, player.id, {
                        guest: !player.guest,
                      })
                    }
                    title="Guest player"
                    aria-label="Guest player"
                  >
                    G
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 text-[9px] uppercase tracking-wide">
                  {linkedMember ? (
                    <>
                      <span className="rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[var(--ink-1)]">
                        Linked
                      </span>
                      {compactPositionLabel(linkedMember.teamPosition) ? (
                        <span className="rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[var(--ink-1)]">
                          {compactPositionLabel(linkedMember.teamPosition)}
                        </span>
                      ) : null}
                      {linkedMember.isTeamAdmin ? (
                        <span className="rounded-full border border-[var(--accent-2)] px-1.5 py-0.5 text-[var(--accent-2)]">
                          Admin
                        </span>
                      ) : null}
                    </>
                  ) : null}
                  {player.guest ? (
                    <span className="rounded-full border border-[var(--accent-0)] px-1.5 py-0.5 text-[var(--accent-0)]">
                      Guest
                    </span>
                  ) : null}
                </div>
              </div>
              <select
                className="h-8 w-full rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-2 text-[10px] text-[var(--ink-0)]"
                value={player.positionLabel}
                onChange={(event) =>
                  onUpdateSquadPlayer(manageSquadId, player.id, {
                    positionLabel: event.target.value,
                  })
                }
              >
                <option value="" className="bg-[var(--panel-2)] text-[var(--ink-0)]" />
                {positionOptions.map((pos) => (
                  <option
                    key={pos}
                    value={pos}
                    className="bg-[var(--panel-2)] text-[var(--ink-0)]"
                  >
                    {pos}
                  </option>
                ))}
              </select>
              <div className="flex h-full w-full items-center justify-center">
                <input
                  type="checkbox"
                  checked={player.active !== false}
                  onChange={(event) =>
                    onUpdateSquadPlayer(manageSquadId, player.id, {
                      active: event.target.checked,
                    })
                  }
                  title="Show in Squad"
                  aria-label="Show in Squad"
                />
              </div>
              <div className="flex h-full w-full items-center justify-center">
                <button
                  className={`h-4 w-4 rounded-full border ${
                    isCaptain
                      ? "border-[var(--accent-0)] bg-[var(--accent-0)]"
                      : "border-[var(--line)]"
                  }`}
                  onClick={() =>
                    onUpdateEditableSquad({
                      captainId: isCaptain ? undefined : player.id,
                    })
                  }
                  title="Captain"
                  aria-label="Captain"
                />
              </div>
              <div className="flex h-full w-full items-center justify-center">
                <button
                  className={`h-4 w-4 rounded-full border ${
                    isSub
                      ? "border-[var(--accent-0)] bg-[var(--accent-0)]"
                      : "border-[var(--line)]"
                  }`}
                  onClick={() => {
                    const next = isSub
                      ? editableSquadSubstituteIds.filter((id) => id !== player.id)
                      : [...editableSquadSubstituteIds, player.id];
                    onUpdateEditableSquad({ substituteIds: next });
                  }}
                  title="Substitute"
                  aria-label="Substitute"
                />
              </div>
              <button
                className="rounded-full border border-[var(--line)] p-1 text-[10px] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                onClick={() => onRemoveSquadPlayer(manageSquadId, player.id)}
                title="Delete"
                aria-label="Delete"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 7h16" />
                  <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  <path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
