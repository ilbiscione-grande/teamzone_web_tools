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
import { requestSyncConflictResolution } from "@/persistence/syncConflictBridge";

const sameProjectContent = (a: Project, b: Project) =>
  serializeProject(a) === serializeProject(b);

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

    const resolveConflictsBeforeSync = async () => {
      if (!authUser) {
        return true;
      }
      const localIndex = loadProjectIndex(authUser.id);
      const cloudIndex = await fetchProjectIndexCloud();
      const cloudIds = new Set(cloudIndex.map((item) => item.id));

      for (const localSummary of localIndex) {
        if (!cloudIds.has(localSummary.id)) {
          continue;
        }
        const local = loadProject(localSummary.id, authUser.id);
        const cloud = await fetchProjectCloud(localSummary.id);
        if (!local || !cloud) {
          continue;
        }
        if (sameProjectContent(local, cloud)) {
          continue;
        }

        const choice = await requestSyncConflictResolution({
          projectName: local.name,
        });

        if (choice === "local") {
          const ok = await saveProjectCloud(local);
          if (!ok) {
            setSyncStatus({
              state: "error",
              message: `Kunde inte skriva över cloud för ${local.name}.`,
              updatedAt: new Date().toISOString(),
            });
            return false;
          }
          continue;
        }

        if (choice === "export") {
          downloadBackup(local);
          setSyncStatus({
            state: "error",
            message: `Sync avbruten. Lokal backup exporterad för ${local.name}.`,
            updatedAt: new Date().toISOString(),
          });
          return false;
        }

        // Default: keep cloud; replace local cache for this project.
        saveProject(cloud, authUser.id);
      }

      return true;
    };

    const handleOnline = () => {
      if (resolving) {
        return;
      }
      resolving = true;
      setSyncStatus({
        state: "syncing",
        updatedAt: new Date().toISOString(),
      });
      resolveConflictsBeforeSync()
        .then((ok) => {
          if (!ok) {
            return null;
          }
          return syncProjects();
        })
        .then((index) => {
          if (!index) {
            return;
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
