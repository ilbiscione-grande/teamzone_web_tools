import type { DrawableObject } from "./drawables";

export type BoardMode = "STATIC" | "DYNAMIC";
export type PitchView = "FULL" | "DEF_HALF" | "OFF_HALF" | "GREEN_EMPTY";
export type PitchOverlay = "NONE" | "CORRIDORS" | "THIRDS" | "ZONES_18";

export type BoardFrame = {
  id: string;
  name: string;
  objects: DrawableObject[];
  action?: string;
  notes?: string;
  durationMs?: number;
};

export type PlayerLink = {
  id: string;
  playerIds: string[];
};

export type Board = {
  id: string;
  name: string;
  mode: BoardMode;
  pitchView: PitchView;
  pitchOverlay: PitchOverlay;
  pitchOverlayText: boolean;
  watermarkEnabled?: boolean;
  watermarkText?: string;
  notes: string;
  notesTemplate?: "TRAINING" | "MATCH" | "EDUCATION";
  notesFields?: {
    training?: {
      mainFocus?: string;
      partGoals?: string;
      organisation?: string;
      keyBehaviours?: string;
      usualErrors?: string;
      coachInstructions?: string;
    };
    match?: {
      opposition?: string;
      ourGameWithBall?: string;
      ourGameWithoutBall?: string;
      counters?: string;
      keyRoles?: string;
      importantReminders?: string;
      matchMessage?: string;
    };
    education?: {
      tema?: string;
      grundprincip?: string;
      whatToSee?: string;
      whatToDo?: string;
      usualErrors?: string;
      matchConnection?: string;
      reflections?: string;
    };
  };
  homeSquadId?: string;
  awaySquadId?: string;
  playerLabel: {
    showName: boolean;
    showPosition: boolean;
    showNumber: boolean;
  };
  playerHighlights: string[];
  playerLinks: PlayerLink[];
  layers: DrawableObject[];
  frames: BoardFrame[];
  activeFrameIndex: number;
};
