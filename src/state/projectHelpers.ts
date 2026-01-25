import type { Board, BoardFrame, Project, ProjectSummary, Squad } from "@/models";
import { SCHEMA_VERSION } from "@/models";
import { createId } from "@/utils/id";

export const defaultHomeKit = () => ({
  shirt: "#e24a3b",
  shorts: "#0f1b1a",
  socks: "#f06d4f",
  vest: "",
});

export const defaultAwayKit = () => ({
  shirt: "#2f6cf6",
  shorts: "#0f1b1a",
  socks: "#f2f1e9",
  vest: "",
});

const createTeamSquad = (name: string, overrides?: Partial<Squad>): Squad => ({
  id: createId(),
  name,
  clubLogo: undefined,
  kit: defaultHomeKit(),
  players: [],
  ...overrides,
});

export const createEmptyBoard = (
  name: string,
  squadIds?: { homeSquadId?: string; awaySquadId?: string }
): Board => ({
  id: createId(),
  name,
  mode: "STATIC",
  pitchView: "FULL",
  pitchOverlay: "NONE",
  pitchOverlayText: false,
  watermarkEnabled: true,
  notes: "",
  notesTemplate: undefined,
  notesFields: {},
  homeSquadId: squadIds?.homeSquadId,
  awaySquadId: squadIds?.awaySquadId,
  playerLabel: {
    showName: true,
    showPosition: false,
    showNumber: false,
  },
  playerHighlights: [],
  playerLinks: [],
  layers: [],
  frames: [
    {
      id: createId(),
      name: "Frame 1",
      objects: [],
      action: "",
      notes: "",
    },
  ],
  activeFrameIndex: 0,
});

export const createDefaultProject = (
  name: string,
  options?: {
    homeKit?: Squad["kit"];
    awayKit?: Squad["kit"];
    attachBallToPlayer?: boolean;
  }
): Project => {
  const homeKit = options?.homeKit ?? defaultHomeKit();
  const awayKit = options?.awayKit ?? defaultAwayKit();
  const homeSquad = createTeamSquad("Home", { kit: { ...homeKit } });
  const awaySquad = createTeamSquad("Away", { kit: { ...awayKit } });
  const board = createEmptyBoard("Board 1", {
    homeSquadId: homeSquad.id,
    awaySquadId: awaySquad.id,
  });
  return {
    id: createId(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    settings: {
      homeKit: { ...homeKit },
      awayKit: { ...awayKit },
      attachBallToPlayer: options?.attachBallToPlayer ?? false,
    },
    boards: [board],
    squads: [homeSquad, awaySquad],
    activeBoardId: board.id,
  };
};

export const ensureBoardSquads = (project: Project): Project => {
  const squads = project.squads ?? [];
  const getSquad = (id?: string) =>
    id ? squads.find((item) => item.id === id) : undefined;
  const createSquad = (name: string, kit?: Squad["kit"]) => {
    const squad = createTeamSquad(name, kit ? { kit } : undefined);
    squads.push(squad);
    return squad;
  };

  project.boards.forEach((board, index) => {
    let home = getSquad(board.homeSquadId);
    let away = getSquad(board.awaySquadId);

    if (!home && squads[0]) {
      home = squads[0];
    }
    if (!away && squads[1]) {
      away = squads[1];
    }

    if (!home) {
      home = createSquad(`Home ${index + 1}`);
    }
    if (!away || away.id === home.id) {
      away = createSquad(`Away ${index + 1}`, defaultAwayKit());
    }

    board.homeSquadId = home.id;
    board.awaySquadId = away.id;

    if (!project.settings) {
      project.settings = {
        homeKit: defaultHomeKit(),
        awayKit: defaultAwayKit(),
        attachBallToPlayer: false,
      };
    }
    if (home.kit.shirt === "#f9bf4a") {
      home.kit.shirt = project.settings.homeKit.shirt;
    }
    if (away.kit.shirt === "#f9bf4a" || away.kit.shirt === "#4aa8f9") {
      away.kit.shirt = project.settings.awayKit.shirt;
    }
  });

  project.squads = squads;
  return project;
};

export const updateIndex = (
  index: ProjectSummary[],
  project: Project
): ProjectSummary[] => {
  const entry: ProjectSummary = {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
  };
  const next = index.filter((item) => item.id !== project.id);
  return [entry, ...next].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
};

export const cloneFrame = (frame: BoardFrame): BoardFrame => ({
  ...frame,
  id: createId(),
  name: `${frame.name} Copy`,
  objects: JSON.parse(JSON.stringify(frame.objects)),
});
