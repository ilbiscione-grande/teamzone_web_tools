import type { Project, ProjectSummary } from "@/models";

const INDEX_KEY = "tacticsboard:projects";
const PROJECT_PREFIX = "tacticsboard:project:";

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
        return;
      } catch (retryError) {
        if (!isQuotaExceededError(retryError)) {
          console.warn("Could not persist project index to local storage.", retryError);
          return;
        }
      }
    }

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
        console.warn("Could not persist project to local storage.", retryError);
        return;
      }
    }
    console.warn("Could not persist project to local storage.", error);
  }
};

export const deleteProject = (id: string, userId?: string | null) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(getProjectKey(id, userId));
};
