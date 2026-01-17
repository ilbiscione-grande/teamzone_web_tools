import type { Board } from "./board";
import type { Squad } from "./squad";

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
  settings: {
    homeKit: {
      shirt: string;
      shorts: string;
      socks: string;
    };
    awayKit: {
      shirt: string;
      shorts: string;
      socks: string;
    };
    attachBallToPlayer: boolean;
  };
  boards: Board[];
  squads: Squad[];
  activeBoardId?: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  updatedAt: string;
};
