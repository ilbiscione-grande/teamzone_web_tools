import type { DrawableObject } from "./drawables";

export type BoardMode = "STATIC" | "DYNAMIC";
export type PitchView = "FULL" | "DEF_HALF" | "OFF_HALF" | "GREEN_EMPTY";
export type PitchOverlay = "NONE" | "CORRIDORS" | "THIRDS" | "ZONES_18";

export type BoardFrame = {
  id: string;
  name: string;
  objects: DrawableObject[];
};

export type Board = {
  id: string;
  name: string;
  mode: BoardMode;
  pitchView: PitchView;
  pitchOverlay: PitchOverlay;
  pitchOverlayText: boolean;
  notes: string;
  homeSquadId?: string;
  awaySquadId?: string;
  playerLabel: {
    showName: boolean;
    showPosition: boolean;
    showNumber: boolean;
  };
  layers: DrawableObject[];
  frames: BoardFrame[];
  activeFrameIndex: number;
};
