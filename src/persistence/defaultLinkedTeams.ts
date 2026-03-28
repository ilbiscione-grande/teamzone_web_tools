type DefaultLinkedTeams = {
  homeTeamId?: string;
  awayTeamId?: string;
};

const storageKey = (userId: string | null | undefined) =>
  `tacticsboard:defaultLinkedTeams:${userId ?? "anon"}`;

export const loadDefaultLinkedTeams = (
  userId: string | null | undefined
): DefaultLinkedTeams => {
  if (typeof window === "undefined") {
    return {};
  }
  const raw = window.localStorage.getItem(storageKey(userId));
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as DefaultLinkedTeams;
    return {
      homeTeamId:
        typeof parsed.homeTeamId === "string" && parsed.homeTeamId.trim()
          ? parsed.homeTeamId
          : undefined,
      awayTeamId:
        typeof parsed.awayTeamId === "string" && parsed.awayTeamId.trim()
          ? parsed.awayTeamId
          : undefined,
    };
  } catch {
    return {};
  }
};

export const saveDefaultLinkedTeam = (
  side: "home" | "away",
  teamId: string,
  userId: string | null | undefined
) => {
  if (typeof window === "undefined") {
    return;
  }
  const current = loadDefaultLinkedTeams(userId);
  const next: DefaultLinkedTeams = {
    ...current,
    [side === "home" ? "homeTeamId" : "awayTeamId"]: teamId,
  };
  window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
};
