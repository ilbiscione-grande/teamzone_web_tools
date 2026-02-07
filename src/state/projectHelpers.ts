import type {
  Board,
  BoardFrame,
  DrawableObject,
  PitchOverlay,
  PitchView,
  Project,
  ProjectMode,
  ProjectSummary,
  Squad,
  SharedBoardSnapshot,
  PitchShape,
} from "@/models";
import { defaultStyle } from "@/board/objects/objectFactory";
import { createPlayer } from "@/board/objects/objectFactory";
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

const POSITION_CYCLE = [
  "GK",
  "RB",
  "RCB",
  "LCB",
  "LB",
  "RWB",
  "LWB",
  "CDM",
  "CM",
  "CAM",
  "RM",
  "LM",
  "RW",
  "LW",
  "CF",
  "ST",
  "SS",
  "AM",
];

export const FORMATION_PRESETS: Record<string, number[]> = {
  "4-3-3": [4, 3, 3],
  "4-4-2": [4, 4, 2],
  "3-5-2": [3, 5, 2],
  "4-2-3-1": [4, 2, 3, 1],
  "3-4-3": [3, 4, 3],
  "4-1-4-1": [4, 1, 4, 1],
  "4-5-1": [4, 5, 1],
  "4-3-1-2": [4, 3, 1, 2],
  "4-1-2-1-2": [4, 1, 2, 1, 2],
  "3-4-1-2": [3, 4, 1, 2],
  "3-4-2-1": [3, 4, 2, 1],
  "3-5-1-1": [3, 5, 1, 1],
  "5-3-2": [5, 3, 2],
  "5-2-3": [5, 2, 3],
  "5-4-1": [5, 4, 1],
};

const PITCH_LENGTH = 105;
const PITCH_WIDTH = 68;

const getLineYs = (count: number) => {
  const margin = 8;
  if (count <= 1) {
    return [PITCH_WIDTH / 2];
  }
  const spacing = (PITCH_WIDTH - margin * 2) / (count - 1);
  return Array.from({ length: count }, (_, index) => margin + spacing * index);
};

const getLineXs = (lineCount: number) => {
  if (lineCount <= 1) {
    return [PITCH_LENGTH * 0.5];
  }
  const minX = 22;
  const maxX = 88;
  const spacing = (maxX - minX) / (lineCount - 1);
  return Array.from({ length: lineCount }, (_, index) => minX + spacing * index);
};

const getFormationPositions = (formation: number[], side: "home" | "away") => {
  const positions: { x: number; y: number }[] = [];
  const gkX = side === "home" ? 8 : PITCH_LENGTH - 8;
  positions.push({ x: gkX, y: PITCH_WIDTH / 2 });
  const lineXs = getLineXs(formation.length).map((x) =>
    side === "home" ? x : PITCH_LENGTH - x
  );
  formation.forEach((count, index) => {
    const ys = getLineYs(count);
    ys.forEach((y) => positions.push({ x: lineXs[index]!, y }));
  });
  return positions;
};

const createPlayers = (
  count: number,
  options?: { vestColors?: Array<string | undefined> }
) =>
  Array.from({ length: count }).map((_, index) => ({
    id: createId(),
    name: `Player ${index + 1}`,
    positionLabel: POSITION_CYCLE[index % POSITION_CYCLE.length] ?? "",
    number: index + 1,
    vestColor: options?.vestColors?.[index],
  }));

export const getDefaultBoardSettings = (mode: ProjectMode) => {
  if (mode === "training") {
    return {
      mode,
      attachBallToPlayer: true,
      pitchView: "GREEN_EMPTY" as PitchView,
      pitchOverlay: "NONE" as PitchOverlay,
      pitchShape: "square" as PitchShape,
      playerLabel: {
        showName: false,
        showPosition: false,
        showNumber: true,
      },
      homeCount: 25,
      awayCount: 25,
      vestColors: [
        ...Array.from({ length: 5 }, () => "#f9bf4a"),
        ...Array.from({ length: 5 }, () => "#2f6cf6"),
      ],
    };
  }
  if (mode === "education") {
    return {
      mode,
      attachBallToPlayer: true,
      pitchView: "FULL" as PitchView,
      pitchOverlay: "NONE" as PitchOverlay,
      pitchShape: "none" as PitchShape,
      playerLabel: {
        showName: false,
        showPosition: true,
        showNumber: false,
      },
      homeCount: 18,
      awayCount: 18,
      vestColors: [],
    };
  }
  return {
    mode,
    attachBallToPlayer: true,
    pitchView: "FULL" as PitchView,
    pitchOverlay: "NONE" as PitchOverlay,
    pitchShape: "none" as PitchShape,
    playerLabel: {
      showName: true,
      showPosition: true,
      showNumber: false,
    },
    homeCount: 18,
    awayCount: 18,
    vestColors: [],
  };
};

const createPitchShapeObjects = (
  shape: PitchShape,
  pitchView: PitchView
): DrawableObject[] => {
  if (shape === "none") {
    return [];
  }
  const centerX = 52.5;
  const centerY = 34;
  if (shape === "circle") {
    return [
      {
        id: createId(),
        type: "circle",
        position: { x: centerX, y: centerY },
        rotation: 0,
        scale: { x: 1, y: 1 },
        style: { ...defaultStyle },
        zIndex: 0,
        locked: false,
        visible: true,
        radius: 15,
      },
    ];
  }
  if (shape === "square") {
    const size = 30;
    return [
      {
        id: createId(),
        type: "rect",
        position: { x: centerX - size / 2, y: centerY - size / 2 },
        rotation: 0,
        scale: { x: 1, y: 1 },
        style: { ...defaultStyle },
        zIndex: 0,
        locked: false,
        visible: true,
        width: size,
        height: size,
        cornerRadius: 0.8,
      },
    ];
  }
  const width = 40;
  const height = 24;
  return [
    {
      id: createId(),
      type: "rect",
      position: { x: centerX - width / 2, y: centerY - height / 2 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      style: { ...defaultStyle },
      zIndex: 0,
      locked: false,
      visible: true,
      width,
      height,
      cornerRadius: 0.8,
    },
  ];
};

export const createEmptyBoard = (
  name: string,
  squadIds?: { homeSquadId?: string; awaySquadId?: string },
  overrides?: {
    pitchView?: PitchView;
    pitchOverlay?: PitchOverlay;
    pitchShape?: PitchShape;
    playerLabel?: Board["playerLabel"];
    pitchRotation?: Board["pitchRotation"];
  }
): Board => ({
  id: createId(),
  name,
  mode: "STATIC",
  pitchView: overrides?.pitchView ?? "FULL",
  pitchRotation: overrides?.pitchRotation ?? 0,
  pitchOverlay: overrides?.pitchOverlay ?? "NONE",
  pitchOverlayText: false,
  watermarkEnabled: true,
  notes: "",
  notesTemplate: undefined,
  notesFields: {},
  homeSquadId: squadIds?.homeSquadId,
  awaySquadId: squadIds?.awaySquadId,
  playerLabel:
    overrides?.playerLabel ?? {
      showName: true,
      showPosition: false,
      showNumber: false,
    },
  playerHighlights: [],
  playerLinks: [],
  layers: createPitchShapeObjects(
    overrides?.pitchShape ?? "none",
    overrides?.pitchView ?? "FULL"
  ),
  frames: [
    {
      id: createId(),
      name: "Frame 1",
      objects: createPitchShapeObjects(
        overrides?.pitchShape ?? "none",
        overrides?.pitchView ?? "FULL"
      ),
      action: "",
      notes: "",
      durationMs: 0,
      playerHighlights: [],
      playerLinks: [],
    },
  ],
  activeFrameIndex: 0,
});

export type CreateBoardTemplate = {
  id: string;
  name: string;
  pitchView?: PitchView;
  pitchOverlay?: PitchOverlay;
  pitchShape?: PitchShape;
  pitchRotation?: Board["pitchRotation"];
};

export const createDefaultProject = (
  name: string,
  options?: {
    homeKit?: Squad["kit"];
    awayKit?: Squad["kit"];
    attachBallToPlayer?: boolean;
    mode?: ProjectMode;
    pitchView?: PitchView;
    pitchOverlay?: PitchOverlay;
    pitchShape?: PitchShape;
    playerLabel?: Board["playerLabel"];
    boardTemplates?: CreateBoardTemplate[];
    homeSquadPreset?: Squad;
    awaySquadPreset?: Squad;
    startingFormation?: string;
  }
): Project => {
  const mode = options?.mode ?? "match";
  const defaults = getDefaultBoardSettings(mode);
  const homeKit = options?.homeKit ?? defaultHomeKit();
  const awayKit = options?.awayKit ?? defaultAwayKit();
  const clonePresetSquad = (
    preset: Squad | undefined,
    fallbackName: string,
    fallbackKit: Squad["kit"],
    count: number,
    vestColors: Array<string | undefined>
  ) => {
    if (!preset) {
      return createTeamSquad(fallbackName, {
        kit: { ...fallbackKit },
        players: createPlayers(count, { vestColors }),
      });
    }
    return createTeamSquad(preset.name || fallbackName, {
      name: preset.name || fallbackName,
      clubLogo: preset.clubLogo,
      kit: { ...preset.kit },
      players: preset.players.map((player) => ({
        ...player,
        id: createId(),
      })),
    });
  };
  const vestColors =
    defaults.vestColors.length > 0
      ? [
          ...defaults.vestColors,
          ...Array.from(
            { length: Math.max(0, defaults.homeCount - defaults.vestColors.length) },
            () => undefined
          ),
        ]
      : [];
  const homeSquad = clonePresetSquad(
    options?.homeSquadPreset,
    "Home",
    homeKit,
    defaults.homeCount,
    vestColors
  );
  const awaySquad = clonePresetSquad(
    options?.awaySquadPreset,
    "Away",
    awayKit,
    defaults.awayCount,
    vestColors
  );
  const baseOverrides = {
    pitchView: options?.pitchView ?? defaults.pitchView,
    pitchOverlay: options?.pitchOverlay ?? defaults.pitchOverlay,
    pitchShape: options?.pitchShape ?? defaults.pitchShape,
    playerLabel: options?.playerLabel ?? defaults.playerLabel,
    pitchRotation: options?.pitchRotation ?? 0,
  };
  const templates =
    options?.boardTemplates && options.boardTemplates.length > 0
      ? options.boardTemplates
      : [{ id: "board-1", name: "Board 1" }];
  const boards = templates.map((template) =>
    createEmptyBoard(
      template.name,
      {
        homeSquadId: homeSquad.id,
        awaySquadId: awaySquad.id,
      },
      {
        pitchView: template.pitchView ?? baseOverrides.pitchView,
        pitchRotation: template.pitchRotation ?? baseOverrides.pitchRotation,
        pitchOverlay: template.pitchOverlay ?? baseOverrides.pitchOverlay,
        pitchShape: template.pitchShape ?? baseOverrides.pitchShape,
        playerLabel: baseOverrides.playerLabel,
      }
    )
  );
  if (options?.startingFormation && FORMATION_PRESETS[options.startingFormation]) {
    const formation = FORMATION_PRESETS[options.startingFormation];
    const targetBoard = boards[0];
    if (targetBoard) {
      const baseObjects = targetBoard.frames[0]?.objects ?? [];
      const nextObjects = [...baseObjects];
      const addFormation = (squad: Squad, side: "home" | "away") => {
        const positions = getFormationPositions(formation, side);
        positions.forEach((position, index) => {
          const player = squad.players[index];
          if (!player) {
            return;
          }
          const token = createPlayer(position, 1.5, squad.kit.shirt);
          token.squadPlayerId = player.id;
          token.showName = targetBoard.playerLabel.showName;
          token.showPosition = targetBoard.playerLabel.showPosition;
          token.showNumber = targetBoard.playerLabel.showNumber;
          token.vestColor = player.vestColor;
          nextObjects.push(token);
        });
      };
      addFormation(homeSquad, "home");
      if (mode !== "training") {
        addFormation(awaySquad, "away");
      }
      targetBoard.frames[0].objects = nextObjects;
      targetBoard.layers = nextObjects;
    }
  }
  return {
    id: createId(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    settings: {
      mode,
      homeKit: { ...homeKit },
      awayKit: { ...awayKit },
      attachBallToPlayer:
        options?.attachBallToPlayer ?? defaults.attachBallToPlayer,
      defaultPitchView: options?.pitchView ?? defaults.pitchView,
      defaultPitchOverlay: options?.pitchOverlay ?? defaults.pitchOverlay,
      defaultPitchShape: options?.pitchShape ?? defaults.pitchShape,
      defaultPlayerLabel: options?.playerLabel ?? defaults.playerLabel,
    },
    boards,
    squads: [homeSquad, awaySquad],
    activeBoardId: boards[0]?.id,
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
    if (
      board.pitchRotation == null &&
      project.settings?.mode === "match" &&
      ["Team Setup", "Build-up", "Offensive Setup"].includes(board.name)
    ) {
      board.pitchRotation = 180;
    }
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
        mode: "match",
        homeKit: defaultHomeKit(),
        awayKit: defaultAwayKit(),
        attachBallToPlayer: false,
        defaultPitchView: "FULL",
        defaultPitchOverlay: "NONE",
        defaultPitchShape: "none",
        defaultPlayerLabel: {
          showName: true,
          showPosition: false,
          showNumber: false,
        },
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

export const createSharedProject = (
  snapshot: SharedBoardSnapshot,
  meta: {
    shareId: string;
    ownerEmail: string;
    permission: "view" | "comment";
    projectName: string;
    boardId: string;
  }
): Project => {
  const now = new Date().toISOString();
  const settings = snapshot.settings ?? {
    mode: "match",
    homeKit: defaultHomeKit(),
    awayKit: defaultAwayKit(),
    attachBallToPlayer: false,
    defaultPitchView: "FULL",
    defaultPitchOverlay: "NONE",
    defaultPitchShape: "none",
    defaultPlayerLabel: {
      showName: true,
      showPosition: false,
      showNumber: false,
    },
  };
  const project: Project = {
    id: `shared-${meta.shareId}`,
    name: meta.projectName,
    createdAt: now,
    updatedAt: now,
    schemaVersion: snapshot.schemaVersion ?? SCHEMA_VERSION,
    isShared: true,
    sharedMeta: meta,
    settings,
    boards: [snapshot.board],
    squads: snapshot.squads ?? [],
    activeBoardId: snapshot.board.id,
  };
  return ensureBoardSquads(project);
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
