import type { Project, ProjectSummary } from "@/models";

const INDEX_KEY = "tacticsboard:projects";
const PROJECT_PREFIX = "tacticsboard:project:";
const STORAGE_NOTICE_KEY = "tacticsboard:storageNotice";
const STORAGE_NOTICE_EVENT = "tacticsboard:storage-notice";

export type StorageNotice = {
  level: "warning" | "error";
  message: string;
  createdAt: string;
};

const getIndexKey = (userId?: string | null) =>
  userId ? `${INDEX_KEY}:${userId}` : INDEX_KEY;
const getProjectKey = (id: string, userId?: string | null) =>
  userId ? `${PROJECT_PREFIX}${userId}:${id}` : `${PROJECT_PREFIX}${id}`;

const isQuotaExceededError = (error: unknown) =>
  error instanceof DOMException &&
  (error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED");

const sortByUpdatedAtDescending = (index: ProjectSummary[]) =>
  [...index].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

const emitStorageNotice = (notice: StorageNotice) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_NOTICE_KEY, JSON.stringify(notice));
  } catch (error) {
    console.warn("Could not persist storage notice.", error);
  }
  window.dispatchEvent(new CustomEvent(STORAGE_NOTICE_EVENT));
};

export const consumeStorageNotice = (): StorageNotice | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_NOTICE_KEY);
  if (!raw) {
    return null;
  }
  window.localStorage.removeItem(STORAGE_NOTICE_KEY);
  try {
    const parsed = JSON.parse(raw) as StorageNotice;
    if (
      parsed &&
      (parsed.level === "warning" || parsed.level === "error") &&
      typeof parsed.message === "string" &&
      typeof parsed.createdAt === "string"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
};

export const storageNoticeEventName = STORAGE_NOTICE_EVENT;

const freeSpaceForProject = (projectId: string, userId?: string | null) => {
  if (typeof window === "undefined") {
    return false;
  }
  const index = sortByUpdatedAtDescending(loadProjectIndex(userId));
  if (index.length === 0) {
    return false;
  }
  const removable = index
    .filter((item) => item.id !== projectId)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  if (removable.length === 0) {
    return false;
  }

  const nextIndex = [...index];
  for (const item of removable) {
    window.localStorage.removeItem(getProjectKey(item.id, userId));
    const idx = nextIndex.findIndex((entry) => entry.id === item.id);
    if (idx >= 0) {
      nextIndex.splice(idx, 1);
    }
    try {
      window.localStorage.setItem(getIndexKey(userId), JSON.stringify(nextIndex));
      emitStorageNotice({
        level: "warning",
        message: `Lokal lagring var full. Projektet "${item.name}" togs bort lokalt for att gora plats.`,
        createdAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      if (!isQuotaExceededError(error)) {
        console.warn("Could not persist project index to local storage.", error);
        return false;
      }
    }
  }

  return false;
};

export const loadProjectIndex = (userId?: string | null): ProjectSummary[] => {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(getIndexKey(userId));
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as ProjectSummary[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveProjectIndex = (
  index: ProjectSummary[],
  userId?: string | null
) => {
  if (typeof window === "undefined") {
    return;
  }
  const next = sortByUpdatedAtDescending(index);
  try {
    window.localStorage.setItem(getIndexKey(userId), JSON.stringify(next));
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      console.warn("Could not persist project index to local storage.", error);
      return;
    }

    const shrink = [...next];
    while (shrink.length > 1) {
      const removed = shrink.pop();
      if (removed) {
        window.localStorage.removeItem(getProjectKey(removed.id, userId));
      }
      try {
        window.localStorage.setItem(getIndexKey(userId), JSON.stringify(shrink));
        if (removed) {
          emitStorageNotice({
            level: "warning",
            message: `Lokal lagring var full. Projektet "${removed.name}" togs bort lokalt for att gora plats.`,
            createdAt: new Date().toISOString(),
          });
        }
        return;
      } catch (retryError) {
        if (!isQuotaExceededError(retryError)) {
          console.warn("Could not persist project index to local storage.", retryError);
          return;
        }
      }
    }

    emitStorageNotice({
      level: "error",
      message: "Kunde inte spara projektlistan lokalt eftersom lagringen ar full.",
      createdAt: new Date().toISOString(),
    });
    console.warn("Could not persist project index to local storage.", error);
  }
};

export const loadProject = (id: string, userId?: string | null): Project | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(getProjectKey(id, userId));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
};

export const saveProject = (project: Project, userId?: string | null) => {
  if (typeof window === "undefined") {
    return;
  }
  const projectKey = getProjectKey(project.id, userId);
  const data = JSON.stringify(project);
  try {
    window.localStorage.setItem(projectKey, data);
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      console.warn("Could not persist project to local storage.", error);
      return;
    }

    const freed = freeSpaceForProject(project.id, userId);
    if (freed) {
      try {
        window.localStorage.setItem(projectKey, data);
        return;
      } catch (retryError) {
        emitStorageNotice({
          level: "error",
          message: `Kunde inte spara projektet "${project.name}" lokalt efter att plats frigjorts.`,
          createdAt: new Date().toISOString(),
        });
        console.warn("Could not persist project to local storage.", retryError);
        return;
      }
    }
    emitStorageNotice({
      level: "error",
      message: `Kunde inte spara projektet "${project.name}" lokalt eftersom lagringen ar full.`,
      createdAt: new Date().toISOString(),
    });
    console.warn("Could not persist project to local storage.", error);
  }
};

export const deleteProject = (id: string, userId?: string | null) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(getProjectKey(id, userId));
};
