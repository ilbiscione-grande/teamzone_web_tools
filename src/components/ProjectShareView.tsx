"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useProjectStore } from "@/state/useProjectStore";
import { useEditorStore } from "@/state/useEditorStore";
import { fetchProjectShareLink } from "@/persistence/projectShareLinks";
import BoardCanvas from "@/board/BoardCanvas";
import type { Project } from "@/models";

type ProjectShareViewProps = {
  token?: string;
};

export default function ProjectShareView({ token }: ProjectShareViewProps) {
  const params = useParams();
  const paramToken =
    params && typeof params === "object" && "token" in params
      ? (Array.isArray(params.token) ? params.token[0] : params.token)
      : undefined;
  const resolvedToken = token ?? paramToken ?? "";
  const openProjectReadOnly = useProjectStore(
    (state) => state.openProjectReadOnly
  );
  const project = useProjectStore((state) => state.project);
  const setActiveBoard = useProjectStore((state) => state.setActiveBoard);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setPlaying = useEditorStore((state) => state.setPlaying);
  const setPlayheadFrame = useEditorStore((state) => state.setPlayheadFrame);
  const setSelection = useEditorStore((state) => state.setSelection);
  const setSelectedLinkId = useEditorStore((state) => state.setSelectedLinkId);
  const setViewport = useEditorStore((state) => state.setViewport);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [forcePortrait, setForcePortrait] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(max-width: 768px)");
    const update = () => setForcePortrait(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    if (forcePortrait) {
      document.body.classList.add("share-portrait");
    } else {
      document.body.classList.remove("share-portrait");
    }
    return () => {
      document.body.classList.remove("share-portrait");
    };
  }, [forcePortrait]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      if (!resolvedToken) {
        if (!cancelled) {
          setError("Share link not found.");
          setLoading(false);
        }
        return;
      }
      const result = await fetchProjectShareLink(resolvedToken);
      if (!result.ok) {
        if (!cancelled) {
          setError(result.error);
          setLoading(false);
        }
        return;
      }
      const sharedProject: Project = {
        ...result.project,
        isShared: true,
      };
      openProjectReadOnly(sharedProject);
      const teamSetupBoard = sharedProject.boards.find(
        (item) => item.name.toLowerCase() === "team setup"
      );
      if (teamSetupBoard) {
        setActiveBoard(teamSetupBoard.id);
      }
      setSelection([]);
      setSelectedLinkId(null);
      setViewport({ zoom: 1, offsetX: 0, offsetY: 0 });
      if (!cancelled) {
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [
    resolvedToken,
    openProjectReadOnly,
    setSelection,
    setSelectedLinkId,
    setViewport,
    setActiveBoard,
  ]);

  const boardId = project?.activeBoardId ?? project?.boards[0]?.id;
  const board = useMemo(
    () => project?.boards.find((item) => item.id === boardId) ?? null,
    [project, boardId]
  );

  useEffect(() => {
    if (!board) {
      return;
    }
    setPlaying(false);
    setPlayheadFrame(0);
    setSelection([]);
    setSelectedLinkId(null);
    setViewport({ zoom: 1, offsetX: 0, offsetY: 0 });
  }, [
    board?.id,
    setPlaying,
    setPlayheadFrame,
    setSelection,
    setSelectedLinkId,
    setViewport,
  ]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-[var(--ink-1)]">
        Loading shared project...
      </div>
    );
  }
  if (error || !project || !board) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-[var(--accent-1)]">
        {error ?? "Share link not available."}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--app-bg)] text-[var(--ink-0)]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-xs text-[var(--ink-1)] md:px-4">
        <span className="display-font text-sm text-[var(--accent-0)]">
          {project.name}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setShowNotes((prev) => !prev)}
            disabled={!board.notes?.trim()}
          >
            {showNotes ? "Hide notes" : "Show notes"}
          </button>
          {project.boards.length > 1 && (
            <select
              className="h-8 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
              value={board.id}
              onChange={(event) => setActiveBoard(event.target.value)}
            >
              {project.boards.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex-1 px-2 pb-3 md:px-4 md:pb-4">
          <div className="board-fit-cover h-full rounded-2xl border border-[var(--line)] bg-[var(--panel)]/70 p-2 md:rounded-3xl md:p-3">
            <div
              className={
                forcePortrait
                  ? "mx-auto h-full w-full max-w-[520px]"
                  : "h-full w-full"
              }
            >
              <BoardCanvas
                board={board}
                readOnly
                forcePortrait={forcePortrait}
              />
            </div>
          </div>
        </div>
      </div>
      {showNotes && (
        <div className="border-t border-[var(--line)] bg-[var(--panel)]/85 px-3 py-3 text-xs text-[var(--ink-0)] md:px-4">
          <p className="mb-2 text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
            Notes
          </p>
          <div className="max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-3 text-[11px]">
            {board.notes}
          </div>
        </div>
      )}
      {board.mode === "DYNAMIC" && (
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-[var(--line)] bg-[var(--panel)]/80 px-3 py-3 md:gap-3 md:px-4">
          <button
            className="rounded-full border border-[var(--line)] px-4 py-2 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={() => {
              setPlayheadFrame(0);
              setPlaying(false);
            }}
          >
            Rewind
          </button>
          <button
            className="rounded-full border border-[var(--line)] px-6 py-2 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={() => setPlaying(!isPlaying)}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
        </div>
      )}
    </div>
  );
}
