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
  clubId: string;
  teamId: string;
  clubName: string;
  teamName: string;
  teamType: string;
  ageGroup?: string | null;
  seasonLabel?: string | null;
};

type ManageTeamsDirectoryClubOption = {
  id: string;
  name: string;
};

type ManageTeamsSourcePanelProps = {
  canUsePresetStorage: boolean;
  managedDirectoryTeam: ManageTeamsSourceTeam | null;
  currentActiveTeamName?: string | null;
  currentActiveClubId: string;
  currentActiveTeamId: string;
  currentActiveClubTeams: Array<{
    id: string;
    name: string;
  }>;
  currentSourceName?: string | null;
  currentSourceDescription?: string | null;
  manageDirectoryClubs: ManageTeamsDirectoryClubOption[];
  manageDirectoryTeams: ManageTeamsDirectoryOption[];
  manageSelectedDirectoryClubId: string;
  manageSelectedDirectoryTeamId: string;
  selectedManageDirectoryTeam: ManageTeamsDirectoryOption | null;
  selectedManageDirectoryClubTeams: Array<{
    id: string;
    name: string;
  }>;
  squadPresetsLoading: boolean;
  squadPresetsError: string | null;
  managePresetStatus: string | null;
  onCurrentActiveClubIdChange: (clubId: string) => void;
  onCurrentActiveTeamIdChange: (teamId: string) => void;
  onManageSelectedDirectoryClubIdChange: (clubId: string) => void;
  onManageSelectedDirectoryTeamIdChange: (teamId: string) => void;
  onLoadDirectoryTeamIntoSide: (teamId: string, side: "home" | "away") => void;
  onSaveReusableTeam: () => void;
  onSetManagedTeamAsCurrent?: (() => void) | null;
};

export default function ManageTeamsSourcePanel({
  canUsePresetStorage,
  managedDirectoryTeam,
  currentActiveTeamName,
  currentActiveClubId,
  currentActiveTeamId,
  currentActiveClubTeams,
  currentSourceName,
  currentSourceDescription,
  manageDirectoryClubs,
  manageDirectoryTeams,
  manageSelectedDirectoryClubId,
  manageSelectedDirectoryTeamId,
  selectedManageDirectoryTeam,
  selectedManageDirectoryClubTeams,
  squadPresetsLoading,
  squadPresetsError,
  managePresetStatus,
  onCurrentActiveClubIdChange,
  onCurrentActiveTeamIdChange,
  onManageSelectedDirectoryClubIdChange,
  onManageSelectedDirectoryTeamIdChange,
  onLoadDirectoryTeamIntoSide,
  onSaveReusableTeam,
  onSetManagedTeamAsCurrent,
}: ManageTeamsSourcePanelProps) {
  return (
    <>
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]/40 p-4">
          <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
            Current team
          </p>
          <p className="mt-2 text-sm text-[var(--ink-0)]">
            {currentActiveTeamName ?? "No active team selected"}
          </p>
          <p className="mt-1 text-[11px] text-[var(--ink-1)]">
            Used as the default Home team when creating new projects.
          </p>
          {manageDirectoryClubs.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                  Current club
                </span>
                <select
                  className="h-10 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--ink-0)]"
                  value={currentActiveClubId}
                  onChange={(event) => onCurrentActiveClubIdChange(event.target.value)}
                >
                  {manageDirectoryClubs.map((club) => (
                    <option key={`manage-club-${club.id}`} value={club.id} className="bg-slate-900">
                      {club.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                  Current team
                </span>
                <select
                  className="h-10 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--ink-0)]"
                  value={currentActiveTeamId}
                  onChange={(event) => onCurrentActiveTeamIdChange(event.target.value)}
                >
                  {currentActiveClubTeams.map((team) => (
                    <option
                      key={`manage-current-team-${team.id}`}
                      value={team.id}
                      className="bg-slate-900"
                    >
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          {managedDirectoryTeam && onSetManagedTeamAsCurrent ? (
            <button
              className="mt-3 rounded-full border border-[var(--line)] px-3 py-2 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              onClick={onSetManagedTeamAsCurrent}
            >
              Set linked team as current
            </button>
          ) : null}
        </div>
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
                Linked team
              </p>
              <p className="text-[11px] text-[var(--ink-1)]">
                {currentSourceName
                  ? "Updates the linked team's only roster."
                  : "This side is not linked yet. Switch to one of your teams first."}
              </p>
            </div>
            {canUsePresetStorage ? (
              <button
                className="rounded-full border border-[var(--accent-0)] px-4 py-2 text-[11px] uppercase tracking-wide text-[var(--accent-0)] hover:brightness-110"
                onClick={onSaveReusableTeam}
              >
                Update linked team
              </button>
            ) : (
              <p className="text-[11px] text-[var(--ink-1)]">Paid plan required.</p>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]/40 p-4">
          <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
            Switch team
          </p>
          <p className="mt-2 text-[11px] text-[var(--ink-1)]">
            Each team has exactly one roster. Switching team replaces this side with that team&apos;s roster and links the side to it.
          </p>
          {manageDirectoryTeams.length > 0 ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                    Club
                  </span>
                  <select
                    className="h-10 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--ink-0)]"
                    value={manageSelectedDirectoryClubId}
                    onChange={(event) => onManageSelectedDirectoryClubIdChange(event.target.value)}
                  >
                    {manageDirectoryClubs.map((club) => (
                      <option key={`switch-club-${club.id}`} value={club.id} className="bg-slate-900">
                        {club.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                    Team
                  </span>
                  <select
                    className="h-10 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--ink-0)]"
                    value={manageSelectedDirectoryTeamId}
                    onChange={(event) => onManageSelectedDirectoryTeamIdChange(event.target.value)}
                  >
                    {selectedManageDirectoryClubTeams.map((team) => (
                      <option
                        key={team.id}
                        value={team.id}
                        className="bg-slate-900"
                      >
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
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
