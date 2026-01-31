import type {
  Board,
  DrawableObject,
  Plan,
  Project,
  ProjectSummary,
  Squad,
  SquadPlayer,
  AuthUser,
  BoardShare,
  SharedBoardSnapshot,
} from "@/models";

export type ProjectStateSlice = {
  index: ProjectSummary[];
  activeProjectId: string | null;
  project: Project | null;
  plan: Plan;
  authUser: AuthUser | null;
  syncStatus: {
    state: "idle" | "syncing" | "saved" | "error" | "offline";
    message?: string;
    updatedAt: string;
  };
};

export type ProjectActions = {
  hydrateIndex: () => void;
  setPlan: (plan: Plan) => void;
  setPlanFromProfile: (plan: Plan) => void;
  setAuthUser: (user: AuthUser) => void;
  clearAuthUser: () => void;
  setSyncStatus: (status: ProjectStateSlice["syncStatus"]) => void;
  syncNow: () => void;
  createProject: (
    name: string,
    options?: {
      homeKit?: Squad["kit"];
      awayKit?: Squad["kit"];
      attachBallToPlayer?: boolean;
    }
  ) => void;
  openProject: (id: string) => void;
  openProjectFromData: (project: Project) => void;
  openSharedBoard: (share: BoardShare) => void;
  closeProject: () => void;
  deleteProject: (id: string) => void;
  loadSample: () => void;
  updateProjectMeta: (payload: Partial<Project>) => void;
  setActiveBoard: (boardId: string) => void;
  addBoard: (name: string) => void;
  addBoardFromSnapshot: (
    snapshot: SharedBoardSnapshot,
    nameOverride?: string
  ) => void;
  updateBoard: (boardId: string, payload: Partial<Board>) => void;
  setBoardNotes: (boardId: string, notes: string) => void;
  setBoardPitchView: (boardId: string, pitchView: Board["pitchView"]) => void;
  setBoardMode: (boardId: string, mode: Board["mode"]) => void;
  setActiveFrameIndex: (boardId: string, index: number) => void;
  duplicateBoard: (boardId: string, name: string) => void;
  deleteBoard: (boardId: string) => void;
  addFrame: (boardId: string, name?: string) => void;
  duplicateFrame: (boardId: string, frameId: string) => void;
  deleteFrame: (boardId: string, frameId: string) => void;
  setFrameObjects: (
    boardId: string,
    frameIndex: number,
    objects: DrawableObject[]
  ) => void;
  addObject: (
    boardId: string,
    frameIndex: number,
    object: DrawableObject
  ) => void;
  updateObject: (
    boardId: string,
    frameIndex: number,
    objectId: string,
    payload: Partial<DrawableObject>
  ) => void;
  removeObject: (boardId: string, frameIndex: number, objectId: string) => void;
  addSquad: (name: string) => void;
  addSquadWithData: (squad: Squad) => void;
  updateSquad: (squadId: string, payload: Partial<Squad>) => void;
  addSquadPlayer: (squadId: string, player: SquadPlayer) => void;
  updateSquadPlayer: (
    squadId: string,
    playerId: string,
    payload: Partial<SquadPlayer>
  ) => void;
  removeSquadPlayer: (squadId: string, playerId: string) => void;
};

export type ProjectStore = ProjectStateSlice & ProjectActions;
