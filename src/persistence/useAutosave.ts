"use client";

import { useEffect, useMemo } from "react";
import { useProjectStore, persistActiveProject } from "@/state/useProjectStore";
import { debounce } from "@/utils/debounce";
import { can } from "@/utils/plan";

export const useAutosave = () => {
  const project = useProjectStore((state) => state.project);
  const plan = useProjectStore((state) => state.plan);
  const debouncedSave = useMemo(
    () => debounce(() => persistActiveProject(), 500),
    []
  );

  useEffect(() => {
    if (!project) {
      return;
    }
    if (!can(plan, "project.save")) {
      return;
    }
    debouncedSave();
  }, [project, plan, debouncedSave]);

  useEffect(() => {
    if (!project) {
      return;
    }
    if (!can(plan, "project.save")) {
      return;
    }
    const timer = window.setInterval(() => {
      persistActiveProject();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [project, plan]);

  useEffect(() => {
    if (!project) {
      return;
    }
    if (!can(plan, "project.save")) {
      return;
    }
    const flush = () => persistActiveProject();
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [project, plan]);
};
