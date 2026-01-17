import type { Project, ProjectSummary } from "@/models";
import { serializeProject } from "./serialize";

const INDEX_KEY = "tacticsboard:projects";
const PROJECT_PREFIX = "tacticsboard:project:";

export const loadProjectIndex = (): ProjectSummary[] => {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(INDEX_KEY);
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

export const saveProjectIndex = (index: ProjectSummary[]) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
};

export const loadProject = (id: string): Project | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(`${PROJECT_PREFIX}${id}`);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
};

export const saveProject = (project: Project) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    `${PROJECT_PREFIX}${project.id}`,
    serializeProject(project)
  );
};

export const deleteProject = (id: string) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(`${PROJECT_PREFIX}${id}`);
};
