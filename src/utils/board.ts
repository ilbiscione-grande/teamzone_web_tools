import type { Board, Project, Squad } from "@/models";

export const getActiveBoard = (project: Project | null): Board | null => {
  if (!project || project.boards.length === 0) {
    return null;
  }
  const id = project.activeBoardId ?? project.boards[0]?.id;
  return project.boards.find((board) => board.id === id) ?? null;
};

export const getBoardSquads = (
  project: Project | null,
  board: Board | null
): { home?: Squad; away?: Squad; all: Squad[] } => {
  if (!project || !board) {
    return { all: [] };
  }
  const home = board.homeSquadId
    ? project.squads.find((item) => item.id === board.homeSquadId)
    : undefined;
  const away = board.awaySquadId
    ? project.squads.find((item) => item.id === board.awaySquadId)
    : undefined;
  const all = [home, away].filter(Boolean) as Squad[];
  return { home, away, all };
};
