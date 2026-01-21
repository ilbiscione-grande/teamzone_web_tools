import type { Board, BoardFrame, Project, Squad } from "@/models";
import { SCHEMA_VERSION } from "@/models";
import { createId } from "@/utils/id";

const createSampleSquad = (name: string, kit: Squad["kit"]): Squad => ({
  id: createId(),
  name,
  clubLogo: undefined,
  kit,
  players: [
    { id: createId(), name: "A. Berg", positionLabel: "GK", number: 1 },
    { id: createId(), name: "L. Holm", positionLabel: "LB", number: 3 },
    { id: createId(), name: "S. Lind", positionLabel: "CB", number: 4 },
    { id: createId(), name: "E. Nygaard", positionLabel: "CB", number: 5 },
    { id: createId(), name: "J. Karl", positionLabel: "RB", number: 2 },
    { id: createId(), name: "M. Olsen", positionLabel: "DM", number: 6 },
    { id: createId(), name: "K. Dahl", positionLabel: "CM", number: 8 },
    { id: createId(), name: "T. Storm", positionLabel: "AM", number: 10 },
    { id: createId(), name: "P. Jorg", positionLabel: "LW", number: 11 },
    { id: createId(), name: "I. Ahl", positionLabel: "RW", number: 7 },
    { id: createId(), name: "O. Soren", positionLabel: "ST", number: 9 },
  ],
});

const createFrame = (
  name: string,
  objects: BoardFrame["objects"] = []
): BoardFrame => ({
  id: createId(),
  name,
  objects,
});

const createBoard = (
  name: string,
  objects: BoardFrame["objects"] = [],
  squadIds?: { homeSquadId?: string; awaySquadId?: string }
): Board => ({
  id: createId(),
  name,
  mode: "STATIC",
  pitchView: "FULL",
  pitchOverlay: "NONE",
  pitchOverlayText: false,
  notes: "Tryck pa en spelare for att redigera dess etikett.",
  notesTemplate: undefined,
  notesFields: {},
  homeSquadId: squadIds?.homeSquadId,
  awaySquadId: squadIds?.awaySquadId,
  playerLabel: {
    showName: true,
    showPosition: true,
    showNumber: false,
  },
  playerHighlights: [],
  playerLinks: [],
  layers: objects,
  frames: [createFrame("Frame 1", objects)],
  activeFrameIndex: 0,
});

export const createSampleProject = (): Project => {
  const homeSquad = createSampleSquad("Nordic FC", {
    shirt: "#e24a3b",
    shorts: "#0f1b1a",
    socks: "#f06d4f",
  });
  const awaySquad = createSampleSquad("City United", {
    shirt: "#2f6cf6",
    shorts: "#0f1b1a",
    socks: "#f2f1e9",
  });
  const board = createBoard(
    "Pressing Setup",
    [
    {
      id: createId(),
      type: "player",
      position: { x: 20, y: 34 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      style: {
        stroke: "#111111",
        fill: "#f9bf4a",
        strokeWidth: 0.4,
        dash: [],
        opacity: 1,
      },
      zIndex: 1,
      locked: false,
      visible: true,
      squadPlayerId: homeSquad.players[0].id,
      hasBall: true,
      showName: true,
      showPosition: true,
      showNumber: false,
      tokenSize: 2.4,
    },
    {
      id: createId(),
      type: "ball",
      position: { x: 24, y: 30 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      style: {
        stroke: "#111111",
        fill: "#ffffff",
        strokeWidth: 0.4,
        dash: [],
        opacity: 1,
      },
      zIndex: 2,
      locked: false,
      visible: true,
    },
    {
      id: createId(),
      type: "arrow",
      position: { x: 30, y: 34 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      style: {
        stroke: "#ffffff",
        fill: "rgba(255,255,255,0.1)",
        strokeWidth: 0.6,
        dash: [],
        opacity: 1,
      },
      zIndex: 1,
      locked: false,
      visible: true,
      points: [0, 0, 12, -8],
      head: true,
      dashed: false,
    },
    ],
    { homeSquadId: homeSquad.id, awaySquadId: awaySquad.id }
  );
  return {
    id: createId(),
    name: "Demo: High Press",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    settings: {
      homeKit: { ...homeSquad.kit },
      awayKit: { ...awaySquad.kit },
      attachBallToPlayer: false,
    },
    boards: [board],
    squads: [homeSquad, awaySquad],
    activeBoardId: board.id,
  };
};
