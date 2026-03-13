import type { Squad } from "@/models";

type TeamDefaults = {
  home?: Squad;
  away?: Squad;
};

const storageKey = (userId: string | null | undefined) =>
  `tacticsboard:defaultTeamSquads:${userId ?? "anon"}`;

const cloneSquad = (squad: Squad): Squad =>
  JSON.parse(JSON.stringify(squad)) as Squad;

export const loadDefaultTeamSquads = (
  userId: string | null | undefined
): TeamDefaults => {
  if (typeof window === "undefined") {
    return {};
  }
  const raw = window.localStorage.getItem(storageKey(userId));
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as TeamDefaults;
    return {
      home: parsed.home ? cloneSquad(parsed.home) : undefined,
      away: parsed.away ? cloneSquad(parsed.away) : undefined,
    };
  } catch {
    return {};
  }
};

export const saveDefaultTeamSquad = (
  side: "home" | "away",
  squad: Squad,
  userId: string | null | undefined
) => {
  if (typeof window === "undefined") {
    return;
  }
  const current = loadDefaultTeamSquads(userId);
  const next: TeamDefaults = {
    ...current,
    [side]: cloneSquad(squad),
  };
  window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
};
