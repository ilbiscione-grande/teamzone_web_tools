"use client";

import { useEffect } from "react";
import { useProjectStore } from "@/state/useProjectStore";
import { syncProjects } from "@/persistence/cloud";

export const useOnlineSync = () => {
  const authUser = useProjectStore((state) => state.authUser);
  const plan = useProjectStore((state) => state.plan);
  const setSyncStatus = useProjectStore((state) => state.setSyncStatus);
  const hydrateIndex = useProjectStore((state) => state.hydrateIndex);

  useEffect(() => {
    if (!authUser || plan !== "PAID") {
      return;
    }

    const handleOnline = () => {
      setSyncStatus({
        state: "syncing",
        updatedAt: new Date().toISOString(),
      });
      syncProjects()
        .then((index) => {
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
