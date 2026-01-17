import type { Project } from "@/models";
import { SCHEMA_VERSION } from "@/models";

export type ValidationResult =
  | { ok: true; project: Project }
  | { ok: false; error: string };

export const serializeProject = (project: Project) =>
  JSON.stringify(project, null, 2);

const isProject = (value: unknown): value is Project => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Project;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.schemaVersion === "number" &&
    Array.isArray(candidate.boards) &&
    Array.isArray(candidate.squads)
  );
};

export const deserializeProject = (raw: string): ValidationResult => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isProject(parsed)) {
      return { ok: false, error: "Invalid project structure." };
    }
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      return {
        ok: false,
        error: `Schema version mismatch (expected ${SCHEMA_VERSION}).`,
      };
    }
    return { ok: true, project: parsed };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid JSON.",
    };
  }
};
