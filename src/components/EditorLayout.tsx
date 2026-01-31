"use client";

import { useEffect, useMemo, useState } from "react";
import type Konva from "konva";
import { useProjectStore } from "@/state/useProjectStore";
import { useEditorStore } from "@/state/useEditorStore";
import { setStageRef } from "@/utils/stageRef";
import BoardCanvas from "@/board/BoardCanvas";
import Toolbox from "@/components/toolbox/Toolbox";
import PropertiesPanel from "@/components/panels/PropertiesPanel";
import FramesBar from "@/components/frames/FramesBar";
import TopBar from "@/components/TopBar";
import AdBanner from "@/components/AdBanner";

export default function EditorLayout() {
  const project = useProjectStore((state) => state.project);
  const activeBoardId = project?.activeBoardId ?? project?.boards[0]?.id;
  const board = useMemo(
    () => project?.boards.find((item) => item.id === activeBoardId),
    [project, activeBoardId]
  );
  const selection = useEditorStore((state) => state.selection);
  const setAttachBallToPlayer = useEditorStore(
    (state) => state.setAttachBallToPlayer
  );
  const [stage, setStage] = useState<Konva.Stage | null>(null);

  useEffect(() => {
    if (project?.settings) {
      setAttachBallToPlayer(project.settings.attachBallToPlayer);
    }
  }, [project?.id, project?.settings?.attachBallToPlayer, setAttachBallToPlayer]);
  if (!project || !board) {
    return null;
  }

  return (
    <div className="grid h-screen grid-rows-[auto_1fr] overflow-hidden">
      <div className="px-6 pt-4">
        <TopBar />
      </div>
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px] gap-4 px-6 pb-6">
        <div className="relative flex min-h-0 flex-col overflow-visible">
          <div className="relative flex-1 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--panel)] shadow-xl shadow-black/30">
            <BoardCanvas
              board={board}
              onStageReady={(nextStage) => {
                setStage(nextStage);
                setStageRef(nextStage);
              }}
            />
          </div>
          <FramesBar board={board} stage={stage} />
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden pr-1">
          <AdBanner variant="side" />
          <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-[var(--line)] bg-[var(--panel)]/95 p-3 shadow-xl shadow-black/30">
            <Toolbox />
          </div>
          {selection.length > 0 && (
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)]/95 p-4 shadow-xl shadow-black/30">
              <PropertiesPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
