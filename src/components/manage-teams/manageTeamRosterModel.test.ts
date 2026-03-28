import { describe, expect, it } from "vitest";

import type { Squad, TeamDirectoryMember } from "@/models";
import {
  buildManageTeamRosterRows,
  findManageTeamRosterRow,
  getManageRosterIdentity,
} from "./manageTeamRosterModel";

describe("manageTeamRosterModel", () => {
  const linkedMembers: TeamDirectoryMember[] = [
    {
      id: "member-1",
      displayName: "Arvid Tellt",
      memberRole: "player",
      teamPosition: "Goalkeeper (GK)",
      isTeamAdmin: false,
      isGuest: false,
      isActive: true,
      shirtNumber: 1,
      sortOrder: 0,
      photoUrl: null,
      userId: null,
    },
    {
      id: "member-2",
      displayName: "Taim Hamid",
      memberRole: "player",
      teamPosition: "Central Midfielder (CM)",
      isTeamAdmin: false,
      isGuest: false,
      isActive: true,
      shirtNumber: 8,
      sortOrder: 1,
      photoUrl: null,
      userId: null,
    },
  ];

  const snapshotSquad: Squad = {
    id: "squad-1",
    name: "Home",
    kit: {
      shirt: "#ffffff",
      shorts: "#000000",
      socks: "#ffffff",
    },
    players: [
      {
        id: "snapshot-1",
        teamMemberId: "member-1",
        sourcePlayerId: "member-1",
        sourceTeamId: "team-1",
        sourceTeamName: "Eksjo J18",
        name: "Arvid Tellt",
        positionLabel: "Goalkeeper (GK)",
        number: 1,
        active: true,
      },
      {
        id: "local-player-1",
        name: "Local Guest",
        positionLabel: "Center Forward (CF)",
        number: 99,
        guest: true,
        active: true,
      },
    ],
  };

  it("prefers teamMemberId and sourcePlayerId before snapshot id", () => {
    expect(
      getManageRosterIdentity({
        id: "snapshot-1",
        teamMemberId: "member-1",
        sourcePlayerId: "legacy-1",
      })
    ).toBe("member-1");
    expect(
      getManageRosterIdentity({
        id: "snapshot-1",
        sourcePlayerId: "legacy-1",
      })
    ).toBe("legacy-1");
  });

  it("builds linked rows from team members and appends local-only snapshot players", () => {
    const rows = buildManageTeamRosterRows({
      snapshotSquad,
      linkedMembers,
      linkedTeamId: "team-1",
      linkedTeamName: "Eksjo J18",
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      identity: "member-1",
      source: "linked",
      hasLocalSnapshot: true,
      localSnapshotId: "snapshot-1",
    });
    expect(rows[1]).toMatchObject({
      identity: "member-2",
      source: "linked",
      hasLocalSnapshot: false,
    });
    expect(rows[1].player).toMatchObject({
      id: "member-2",
      teamMemberId: "member-2",
      sourcePlayerId: "member-2",
      name: "Taim Hamid",
      positionLabel: "Central Midfielder (CM)",
    });
    expect(rows[2]).toMatchObject({
      identity: "local-player-1",
      source: "local",
      hasLocalSnapshot: true,
      localSnapshotId: "local-player-1",
    });
  });

  it("can find rows by identity, snapshot id or linked ids", () => {
    const rows = buildManageTeamRosterRows({
      snapshotSquad,
      linkedMembers,
      linkedTeamId: "team-1",
      linkedTeamName: "Eksjo J18",
    });

    expect(findManageTeamRosterRow(rows, "member-1")?.localSnapshotId).toBe("snapshot-1");
    expect(findManageTeamRosterRow(rows, "snapshot-1")?.identity).toBe("member-1");
    expect(findManageTeamRosterRow(rows, "local-player-1")?.source).toBe("local");
  });
});
