"use client";

import type { ReactNode } from "react";
import type { SquadPreset } from "@/models";

type ManageRosterFilter = "all" | "visible" | "hidden" | "guests" | "regular";
type ManageRosterView = "base" | "board";

type ManageTeamsRosterProps = {
  manageSquad: SquadPreset["squad"] | null;
  manageSide: "home" | "away";
  manageRosterView: ManageRosterView;
  manageMembershipSummary: {
    linkedMembers: number;
    localOnly: number;
    guests: number;
  };
  manageBaseSearch: string;
  manageBoardSearch: string;
  manageBoardFilter: ManageRosterFilter;
  manageGuestName: string;
  manageGuestPosition: string;
  manageGuestNumber: string;
  onManageRosterViewChange: (view: ManageRosterView) => void;
  onManageBaseSearchChange: (value: string) => void;
  onManageBoardSearchChange: (value: string) => void;
  onManageBoardFilterChange: (value: ManageRosterFilter) => void;
  onManageGuestNameChange: (value: string) => void;
  onManageGuestPositionChange: (value: string) => void;
  onManageGuestNumberChange: (value: string) => void;
  onAddMember: () => void;
  onAddGuestMember: () => void;
  onAddBoardGuest: () => void;
  onShowAllBoardPlayers: () => void;
  onResetBoardPositions: () => void;
  onResetBoardRoster: () => void;
  baseRosterToolbar?: ReactNode;
  children: ReactNode;
};

export default function ManageTeamsRoster({
  manageSquad,
  manageSide,
  manageRosterView,
  manageMembershipSummary,
  manageBaseSearch,
  manageBoardSearch,
  manageBoardFilter,
  manageGuestName,
  manageGuestPosition,
  manageGuestNumber,
  onManageRosterViewChange,
  onManageBaseSearchChange,
  onManageBoardSearchChange,
  onManageBoardFilterChange,
  onManageGuestNameChange,
  onManageGuestPositionChange,
  onManageGuestNumberChange,
  onAddMember,
  onAddGuestMember,
  onAddBoardGuest,
  onShowAllBoardPlayers,
  onResetBoardPositions,
  onResetBoardRoster,
  baseRosterToolbar,
  children,
}: ManageTeamsRosterProps) {
  return (
    <>
      <div className="space-y-3 rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/40 p-4 lg:p-5">
        {manageSquad ? (
          <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <span className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                Roster
              </span>
              <div className="flex items-center gap-2 self-start lg:self-auto">
                <button
                  className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-wide ${
                    manageRosterView === "base"
                      ? "border-[var(--accent-0)] text-[var(--ink-0)]"
                      : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                  }`}
                  onClick={() => onManageRosterViewChange("base")}
                >
                  Team roster
                </button>
                <button
                  className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-wide ${
                    manageRosterView === "board"
                      ? "border-[var(--accent-0)] text-[var(--ink-0)]"
                      : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                  }`}
                  onClick={() => onManageRosterViewChange("board")}
                >
                  Match board
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
                <span className="rounded-full border border-[var(--line)] px-2 py-1">
                  Linked members: {manageMembershipSummary.linkedMembers}
                </span>
                <span className="rounded-full border border-[var(--line)] px-2 py-1">
                  Local only: {manageMembershipSummary.localOnly}
                </span>
                <span className="rounded-full border border-[var(--line)] px-2 py-1">
                  Guests: {manageMembershipSummary.guests}
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:min-w-[380px] xl:max-w-[520px] xl:flex-1 xl:justify-end">
                <input
                  className="h-8 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-[11px] text-[var(--ink-0)] sm:flex-1 xl:max-w-[340px]"
                  placeholder={
                    manageRosterView === "base"
                      ? "Search team roster..."
                      : "Search match board..."
                  }
                  value={manageRosterView === "base" ? manageBaseSearch : manageBoardSearch}
                  onChange={(event) =>
                    manageRosterView === "base"
                      ? onManageBaseSearchChange(event.target.value)
                      : onManageBoardSearchChange(event.target.value)
                  }
                />
                {manageRosterView === "board" ? (
                  <select
                    className="h-8 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-[11px]"
                    value={manageBoardFilter}
                    onChange={(event) =>
                      onManageBoardFilterChange(event.target.value as ManageRosterFilter)
                    }
                  >
                    <option value="all">All</option>
                    <option value="visible">Visible</option>
                    <option value="hidden">Hidden</option>
                    <option value="guests">Guests</option>
                    <option value="regular">Regular</option>
                  </select>
                ) : null}
              </div>
            </div>
            {manageRosterView === "base" ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <button
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                    onClick={onAddMember}
                  >
                    Add player
                  </button>
                  <button
                    className="rounded-full border border-[var(--accent-0)] px-3 py-1 text-[11px] uppercase tracking-wide text-[var(--accent-0)] hover:brightness-110"
                    onClick={onAddGuestMember}
                  >
                    Add guest
                  </button>
                </div>
                {baseRosterToolbar}
              </div>
            ) : (
              <details className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]/35">
                <summary className="cursor-pointer list-none px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                  Match board tools
                </summary>
                <div className="space-y-3 border-t border-[var(--line)] px-3 py-3">
                  <p className="text-[10px] text-[var(--ink-1)]">
                    Add temporary guests and adjust board-only visibility or positions here.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      className="h-8 rounded-md border border-[var(--line)] bg-transparent px-2 text-[11px] text-[var(--ink-0)]"
                      placeholder="Guest name"
                      value={manageGuestName}
                      onChange={(event) => onManageGuestNameChange(event.target.value)}
                    />
                    <input
                      className="h-8 rounded-md border border-[var(--line)] bg-transparent px-2 text-[11px] text-[var(--ink-0)]"
                      placeholder="Position"
                      value={manageGuestPosition}
                      onChange={(event) => onManageGuestPositionChange(event.target.value)}
                    />
                    <input
                      className="h-8 rounded-md border border-[var(--line)] bg-transparent px-2 text-[11px] text-[var(--ink-0)]"
                      placeholder="#"
                      value={manageGuestNumber}
                      onChange={(event) => onManageGuestNumberChange(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <button
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                      onClick={onAddBoardGuest}
                    >
                      Add board guest
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
                    <button
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                      onClick={onShowAllBoardPlayers}
                    >
                      Show all
                    </button>
                    <button
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                      onClick={onResetBoardPositions}
                    >
                      Reset positions
                    </button>
                    <button
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                      onClick={onResetBoardRoster}
                    >
                      Reset board roster
                    </button>
                  </div>
                </div>
              </details>
            )}
            {children}
          </>
        ) : (
          <p className="text-xs text-[var(--ink-1)]">No team data available.</p>
        )}
      </div>
    </>
  );
}
