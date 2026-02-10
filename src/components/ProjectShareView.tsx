"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "next/navigation";
import { useProjectStore } from "@/state/useProjectStore";
import { useEditorStore } from "@/state/useEditorStore";
import { fetchProjectShareLink } from "@/persistence/projectShareLinks";
import BoardCanvas from "@/board/BoardCanvas";
import { getPitchViewBounds } from "@/board/pitch/Pitch";
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
  const setActiveFrameIndex = useProjectStore(
    (state) => state.setActiveFrameIndex
  );
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setPlaying = useEditorStore((state) => state.setPlaying);
  const frameDurationMs = useEditorStore((state) => state.frameDurationMs);
  const loopPlayback = useEditorStore((state) => state.loopPlayback);
  const playheadFrame = useEditorStore((state) => state.playheadFrame);
  const setPlayheadFrame = useEditorStore((state) => state.setPlayheadFrame);
  const setSelection = useEditorStore((state) => state.setSelection);
  const setSelectedLinkId = useEditorStore((state) => state.setSelectedLinkId);
  const setViewport = useEditorStore((state) => state.setViewport);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [forcePortrait, setForcePortrait] = useState(false);
  const [controlsOffset, setControlsOffset] = useState({ x: 0, y: 0 });
  const [draggingControls, setDraggingControls] = useState(false);
  const dragPointRef = useRef<{ x: number; y: number } | null>(null);
  const scrubTrackRef = useRef<HTMLDivElement | null>(null);
  const scrubbingRef = useRef(false);

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
    if (!draggingControls) {
      return;
    }
    const onMove = (event: PointerEvent) => {
      const prev = dragPointRef.current;
      if (!prev) {
        dragPointRef.current = { x: event.clientX, y: event.clientY };
        return;
      }
      const dx = event.clientX - prev.x;
      const dy = event.clientY - prev.y;
      dragPointRef.current = { x: event.clientX, y: event.clientY };
      setControlsOffset((prev) => ({
        x: prev.x + dx,
        y: prev.y + dy,
      }));
    };
    const onUp = () => {
      setDraggingControls(false);
      dragPointRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingControls]);

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
  const portraitStyle = useMemo(() => {
    if (!board || !forcePortrait) {
      return undefined;
    }
    const bounds = getPitchViewBounds(board.pitchView);
    const rotated =
      board.pitchView === "DEF_HALF" ||
      board.pitchView === "OFF_HALF" ||
      board.pitchView === "FULL";
    const effectiveWidth = rotated ? bounds.height : bounds.width;
    const effectiveHeight = rotated ? bounds.width : bounds.height;
    return {
      width: "100vw",
      maxWidth: "100vw",
      aspectRatio: `${effectiveWidth} / ${effectiveHeight}`,
    } as CSSProperties;
  }, [board, forcePortrait]);

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

  useEffect(() => {
    if (!board || board.mode !== "DYNAMIC" || !isPlaying) {
      return;
    }
    const lastIndex = Math.max(0, board.frames.length - 1);
    const startIndex = Math.min(
      lastIndex,
      Math.max(0, Math.floor(playheadFrame))
    );
    if (board.activeFrameIndex !== startIndex) {
      setActiveFrameIndex(board.id, startIndex);
    }
    const durations = board.frames.map((frame) =>
      frame.durationMs && frame.durationMs > 0 ? frame.durationMs : frameDurationMs
    );
    const startFraction = Math.max(
      0,
      Math.min(1, playheadFrame - startIndex)
    );
    let startTime = performance.now() - durations[startIndex] * startFraction;
    const totalDuration = durations
      .slice(startIndex, lastIndex + 1)
      .reduce((sum, value) => sum + value, 0);
    let raf = 0;
    const resolvePlayhead = (elapsedMs: number) => {
      let acc = 0;
      for (let index = startIndex; index <= lastIndex; index += 1) {
        const segment = durations[index];
        if (elapsedMs <= acc + segment || index === lastIndex) {
          const t = segment > 0 ? (elapsedMs - acc) / segment : 0;
          return {
            playhead: index + Math.max(0, Math.min(1, t)),
            index,
          };
        }
        acc += segment;
      }
      return { playhead: lastIndex, index: lastIndex };
    };
    const tick = (now: number) => {
      if (!startTime) {
        startTime = now;
      }
      const elapsed = now - startTime;
      const total = Math.max(totalDuration, 1);
      if (!loopPlayback && elapsed >= total) {
        setPlaying(false);
        setActiveFrameIndex(board.id, lastIndex);
        setPlayheadFrame(lastIndex);
        return;
      }
      const elapsedCycle = loopPlayback
        ? elapsed % total
        : Math.min(elapsed, total);
      const { playhead, index } = resolvePlayhead(elapsedCycle);
      setPlayheadFrame(playhead);
      if (index !== board.activeFrameIndex) {
        setActiveFrameIndex(board.id, index);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, [
    board,
    isPlaying,
    playheadFrame,
    frameDurationMs,
    loopPlayback,
    setActiveFrameIndex,
    setPlayheadFrame,
    setPlaying,
  ]);

  const lastFrameIndex = Math.max(0, (board?.frames.length ?? 1) - 1);
  const timelinePercent =
    lastFrameIndex <= 0
      ? 0
      : Math.max(0, Math.min(100, (playheadFrame / lastFrameIndex) * 100));

  const scrubToClientX = (clientX: number) => {
    if (!board) {
      return;
    }
    const track = scrubTrackRef.current;
    if (!track) {
      return;
    }
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const frameValue = lastFrameIndex > 0 ? ratio * lastFrameIndex : 0;
    const frameIndex = Math.floor(frameValue);
    setPlaying(false);
    setActiveFrameIndex(board.id, frameIndex);
    setPlayheadFrame(frameValue);
  };

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!scrubbingRef.current) {
        return;
      }
      scrubToClientX(event.clientX);
    };
    const onPointerUp = () => {
      scrubbingRef.current = false;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!scrubbingRef.current) {
        return;
      }
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      scrubToClientX(touch.clientX);
    };
    const onTouchEnd = () => {
      scrubbingRef.current = false;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [lastFrameIndex, board?.id]);

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
    <div className="relative flex h-screen flex-col bg-[var(--app-bg)] text-[var(--ink-0)]">
      <div
        className={
          forcePortrait
            ? "absolute left-0 right-0 top-0 z-10 flex h-12 items-center gap-2 bg-[var(--panel)]/85 px-3 text-xs text-[var(--ink-1)] backdrop-blur"
            : "flex items-center gap-2 px-3 py-2 text-xs text-[var(--ink-1)] md:px-4"
        }
      >
        <span className="display-font min-w-0 flex-1 truncate text-[11px] text-[var(--accent-0)] sm:text-xs md:text-sm">
          {project.name}
        </span>
        <div className="flex items-center gap-2">
          <button
            className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setShowNotes((prev) => !prev)}
            disabled={!board.notes?.trim()}
          >
            {showNotes ? "Hide notes" : "Show notes"}
          </button>
          {project.boards.length > 1 && (
            <select
              className="h-7 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-[11px] text-[var(--ink-0)] md:h-8 md:text-xs"
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
      <div
        className={
          forcePortrait ? "flex min-h-0 flex-1 pt-12" : "flex min-h-0 flex-1"
        }
      >
        <div
          className={
            forcePortrait ? "flex-1 px-0 pb-0" : "flex-1 px-2 pb-3 md:px-4 md:pb-4"
          }
        >
          <div
            className={
              forcePortrait
                ? "board-fit-cover bg-transparent p-0"
                : "board-fit-cover h-full rounded-2xl border border-[var(--line)] bg-[var(--panel)]/70 p-2 md:rounded-3xl md:p-3"
            }
            style={forcePortrait ? portraitStyle : undefined}
          >
            <div className="h-full w-full">
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
        <div
          className={
            forcePortrait
              ? "absolute bottom-0 left-0 right-0 z-10 border-t border-[var(--line)] bg-[var(--panel)]/92 px-3 py-3 text-xs text-[var(--ink-0)] backdrop-blur"
              : "border-t border-[var(--line)] bg-[var(--panel)]/85 px-3 py-3 text-xs text-[var(--ink-0)] md:px-4"
          }
        >
          <p className="mb-2 text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
            Notes
          </p>
          <div className="max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-3 text-[11px]">
            {board.notes}
          </div>
        </div>
      )}
      {board.mode === "DYNAMIC" && (
        <div
          className={
            forcePortrait
              ? "absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 flex-col gap-1 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/60 px-2 py-1.5 backdrop-blur"
              : "flex flex-wrap items-center justify-center gap-2 border-t border-[var(--line)] bg-[var(--panel)]/80 px-3 py-3 md:gap-3 md:px-4"
          }
          style={
            forcePortrait
              ? {
                  transform: `translate(calc(-50% + ${controlsOffset.x}px), ${controlsOffset.y}px)`,
                }
              : undefined
          }
          onPointerDown={(event) => {
            if (!forcePortrait) {
              return;
            }
            const target = event.target as HTMLElement;
            if (target.closest("button") || target.closest("[data-scrub]")) {
              return;
            }
            dragPointRef.current = { x: event.clientX, y: event.clientY };
            setDraggingControls(true);
          }}
        >
          <div className="flex items-center gap-2">
            {forcePortrait && (
              <div
                className="h-6 w-3 cursor-grab rounded-full border border-[var(--line)] bg-[var(--panel-2)]/60 active:cursor-grabbing"
                title="Move controls"
                aria-label="Move controls"
              />
            )}
            <button
              className={
                forcePortrait
                  ? "inline-flex h-7 w-12 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--panel-2)]/45 hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                  : "rounded-full border border-[var(--line)] px-4 py-2 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              }
              onClick={() => {
                setPlayheadFrame(0);
                setPlaying(false);
              }}
              title="Rewind"
              aria-label="Rewind"
            >
              {forcePortrait ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 19L2 12l9-7v14z" />
                  <path d="M22 19l-9-7 9-7v14z" />
                </svg>
              ) : (
                "Rewind"
              )}
            </button>
            <button
              className={
                forcePortrait
                  ? "inline-flex h-7 w-12 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--panel-2)]/45 hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                  : "rounded-full border border-[var(--line)] px-6 py-2 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              }
              onClick={() => setPlaying(!isPlaying)}
              title={isPlaying ? "Pause" : "Play"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {forcePortrait ? (
                isPlaying ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )
              ) : isPlaying ? (
                "Pause"
              ) : (
                "Play"
              )}
            </button>
          </div>
          <div
            ref={scrubTrackRef}
            data-scrub
            className={`relative rounded-full bg-[var(--panel-2)]/75 ${
              forcePortrait ? "h-1.5 w-[132px]" : "h-2 w-[280px]"
            }`}
            onPointerDown={(event) => {
              event.stopPropagation();
              scrubbingRef.current = true;
              scrubToClientX(event.clientX);
            }}
            onTouchStart={(event) => {
              event.stopPropagation();
              const touch = event.touches[0];
              if (!touch) {
                return;
              }
              scrubbingRef.current = true;
              scrubToClientX(touch.clientX);
            }}
          >
            <div
              className="h-full rounded-full bg-[var(--accent-0)]"
              style={{ width: `${timelinePercent}%` }}
            />
            <div
              className={`absolute top-1/2 rounded-full border border-[var(--panel)] bg-[var(--accent-0)] ${
                forcePortrait ? "h-2.5 w-2.5 -translate-y-1/2" : "h-3.5 w-3.5 -translate-y-1/2"
              }`}
              style={{
                left: forcePortrait
                  ? `calc(${timelinePercent}% - 5px)`
                  : `calc(${timelinePercent}% - 7px)`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
