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
  currentSourceName?: string | null;
  currentSourceDescription?: string | null;
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
  currentSourceName,
  currentSourceDescription,
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
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]/40 p-4">
          <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
            Current source
          </p>
          {managedDirectoryTeam ? (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-[var(--ink-0)]">
                {managedDirectoryTeam.clubName} / {managedDirectoryTeam.teamName}
              </p>
              <p className="text-xs text-[var(--ink-1)]">
                Team roster starts from this linked team. Match board changes still stay local to the active board.
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
          ) : currentSourceName ? (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-[var(--ink-0)]">{currentSourceName}</p>
              <p className="text-xs text-[var(--ink-1)]">
                {currentSourceDescription ??
                  "This side is linked to a saved team outside the club directory view."}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-[var(--ink-1)]">
              This side is currently project-only. Create or link a team here if you want this roster to be reusable across projects.
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]/40 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                Save team
              </p>
              <p className="text-[11px] text-[var(--ink-1)]">
                {currentSourceName
                  ? "Pushes the current team roster back to the linked team."
                  : "Creates a reusable linked team from the current team roster."}
              </p>
            </div>
            {canUsePresetStorage ? (
              <button
                className="rounded-full border border-[var(--accent-0)] px-4 py-2 text-[11px] uppercase tracking-wide text-[var(--accent-0)] hover:brightness-110"
                onClick={onSaveReusableTeam}
              >
                {currentSourceName ? "Update linked team" : "Create linked team"}
              </button>
            ) : (
              <p className="text-[11px] text-[var(--ink-1)]">Paid plan required.</p>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]/40 p-4">
          <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
            Load team
          </p>
          <p className="mt-2 text-[11px] text-[var(--ink-1)]">
            Loading a team replaces this side&apos;s roster with that team&apos;s base squad and links the side to it.
          </p>
          {manageDirectoryTeams.length > 0 ? (
            <>
              <select
                className="mt-3 h-10 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--ink-0)]"
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
