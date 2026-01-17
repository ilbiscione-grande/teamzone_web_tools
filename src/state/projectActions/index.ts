import type { StateCreator } from "zustand";
import { createBoardActions } from "./boardActions";
import { createCoreActions } from "./coreActions";
import { createObjectActions } from "./objectActions";
import { createSquadActions } from "./squadActions";
import type { ProjectActions, ProjectStore } from "./types";

export type { ProjectActions, ProjectStateSlice, ProjectStore } from "./types";

export const createProjectActions: StateCreator<
  ProjectStore,
  [["zustand/immer", never]],
  [],
  ProjectActions
> = (set, get) => ({
  ...createCoreActions(set, get),
  ...createBoardActions(set, get),
  ...createObjectActions(set, get),
  ...createSquadActions(set, get),
});
