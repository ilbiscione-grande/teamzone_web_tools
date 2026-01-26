import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { DrawableObject } from "@/models";

export type Tool =
  | "player"
  | "ball"
  | "cone"
  | "goal"
  | "circle"
  | "rect"
  | "triangle"
  | "line"
  | "line_dashed"
  | "arrow"
  | "arrow_dashed"
  | "text";

type Viewport = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

type EditorState = {
  activeTool: Tool;
  selection: string[];
  viewport: Viewport;
  isPlaying: boolean;
  playerTokenSize: number;
  playerSide: "home" | "away";
  frameDurationMs: number;
  playheadProgress: number;
  playheadFrame: number;
  attachBallToPlayer: boolean;
  loopPlayback: boolean;
  isLinkingPlayers: boolean;
  linkingPlayerIds: string[];
  selectedLinkId: string | null;
  past: DrawableObject[][];
  future: DrawableObject[][];
  setTool: (tool: Tool) => void;
  setSelection: (ids: string[]) => void;
  setViewport: (viewport: Partial<Viewport>) => void;
  setPlaying: (playing: boolean) => void;
  setPlayerTokenSize: (size: number) => void;
  setPlayerSide: (side: "home" | "away") => void;
  setFrameDurationMs: (value: number) => void;
  setPlayheadProgress: (value: number) => void;
  setPlayheadFrame: (value: number) => void;
  setAttachBallToPlayer: (value: boolean) => void;
  setLoopPlayback: (value: boolean) => void;
  setLinkingPlayers: (value: boolean) => void;
  addLinkingPlayer: (id: string) => void;
  clearLinkingPlayers: () => void;
  setSelectedLinkId: (id: string | null) => void;
  pushHistory: (snapshot: DrawableObject[]) => void;
  undo: (current: DrawableObject[]) => DrawableObject[] | null;
  redo: (current: DrawableObject[]) => DrawableObject[] | null;
  clearHistory: () => void;
};

const MAX_HISTORY = 50;

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    activeTool: "player",
    selection: [],
    viewport: {
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    },
    isPlaying: false,
    playerTokenSize: 1.5,
    playerSide: "home",
    frameDurationMs: 700,
    playheadProgress: 0,
    playheadFrame: 0,
    attachBallToPlayer: false,
    loopPlayback: false,
    isLinkingPlayers: false,
    linkingPlayerIds: [],
    selectedLinkId: null,
    past: [],
    future: [],
    setTool: (tool) => {
      set((state) => {
        state.activeTool = tool;
      });
    },
    setSelection: (ids) => {
      set((state) => {
        state.selection = ids;
      });
    },
    setViewport: (viewport) => {
      set((state) => {
        state.viewport = { ...state.viewport, ...viewport };
      });
    },
    setPlaying: (playing) => {
      set((state) => {
        state.isPlaying = playing;
      });
    },
    setPlayerTokenSize: (size) => {
      set((state) => {
        state.playerTokenSize = size;
      });
    },
    setPlayerSide: (side) => {
      set((state) => {
        state.playerSide = side;
      });
    },
    setFrameDurationMs: (value) => {
      set((state) => {
        state.frameDurationMs = value;
      });
    },
    setPlayheadProgress: (value) => {
      set((state) => {
        state.playheadProgress = value;
      });
    },
    setPlayheadFrame: (value) => {
      set((state) => {
        state.playheadFrame = value;
      });
    },
    setAttachBallToPlayer: (value) => {
      set((state) => {
        state.attachBallToPlayer = value;
      });
    },
    setLoopPlayback: (value) => {
      set((state) => {
        state.loopPlayback = value;
      });
    },
    setLinkingPlayers: (value) => {
      set((state) => {
        state.isLinkingPlayers = value;
      });
    },
    addLinkingPlayer: (id) => {
      set((state) => {
        if (!state.linkingPlayerIds.includes(id)) {
          state.linkingPlayerIds.push(id);
        }
      });
    },
    clearLinkingPlayers: () => {
      set((state) => {
        state.linkingPlayerIds = [];
      });
    },
    setSelectedLinkId: (id) => {
      set((state) => {
        state.selectedLinkId = id;
      });
    },
    pushHistory: (snapshot) => {
      set((state) => {
        state.past.push(snapshot);
        if (state.past.length > MAX_HISTORY) {
          state.past.shift();
        }
        state.future = [];
      });
    },
    undo: (current) => {
      const { past, future } = get();
      if (past.length === 0) {
        return null;
      }
      const previous = past[past.length - 1];
      set((state) => {
        state.past = state.past.slice(0, -1);
        state.future = [current, ...future];
      });
      return previous;
    },
    redo: (current) => {
      const { future } = get();
      if (future.length === 0) {
        return null;
      }
      const next = future[0];
      set((state) => {
        state.future = state.future.slice(1);
        state.past = [...state.past, current].slice(-MAX_HISTORY);
      });
      return next;
    },
    clearHistory: () => {
      set((state) => {
        state.past = [];
        state.future = [];
      });
    },
  }))
);
