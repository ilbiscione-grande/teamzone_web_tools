import type { Board, PitchOverlay, PitchView } from "./board";
import type { Squad } from "./squad";

export type ProjectMode = "training" | "match" | "education";
export type PitchShape = "none" | "circle" | "square" | "rect";

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
  isSample?: boolean;
  isShared?: boolean;
  sharedMeta?: {
    shareId: string;
    ownerEmail: string;
    permission: "view" | "comment";
    projectName: string;
    boardId: string;
  };
  settings: {
    mode: ProjectMode;
    homeKit: {
      shirt: string;
      shorts: string;
      socks: string;
      vest?: string;
    };
    awayKit: {
      shirt: string;
      shorts: string;
      socks: string;
      vest?: string;
    };
    attachBallToPlayer: boolean;
    defaultPitchView: PitchView;
    defaultPitchOverlay: PitchOverlay;
    defaultPitchShape: PitchShape;
    defaultPlayerLabel: {
      showName: boolean;
      showPosition: boolean;
      showNumber: boolean;
    };
  };
  sessionNotes: string;
  sessionNotesFields?: Board["notesFields"];
  boards: Board[];
  squads: Squad[];
  activeBoardId?: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  updatedAt: string;
};
