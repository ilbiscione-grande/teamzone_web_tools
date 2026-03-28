import type { Squad, SquadPlayer, TeamDirectoryMember } from "@/models";

export type ManageTeamRosterRow = {
  identity: string;
  player: SquadPlayer;
  linkedMember?: TeamDirectoryMember;
  localSnapshotId?: string;
  hasLocalSnapshot: boolean;
  source: "linked" | "local";
};

export const getManageRosterIdentity = (
  player: Pick<SquadPlayer, "id" | "teamMemberId" | "sourcePlayerId">
) => player.teamMemberId ?? player.sourcePlayerId ?? player.id;

const createPlayerFromMember = (
  member: TeamDirectoryMember,
  teamId: string,
  teamName: string
): SquadPlayer => ({
  id: member.id,
  teamMemberId: member.id,
  sourcePlayerId: member.id,
  sourceTeamId: teamId,
  sourceTeamName: teamName,
  name: member.displayName,
  positionLabel: member.teamPosition?.trim() || "POS",
  guest: member.isGuest,
  active: member.isActive,
  number: member.shirtNumber ?? undefined,
  photoUrl: member.photoUrl ?? undefined,
});

export const buildManageTeamRosterRows = (params: {
  snapshotSquad: Squad | null;
  linkedMembers: TeamDirectoryMember[];
  linkedTeamId?: string;
  linkedTeamName?: string;
}) => {
  const { snapshotSquad, linkedMembers, linkedTeamId, linkedTeamName } = params;
  if (!snapshotSquad) {
    return [] as ManageTeamRosterRow[];
  }

  if (!linkedMembers.length || !linkedTeamId || !linkedTeamName) {
    return snapshotSquad.players.map((player) => ({
      identity: getManageRosterIdentity(player),
      player,
      localSnapshotId: player.id,
      hasLocalSnapshot: true,
      source: "local" as const,
    }));
  }

  const snapshotByIdentity = new Map<string, SquadPlayer>();
  const unmatchedSnapshotPlayers: SquadPlayer[] = [];

  snapshotSquad.players.forEach((player) => {
    const identity = getManageRosterIdentity(player);
    if (player.teamMemberId || player.sourcePlayerId) {
      snapshotByIdentity.set(identity, player);
      return;
    }
    unmatchedSnapshotPlayers.push(player);
  });

  const mergedRows = linkedMembers
    .filter((member) => member.memberRole === "player" || member.isGuest)
    .map((member) => {
      const snapshot = snapshotByIdentity.get(member.id);
      const player = snapshot
        ? {
            ...snapshot,
            teamMemberId: snapshot.teamMemberId ?? member.id,
            sourcePlayerId: snapshot.sourcePlayerId ?? member.id,
            sourceTeamId: snapshot.sourceTeamId ?? linkedTeamId,
            sourceTeamName: snapshot.sourceTeamName ?? linkedTeamName,
          }
        : createPlayerFromMember(member, linkedTeamId, linkedTeamName);

      return {
        identity: member.id,
        player,
        linkedMember: member,
        localSnapshotId: snapshot?.id,
        hasLocalSnapshot: Boolean(snapshot),
        source: "linked" as const,
      } satisfies ManageTeamRosterRow;
    });

  const localRows = unmatchedSnapshotPlayers.map((player) => ({
    identity: getManageRosterIdentity(player),
    player,
    localSnapshotId: player.id,
    hasLocalSnapshot: true,
    source: "local" as const,
  }));

  return [...mergedRows, ...localRows];
};

export const findManageTeamRosterRow = (
  rows: ManageTeamRosterRow[],
  playerId: string
) =>
  rows.find(
    (row) =>
      row.identity === playerId ||
      row.player.id === playerId ||
      row.player.teamMemberId === playerId ||
      row.player.sourcePlayerId === playerId
  ) ?? null;
