import type { SharedBoardSnapshot } from "./share";

export type PublicBoardStatus = "unverified" | "verified" | "reviewed";

export type PublicBoard = {
  id: string;
  ownerId: string;
  ownerEmail: string;
  boardId: string;
  boardName: string;
  projectName: string;
  title: string;
  description: string;
  tags: string[];
  formation?: string | null;
  thumbnail?: string | null;
  status: PublicBoardStatus;
  createdAt: string;
  updatedAt: string;
  boardData: SharedBoardSnapshot;
};

export type PublicBoardReport = {
  id: string;
  boardId: string;
  reporterId: string;
  reporterEmail: string;
  reason: string;
  createdAt: string;
};
