import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ProjectSummary, Project, Plan, AuthUser } from "@/models";
import { saveProject, saveProjectIndex } from "@/persistence/storage";
import { saveProjectCloud } from "@/persistence/cloud";
import { createProjectActions, type ProjectActions } from "@/state/projectActions";
import { updateIndex } from "@/state/projectHelpers";
import { can } from "@/utils/plan";

const PLAN_KEY = "tacticsboard:plan";
const AUTH_USER_KEY = "tacticsboard:authUser";
const PLAN_CHECK_KEY = "tacticsboard:planCheckAt";
const PLAN_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

const loadAuthUser = (): AuthUser | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(AUTH_USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

const loadPlan = (authUser: AuthUser | null): Plan => {
  if (typeof window === "undefined") {
    return "FREE";
  }
  if (!authUser) {
    return "FREE";
  }
  const stored = window.localStorage.getItem(PLAN_KEY) as Plan | null;
  const lastCheck = Number(window.localStorage.getItem(PLAN_CHECK_KEY) ?? 0);
  if (stored) {
    if (stored === "PAID" && lastCheck && Date.now() - lastCheck > PLAN_GRACE_MS) {
      return "AUTH";
    }
    return stored;
  }
  return "AUTH";
};

export type ProjectState = {
  index: ProjectSummary[];
  activeProjectId: string | null;
  project: Project | null;
  plan: Plan;
  authUser: AuthUser | null;
  syncStatus: {
    state: "idle" | "syncing" | "saved" | "error" | "offline";
    message?: string;
    updatedAt: string;
  };
} & ProjectActions;

export const useProjectStore = create<ProjectState>()(
  immer((set, get, store) => {
    const authUser = loadAuthUser();
    return {
    index: [],
    activeProjectId: null,
    project: null,
    plan: loadPlan(authUser),
    authUser,
    syncStatus: {
      state: "idle",
      updatedAt: new Date().toISOString(),
    },
    ...createProjectActions(set, get, store),
    };
  })
);

export const persistActiveProject = () => {
  const { project, index, plan, authUser } = useProjectStore.getState();
  if (!project) {
    return;
  }
  if (!can(plan, "project.save")) {
    return;
  }
  saveProject(project);
  saveProjectIndex(updateIndex(index, project));
  if (authUser && plan === "PAID") {
    if (typeof window !== "undefined" && !window.navigator.onLine) {
      useProjectStore.getState().setSyncStatus({
        state: "offline",
        message: "Offline. Will sync when online.",
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    useProjectStore.getState().setSyncStatus({
      state: "syncing",
      updatedAt: new Date().toISOString(),
    });
    saveProjectCloud(project).then((ok) => {
      useProjectStore.getState().setSyncStatus({
        state: ok ? "saved" : "error",
        message: ok ? undefined : "Cloud save failed.",
        updatedAt: new Date().toISOString(),
      });
    });
  }
};

export const persistPlan = (plan: Plan) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(PLAN_KEY, plan);
};

export const persistPlanCheck = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(PLAN_CHECK_KEY, String(Date.now()));
};

export const persistAuthUser = (user: AuthUser | null) => {
  if (typeof window === "undefined") {
    return;
  }
  if (!user) {
    window.localStorage.removeItem(AUTH_USER_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
};
