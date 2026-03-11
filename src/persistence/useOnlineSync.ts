"use client";

import { useEffect } from "react";
import { useProjectStore } from "@/state/useProjectStore";
import {
  fetchProjectCloud,
  fetchProjectIndexCloud,
  saveProjectCloud,
  syncProjects,
} from "@/persistence/cloud";
import { loadProject, loadProjectIndex, saveProject } from "@/persistence/storage";
import { serializeProject } from "@/persistence/serialize";
import type { Project } from "@/models";
import {
  requestSyncConflictResolution,
  type SyncConflictChoice,
} from "@/persistence/syncConflictBridge";
import {
  clearAllOfflineDirtyProjects,
  clearOfflineDirtyProject,
  getOfflineDirtyProjectIds,
} from "@/persistence/offlineDirty";

const sameProjectContent = (a: Project, b: Project) =>
  serializeProject(a) === serializeProject(b);
const DEEP_SYNC_COOLDOWN_MS = 10 * 60 * 1000;
const getDeepSyncKey = (userId: string) =>
  `tacticsboard:lastDeepSyncAt:${userId}`;

const downloadBackup = (project: Project) => {
  const data = serializeProject(project);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${project.name.replace(/\s+/g, "_")}_offline_backup.json`;
  link.click();
  URL.revokeObjectURL(url);
};

type ResolveSyncConflictsDeps = {
  authUserId: string | null | undefined;
  getDirtyProjectIds: (userId: string) => string[];
  loadLocalIndex: (userId: string) => { id: string; name: string; updatedAt: string }[];
  fetchCloudIndex: () => Promise<{ id: string; name: string; updatedAt: string }[]>;
  loadLocalProject: (projectId: string, userId: string) => Project | null;
  fetchCloudProject: (projectId: string) => Promise<Project | null>;
  requestResolution: (payload: { projectName: string }) => Promise<SyncConflictChoice>;
  saveCloudProject: (project: Project) => Promise<boolean>;
  saveLocalProject: (project: Project, userId: string) => void;
  clearDirtyProject: (userId: string, projectId: string) => void;
  setSyncStatus: (status: {
    state: "idle" | "syncing" | "saved" | "error" | "offline";
    message?: string;
    updatedAt: string;
  }) => void;
  exportBackup: (project: Project) => void;
};

export const resolveSyncConflictsBeforeSync = async ({
  authUserId,
  getDirtyProjectIds,
  loadLocalIndex,
  fetchCloudIndex,
  loadLocalProject,
  fetchCloudProject,
  requestResolution,
  saveCloudProject,
  saveLocalProject,
  clearDirtyProject,
  setSyncStatus,
  exportBackup,
}: ResolveSyncConflictsDeps): Promise<boolean> => {
  if (!authUserId) {
    return true;
  }
  const userId = authUserId;
  const dirtyIds = new Set(getDirtyProjectIds(userId));
  if (dirtyIds.size === 0) {
    return true;
  }
  const localIndex = loadLocalIndex(userId);
  const cloudIndex = await fetchCloudIndex();
  const cloudIds = new Set(cloudIndex.map((item) => item.id));

  for (const localSummary of localIndex) {
    if (!dirtyIds.has(localSummary.id)) {
      continue;
    }
    if (!cloudIds.has(localSummary.id)) {
      continue;
    }
    const local = loadLocalProject(localSummary.id, userId);
    const cloud = await fetchCloudProject(localSummary.id);
    if (!local || !cloud) {
      continue;
    }
    if (sameProjectContent(local, cloud)) {
      clearDirtyProject(userId, localSummary.id);
      continue;
    }

    const choice = await requestResolution({
      projectName: local.name,
    });

    if (choice === "local") {
      const ok = await saveCloudProject(local);
      if (!ok) {
        setSyncStatus({
          state: "error",
          message: `Kunde inte skriva över cloud för ${local.name}.`,
          updatedAt: new Date().toISOString(),
        });
        return false;
      }
      clearDirtyProject(userId, localSummary.id);
      continue;
    }

    if (choice === "export") {
      exportBackup(local);
      setSyncStatus({
        state: "error",
        message: `Sync avbruten. Lokal backup exporterad för ${local.name}.`,
        updatedAt: new Date().toISOString(),
      });
      return false;
    }

    saveLocalProject(cloud, userId);
    clearDirtyProject(userId, localSummary.id);
  }

  return true;
};

export const useOnlineSync = () => {
  const authUser = useProjectStore((state) => state.authUser);
  const plan = useProjectStore((state) => state.plan);
  const setSyncStatus = useProjectStore((state) => state.setSyncStatus);
  const hydrateIndex = useProjectStore((state) => state.hydrateIndex);

  useEffect(() => {
    if (!authUser || plan !== "PAID") {
      return;
    }

    let resolving = false;

    const handleOnline = () => {
      if (resolving) {
        return;
      }
      resolving = true;
      setSyncStatus({
        state: "syncing",
        updatedAt: new Date().toISOString(),
      });
      resolveSyncConflictsBeforeSync({
        authUserId: authUser?.id,
        getDirtyProjectIds: getOfflineDirtyProjectIds,
        loadLocalIndex: loadProjectIndex,
        fetchCloudIndex: fetchProjectIndexCloud,
        loadLocalProject: loadProject,
        fetchCloudProject: fetchProjectCloud,
        requestResolution: requestSyncConflictResolution,
        saveCloudProject: saveProjectCloud,
        saveLocalProject: saveProject,
        clearDirtyProject: clearOfflineDirtyProject,
        setSyncStatus,
        exportBackup: downloadBackup,
      })
        .then((ok) => {
          if (!ok) {
            return null;
          }
          const userId = authUser.id;
          if (!userId) {
            return syncProjects();
          }
          const dirtyIds = userId ? getOfflineDirtyProjectIds(userId) : [];
          if (
            typeof window !== "undefined" &&
            dirtyIds.length === 0
          ) {
            const last = Number(
              window.localStorage.getItem(getDeepSyncKey(userId)) ?? 0
            );
            if (Number.isFinite(last) && Date.now() - last < DEEP_SYNC_COOLDOWN_MS) {
              return [];
            }
          }
          return syncProjects();
        })
        .then((index) => {
          if (!index) {
            return;
          }
          const userId = authUser.id;
          if (userId) {
            clearAllOfflineDirtyProjects(userId);
            if (typeof window !== "undefined") {
              window.localStorage.setItem(
                getDeepSyncKey(userId),
                String(Date.now())
              );
            }
          }
          hydrateIndex();
          setSyncStatus({
            state: "saved",
            updatedAt: new Date().toISOString(),
          });
        })
        .catch(() => {
          setSyncStatus({
            state: "error",
            message: "Cloud sync failed.",
            updatedAt: new Date().toISOString(),
          });
        })
        .finally(() => {
          resolving = false;
        });
    };

    if (typeof window !== "undefined" && window.navigator.onLine) {
      handleOnline();
    }

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [authUser, plan, hydrateIndex, setSyncStatus]);
};
