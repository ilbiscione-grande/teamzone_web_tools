"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

export default function EditorLayout() {
  const project = useProjectStore((state) => state.project);
  const activeBoardId = project?.activeBoardId ?? project?.boards[0]?.id;
  const board = useMemo(
    () => project?.boards.find((item) => item.id === activeBoardId),
    [project, activeBoardId]
  );
  const modeLabel =
    project?.settings?.mode ?? ("match" as "training" | "match" | "education");
  const modeText = modeLabel.charAt(0).toUpperCase() + modeLabel.slice(1);
  const selection = useEditorStore((state) => state.selection);
  const setAttachBallToPlayer = useEditorStore(
    (state) => state.setAttachBallToPlayer
  );
  const updateProjectMeta = useProjectStore((state) => state.updateProjectMeta);
  const updateBoard = useProjectStore((state) => state.updateBoard);
  const [stage, setStage] = useState<Konva.Stage | null>(null);
  const [propertiesFloating, setPropertiesFloating] = useState(false);
  const [propertiesPos, setPropertiesPos] = useState({ x: 24, y: 140 });
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showMaximizedNotes, setShowMaximizedNotes] = useState(false);
  const [maximizedNotesScope, setMaximizedNotesScope] = useState<
    "session" | "board"
  >("board");

  useEffect(() => {
    if (project?.settings) {
      setAttachBallToPlayer(project.settings.attachBallToPlayer);
    }
  }, [project?.id, project?.settings?.attachBallToPlayer, setAttachBallToPlayer]);
  useEffect(() => {
    if (!propertiesFloating || typeof window === "undefined") {
      return;
    }
    setPropertiesPos((prev) => {
      if (prev.x !== 24 || prev.y !== 140) {
        return prev;
      }
      return {
        x: Math.max(24, window.innerWidth - 360),
        y: 140,
      };
    });
  }, [propertiesFloating]);

  useEffect(() => {
    if (!propertiesFloating) {
      return;
    }
    const handleMove = (event: PointerEvent) => {
      if (!draggingRef.current || !dragOffsetRef.current) {
        return;
      }
      const nextX = event.clientX - dragOffsetRef.current.x;
      const nextY = event.clientY - dragOffsetRef.current.y;
      const maxX = window.innerWidth - 320;
      const maxY = window.innerHeight - 160;
      setPropertiesPos({
        x: Math.min(Math.max(8, nextX), Math.max(8, maxX)),
        y: Math.min(Math.max(8, nextY), Math.max(8, maxY)),
      });
    };
    const handleUp = () => {
      draggingRef.current = false;
      dragOffsetRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [propertiesFloating]);
  const toolboxCollapsed = selection.length > 0 && !propertiesFloating;
  if (!project || !board) {
    return null;
  }

  if (isMaximized && board) {
    const scopedNotes =
      maximizedNotesScope === "session" ? project.sessionNotes : board.notes;
    return (
      <div className="fixed inset-0 z-50 flex h-screen flex-col bg-[var(--panel)]">
        <div
          className={`relative flex-1 overflow-hidden ${
            showMaximizedNotes ? "grid grid-cols-[minmax(0,1fr)_360px] gap-3 p-3" : ""
          }`}
        >
          {showMaximizedNotes && (
            <div className="relative min-h-0 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--panel)]">
              <BoardCanvas
                board={board}
                onStageReady={(nextStage) => {
                  setStage(nextStage);
                  setStageRef(nextStage);
                }}
                isMaximized={isMaximized}
                onToggleMaximize={() => setIsMaximized(false)}
              />
            </div>
          )}
          {showMaximizedNotes && (
            <div className="min-h-0 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-3">
              <div className="mb-3 inline-flex rounded-full border border-[var(--line)] bg-[var(--panel-2)] p-1">
                <button
                  className={`rounded-full px-3 py-1 text-xs ${
                    maximizedNotesScope === "session"
                      ? "bg-[var(--accent-1)] text-[var(--ink-0)]"
                      : "text-[var(--ink-1)]"
                  }`}
                  onClick={() => setMaximizedNotesScope("session")}
                >
                  Session
                </button>
                <button
                  className={`rounded-full px-3 py-1 text-xs ${
                    maximizedNotesScope === "board"
                      ? "bg-[var(--accent-1)] text-[var(--ink-0)]"
                      : "text-[var(--ink-1)]"
                  }`}
                  onClick={() => setMaximizedNotesScope("board")}
                >
                  Board
                </button>
              </div>
              <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
                <textarea
                  className="h-36 w-full resize-none rounded-2xl border border-[var(--line)] bg-transparent px-3 py-2 text-sm text-[var(--ink-0)]"
                  value={scopedNotes ?? ""}
                  onChange={(event) => {
                    if (maximizedNotesScope === "session") {
                      updateProjectMeta({ sessionNotes: event.target.value });
                    } else {
                      updateBoard(board.id, { notes: event.target.value });
                    }
                  }}
                />
                <div className="min-h-0 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/40 p-3 text-sm text-[var(--ink-0)]">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                    {scopedNotes ?? ""}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
          {!showMaximizedNotes && (
            <>
              <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-full border border-[var(--line)] bg-[var(--panel-2)]/80 px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--accent-2)]">
                {modeText}
              </div>
              <BoardCanvas
                board={board}
                onStageReady={(nextStage) => {
                  setStage(nextStage);
                  setStageRef(nextStage);
                }}
                isMaximized={isMaximized}
                onToggleMaximize={() => setIsMaximized(false)}
              />
            </>
          )}
          <div className="absolute right-4 top-4 z-30 flex gap-2">
            <button
              className={`rounded-full border px-3 py-1 text-xs ${
                showMaximizedNotes
                  ? "border-[var(--accent-2)] bg-[var(--panel-2)] text-[var(--accent-2)]"
                  : "border-[var(--line)] bg-[var(--panel-2)]/70 text-[var(--ink-1)]"
              }`}
              onClick={() => setShowMaximizedNotes((prev) => !prev)}
            >
              {showMaximizedNotes ? "Hide notes" : "Show notes"}
            </button>
          </div>
        </div>
        {board.mode === "DYNAMIC" && (
          <div className="px-4 pb-4">
            <FramesBar board={board} stage={stage} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid h-screen grid-rows-[auto_1fr] overflow-hidden">
      <div className="px-6 pt-4">
        <TopBar />
      </div>
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px] gap-4 px-6 pb-6">
        <div className="relative flex min-h-0 flex-col overflow-visible">
          <div className="relative flex-1 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--panel)] shadow-xl shadow-black/30">
            <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-full border border-[var(--line)] bg-[var(--panel-2)]/80 px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--accent-2)]">
              {modeText}
            </div>
            <BoardCanvas
              board={board}
              onStageReady={(nextStage) => {
                setStage(nextStage);
                setStageRef(nextStage);
              }}
              isMaximized={isMaximized}
              onToggleMaximize={() => setIsMaximized(true)}
            />
          </div>
          <FramesBar board={board} stage={stage} />
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden pr-1">
          <AdBanner variant="side" />
          <div
            className={`flex flex-col rounded-3xl border border-[var(--line)] bg-[var(--panel)]/95 p-3 shadow-xl shadow-black/30 ${
              toolboxCollapsed ? "flex-none" : "min-h-0 flex-1"
            }`}
          >
            <Toolbox collapsed={toolboxCollapsed} />
          </div>
          {selection.length > 0 && !propertiesFloating && (
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)]/95 p-4 shadow-xl shadow-black/30">
              <PropertiesPanel
                floating={propertiesFloating}
                onToggleFloating={() =>
                  setPropertiesFloating((prev) => !prev)
                }
              />
            </div>
          )}
        </div>
      </div>
      {selection.length > 0 && propertiesFloating && (
        <div
          className="fixed z-40 w-[320px] rounded-3xl border border-[var(--line)] bg-[var(--panel)]/95 p-4 shadow-2xl shadow-black/40"
          style={{ left: propertiesPos.x, top: propertiesPos.y }}
        >
          <div
            className="mb-3 h-4 w-full cursor-move rounded-full bg-[var(--panel-2)]/70"
            onPointerDown={(event) => {
              draggingRef.current = true;
              dragOffsetRef.current = {
                x: event.clientX - propertiesPos.x,
                y: event.clientY - propertiesPos.y,
              };
            }}
          />
          <PropertiesPanel
            floating={propertiesFloating}
            onToggleFloating={() =>
              setPropertiesFloating((prev) => !prev)
            }
          />
        </div>
      )}
    </div>
  );
}
