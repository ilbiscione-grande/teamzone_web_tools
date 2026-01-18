"use client";

import { useEffect } from "react";
import { useProjectStore } from "@/state/useProjectStore";
import { useAutosave } from "@/persistence/useAutosave";
import { useOnlineSync } from "@/persistence/useOnlineSync";
import ProjectList from "@/components/ProjectList";
import EditorLayout from "@/components/EditorLayout";

export default function AppShell() {
  const project = useProjectStore((state) => state.project);
  const hydrateIndex = useProjectStore((state) => state.hydrateIndex);

  useEffect(() => {
    hydrateIndex();
  }, [hydrateIndex]);

  useAutosave();
  useOnlineSync();

  return (
    <div className="min-h-screen text-foreground">
      {project ? <EditorLayout /> : <ProjectList />}
    </div>
  );
}
