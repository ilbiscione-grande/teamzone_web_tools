import type { Board, PlayerToken, Project, Squad, SquadPlayer } from "@/models";

export const getBoardOverridePlayerKey = (player: Pick<SquadPlayer, "id" | "teamMemberId">) =>
  player.teamMemberId ?? player.id;

export const getPlayerTokenLinkKey = (
  player: Pick<PlayerToken, "squadPlayerId" | "teamMemberId">
) => player.squadPlayerId ?? player.teamMemberId;

const applyBoardOverride = (board: Board, squad: Squad): Squad => {
  const override = board.squadOverrides?.[squad.id];
  if (!override) {
    return squad;
  }
  const hiddenIds = new Set(override.hiddenPlayerIds ?? []);
  const numberOverrides = override.numberOverrides ?? {};
  const positionOverrides = override.positionOverrides ?? {};
  const basePlayers = squad.players.map((player) => {
    const overrideKey = getBoardOverridePlayerKey(player);
    const nextNumber = numberOverrides[overrideKey] ?? numberOverrides[player.id];
    const nextPosition = positionOverrides[overrideKey] ?? positionOverrides[player.id];
    return {
      ...player,
      number:
        typeof nextNumber === "number" && Number.isFinite(nextNumber)
          ? nextNumber
          : player.number,
      positionLabel:
        typeof nextPosition === "string" && nextPosition.trim().length > 0
          ? nextPosition
          : player.positionLabel,
      active:
        hiddenIds.has(overrideKey) || hiddenIds.has(player.id)
          ? false
          : player.active ?? true,
    };
  });
  const guestPlayers = (override.guestPlayers ?? []).map((guest) => {
    const nextNumber = numberOverrides[guest.id];
    const nextPosition = positionOverrides[guest.id];
    return {
      ...guest,
      guest: true,
      number:
        typeof nextNumber === "number" && Number.isFinite(nextNumber)
          ? nextNumber
          : guest.number,
      positionLabel:
        typeof nextPosition === "string" && nextPosition.trim().length > 0
          ? nextPosition
          : guest.positionLabel,
      active: hiddenIds.has(guest.id) ? false : guest.active ?? true,
    };
  });
  return {
    ...squad,
    players: [...basePlayers, ...guestPlayers],
  };
};

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
  const homeWithOverride = home ? applyBoardOverride(board, home) : undefined;
  const awayWithOverride = away ? applyBoardOverride(board, away) : undefined;
  const all = [homeWithOverride, awayWithOverride].filter(Boolean) as Squad[];
  return {
    home: homeWithOverride,
    away: awayWithOverride,
    all,
  };
};
