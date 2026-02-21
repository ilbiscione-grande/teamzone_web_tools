import type { Board, Project, Squad } from "@/models";

export const getActiveBoard = (project: Project | null): Board | null => {
  if (!project || !Array.isArray(project.boards) || project.boards.length === 0) {
    return null;
  }
  const boards = project.boards.filter(
    (item): item is Board =>
      Boolean(item) &&
      typeof item.id === "string" &&
      item.id.length > 0 &&
      Array.isArray(item.frames)
  );
  if (boards.length === 0) {
    return null;
  }
  const id = project.activeBoardId ?? project.boards[0]?.id;
  return boards.find((board) => board.id === id) ?? boards[0] ?? null;
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
