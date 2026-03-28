"use client";

type ManageTeamsSourceTeam = {
  clubName: string;
  teamName: string;
  clubMembershipRole: string;
  teamType: string;
  ageGroup?: string | null;
  seasonLabel?: string | null;
  isCurrentUserClubAdmin: boolean;
  isCurrentUserTeamAdmin: boolean;
};

type ManageTeamsDirectoryOption = {
  teamId: string;
  clubName: string;
  teamName: string;
  teamType: string;
  ageGroup?: string | null;
  seasonLabel?: string | null;
};

type ManageTeamsSourcePanelProps = {
  canUsePresetStorage: boolean;
  managedDirectoryTeam: ManageTeamsSourceTeam | null;
  manageDirectoryTeams: ManageTeamsDirectoryOption[];
  manageSelectedDirectoryTeamId: string;
  selectedManageDirectoryTeam: ManageTeamsDirectoryOption | null;
  squadPresetsLoading: boolean;
  squadPresetsError: string | null;
  managePresetStatus: string | null;
  onManageSelectedDirectoryTeamIdChange: (teamId: string) => void;
  onLoadDirectoryTeamIntoSide: (teamId: string, side: "home" | "away") => void;
  onSaveReusableTeam: () => void;
};

export default function ManageTeamsSourcePanel({
  canUsePresetStorage,
  managedDirectoryTeam,
  manageDirectoryTeams,
  manageSelectedDirectoryTeamId,
  selectedManageDirectoryTeam,
  squadPresetsLoading,
  squadPresetsError,
  managePresetStatus,
  onManageSelectedDirectoryTeamIdChange,
  onLoadDirectoryTeamIntoSide,
  onSaveReusableTeam,
}: ManageTeamsSourcePanelProps) {
  return (
    <>
      {!canUsePresetStorage ? (
        <p className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)]/50 px-3 py-2 text-xs text-[var(--ink-1)]">
          Free/Auth plans can edit rosters locally in this project. Reusable team storage is available on paid plans.
        </p>
      ) : null}
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/35 px-4 py-2.5 text-[11px] text-[var(--ink-1)]">
        <span className="shrink-0 rounded-full border border-[var(--line)] px-2 py-0.5 text-[9px] uppercase tracking-widest">
          Info
        </span>
        <p className="min-w-0 truncate">
          Changes here affect the current project first. Use <span className="text-[var(--accent-0)]">Save as reusable team</span> when you want this squad available in future projects.
        </p>
      </div>
      {canUsePresetStorage ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/25 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                Save reusable team
              </p>
              <p className="text-[11px] text-[var(--ink-1)]">
                Saves this side as a reusable team for future projects.
              </p>
            </div>
            <button
              className="rounded-full border border-[var(--accent-0)] px-4 py-2 text-[11px] uppercase tracking-wide text-[var(--accent-0)] hover:brightness-110"
              onClick={onSaveReusableTeam}
            >
              Save reusable team
            </button>
          </div>
        </div>
      ) : null}
      <details className="group rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/25">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <p className="shrink-0 text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
              Team source
            </p>
            <p className="truncate text-[11px] text-[var(--ink-1)]">
              {managedDirectoryTeam
                ? `${managedDirectoryTeam.clubName} / ${managedDirectoryTeam.teamName}`
                : "This side is currently using a local project squad."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
            {managedDirectoryTeam ? (
              <>
                <span className="rounded-full border border-[var(--line)] px-2 py-1">
                  {managedDirectoryTeam.teamType}
                </span>
                {managedDirectoryTeam.isCurrentUserTeamAdmin ? (
                  <span className="rounded-full border border-[var(--accent-0)] px-2 py-1 text-[var(--accent-0)]">
                    Team admin
                  </span>
                ) : null}
              </>
            ) : (
              <span className="rounded-full border border-[var(--accent-1)] px-2 py-1 text-[var(--accent-1)]">
                Local squad
              </span>
            )}
            <span className="transition-transform group-open:rotate-180">⌄</span>
          </div>
        </summary>
        <div className="grid gap-4 border-t border-[var(--line)] px-4 py-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]/40 p-4">
            <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
              Current source
            </p>
            {managedDirectoryTeam ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-[var(--ink-0)]">
                  {managedDirectoryTeam.clubName} / {managedDirectoryTeam.teamName}
                </p>
                <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
                  <span className="rounded-full border border-[var(--line)] px-2 py-1">
                    Club role: {managedDirectoryTeam.clubMembershipRole}
                  </span>
                  <span className="rounded-full border border-[var(--line)] px-2 py-1">
                    Team type: {managedDirectoryTeam.teamType}
                  </span>
                  {managedDirectoryTeam.ageGroup ? (
                    <span className="rounded-full border border-[var(--line)] px-2 py-1">
                      {managedDirectoryTeam.ageGroup}
                    </span>
                  ) : null}
                  {managedDirectoryTeam.seasonLabel ? (
                    <span className="rounded-full border border-[var(--line)] px-2 py-1">
                      {managedDirectoryTeam.seasonLabel}
                    </span>
                  ) : null}
                  {managedDirectoryTeam.isCurrentUserClubAdmin ? (
                    <span className="rounded-full border border-[var(--accent-2)] px-2 py-1 text-[var(--accent-2)]">
                      Club admin
                    </span>
                  ) : null}
                  {managedDirectoryTeam.isCurrentUserTeamAdmin ? (
                    <span className="rounded-full border border-[var(--accent-0)] px-2 py-1 text-[var(--accent-0)]">
                      Team admin
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-[var(--ink-1)]">
                This side is currently using a local project squad. Saving a reusable team does not automatically relink the current board to that saved team.
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]/40 p-4">
            <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
              Load team
            </p>
            {manageDirectoryTeams.length > 0 ? (
              <>
                <select
                  className="mt-2 h-10 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--ink-0)]"
                  value={manageSelectedDirectoryTeamId}
                  onChange={(event) => onManageSelectedDirectoryTeamIdChange(event.target.value)}
                >
                  {manageDirectoryTeams.map((team) => (
                    <option key={team.teamId} value={team.teamId} className="bg-slate-900">
                      {team.clubName} / {team.teamName}
                    </option>
                  ))}
                </select>
                {selectedManageDirectoryTeam ? (
                  <p className="mt-2 text-[11px] text-[var(--ink-1)]">
                    {selectedManageDirectoryTeam.teamType}
                    {selectedManageDirectoryTeam.ageGroup
                      ? ` • ${selectedManageDirectoryTeam.ageGroup}`
                      : ""}
                    {selectedManageDirectoryTeam.seasonLabel
                      ? ` • ${selectedManageDirectoryTeam.seasonLabel}`
                      : ""}
                  </p>
                ) : null}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    className="rounded-full border border-[var(--line)] px-3 py-2 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                    onClick={() =>
                      onLoadDirectoryTeamIntoSide(manageSelectedDirectoryTeamId, "home")
                    }
                  >
                    Use as Home
                  </button>
                  <button
                    className="rounded-full border border-[var(--line)] px-3 py-2 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                    onClick={() =>
                      onLoadDirectoryTeamIntoSide(manageSelectedDirectoryTeamId, "away")
                    }
                  >
                    Use as Away
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-2 text-xs text-[var(--ink-1)]">
                No club teams available yet for this account.
              </p>
            )}
          </div>
        </div>
      </details>
      {squadPresetsLoading ? (
        <p className="text-xs text-[var(--ink-1)]">Loading teams...</p>
      ) : null}
      {squadPresetsError ? (
        <p className="text-xs text-[var(--accent-1)]">{squadPresetsError}</p>
      ) : null}
      {managePresetStatus ? (
        <p className="text-xs text-[var(--accent-1)]">{managePresetStatus}</p>
      ) : null}
    </>
  );
}
