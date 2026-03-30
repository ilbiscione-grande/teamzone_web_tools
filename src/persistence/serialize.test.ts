import { describe, expect, it } from "vitest";
import { serializeProject, deserializeProject } from "./serialize";
import { createSampleProject } from "./sampleData";
import { SCHEMA_VERSION } from "@/models";
import type { Project } from "@/models";

describe("serialize/deserialize", () => {
  const createComplexProject = (): Project => ({
    id: "project-complex",
    name: "Complex Project",
    createdAt: "2026-03-11T10:00:00.000Z",
    updatedAt: "2026-03-11T11:00:00.000Z",
    schemaVersion: SCHEMA_VERSION,
    settings: {
      mode: "training",
      homeKit: {
        shirt: "#112233",
        shorts: "#223344",
        socks: "#334455",
        vest: "#445566",
      },
      awayKit: {
        shirt: "#667788",
        shorts: "#778899",
        socks: "#8899aa",
        vest: "#99aabb",
      },
      attachBallToPlayer: true,
      defaultPitchView: "GREEN_EMPTY",
      defaultPitchOverlay: "THIRDS",
      defaultPitchShape: "square",
      defaultPlayerLabel: {
        showName: true,
        showPosition: true,
        showNumber: true,
      },
    },
    sessionNotes: "Session notes",
    sessionNotesFields: {
      training: {
        mainFocus: "Build up play",
        partGoals: "Create central options",
        dateTime: "2026-03-11 18:00",
        equipment: ["Cones", "Bibs", "Balls"],
        organisation: "7v7",
        keyBehaviours: "Scan before receiving",
        usualErrors: "Distances too long",
        coachInstructions: "Play forward when possible",
      },
    },
    teamContext: {
      homeTeamId: "team-home",
      awayTeamId: "team-away",
      homeTeamSnapshot: {
        teamId: "team-home",
        teamName: "Home Team",
        clubId: "club-home",
        clubName: "Home Club",
        capturedAt: "2026-03-11T10:30:00.000Z",
      },
      awayTeamSnapshot: {
        teamId: "team-away",
        teamName: "Away Team",
        clubId: "club-away",
        clubName: "Away Club",
        capturedAt: "2026-03-11T10:31:00.000Z",
      },
    },
    squads: [
      {
        id: "squad-home",
        name: "Home",
        clubLogo: "data:image/png;base64,home-logo",
        kit: {
          shirt: "#112233",
          shirtSecondary: "#abcdef",
          shorts: "#223344",
          socks: "#334455",
          vest: "#445566",
        },
        players: [
          {
            id: "player-home-1",
            teamMemberId: "member-home-1",
            name: "Home One",
            positionLabel: "GK",
            active: true,
            guest: false,
            number: 1,
            vestColor: "#ffee00",
            photoUrl: "https://example.com/player-home-1.png",
            sourceTeamId: "team-home",
            sourceTeamName: "Home Team",
            sourcePlayerId: "source-home-1",
          },
          {
            id: "player-home-2",
            name: "Home Two",
            positionLabel: "CB",
            active: false,
            guest: true,
            number: 4,
          },
        ],
        captainId: "player-home-1",
        substituteIds: ["player-home-2"],
      },
      {
        id: "squad-away",
        name: "Away",
        clubLogo: "data:image/png;base64,away-logo",
        kit: {
          shirt: "#667788",
          shorts: "#778899",
          socks: "#8899aa",
          vest: "#99aabb",
        },
        players: [
          {
            id: "player-away-1",
            name: "Away One",
            positionLabel: "ST",
            active: true,
            guest: false,
            number: 9,
          },
        ],
        captainId: "player-away-1",
        substituteIds: [],
      },
    ],
    boards: [
      {
        id: "board-static",
        name: "Static Board",
        mode: "STATIC",
        pitchView: "FULL",
        pitchRotation: 180,
        threeDView: true,
        threeDStrength: 75,
        pitchOverlay: "CORRIDORS",
        pitchOverlayText: true,
        watermarkEnabled: true,
        watermarkText: "Teamzone Watermark",
        notes: "Board notes",
        notesTemplate: "TRAINING",
        notesFields: {
          training: {
            mainFocus: "Static build-up",
            equipment: ["Cones"],
          },
        },
        homeSquadId: "squad-home",
        awaySquadId: "squad-away",
        squadOverrides: {
          "squad-home": {
            hiddenPlayerIds: ["player-home-2"],
            guestPlayers: [
              {
                id: "guest-home-1",
                name: "Guest Home",
                positionLabel: "AM",
                guest: true,
                active: true,
                number: 18,
              },
            ],
            numberOverrides: {
              "player-home-1": 99,
            },
            positionOverrides: {
              "player-home-1": "SW",
            },
          },
        },
        playerLabel: {
          showName: true,
          showPosition: true,
          showNumber: true,
        },
        playerHighlights: ["player-token-1"],
        playerLinks: [
          {
            id: "board-link-1",
            playerIds: ["player-token-1", "player-token-2"],
            style: {
              stroke: "#ffffff",
              fill: "transparent",
              strokeWidth: 0.2,
              dash: [2, 1],
              opacity: 1,
            },
          },
        ],
        layers: [],
        frames: [
          {
            id: "frame-1",
            name: "Frame 1",
            action: "Pass",
            notes: "Frame notes",
            durationMs: 900,
            playerHighlights: ["player-token-1"],
            playerLinks: [
              {
                id: "frame-link-1",
                playerIds: ["player-token-1", "player-token-2", "player-token-1"],
                style: {
                  stroke: "#ffcc00",
                  fill: "transparent",
                  strokeWidth: 0.3,
                  dash: [],
                  opacity: 1,
                },
              },
            ],
            objects: [
              {
                id: "player-token-1",
                type: "player",
                position: { x: 10, y: 20 },
                rotation: 15,
                scale: { x: 1.2, y: 1.2 },
                style: {
                  stroke: "#000000",
                  fill: "#ffffff",
                  strokeWidth: 0.4,
                  dash: [],
                  opacity: 1,
                },
                zIndex: 3,
                locked: false,
                visible: true,
                animation: "pulse",
                squadPlayerId: "player-home-1",
                boardPositionLabel: "6",
                hasBall: true,
                showName: true,
                showPosition: true,
                showNumber: true,
                tokenSize: 2.4,
                vestColor: "#ffee00",
                moveControl: { x: 12, y: 24 },
              },
              {
                id: "player-token-2",
                type: "player",
                position: { x: 18, y: 28 },
                rotation: 0,
                scale: { x: 1, y: 1 },
                style: {
                  stroke: "#111111",
                  fill: "#f9bf4a",
                  strokeWidth: 0.4,
                  dash: [],
                  opacity: 1,
                },
                zIndex: 3,
                locked: false,
                visible: true,
                squadPlayerId: "player-home-2",
                showName: false,
                showPosition: true,
                showNumber: false,
                tokenSize: 2,
              },
              {
                id: "ball-1",
                type: "ball",
                position: { x: 11, y: 21 },
                rotation: 0,
                scale: { x: 1, y: 1 },
                style: {
                  stroke: "#111111",
                  fill: "#ffffff",
                  strokeWidth: 0.3,
                  dash: [],
                  opacity: 1,
                },
                zIndex: 4,
                locked: false,
                visible: true,
                attachedToId: "player-token-1",
                offset: { x: 1, y: 1 },
              },
              {
                id: "cone-1",
                type: "cone",
                position: { x: 30, y: 30 },
                rotation: 0,
                scale: { x: 1, y: 1 },
                style: {
                  stroke: "#222222",
                  fill: "#ff8800",
                  strokeWidth: 0.2,
                  dash: [],
                  opacity: 1,
                },
                zIndex: 1,
                locked: false,
                visible: true,
                width: 4,
                height: 6,
              },
              {
                id: "pole-1",
                type: "pole",
                position: { x: 35, y: 35 },
                rotation: 8,
                scale: { x: 1, y: 1 },
                style: {
                  stroke: "#ffffff",
                  fill: "#00aa88",
                  strokeWidth: 0.2,
                  dash: [],
                  opacity: 1,
                },
                zIndex: 1,
                locked: false,
                visible: true,
                width: 2,
                height: 10,
              },
              {
                id: "mannequin-1",
                type: "mannequin",
                position: { x: 40, y: 40 },
                rotation: 0,
                scale: { x: 1, y: 1 },
                style: {
                  stroke: "#ffffff",
                  fill: "#0088cc",
                  strokeWidth: 0.2,
                  dash: [],
                  opacity: 1,
                },
                zIndex: 1,
                locked: false,
                visible: true,
                width: 3,
                height: 8,
              },
              {
                id: "goal-1",
                type: "goal",
                position: { x: 45, y: 45 },
                rotation: 0,
                scale: { x: 1, y: 1 },
                style: {
                  stroke: "#ffffff",
                  fill: "rgba(255,255,255,0.1)",
                  strokeWidth: 0.2,
                  dash: [],
                  opacity: 1,
                },
                zIndex: 1,
                locked: true,
                visible: true,
                width: 6,
                height: 4,
              },
              {
                id: "circle-1",
                type: "circle",
                position: { x: 50, y: 20 },
                rotation: 0,
                scale: { x: 1, y: 1 },
                style: {
                  stroke: "#ff0000",
                  fill: "rgba(255,0,0,0.1)",
                  strokeWidth: 0.2,
                  dash: [1, 1],
                  opacity: 0.8,
                },
                zIndex: 0,
                locked: false,
                visible: true,
                radius: 5,
              },
              {
                id: "rect-1",
                type: "rect",
                position: { x: 55, y: 20 },
                rotation: 0,
                scale: { x: 1, y: 1 },
                style: {
                  stroke: "#00ff00",
                  fill: "rgba(0,255,0,0.1)",
                  strokeWidth: 0.2,
                  dash: [],
                  opacity: 1,
                },
                zIndex: 0,
                locked: false,
                visible: true,
                width: 8,
                height: 4,
                cornerRadius: 0.5,
              },
              {
                id: "triangle-1",
                type: "triangle",
                position: { x: 66, y: 20 },
                rotation: 0,
                scale: { x: 1, y: 1 },
                style: {
                  stroke: "#0000ff",
                  fill: "rgba(0,0,255,0.1)",
                  strokeWidth: 0.2,
                  dash: [],
                  opacity: 1,
                },
                zIndex: 0,
                locked: false,
                visible: true,
                width: 6,
                height: 6,
              },
              {
                id: "arrow-1",
                type: "arrow",
                position: { x: 20, y: 50 },
                rotation: 0,
                scale: { x: 1, y: 1 },
                style: {
                  stroke: "#ffffff",
                  fill: "transparent",
                  strokeWidth: 0.6,
                  dash: [4, 3],
                  opacity: 1,
                },
                zIndex: 2,
                locked: false,
                visible: true,
                animation: "draw",
                points: [0, 0, 12, -6],
                head: true,
                dashed: true,
                curved: true,
                control: { x: 7, y: -8 },
              },
              {
                id: "text-1",
                type: "text",
                position: { x: 25, y: 12 },
                rotation: 0,
                scale: { x: 1, y: 1 },
                style: {
                  stroke: "#000000",
                  fill: "#ffffff",
                  strokeWidth: 0,
                  dash: [],
                  opacity: 1,
                },
                zIndex: 2,
                locked: false,
                visible: true,
                text: "Press trigger",
                fontSize: 2.4,
                bold: true,
                background: true,
                align: "center",
                width: 20,
                height: 6,
              },
              {
                id: "path-1",
                type: "path",
                position: { x: 60, y: 40 },
                rotation: 0,
                scale: { x: 1, y: 1 },
                style: {
                  stroke: "#f9bf4a",
                  fill: "transparent",
                  strokeWidth: 0.5,
                  dash: [],
                  opacity: 1,
                },
                zIndex: 2,
                locked: false,
                visible: true,
                animation: "highlight",
                points: [0, 0, 4, 2, 7, 5, 10, 8],
                linkedToId: "player-token-1",
              },
            ],
          },
        ],
        activeFrameIndex: 0,
      },
      {
        id: "board-dynamic",
        name: "Dynamic Board",
        mode: "DYNAMIC",
        pitchView: "OFF_HALF",
        pitchOverlay: "ZONES_18",
        pitchOverlayText: false,
        notes: "Dynamic notes",
        notesFields: {
          match: {
            ourGameWithBall: "Attack wide channels",
            counters: "Counter-press immediately",
          },
        },
        homeSquadId: "squad-home",
        awaySquadId: "squad-away",
        squadOverrides: {},
        playerLabel: {
          showName: false,
          showPosition: true,
          showNumber: false,
        },
        playerHighlights: [],
        playerLinks: [],
        layers: [],
        frames: [
          {
            id: "frame-dyn-1",
            name: "Start",
            objects: [],
            action: "",
            notes: "",
            durationMs: 0,
            playerHighlights: [],
            playerLinks: [],
          },
          {
            id: "frame-dyn-2",
            name: "Finish",
            objects: [],
            action: "Shot",
            notes: "Final action",
            durationMs: 1200,
            playerHighlights: [],
            playerLinks: [],
          },
        ],
        activeFrameIndex: 1,
      },
    ],
    activeBoardId: "board-dynamic",
  });

  it("roundtrips a project", () => {
    const project = createSampleProject();
    const raw = serializeProject(project);
    const parsed = deserializeProject(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.project.id).toBe(project.id);
      expect(parsed.project.schemaVersion).toBe(SCHEMA_VERSION);
    }
  });

  it("roundtrips a complex project with advanced board fields", () => {
    const project = createComplexProject();
    const raw = serializeProject(project);
    const parsed = deserializeProject(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    expect(parsed.project).toEqual(project);
    expect(parsed.project.sessionNotesFields?.training?.equipment).toEqual([
      "Cones",
      "Bibs",
      "Balls",
    ]);
    expect(parsed.project.boards[0]?.squadOverrides?.["squad-home"]?.hiddenPlayerIds).toEqual([
      "player-home-2",
    ]);
    expect(parsed.project.boards[0]?.squadOverrides?.["squad-home"]?.numberOverrides).toEqual({
      "player-home-1": 99,
    });
    expect(parsed.project.boards[0]?.frames[0]?.playerLinks?.[0]?.playerIds).toEqual([
      "player-token-1",
      "player-token-2",
      "player-token-1",
    ]);
    expect(parsed.project.boards[0]?.frames[0]?.objects.some((item) => item.type === "path")).toBe(true);
    expect(parsed.project.boards[0]?.frames[0]?.objects.some((item) => item.type === "pole")).toBe(true);
    expect(parsed.project.boards[0]?.frames[0]?.objects.some((item) => item.type === "mannequin")).toBe(true);
  });

  it("rejects schema mismatches", () => {
    const project = createSampleProject();
    const raw = serializeProject({ ...project, schemaVersion: 999 });
    const parsed = deserializeProject(raw);
    expect(parsed.ok).toBe(false);
  });

  it("rejects projects with invalid nested board structure", () => {
    const project = createComplexProject() as unknown as {
      boards: Array<Record<string, unknown>>;
    };
    project.boards[0] = {
      ...project.boards[0],
      frames: [
        {
          id: "broken-frame",
          name: "Broken",
          objects: [
            {
              id: "broken-player",
              type: "player",
              position: { x: 10, y: 20 },
              rotation: 0,
              scale: { x: 1, y: 1 },
              style: {
                stroke: "#000",
                fill: "#fff",
                strokeWidth: 1,
                dash: [],
                opacity: 1,
              },
              zIndex: 1,
              locked: false,
              visible: true,
              showName: true,
              showPosition: true,
              showNumber: true,
              // tokenSize intentionally missing
            },
          ],
        },
      ],
    };

    const parsed = deserializeProject(JSON.stringify(project));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toBe("Invalid project structure.");
    }
  });

  it("rejects projects with invalid squad data", () => {
    const project = createComplexProject() as unknown as {
      squads: Array<Record<string, unknown>>;
    };
    project.squads[0] = {
      ...project.squads[0],
      players: [
        {
          id: "broken-player",
          name: "Broken Player",
          // positionLabel intentionally missing
        },
      ],
    };

    const parsed = deserializeProject(JSON.stringify(project));
    expect(parsed.ok).toBe(false);
  });
});
