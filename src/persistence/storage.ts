import type { Project, ProjectSummary } from "@/models";
import { serializeProject } from "./serialize";

const INDEX_KEY = "tacticsboard:projects";
const PROJECT_PREFIX = "tacticsboard:project:";

const getIndexKey = (userId?: string | null) =>
  userId ? `${INDEX_KEY}:${userId}` : INDEX_KEY;
const getProjectKey = (id: string, userId?: string | null) =>
  userId ? `${PROJECT_PREFIX}${userId}:${id}` : `${PROJECT_PREFIX}${id}`;

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
  try {
    window.localStorage.setItem(getIndexKey(userId), JSON.stringify(index));
  } catch (error) {
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
  try {
    window.localStorage.setItem(
      getProjectKey(project.id, userId),
      serializeProject(project)
    );
  } catch (error) {
    console.warn("Could not persist project to local storage.", error);
  }
};

export const deleteProject = (id: string, userId?: string | null) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(getProjectKey(id, userId));
};
