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
  | "duplicateBoard"
  | "deleteBoard"
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
  get,
  _store
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
      if (state.project.isShared) {
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
      if (state.project?.isShared) {
        return;
      }
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
  duplicateBoard: (boardId, name) => {
    set((state) => {
      if (!state.project) {
        return;
      }
      if (state.project.isShared) {
        return;
      }
      const source = state.project.boards.find((item) => item.id === boardId);
      if (!source) {
        return;
      }
      const limits = getPlanLimits(state.plan);
      if (state.project.boards.length >= limits.maxBoards) {
        window.alert("Board limit reached for this plan.");
        return;
      }
      const clonedFrames = source.frames.map((frame) => ({
        ...frame,
        id: createId(),
        objects: JSON.parse(JSON.stringify(frame.objects)),
      }));
      const clone: Board = {
        ...source,
        id: createId(),
        name,
        frames: clonedFrames,
        layers: JSON.parse(JSON.stringify(source.layers)),
        activeFrameIndex: Math.min(
          source.activeFrameIndex,
          clonedFrames.length - 1
        ),
      };
      state.project.boards.push(clone);
      state.project.activeBoardId = clone.id;
      state.project.updatedAt = new Date().toISOString();
    });
  },
  deleteBoard: (boardId) => {
    set((state) => {
      if (!state.project) {
        return;
      }
      if (state.project.isShared) {
        return;
      }
      if (state.project.boards.length <= 1) {
        window.alert("You must keep at least one board.");
        return;
      }
      const nextBoards = state.project.boards.filter(
        (item) => item.id !== boardId
      );
      if (nextBoards.length === state.project.boards.length) {
        return;
      }
      state.project.boards = nextBoards;
      const nextActive =
        state.project.activeBoardId === boardId
          ? nextBoards[0]?.id ?? null
          : state.project.activeBoardId;
      state.project.activeBoardId = nextActive;
      state.project.updatedAt = new Date().toISOString();
    });
  },
  addFrame: (boardId, name = "Frame") => {
    set((state) => {
      const board = state.project?.boards.find((item) => item.id === boardId);
      if (!board) {
        return;
      }
      if (state.project?.isShared) {
        return;
      }
      const frame: BoardFrame = {
        id: createId(),
        name: `${name} ${board.frames.length + 1}`,
        objects: board.frames[board.activeFrameIndex]?.objects ?? [],
        action: "",
        notes: "",
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
      if (state.project?.isShared) {
        return;
      }
      const frame = board.frames.find((item) => item.id === frameId);
      if (!frame) {
        return;
      }
      const sourceIndex = board.frames.findIndex((item) => item.id === frameId);
      const insertIndex =
        sourceIndex >= 0 ? sourceIndex + 1 : board.frames.length;
      board.frames.splice(insertIndex, 0, cloneFrame(frame));
      board.activeFrameIndex = insertIndex;
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
      if (state.project?.isShared) {
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
