import type { StateCreator } from "zustand";
import type { ProjectActions, ProjectStore } from "./types";
import type { Board, BoardFrame, SharedBoardSnapshot } from "@/models";
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
  | "addBoardFromSnapshot"
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
      const board = createEmptyBoard(
        name,
        { homeSquadId, awaySquadId },
        {
          pitchView: state.project.settings?.defaultPitchView,
          pitchOverlay: state.project.settings?.defaultPitchOverlay,
          pitchShape: state.project.settings?.defaultPitchShape,
          playerLabel: state.project.settings?.defaultPlayerLabel,
        }
      );
      state.project.boards.push(board);
      state.project.activeBoardId = board.id;
      state.project.updatedAt = new Date().toISOString();
    });
  },
  addBoardFromSnapshot: (snapshot, nameOverride) => {
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
      const squadIdMap = new Map<string, string>();
      const playerIdMap = new Map<string, string>();
      const clonedSquads = (snapshot.squads ?? []).map((squad) => {
        const nextSquadId = createId();
        squadIdMap.set(squad.id, nextSquadId);
        const players = squad.players.map((player) => {
          const nextPlayerId = createId();
          playerIdMap.set(player.id, nextPlayerId);
          return { ...player, id: nextPlayerId };
        });
        return { ...squad, id: nextSquadId, players };
      });
      const clonedBoard = JSON.parse(
        JSON.stringify(snapshot.board)
      ) as Board;
      clonedBoard.id = createId();
      clonedBoard.name = nameOverride ?? snapshot.board.name;
      clonedBoard.homeSquadId = snapshot.board.homeSquadId
        ? squadIdMap.get(snapshot.board.homeSquadId)
        : undefined;
      clonedBoard.awaySquadId = snapshot.board.awaySquadId
        ? squadIdMap.get(snapshot.board.awaySquadId)
        : undefined;
      clonedBoard.frames = clonedBoard.frames.map((frame) => ({
        ...frame,
        id: createId(),
        objects: frame.objects.map((item) => {
          if (item.type === "player" && item.squadPlayerId) {
            return {
              ...item,
              squadPlayerId: playerIdMap.get(item.squadPlayerId),
            };
          }
          return item;
        }),
      }));
      clonedBoard.activeFrameIndex = Math.min(
        clonedBoard.activeFrameIndex ?? 0,
        clonedBoard.frames.length - 1
      );
      clonedBoard.layers =
        clonedBoard.frames[clonedBoard.activeFrameIndex]?.objects ?? [];
      state.project.squads.push(...clonedSquads);
      state.project.boards.push(clonedBoard);
      state.project.activeBoardId = clonedBoard.id;
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
