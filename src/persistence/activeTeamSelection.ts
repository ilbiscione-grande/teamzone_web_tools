"use client";

export type ActiveTeamSelection = {
  teamId: string;
  clubName?: string | null;
  teamName: string;
  updatedAt: string;
};

const getStorageKey = (userId: string | null) =>
  `tacticsboard:activeTeam:${userId ?? "anon"}`;

export const loadActiveTeamSelection = (
  userId: string | null
): ActiveTeamSelection | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(getStorageKey(userId));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as ActiveTeamSelection;
    if (!parsed || typeof parsed.teamId !== "string" || typeof parsed.teamName !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const saveActiveTeamSelection = (
  selection: Omit<ActiveTeamSelection, "updatedAt">,
  userId: string | null
) => {
  if (typeof window === "undefined") {
    return;
  }
  const next: ActiveTeamSelection = {
    ...selection,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(next));
};

export const clearActiveTeamSelection = (userId: string | null) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(getStorageKey(userId));
};
