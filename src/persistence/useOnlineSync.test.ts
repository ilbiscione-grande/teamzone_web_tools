import { describe, expect, it, vi } from "vitest";
import type { Project } from "@/models";
import { SCHEMA_VERSION } from "@/models";
import { resolveSyncConflictsBeforeSync } from "./useOnlineSync";

const createProject = (
  id: string,
  name: string,
  updatedAt: string,
  notes = ""
): Project => ({
  id,
  name,
  createdAt: updatedAt,
  updatedAt,
  schemaVersion: SCHEMA_VERSION,
  settings: {
    mode: "match",
    homeKit: {
      shirt: "#111111",
      shorts: "#222222",
      socks: "#333333",
    },
    awayKit: {
      shirt: "#444444",
      shorts: "#555555",
      socks: "#666666",
    },
    attachBallToPlayer: false,
    defaultPitchView: "FULL",
    defaultPitchOverlay: "NONE",
    defaultPitchShape: "none",
    defaultPlayerLabel: {
      showName: true,
      showPosition: false,
      showNumber: false,
    },
  },
  sessionNotes: notes,
  sessionNotesFields: {},
  boards: [],
  squads: [],
  activeBoardId: undefined,
});

describe("resolveSyncConflictsBeforeSync", () => {
  it("clears dirty state when local and cloud projects are identical", async () => {
    const project = createProject(
      "project-1",
      "Identical",
      "2026-03-11T10:00:00.000Z",
      "same"
    );
    const clearDirtyProject = vi.fn();

    const ok = await resolveSyncConflictsBeforeSync({
      authUserId: "user-1",
      getDirtyProjectIds: () => ["project-1"],
      loadLocalIndex: () => [
        { id: "project-1", name: "Identical", updatedAt: project.updatedAt },
      ],
      fetchCloudIndex: async () => [
        { id: "project-1", name: "Identical", updatedAt: project.updatedAt },
      ],
      loadLocalProject: () => project,
      fetchCloudProject: async () => project,
      requestResolution: vi.fn(),
      saveCloudProject: vi.fn(async () => true),
      saveLocalProject: vi.fn(),
      clearDirtyProject,
      setSyncStatus: vi.fn(),
      exportBackup: vi.fn(),
    });

    expect(ok).toBe(true);
    expect(clearDirtyProject).toHaveBeenCalledWith("user-1", "project-1");
  });

  it("saves local project to cloud when conflict resolution chooses local", async () => {
    const local = createProject(
      "project-1",
      "Local Wins",
      "2026-03-11T10:00:00.000Z",
      "local"
    );
    const cloud = createProject(
      "project-1",
      "Local Wins",
      "2026-03-11T09:00:00.000Z",
      "cloud"
    );
    const saveCloudProject = vi.fn(async () => true);
    const clearDirtyProject = vi.fn();

    const ok = await resolveSyncConflictsBeforeSync({
      authUserId: "user-1",
      getDirtyProjectIds: () => ["project-1"],
      loadLocalIndex: () => [
        { id: "project-1", name: "Local Wins", updatedAt: local.updatedAt },
      ],
      fetchCloudIndex: async () => [
        { id: "project-1", name: "Local Wins", updatedAt: cloud.updatedAt },
      ],
      loadLocalProject: () => local,
      fetchCloudProject: async () => cloud,
      requestResolution: async () => "local",
      saveCloudProject,
      saveLocalProject: vi.fn(),
      clearDirtyProject,
      setSyncStatus: vi.fn(),
      exportBackup: vi.fn(),
    });

    expect(ok).toBe(true);
    expect(saveCloudProject).toHaveBeenCalledWith(local);
    expect(clearDirtyProject).toHaveBeenCalledWith("user-1", "project-1");
  });

  it("exports backup and aborts sync when conflict resolution chooses export", async () => {
    const local = createProject(
      "project-1",
      "Export Me",
      "2026-03-11T10:00:00.000Z",
      "local"
    );
    const cloud = createProject(
      "project-1",
      "Export Me",
      "2026-03-11T09:00:00.000Z",
      "cloud"
    );
    const exportBackup = vi.fn();
    const setSyncStatus = vi.fn();

    const ok = await resolveSyncConflictsBeforeSync({
      authUserId: "user-1",
      getDirtyProjectIds: () => ["project-1"],
      loadLocalIndex: () => [
        { id: "project-1", name: "Export Me", updatedAt: local.updatedAt },
      ],
      fetchCloudIndex: async () => [
        { id: "project-1", name: "Export Me", updatedAt: cloud.updatedAt },
      ],
      loadLocalProject: () => local,
      fetchCloudProject: async () => cloud,
      requestResolution: async () => "export",
      saveCloudProject: vi.fn(async () => true),
      saveLocalProject: vi.fn(),
      clearDirtyProject: vi.fn(),
      setSyncStatus,
      exportBackup,
    });

    expect(ok).toBe(false);
    expect(exportBackup).toHaveBeenCalledWith(local);
    expect(setSyncStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "error",
        message: expect.stringContaining("Lokal backup exporterad"),
      })
    );
  });

  it("replaces local cache with cloud project when conflict resolution chooses cloud", async () => {
    const local = createProject(
      "project-1",
      "Cloud Wins",
      "2026-03-11T10:00:00.000Z",
      "local"
    );
    const cloud = createProject(
      "project-1",
      "Cloud Wins",
      "2026-03-11T11:00:00.000Z",
      "cloud"
    );
    const saveLocalProject = vi.fn();
    const clearDirtyProject = vi.fn();

    const ok = await resolveSyncConflictsBeforeSync({
      authUserId: "user-1",
      getDirtyProjectIds: () => ["project-1"],
      loadLocalIndex: () => [
        { id: "project-1", name: "Cloud Wins", updatedAt: local.updatedAt },
      ],
      fetchCloudIndex: async () => [
        { id: "project-1", name: "Cloud Wins", updatedAt: cloud.updatedAt },
      ],
      loadLocalProject: () => local,
      fetchCloudProject: async () => cloud,
      requestResolution: async () => "cloud",
      saveCloudProject: vi.fn(async () => true),
      saveLocalProject,
      clearDirtyProject,
      setSyncStatus: vi.fn(),
      exportBackup: vi.fn(),
    });

    expect(ok).toBe(true);
    expect(saveLocalProject).toHaveBeenCalledWith(cloud, "user-1");
    expect(clearDirtyProject).toHaveBeenCalledWith("user-1", "project-1");
  });
});
