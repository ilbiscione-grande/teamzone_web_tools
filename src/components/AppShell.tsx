"use client";

import { useEffect, useRef, useState } from "react";
import type { DrawableObject } from "@/models";
import { useProjectStore } from "@/state/useProjectStore";
import { useAutosave } from "@/persistence/useAutosave";
import { useOnlineSync } from "@/persistence/useOnlineSync";
import ProjectList from "@/components/ProjectList";
import EditorLayout from "@/components/EditorLayout";
import { getActiveBoard } from "@/utils/board";
import { useEditorStore } from "@/state/useEditorStore";
import { clone } from "@/utils/clone";
import { createId } from "@/utils/id";
import {
  registerSyncConflictHandler,
  type SyncConflictChoice,
} from "@/persistence/syncConflictBridge";

export default function AppShell() {
  const project = useProjectStore((state) => state.project);
  const hydrateIndex = useProjectStore((state) => state.hydrateIndex);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullReady, setPullReady] = useState(false);
  const [pullActive, setPullActive] = useState(false);
  const touchStartRef = useRef<number | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const clipboardRef = useRef<DrawableObject[]>([]);
  const [syncConflict, setSyncConflict] = useState<{
    projectName: string;
    resolve: (choice: SyncConflictChoice) => void;
  } | null>(null);

  useEffect(() => {
    hydrateIndex();
  }, [hydrateIndex]);

  useAutosave();
  useOnlineSync();

  useEffect(() => {
    const unregister = registerSyncConflictHandler(
      ({ projectName }) =>
        new Promise<SyncConflictChoice>((resolve) => {
          setSyncConflict({ projectName, resolve });
        })
    );
    return () => unregister();
  }, []);

  useEffect(() => {
    const threshold = 80;
    const maxPull = 120;
    const handleTouchStart = (event: TouchEvent) => {
      if (window.scrollY > 0) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-disable-pull]")) {
        return;
      }
      if (target?.closest("[data-scrollable]")) {
        return;
      }
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      touchStartRef.current = touch.clientY;
      setPullActive(true);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!pullActive || touchStartRef.current === null) {
        return;
      }
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      const distance = touch.clientY - touchStartRef.current;
      if (distance <= 0) {
        return;
      }
      event.preventDefault();
      const nextDistance = Math.min(distance, maxPull);
      setPullDistance(nextDistance);
      setPullReady(nextDistance >= threshold);
    };

    const resetPull = () => {
      touchStartRef.current = null;
      setPullActive(false);
      setPullReady(false);
      setPullDistance(0);
    };

    const handleTouchEnd = () => {
      if (pullReady) {
        setPullDistance(threshold);
        window.location.reload();
        return;
      }
      resetPull();
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [pullActive, pullReady]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(display-mode: standalone)");
    const update = () =>
      setIsStandalone(
        media.matches ||
          (window.navigator as { standalone?: boolean }).standalone === true
      );
    update();
    if ("addEventListener" in media) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    const legacyMedia = media as MediaQueryList & {
      addListener?: (listener: () => void) => void;
      removeListener?: (listener: () => void) => void;
    };
    legacyMedia.addListener?.(update);
    return () => legacyMedia.removeListener?.(update);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          (target as HTMLElement).isContentEditable)
      ) {
        return;
      }
      const project = useProjectStore.getState().project;
      if (!project) {
        return;
      }
      const board = getActiveBoard(project);
      if (!board) {
        return;
      }
      if (project.isShared) {
        return;
      }
      const selection = useEditorStore.getState().selection;
      const selectedLinkId = useEditorStore.getState().selectedLinkId;
      const frameIndex = board.activeFrameIndex ?? 0;
      const objects = board.frames[frameIndex]?.objects ?? [];

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        if (selection.length === 0) {
          return;
        }
        const copied = selection
          .map((id) => objects.find((item) => item.id === id))
          .filter((item): item is DrawableObject => Boolean(item))
          .map((item) => clone(item));
        clipboardRef.current = copied;
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
        if (!clipboardRef.current || clipboardRef.current.length === 0) {
          return;
        }
        useEditorStore.getState().pushHistory(clone(objects));
        clipboardRef.current.forEach((item) => {
          const duplicated = clone(item);
          duplicated.id = createId();
          useProjectStore
            .getState()
            .addObject(board.id, frameIndex, duplicated);
        });
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        if (board.mode !== "DYNAMIC") {
          return;
        }
        event.preventDefault();
        const nextIndex =
          event.key === "ArrowRight"
            ? Math.min(board.frames.length - 1, frameIndex + 1)
            : Math.max(0, frameIndex - 1);
        useProjectStore.getState().setActiveFrameIndex(board.id, nextIndex);
        useEditorStore.getState().setPlayheadFrame(nextIndex);
        return;
      }

      if (event.key === " " || event.code === "Space") {
        if (board.mode !== "DYNAMIC") {
          return;
        }
        event.preventDefault();
        const editorState = useEditorStore.getState();
        if (event.metaKey || event.ctrlKey) {
          useProjectStore.getState().setActiveFrameIndex(board.id, 0);
          editorState.setPlayheadFrame(0);
          window.dispatchEvent(new CustomEvent("tacticsboard:record"));
          return;
        }
        if (editorState.isPlaying) {
          editorState.setPlaying(false);
          return;
        }
        const lastIndex = Math.max(0, board.frames.length - 1);
        const currentFrame = editorState.playheadFrame;
        const atEnd = Math.floor(currentFrame) >= lastIndex;
        if (atEnd) {
          useProjectStore.getState().setActiveFrameIndex(board.id, 0);
          editorState.setPlayheadFrame(0);
        } else {
          useProjectStore
            .getState()
            .setActiveFrameIndex(board.id, Math.floor(currentFrame));
        }
        editorState.setPlaying(true);
        return;
      }

      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }
      const deleteSelection = useEditorStore.getState().selection;
      if (deleteSelection.length === 0 && !selectedLinkId) {
        return;
      }
      useEditorStore.getState().pushHistory(clone(objects));
      deleteSelection.forEach((id) => {
        useProjectStore.getState().removeObject(board.id, frameIndex, id);
      });
      if (selectedLinkId) {
        const frameLinks =
          board.frames[frameIndex]?.playerLinks ?? board.playerLinks ?? [];
        const nextLinks = frameLinks.filter(
          (link) => link.id !== selectedLinkId
        );
        const nextFrames = board.frames.map((frame, index) =>
          index === frameIndex ? { ...frame, playerLinks: nextLinks } : frame
        );
        useProjectStore.getState().updateBoard(board.id, {
          frames: nextFrames,
        });
        useEditorStore.getState().setSelectedLinkId(null);
      }
      useEditorStore.getState().setSelection([]);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="min-h-screen text-foreground">
      <div className="pointer-events-none fixed left-1/2 top-0 z-50 -translate-x-1/2">
        <div
          className="mt-2 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--ink-1)] shadow-lg shadow-black/30 transition-all"
          style={{
            transform: `translateY(${Math.min(pullDistance, 80)}px)`,
            opacity: pullDistance > 0 ? 1 : 0,
          }}
        >
          {pullReady ? "Release to refresh" : "Pull to refresh"}
        </div>
      </div>
      {isStandalone && (
        <button
          className="fixed right-4 top-4 z-50 rounded-full border border-white/20 bg-black/40 p-2 text-[var(--ink-0)] shadow-lg shadow-black/30 backdrop-blur"
          onClick={() => {
            if (!window.confirm("Close the app?")) {
              return;
            }
            window.close();
          }}
          title="Close app"
          aria-label="Close app"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12" />
            <path d="M18 6l-12 12" />
          </svg>
        </button>
      )}
      {project ? <EditorLayout /> : <ProjectList />}
      {syncConflict && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5 text-[var(--ink-0)] shadow-2xl shadow-black/40">
            <h2 className="display-font text-lg text-[var(--accent-0)]">
              Sync conflict detected
            </h2>
            <p className="mt-2 text-sm text-[var(--ink-1)]">
              Project: <span className="text-[var(--ink-0)]">{syncConflict.projectName}</span>
            </p>
            <p className="mt-2 text-xs text-[var(--ink-1)]">
              Local offline changes differ from cloud. Choose how to proceed.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                className="h-10 rounded-full border border-[var(--line)] text-sm hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                onClick={() => {
                  syncConflict.resolve("cloud");
                  setSyncConflict(null);
                }}
              >
                Keep cloud version
              </button>
              <button
                className="h-10 rounded-full border border-[var(--accent-0)] bg-[var(--accent-0)] text-sm font-semibold text-black hover:brightness-110"
                onClick={() => {
                  syncConflict.resolve("local");
                  setSyncConflict(null);
                }}
              >
                Overwrite cloud with local
              </button>
              <button
                className="h-10 rounded-full border border-[var(--line)] text-sm hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                onClick={() => {
                  syncConflict.resolve("export");
                  setSyncConflict(null);
                }}
              >
                Export local backup and abort sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
