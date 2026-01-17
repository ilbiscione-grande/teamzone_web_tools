import type { StateCreator } from "zustand";
import type { ProjectActions, ProjectStore } from "./types";
import type { Board, BoardFrame } from "@/models";
import { createId } from "@/utils/id";
import {
  createEmptyBoard,
  cloneFrame,
  defaultAwayKit,
  defaultHomeKit,
} from "@/state/projectHelpers";
import { getPlanLimits } from "@/utils/plan";

type BoardActionSlice = Pick<
  ProjectActions,
  | "setActiveBoard"
  | "addBoard"
  | "updateBoard"
  | "setBoardNotes"
  | "setBoardPitchView"
  | "setBoardMode"
  | "setActiveFrameIndex"
  | "addFrame"
  | "duplicateFrame"
  | "deleteFrame"
>;

export const createBoardActions: StateCreator<
  ProjectStore,
  [["zustand/immer", never]],
  [],
  BoardActionSlice
> = (
  set,
  get
) => ({
  setActiveBoard: (boardId) => {
    set((state) => {
      if (!state.project) {
        return;
      }
      state.project.activeBoardId = boardId;
      state.project.updatedAt = new Date().toISOString();
    });
  },
  addBoard: (name) => {
    set((state) => {
      if (!state.project) {
        return;
      }
      const limits = getPlanLimits(state.plan);
      if (state.project.boards.length >= limits.maxBoards) {
        window.alert("Board limit reached for this plan.");
        return;
      }
      const homeKit = state.project.settings?.homeKit ?? defaultHomeKit();
      const awayKit = state.project.settings?.awayKit ?? defaultAwayKit();
      const homeSquadId = createId();
      const awaySquadId = createId();
      state.project.squads.push({
        id: homeSquadId,
        name: `Home ${state.project.boards.length + 1}`,
        clubLogo: undefined,
        kit: { ...homeKit },
        players: [],
      });
      state.project.squads.push({
        id: awaySquadId,
        name: `Away ${state.project.boards.length + 1}`,
        clubLogo: undefined,
        kit: { ...awayKit },
        players: [],
      });
      const board = createEmptyBoard(name, { homeSquadId, awaySquadId });
      state.project.boards.push(board);
      state.project.activeBoardId = board.id;
      state.project.updatedAt = new Date().toISOString();
    });
  },
  updateBoard: (boardId, payload) => {
    set((state) => {
      const board = state.project?.boards.find((item) => item.id === boardId);
      if (!board) {
        return;
      }
      Object.assign(board, payload);
      if (state.project) {
        state.project.updatedAt = new Date().toISOString();
      }
    });
  },
  setBoardNotes: (boardId, notes) => {
    get().updateBoard(boardId, { notes });
  },
  setBoardPitchView: (boardId, pitchView) => {
    get().updateBoard(boardId, { pitchView });
  },
  setBoardMode: (boardId, mode) => {
    get().updateBoard(boardId, { mode });
  },
  setActiveFrameIndex: (boardId, index) => {
    set((state) => {
      const board = state.project?.boards.find((item) => item.id === boardId);
      if (!board) {
        return;
      }
      board.activeFrameIndex = index;
    });
  },
  addFrame: (boardId, name = "Frame") => {
    set((state) => {
      const board = state.project?.boards.find((item) => item.id === boardId);
      if (!board) {
        return;
      }
      const frame: BoardFrame = {
        id: createId(),
        name: `${name} ${board.frames.length + 1}`,
        objects: board.frames[board.activeFrameIndex]?.objects ?? [],
      };
      board.frames.push(JSON.parse(JSON.stringify(frame)));
      board.activeFrameIndex = board.frames.length - 1;
      if (state.project) {
        state.project.updatedAt = new Date().toISOString();
      }
    });
  },
  duplicateFrame: (boardId, frameId) => {
    set((state) => {
      const board = state.project?.boards.find((item) => item.id === boardId);
      if (!board) {
        return;
      }
      const frame = board.frames.find((item) => item.id === frameId);
      if (!frame) {
        return;
      }
      board.frames.push(cloneFrame(frame));
      board.activeFrameIndex = board.frames.length - 1;
      if (state.project) {
        state.project.updatedAt = new Date().toISOString();
      }
    });
  },
  deleteFrame: (boardId, frameId) => {
    set((state) => {
      const board = state.project?.boards.find((item) => item.id === boardId);
      if (!board || board.frames.length <= 1) {
        return;
      }
      board.frames = board.frames.filter((item) => item.id !== frameId);
      board.activeFrameIndex = Math.max(0, board.activeFrameIndex - 1);
      if (state.project) {
        state.project.updatedAt = new Date().toISOString();
      }
    });
  },
});
