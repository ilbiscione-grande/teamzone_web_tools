import type { Board } from "./board";
import type { Project } from "./project";
import type { Squad } from "./squad";

export type BoardSharePermission = "view" | "comment";

export type SharedBoardSnapshot = {
  schemaVersion: number;
  board: Board;
  squads: Squad[];
  settings: Project["settings"];
};

export type BoardShare = {
  id: string;
  ownerId: string;
  ownerEmail: string;
  recipientEmail: string;
  boardId: string;
  boardName: string;
  projectName: string;
  permission: BoardSharePermission;
  createdAt: string;
  updatedAt: string;
  boardData: SharedBoardSnapshot;
};

export type BoardComment = {
  id: string;
  shareId: string;
  boardId: string;
  frameId?: string | null;
  objectId?: string | null;
  authorId: string;
  authorEmail: string;
  body: string;
  createdAt: string;
};
