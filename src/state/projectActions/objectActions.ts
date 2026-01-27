import type { StateCreator } from "zustand";
import type { ProjectActions, ProjectStore } from "./types";
import type { DrawableObject } from "@/models";

type ObjectActionSlice = Pick<
  ProjectActions,
  "setFrameObjects" | "addObject" | "updateObject" | "removeObject"
>;

export const createObjectActions: StateCreator<
  ProjectStore,
  [["zustand/immer", never]],
  [],
  ObjectActionSlice
> = (set, _get, _store) => ({
  setFrameObjects: (boardId, frameIndex, objects) => {
    set((state) => {
      if (state.project?.isShared) {
        return;
      }
      const board = state.project?.boards.find((item) => item.id === boardId);
      if (!board || !board.frames[frameIndex]) {
        return;
      }
      board.frames[frameIndex].objects = objects;
      if (board.mode === "STATIC") {
        board.layers = objects;
      }
      if (state.project) {
        state.project.updatedAt = new Date().toISOString();
      }
    });
  },
  addObject: (boardId, frameIndex, object: DrawableObject) => {
    set((state) => {
      if (state.project?.isShared) {
        return;
      }
      const board = state.project?.boards.find((item) => item.id === boardId);
      if (!board || !board.frames[frameIndex]) {
        return;
      }
      board.frames[frameIndex].objects.push(object);
      if (board.mode === "STATIC") {
        board.layers = board.frames[frameIndex].objects;
      }
      if (state.project) {
        state.project.updatedAt = new Date().toISOString();
      }
    });
  },
  updateObject: (boardId, frameIndex, objectId, payload) => {
    set((state) => {
      if (state.project?.isShared) {
        return;
      }
      const board = state.project?.boards.find((item) => item.id === boardId);
      const frame = board?.frames[frameIndex];
      if (!frame) {
        return;
      }
      const target = frame.objects.find((item) => item.id === objectId);
      if (!target) {
        return;
      }
      Object.assign(target, payload);
      if (
        target.type === "player" &&
        Object.prototype.hasOwnProperty.call(payload, "squadPlayerId") &&
        board
      ) {
        board.frames.forEach((entry) => {
          const match = entry.objects.find((item) => item.id === objectId);
          if (match && match.type === "player") {
            match.squadPlayerId = (payload as { squadPlayerId?: string })
              .squadPlayerId;
          }
        });
      }
      if (board.mode === "STATIC") {
        board.layers = frame.objects;
      }
      if (state.project) {
        state.project.updatedAt = new Date().toISOString();
      }
    });
  },
  removeObject: (boardId, frameIndex, objectId) => {
    set((state) => {
      if (state.project?.isShared) {
        return;
      }
      const board = state.project?.boards.find((item) => item.id === boardId);
      const frame = board?.frames[frameIndex];
      if (!frame) {
        return;
      }
      frame.objects = frame.objects.filter((item) => item.id !== objectId);
      if (board.mode === "STATIC") {
        board.layers = frame.objects;
      }
      if (state.project) {
        state.project.updatedAt = new Date().toISOString();
      }
    });
  },
});
