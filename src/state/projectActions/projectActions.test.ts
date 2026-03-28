import { describe, expect, it } from "vitest";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createBoardActions } from "./boardActions";
import { createObjectActions } from "./objectActions";
import { createSquadActions } from "./squadActions";
import type { ProjectStore } from "./types";
import { createDefaultProject } from "@/state/projectHelpers";
import type { DrawableObject, SquadPlayer } from "@/models";

const createTestStore = () =>
  create<ProjectStore>()(
    immer((set, get, store) => ({
      index: [],
      activeProjectId: null,
      project: null,
      plan: "PAID",
      authUser: null,
      syncStatus: {
        state: "idle",
        updatedAt: "2026-03-11T00:00:00.000Z",
      },
      hydrateIndex: () => undefined,
      setPlan: () => undefined,
      setPlanFromProfile: () => undefined,
      setAuthUser: () => undefined,
      clearAuthUser: () => undefined,
      setSyncStatus: () => undefined,
      syncNow: () => undefined,
      createProject: () => undefined,
      openProject: () => undefined,
      openProjectFromData: () => undefined,
      openProjectReadOnly: () => undefined,
      openSharedBoard: () => undefined,
      closeProject: async () => undefined,
      deleteProject: () => undefined,
      loadSample: () => undefined,
      updateProjectMeta: () => undefined,
      ...createBoardActions(set, get, store),
      ...createObjectActions(set, get, store),
      ...createSquadActions(set, get, store),
    }))
  );

const createPlayerObject = (
  id: string,
  squadPlayerId?: string,
  teamMemberId?: string
): DrawableObject => ({
  id,
  type: "player",
  position: { x: 10, y: 20 },
  rotation: 0,
  scale: { x: 1, y: 1 },
  style: {
    stroke: "#111111",
    fill: "#ffffff",
    strokeWidth: 0.4,
    dash: [],
    opacity: 1,
  },
  zIndex: 1,
  locked: false,
  visible: true,
  squadPlayerId,
  teamMemberId,
  showName: true,
  showPosition: true,
  showNumber: false,
  tokenSize: 1.5,
});

describe("project actions", () => {
  it("adds a board and updates active board and updatedAt", () => {
    const useStore = createTestStore();
    const project = createDefaultProject("Test Project");
    useStore.setState({
      project,
      activeProjectId: project.id,
    });
    const beforeUpdatedAt = useStore.getState().project?.updatedAt;

    useStore.getState().addBoard("Second Board");

    const nextProject = useStore.getState().project;
    expect(nextProject?.boards).toHaveLength(2);
    expect(nextProject?.boards[1]?.name).toBe("Second Board");
    expect(nextProject?.activeBoardId).toBe(nextProject?.boards[1]?.id);
    expect(nextProject?.updatedAt).not.toBe(beforeUpdatedAt);
  });

  it("adds and duplicates frames while keeping frame ids unique", () => {
    const useStore = createTestStore();
    const project = createDefaultProject("Test Project");
    useStore.setState({
      project,
      activeProjectId: project.id,
    });
    const boardId = project.boards[0]!.id;
    const firstFrameId = project.boards[0]!.frames[0]!.id;

    useStore.getState().addFrame(boardId, "Moment");
    useStore.getState().duplicateFrame(boardId, firstFrameId);

    const board = useStore.getState().project?.boards[0];
    const frameIds = new Set(board?.frames.map((frame) => frame.id));
    expect(board?.frames).toHaveLength(3);
    expect(frameIds.size).toBe(3);
  });

  it("keeps static board layers in sync with frame objects", () => {
    const useStore = createTestStore();
    const project = createDefaultProject("Static Project");
    const board = project.boards[0]!;
    const object = createPlayerObject("player-1");
    useStore.setState({
      project,
      activeProjectId: project.id,
    });

    useStore.getState().setFrameObjects(board.id, 0, [object]);

    const nextBoard = useStore.getState().project?.boards[0];
    expect(nextBoard?.frames[0]?.objects).toEqual([object]);
    expect(nextBoard?.layers).toEqual([object]);
  });

  it("propagates squadPlayerId updates across frames for the same player object", () => {
    const useStore = createTestStore();
    const project = createDefaultProject("Dynamic Project");
    const squad = project.squads[0]!;
    squad.players = [
      {
        id: "squad-player-1",
        name: "Player One",
        positionLabel: "RB",
      },
      {
        id: "squad-player-2",
        name: "Player Two",
        positionLabel: "CM",
      },
    ];
    const board = project.boards[0]!;
    board.mode = "DYNAMIC";
    board.frames = [
      {
        ...board.frames[0]!,
        id: "frame-1",
        objects: [createPlayerObject("shared-player", "squad-player-1")],
      },
      {
        ...board.frames[0]!,
        id: "frame-2",
        objects: [createPlayerObject("shared-player", "squad-player-1")],
      },
    ];
    useStore.setState({
      project,
      activeProjectId: project.id,
    });

    useStore
      .getState()
      .updateObject(board.id, 0, "shared-player", {
        squadPlayerId: "squad-player-2",
      } as Partial<DrawableObject>);

    const frames = useStore.getState().project?.boards[0]?.frames ?? [];
    expect(
      frames.every(
        (frame) =>
          frame.objects[0] &&
          frame.objects[0].type === "player" &&
          frame.objects[0].squadPlayerId === "squad-player-2"
      )
    ).toBe(true);
    expect(
      frames[0]?.objects[0]?.type === "player"
        ? frames[0].objects[0].boardPositionLabel
        : undefined
    ).toBe("CM");
  });

  it("moves a squad player link from another board token when reassigned", () => {
    const useStore = createTestStore();
    const project = createDefaultProject("Linked Players");
    const squad = project.squads[0]!;
    squad.players = [
      {
        id: "squad-player-1",
        name: "Player One",
        positionLabel: "RB",
      },
      {
        id: "squad-player-2",
        name: "Player Two",
        positionLabel: "CM",
      },
    ];
    const board = project.boards[0]!;
    board.mode = "STATIC";
    board.frames[0]!.objects = [
      createPlayerObject("player-a", "squad-player-1"),
      createPlayerObject("player-b", "squad-player-2"),
    ];
    useStore.setState({
      project,
      activeProjectId: project.id,
    });

    useStore
      .getState()
      .updateObject(board.id, 0, "player-b", {
        squadPlayerId: "squad-player-1",
      } as Partial<DrawableObject>);

    const objects = useStore.getState().project?.boards[0]?.frames[0]?.objects ?? [];
    expect(
      objects.find((item) => item.id === "player-b" && item.type === "player")
    ).toMatchObject({
      squadPlayerId: "squad-player-1",
      boardPositionLabel: "RB",
    });
    expect(
      objects.find((item) => item.id === "player-a" && item.type === "player")
    ).toMatchObject({
      squadPlayerId: undefined,
    });
  });

  it("propagates teamMemberId with squad player links across frames", () => {
    const useStore = createTestStore();
    const project = createDefaultProject("Dynamic Project");
    const squad = project.squads[0]!;
    squad.players = [
      {
        id: "squad-player-1",
        teamMemberId: "team-member-1",
        name: "Player One",
        positionLabel: "RB",
      },
      {
        id: "squad-player-2",
        teamMemberId: "team-member-2",
        name: "Player Two",
        positionLabel: "CM",
      },
    ];
    const board = project.boards[0]!;
    board.mode = "DYNAMIC";
    board.frames = [
      {
        ...board.frames[0]!,
        id: "frame-1",
        objects: [
          createPlayerObject("shared-player", "squad-player-1", "team-member-1"),
        ],
      },
      {
        ...board.frames[0]!,
        id: "frame-2",
        objects: [
          createPlayerObject("shared-player", "squad-player-1", "team-member-1"),
        ],
      },
    ];
    useStore.setState({
      project,
      activeProjectId: project.id,
    });

    useStore.getState().updateObject(board.id, 0, "shared-player", {
      squadPlayerId: "squad-player-2",
      teamMemberId: "team-member-2",
    } as Partial<DrawableObject>);

    const frames = useStore.getState().project?.boards[0]?.frames ?? [];
    expect(
      frames.every(
        (frame) =>
          frame.objects[0] &&
          frame.objects[0].type === "player" &&
          frame.objects[0].squadPlayerId === "squad-player-2" &&
          frame.objects[0].teamMemberId === "team-member-2"
      )
    ).toBe(true);
  });

  it("adds, updates and removes squad players while updating project timestamp", () => {
    const useStore = createTestStore();
    const project = createDefaultProject("Squad Project");
    project.updatedAt = "2026-03-01T00:00:00.000Z";
    useStore.setState({
      project,
      activeProjectId: project.id,
    });
    const squadId = project.squads[0]!.id;
    const player: SquadPlayer = {
      id: "new-player",
      name: "New Player",
      positionLabel: "AM",
      number: 14,
    };
    const beforeUpdatedAt = useStore.getState().project?.updatedAt;

    useStore.getState().addSquadPlayer(squadId, player);
    useStore
      .getState()
      .updateSquadPlayer(squadId, player.id, { positionLabel: "LW" });
    useStore.getState().removeSquadPlayer(squadId, player.id);

    const squad = useStore.getState().project?.squads.find((item) => item.id === squadId);
    expect(squad?.players.find((entry) => entry.id === player.id)).toBeUndefined();
    expect(useStore.getState().project?.updatedAt).not.toBe(beforeUpdatedAt);
  });

  it("preserves teamMemberId when creating squads from presets", () => {
    const project = createDefaultProject("Preset Project", {
      homeTeamId: "team-home",
      awayTeamId: "team-away",
      homeSquadPreset: {
        id: "preset-home",
        name: "Preset Home",
        kit: {
          shirt: "#111111",
          shorts: "#222222",
          socks: "#333333",
        },
        players: [
          {
            id: "preset-player-1",
            teamMemberId: "team-member-1",
            name: "Preset Player",
            positionLabel: "GK",
            number: 1,
          },
        ],
      },
    });

    expect(project.squads[0]?.players[0]).toMatchObject({
      name: "Preset Player",
      teamMemberId: "team-member-1",
    });
    expect(project.teamContext).toEqual({
      homeTeamId: "team-home",
      awayTeamId: "team-away",
    });
    expect(project.squads[0]?.players[0]?.id).not.toBe("preset-player-1");
  });
});
