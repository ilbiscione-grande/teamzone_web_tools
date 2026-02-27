import type { Project } from "@/models";
import { createId } from "@/utils/id";
import { clone } from "@/utils/clone";

const TEMPLATES_KEY = "tacticsboard:projectTemplates";

const getTemplatesKey = (userId?: string | null) =>
  userId ? `${TEMPLATES_KEY}:${userId}` : TEMPLATES_KEY;

export type ProjectTemplate = {
  id: string;
  name: string;
  updatedAt: string;
  project: Project;
};

export const loadProjectTemplates = (
  userId?: string | null
): ProjectTemplate[] => {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(getTemplatesKey(userId));
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as ProjectTemplate[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          item.project &&
          typeof item.project === "object"
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
};

export const saveProjectTemplate = (
  project: Project,
  templateName: string,
  userId?: string | null
) => {
  if (typeof window === "undefined") {
    return { ok: false as const, error: "Unavailable in this environment." };
  }
  const name = templateName.trim();
  if (!name) {
    return { ok: false as const, error: "Template name is required." };
  }
  const existing = loadProjectTemplates(userId);
  const now = new Date().toISOString();
  const projectSnapshot = clone(project);
  const matched = existing.find(
    (item) => item.name.toLowerCase() === name.toLowerCase()
  );
  const nextEntry: ProjectTemplate = {
    id: matched?.id ?? createId(),
    name,
    updatedAt: now,
    project: projectSnapshot,
  };
  const next = [nextEntry, ...existing.filter((item) => item.id !== nextEntry.id)].slice(
    0,
    30
  );
  try {
    window.localStorage.setItem(getTemplatesKey(userId), JSON.stringify(next));
    return { ok: true as const, template: nextEntry };
  } catch {
    return {
      ok: false as const,
      error: "Could not save template to local storage.",
    };
  }
};

export const createProjectFromTemplate = (
  template: ProjectTemplate,
  projectName: string
): Project => {
  const now = new Date().toISOString();
  const next = clone(template.project);
  const boardFallbackId = next.boards?.[0]?.id;
  return {
    ...next,
    id: createId(),
    name: projectName.trim() || `${template.name} copy`,
    createdAt: now,
    updatedAt: now,
    isSample: false,
    isShared: false,
    sharedMeta: undefined,
    activeBoardId: next.activeBoardId ?? boardFallbackId,
  };
};

export const renameProjectTemplate = (
  templateId: string,
  nextName: string,
  userId?: string | null
) => {
  if (typeof window === "undefined") {
    return { ok: false as const, error: "Unavailable in this environment." };
  }
  const name = nextName.trim();
  if (!name) {
    return { ok: false as const, error: "Template name is required." };
  }
  const existing = loadProjectTemplates(userId);
  const target = existing.find((item) => item.id === templateId);
  if (!target) {
    return { ok: false as const, error: "Template not found." };
  }
  const duplicate = existing.find(
    (item) => item.id !== templateId && item.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    return { ok: false as const, error: "A template with this name already exists." };
  }
  const now = new Date().toISOString();
  const next = existing
    .map((item) =>
      item.id === templateId ? { ...item, name, updatedAt: now } : item
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  try {
    window.localStorage.setItem(getTemplatesKey(userId), JSON.stringify(next));
    return { ok: true as const, templates: next };
  } catch {
    return {
      ok: false as const,
      error: "Could not rename template in local storage.",
    };
  }
};

export const deleteProjectTemplate = (
  templateId: string,
  userId?: string | null
) => {
  if (typeof window === "undefined") {
    return { ok: false as const, error: "Unavailable in this environment." };
  }
  const existing = loadProjectTemplates(userId);
  const next = existing.filter((item) => item.id !== templateId);
  if (next.length === existing.length) {
    return { ok: false as const, error: "Template not found." };
  }
  try {
    window.localStorage.setItem(getTemplatesKey(userId), JSON.stringify(next));
    return { ok: true as const, templates: next };
  } catch {
    return {
      ok: false as const,
      error: "Could not delete template from local storage.",
    };
  }
};
