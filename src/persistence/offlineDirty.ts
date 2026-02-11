const OFFLINE_DIRTY_KEY = "tacticsboard:offlineDirty";

const buildKey = (userId: string) => `${OFFLINE_DIRTY_KEY}:${userId}`;

const readMap = (userId: string): Record<string, true> => {
  if (typeof window === "undefined") {
    return {};
  }
  const raw = window.localStorage.getItem(buildKey(userId));
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, true>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeMap = (userId: string, next: Record<string, true>) => {
  if (typeof window === "undefined") {
    return;
  }
  const hasAny = Object.keys(next).length > 0;
  if (!hasAny) {
    window.localStorage.removeItem(buildKey(userId));
    return;
  }
  window.localStorage.setItem(buildKey(userId), JSON.stringify(next));
};

export const getOfflineDirtyProjectIds = (userId: string): string[] =>
  Object.keys(readMap(userId));

export const markOfflineDirtyProject = (userId: string, projectId: string) => {
  const next = readMap(userId);
  next[projectId] = true;
  writeMap(userId, next);
};

export const clearOfflineDirtyProject = (userId: string, projectId: string) => {
  const next = readMap(userId);
  if (next[projectId]) {
    delete next[projectId];
    writeMap(userId, next);
  }
};

export const clearAllOfflineDirtyProjects = (userId: string) => {
  writeMap(userId, {});
};

