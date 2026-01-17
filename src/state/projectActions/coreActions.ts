import type { StateCreator } from "zustand";
import type { ProjectActions, ProjectStore } from "./types";
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

type CoreActionSlice = Pick<
  ProjectActions,
  | "hydrateIndex"
  | "setPlan"
  | "setAuthUser"
  | "clearAuthUser"
  | "setSyncStatus"
  | "createProject"
  | "openProject"
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
      state.index = can(plan, "project.save") ? loadProjectIndex() : [];
    });
    const { authUser } = get();
    if (authUser) {
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
  setSyncStatus: (status) => {
    set((state) => {
      state.syncStatus = status;
    });
  },
  setAuthUser: (user) => {
    set((state) => {
      state.authUser = user;
      const nextPlan = state.plan === "PAID" ? "PAID" : "AUTH";
      state.plan = nextPlan;
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
      saveProject(project);
      if (get().authUser) {
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
      saveProjectIndex(get().index);
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
    if (can(get().plan, "project.save")) {
      saveProject(project);
      if (get().authUser) {
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
      saveProjectIndex(get().index);
    }
  },
  openProject: (id) => {
    if (get().authUser) {
      fetchProjectCloud(id).then((project) => {
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
          saveProjectIndex(get().index);
        }
      });
      return;
    }
    const project = loadProject(id);
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
      saveProjectIndex(get().index);
    }
  },
  closeProject: () => {
    set((state) => {
      state.project = null;
      state.activeProjectId = null;
    });
  },
  deleteProject: (id) => {
    if (can(get().plan, "project.save")) {
      deleteStoredProject(id);
      if (get().authUser) {
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
      saveProjectIndex(get().index);
    }
  },
  updateProjectMeta: (payload) => {
    const project = get().project;
    if (!project) {
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
