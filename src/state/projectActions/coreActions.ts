import type { StateCreator } from "zustand";
import type { ProjectActions, ProjectStore } from "./types";
import type { Project } from "@/models";
import {
  deleteProject as deleteStoredProject,
  loadProject,
  loadProjectIndex,
  saveProject,
  saveProjectIndex,
} from "@/persistence/storage";
import { createSampleProject } from "@/persistence/sampleData";
import {
  createDefaultProject,
  ensureBoardSquads,
  createSharedProject,
  updateIndex,
} from "@/state/projectHelpers";
import { can, getPlanLimits } from "@/utils/plan";
import { persistAuthUser, persistPlan } from "@/state/useProjectStore";
import {
  deleteProjectCloud,
  fetchProjectCloud,
  saveProjectCloud,
  syncProjects,
} from "@/persistence/cloud";
import { clearOfflineDirtyProject } from "@/persistence/offlineDirty";

type CoreActionSlice = Pick<
  ProjectActions,
  | "hydrateIndex"
  | "setPlan"
  | "setPlanFromProfile"
  | "setAuthUser"
  | "clearAuthUser"
  | "setSyncStatus"
  | "syncNow"
  | "createProject"
  | "openProject"
  | "openProjectReadOnly"
  | "openProjectFromData"
  | "openSharedBoard"
  | "closeProject"
  | "deleteProject"
  | "loadSample"
  | "updateProjectMeta"
>;

export const createCoreActions: StateCreator<
  ProjectStore,
  [["zustand/immer", never]],
  [],
  CoreActionSlice
> = (set, get, _store) => ({
  hydrateIndex: () => {
    set((state) => {
      const plan = state.plan;
      const userId = state.authUser?.id ?? null;
      state.index = can(plan, "project.save") ? loadProjectIndex(userId) : [];
    });
    const { authUser } = get();
    if (authUser && get().plan === "PAID") {
      if (typeof window !== "undefined" && !window.navigator.onLine) {
        set((state) => {
          state.index = loadProjectIndex(authUser.id);
        });
        get().setSyncStatus({
          state: "offline",
          message: "Offline. Will sync when online.",
          updatedAt: new Date().toISOString(),
        });
        return;
      }
      get().setSyncStatus({
        state: "syncing",
        updatedAt: new Date().toISOString(),
      });
      syncProjects()
        .then((index) => {
          set((state) => {
            state.index = index;
          });
          get().setSyncStatus({
            state: "saved",
            updatedAt: new Date().toISOString(),
          });
        })
        .catch(() => {
          get().setSyncStatus({
            state: "error",
            message: "Cloud sync failed.",
            updatedAt: new Date().toISOString(),
          });
        });
    }
  },
  setPlan: (plan) => {
    set((state) => {
      state.plan = plan;
      if (plan === "FREE") {
        state.authUser = null;
        state.syncStatus = {
          state: "idle",
          updatedAt: new Date().toISOString(),
        };
      }
      if (!can(plan, "project.save")) {
        state.index = [];
      }
    });
    if (plan === "FREE") {
      persistAuthUser(null);
    }
    persistPlan(plan);
  },
  setPlanFromProfile: (plan) => {
    set((state) => {
      state.plan = plan;
      if (!can(plan, "project.save")) {
        state.index = [];
      }
    });
    persistPlan(plan);
  },
  setSyncStatus: (status) => {
    set((state) => {
      state.syncStatus = status;
    });
  },
  syncNow: () => {
    const { authUser, plan } = get();
    if (!authUser || plan !== "PAID") {
      return;
    }
    if (typeof window !== "undefined" && !window.navigator.onLine) {
      get().setSyncStatus({
        state: "offline",
        message: "Offline. Will sync when online.",
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    get().setSyncStatus({
      state: "syncing",
      updatedAt: new Date().toISOString(),
    });
    syncProjects()
      .then((index) => {
        set((state) => {
          state.index = index;
        });
        get().setSyncStatus({
          state: "saved",
          updatedAt: new Date().toISOString(),
        });
      })
      .catch(() => {
        get().setSyncStatus({
          state: "error",
          message: "Cloud sync failed.",
          updatedAt: new Date().toISOString(),
        });
      });
  },
  setAuthUser: (user) => {
    set((state) => {
      const prevEmail = state.authUser?.email;
      state.authUser = user;
      const nextPlan = state.plan === "PAID" ? "PAID" : "AUTH";
      state.plan = nextPlan;
      if (prevEmail !== user.email) {
        state.index = [];
        state.project = null;
        state.activeProjectId = null;
      }
      if (!can(nextPlan, "project.save")) {
        state.index = [];
      }
    });
    const nextPlan = get().plan === "PAID" ? "PAID" : "AUTH";
    persistAuthUser(user);
    persistPlan(nextPlan);
  },
  clearAuthUser: () => {
    set((state) => {
      state.authUser = null;
      state.plan = "FREE";
      state.index = [];
      state.project = null;
      state.activeProjectId = null;
      state.syncStatus = {
        state: "idle",
        updatedAt: new Date().toISOString(),
      };
    });
    persistAuthUser(null);
    persistPlan("FREE");
  },
  createProject: (name, options) => {
    const { plan, project: activeProject, index } = get();
    const limits = getPlanLimits(plan);
    const existingIds = new Set(index.map((item) => item.id));
    if (activeProject) {
      existingIds.add(activeProject.id);
    }
    if (existingIds.size >= limits.maxProjects) {
      window.alert("Project limit reached for this plan.");
      return;
    }
    const project = ensureBoardSquads(createDefaultProject(name, options));
    if (can(get().plan, "project.save")) {
      saveProject(project, get().authUser?.id ?? null);
      if (get().authUser && get().plan === "PAID") {
        saveProjectCloud(project);
      }
    }
    set((state) => {
      state.project = project;
      state.activeProjectId = project.id;
      if (can(state.plan, "project.save")) {
        state.index = updateIndex(state.index, project);
      }
    });
    if (can(get().plan, "project.save")) {
      saveProjectIndex(get().index, get().authUser?.id ?? null);
    }
  },
  loadSample: () => {
    const { plan, project: activeProject, index } = get();
    const limits = getPlanLimits(plan);
    const existingIds = new Set(index.map((item) => item.id));
    if (activeProject) {
      existingIds.add(activeProject.id);
    }
    if (existingIds.size >= limits.maxProjects) {
      window.alert("Project limit reached for this plan.");
      return;
    }
    const project = ensureBoardSquads(createSampleProject());
    set((state) => {
      state.project = project;
      state.activeProjectId = project.id;
    });
  },
  openProject: (id) => {
    if (get().authUser && get().plan === "PAID") {
      const localProject = loadProject(id, get().authUser?.id ?? null);
      const legacyLocalProject = loadProject(id, null);
      const applyOpenedProject = (project: Project) => {
        ensureBoardSquads(project);
        set((state) => {
          state.project = project;
          state.activeProjectId = id;
          if (can(state.plan, "project.save")) {
            state.index = updateIndex(state.index, project);
          }
        });
        if (can(get().plan, "project.save")) {
          saveProjectIndex(get().index, get().authUser?.id ?? null);
        }
      };
      // Open immediately from local cache (user-scoped first, then legacy local key)
      // so the Open button always responds even if cloud is slow/unavailable.
      if (localProject) {
        applyOpenedProject(localProject);
      } else if (legacyLocalProject) {
        applyOpenedProject(legacyLocalProject);
      }
      if (typeof window !== "undefined" && !window.navigator.onLine) {
        const project = localProject ?? legacyLocalProject;
        if (!project) {
          return;
        }
        return;
      }
      fetchProjectCloud(id).then((project) => {
        if (!project && !localProject && !legacyLocalProject) {
          return;
        }
        let opened: Project | null = null;
        const bestLocal = localProject ?? legacyLocalProject;
        if (project && bestLocal) {
          const cloudAt = Date.parse(project.updatedAt || project.createdAt || "");
          const localAt = Date.parse(
            bestLocal.updatedAt || bestLocal.createdAt || ""
          );
          const localIsNewer =
            Number.isFinite(localAt) &&
            Number.isFinite(cloudAt) &&
            localAt >= cloudAt;
          const localHasMoreBoards =
            bestLocal.boards.length > project.boards.length;
          opened =
            localIsNewer || localHasMoreBoards
              ? bestLocal
              : project;
          if (opened === bestLocal) {
            saveProjectCloud(bestLocal);
          } else {
            saveProject(project, get().authUser?.id ?? null);
          }
        } else {
          opened = project ?? bestLocal;
        }
        if (!opened) {
          return;
        }
        // Avoid duplicate state updates when we already opened identical local data.
        const current = get().project;
        if (!current || current.id !== opened.id || current.updatedAt !== opened.updatedAt) {
          applyOpenedProject(opened);
        }
      });
      return;
    }
    const project = loadProject(id, get().authUser?.id ?? null);
    if (!project) {
      return;
    }
    ensureBoardSquads(project);
    set((state) => {
      state.project = project;
      state.activeProjectId = id;
      if (can(state.plan, "project.save")) {
        state.index = updateIndex(state.index, project);
      }
    });
    if (can(get().plan, "project.save")) {
      saveProjectIndex(get().index, get().authUser?.id ?? null);
    }
  },
  openProjectFromData: (project) => {
    ensureBoardSquads(project);
    if (can(get().plan, "project.save")) {
      saveProject(project, get().authUser?.id ?? null);
      if (get().authUser && get().plan === "PAID") {
        void saveProjectCloud(project).catch(() => undefined);
      }
    }
    set((state) => {
      state.project = project;
      state.activeProjectId = project.id;
      if (can(state.plan, "project.save")) {
        state.index = updateIndex(state.index, project);
      }
    });
    if (can(get().plan, "project.save")) {
      saveProjectIndex(get().index, get().authUser?.id ?? null);
    }
  },
  openProjectReadOnly: (project: Project) => {
    ensureBoardSquads(project);
    set((state) => {
      state.project = project;
      state.activeProjectId = project.id;
    });
  },
  openSharedBoard: (share) => {
    const project = createSharedProject(share.boardData, {
      shareId: share.id,
      ownerEmail: share.ownerEmail,
      permission: share.permission,
      projectName: share.projectName,
      boardId: share.boardId,
    });
    set((state) => {
      state.project = project;
      state.activeProjectId = project.id;
    });
  },
  closeProject: async () => {
    const snapshot = get();
    const active = snapshot.project;
    if (
      active &&
      !active.isSample &&
      !active.isShared &&
      can(snapshot.plan, "project.save")
    ) {
      const userId = snapshot.authUser?.id ?? null;
      saveProject(active, userId);
      saveProjectIndex(updateIndex(snapshot.index, active), userId);
      if (
        snapshot.authUser &&
        snapshot.authUser.id &&
        snapshot.plan === "PAID" &&
        (typeof window === "undefined" || window.navigator.onLine)
      ) {
        get().setSyncStatus({
          state: "syncing",
          updatedAt: new Date().toISOString(),
        });
        const ok = await saveProjectCloud(active);
        if (ok) {
          clearOfflineDirtyProject(snapshot.authUser.id, active.id);
        }
        get().setSyncStatus({
          state: ok ? "saved" : "error",
          message: ok ? undefined : "Cloud save failed.",
          updatedAt: new Date().toISOString(),
        });
      }
    }
    set((state) => {
      state.project = null;
      state.activeProjectId = null;
    });
  },
  deleteProject: (id) => {
    if (can(get().plan, "project.save")) {
      deleteStoredProject(id, get().authUser?.id ?? null);
      if (get().authUser && get().plan === "PAID") {
        deleteProjectCloud(id);
      }
    }
    set((state) => {
      state.index = can(state.plan, "project.save")
        ? state.index.filter((item) => item.id !== id)
        : [];
      if (state.activeProjectId === id) {
        state.project = null;
        state.activeProjectId = null;
      }
    });
    if (can(get().plan, "project.save")) {
      saveProjectIndex(get().index, get().authUser?.id ?? null);
    }
  },
  updateProjectMeta: (payload) => {
    const project = get().project;
    if (!project) {
      return;
    }
    if (project.isShared) {
      return;
    }
    set((state) => {
      if (!state.project) {
        return;
      }
      state.project = { ...state.project, ...payload };
      state.project.updatedAt = new Date().toISOString();
      if (can(state.plan, "project.save")) {
        state.index = updateIndex(state.index, state.project);
      }
    });
  },
});
