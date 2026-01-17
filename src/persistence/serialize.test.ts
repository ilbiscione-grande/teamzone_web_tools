import { describe, expect, it } from "vitest";
import { serializeProject, deserializeProject } from "./serialize";
import { createSampleProject } from "./sampleData";
import { SCHEMA_VERSION } from "@/models";

describe("serialize/deserialize", () => {
  it("roundtrips a project", () => {
    const project = createSampleProject();
    const raw = serializeProject(project);
    const parsed = deserializeProject(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.project.id).toBe(project.id);
      expect(parsed.project.schemaVersion).toBe(SCHEMA_VERSION);
    }
  });

  it("rejects schema mismatches", () => {
    const project = createSampleProject();
    const raw = serializeProject({ ...project, schemaVersion: 999 });
    const parsed = deserializeProject(raw);
    expect(parsed.ok).toBe(false);
  });
});
