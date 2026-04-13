import type { DrawableObject, Style } from "./drawables";
import type { SquadPlayer } from "./squad";

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
  playerHighlights?: PlayerHighlight[];
  playerLinks?: PlayerLink[];
};

export type PlayerHighlight =
  | string
  | {
      playerId: string;
      color?: string;
    };

export type PlayerLink = {
  id: string;
  playerIds: string[];
  style?: Style;
  showLine?: boolean;
};

export type BoardSquadOverride = {
  hiddenPlayerIds?: string[];
  guestPlayers?: SquadPlayer[];
  numberOverrides?: Record<string, number | undefined>;
  positionOverrides?: Record<string, string>;
};

export type Board = {
  id: string;
  name: string;
  mode: BoardMode;
  pitchView: PitchView;
  pitchRotation?: 0 | 180;
  threeDView?: boolean;
  threeDStrength?: number;
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
      dateTime?: string;
      equipment?: string[];
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
  squadOverrides?: Record<string, BoardSquadOverride>;
  playerVisualization?: "circle" | "jersey";
  playerLabel: {
    showName: boolean;
    showPosition: boolean;
    showNumber: boolean;
  };
  playerHighlights: PlayerHighlight[];
  playerLinks: PlayerLink[];
  layers: DrawableObject[];
  frames: BoardFrame[];
  activeFrameIndex: number;
};
