import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project, ProjectSummary } from "@/models";
import {
  consumeStorageNotice,
  deleteProject,
  loadProject,
  loadProjectIndex,
  saveProject,
  saveProjectIndex,
} from "./storage";
import { SCHEMA_VERSION } from "@/models";

type StorageMap = Map<string, string>;

class LocalStorageMock {
  private store: StorageMap = new Map();
  private failKeys = new Set<string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
    this.failKeys.clear();
  }

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    if (this.failKeys.has(key)) {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    }
    this.store.set(key, value);
  }

  failOnKey(key: string) {
    this.failKeys.add(key);
  }

  stopFailingOnKey(key: string) {
    this.failKeys.delete(key);
  }
}

const createProject = (
  id: string,
  updatedAt: string,
  name = `Project ${id}`
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
  sessionNotes: "",
  sessionNotesFields: {},
  boards: [],
  squads: [],
  activeBoardId: undefined,
});

describe("storage", () => {
  let localStorageMock: LocalStorageMock;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorageMock = new LocalStorageMock();
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: localStorageMock,
        dispatchEvent: vi.fn(),
      },
      configurable: true,
      writable: true,
    });
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("saves and loads projects using user scope", () => {
    const scopedProject = createProject("alpha", "2026-03-11T10:00:00.000Z");
    const unscopedProject = createProject("alpha", "2026-03-11T11:00:00.000Z");

    saveProject(scopedProject, "user-1");
    saveProject(unscopedProject, null);

    expect(loadProject("alpha", "user-1")).toEqual(scopedProject);
    expect(loadProject("alpha", null)).toEqual(unscopedProject);
    expect(loadProject("alpha", "user-2")).toBeNull();
  });

  it("sorts project index by updatedAt descending and scopes per user", () => {
    const index: ProjectSummary[] = [
      { id: "older", name: "Older", updatedAt: "2026-03-11T09:00:00.000Z" },
      { id: "newer", name: "Newer", updatedAt: "2026-03-11T11:00:00.000Z" },
      { id: "middle", name: "Middle", updatedAt: "2026-03-11T10:00:00.000Z" },
    ];

    saveProjectIndex(index, "user-1");
    saveProjectIndex([{ id: "other", name: "Other", updatedAt: "2026-03-10T10:00:00.000Z" }], "user-2");

    expect(loadProjectIndex("user-1").map((item) => item.id)).toEqual([
      "newer",
      "middle",
      "older",
    ]);
    expect(loadProjectIndex("user-2").map((item) => item.id)).toEqual(["other"]);
  });

  it("frees space by removing the oldest other project when project save hits quota", () => {
    const userId = "user-1";
    const oldest = createProject("oldest", "2026-03-11T08:00:00.000Z");
    const newest = createProject("newest", "2026-03-11T09:00:00.000Z");
    const incoming = createProject("incoming", "2026-03-11T10:00:00.000Z");

    saveProject(oldest, userId);
    saveProject(newest, userId);
    saveProjectIndex(
      [
        { id: oldest.id, name: oldest.name, updatedAt: oldest.updatedAt },
        { id: newest.id, name: newest.name, updatedAt: newest.updatedAt },
      ],
      userId
    );

    localStorageMock.failOnKey(`tacticsboard:project:${userId}:${incoming.id}`);

    const originalSetItem = localStorageMock.setItem.bind(localStorageMock);
    let initialQuotaTriggered = false;
    vi.spyOn(localStorageMock, "setItem").mockImplementation((key, value) => {
      if (
        key === `tacticsboard:project:${userId}:${incoming.id}` &&
        !initialQuotaTriggered
      ) {
        initialQuotaTriggered = true;
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
      localStorageMock.stopFailingOnKey(`tacticsboard:project:${userId}:${incoming.id}`);
      return originalSetItem(key, value);
    });

    saveProject(incoming, userId);

    expect(loadProject("incoming", userId)).toEqual(incoming);
    expect(loadProject("oldest", userId)).toBeNull();
    expect(loadProject("newest", userId)).toEqual(newest);
    expect(loadProjectIndex(userId).map((item) => item.id)).toEqual(["newest"]);
    expect(consumeStorageNotice()).toEqual(
      expect.objectContaining({
        level: "warning",
        message: expect.stringContaining('Projektet "Project oldest" togs bort lokalt'),
      })
    );
  });

  it("removes a project from local storage", () => {
    const project = createProject("delete-me", "2026-03-11T10:00:00.000Z");
    saveProject(project, "user-1");

    deleteProject(project.id, "user-1");

    expect(loadProject(project.id, "user-1")).toBeNull();
  });

  it("warns without throwing on invalid project index data", () => {
    localStorageMock.failOnKey("tacticsboard:projects:user-1");

    saveProjectIndex(
      [{ id: "alpha", name: "Alpha", updatedAt: "2026-03-11T10:00:00.000Z" }],
      "user-1"
    );

    expect(warnSpy).toHaveBeenCalled();
    expect(consumeStorageNotice()).toEqual(
      expect.objectContaining({
        level: "error",
        message: expect.stringContaining("Kunde inte spara projektlistan lokalt"),
      })
    );
    expect(loadProjectIndex("user-1")).toEqual([]);
  });
});
