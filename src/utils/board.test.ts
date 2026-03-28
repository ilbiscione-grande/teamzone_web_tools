import { describe, expect, it } from "vitest";
import { getBoardOverridePlayerKey, getBoardSquads } from "./board";
import type { Board, Project, Squad } from "@/models";

describe("board utils", () => {
  it("prefers teamMemberId as the override key", () => {
    expect(
      getBoardOverridePlayerKey({
        id: "snapshot-player-1",
        teamMemberId: "team-member-1",
      })
    ).toBe("team-member-1");
    expect(
      getBoardOverridePlayerKey({
        id: "snapshot-player-2",
      })
    ).toBe("snapshot-player-2");
  });

  it("applies board overrides by teamMemberId for snapshot players", () => {
    const squad: Squad = {
      id: "squad-home",
      name: "Home",
      kit: {
        shirt: "#111111",
        shorts: "#222222",
        socks: "#333333",
      },
      players: [
        {
          id: "snapshot-player-1",
          teamMemberId: "team-member-1",
          name: "Player One",
          positionLabel: "CAM",
          active: true,
          number: 10,
        },
      ],
    };

    const board: Board = {
      id: "board-1",
      name: "Board 1",
      mode: "STATIC",
      pitchView: "FULL",
      pitchOverlay: "NONE",
      pitchOverlayText: false,
      notes: "",
      homeSquadId: "squad-home",
      awaySquadId: undefined,
      squadOverrides: {
        "squad-home": {
          hiddenPlayerIds: ["team-member-1"],
          positionOverrides: {
            "team-member-1": "CF",
          },
        },
      },
      playerLabel: {
        showName: true,
        showPosition: true,
        showNumber: false,
      },
      playerHighlights: [],
      playerLinks: [],
      layers: [],
      frames: [
        {
          id: "frame-1",
          name: "Frame 1",
          objects: [],
        },
      ],
      activeFrameIndex: 0,
    };

    const project: Project = {
      id: "project-1",
      name: "Project",
      createdAt: "2026-03-28T00:00:00.000Z",
      updatedAt: "2026-03-28T00:00:00.000Z",
      schemaVersion: 1,
      settings: {
        mode: "match",
        homeKit: {
          shirt: "#111111",
          shorts: "#222222",
          socks: "#333333",
        },
        awayKit: {
          shirt: "#444444",
          shorts: "#555555",
          socks: "#666666",
        },
        attachBallToPlayer: false,
        defaultPitchView: "FULL",
        defaultPitchOverlay: "NONE",
        defaultPitchShape: "none",
        defaultPlayerLabel: {
          showName: true,
          showPosition: false,
          showNumber: false,
        },
      },
      sessionNotes: "",
      teamContext: {
        homeTeamId: "team-home",
      },
      boards: [board],
      squads: [squad],
      activeBoardId: "board-1",
    };

    const result = getBoardSquads(project, board);
    expect(result.home?.players[0]).toMatchObject({
      teamMemberId: "team-member-1",
      positionLabel: "CF",
      active: false,
    });
  });
});
