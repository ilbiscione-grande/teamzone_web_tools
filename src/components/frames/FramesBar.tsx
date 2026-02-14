"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { Board } from "@/models";
import type Konva from "konva";
import { useProjectStore } from "@/state/useProjectStore";
import { useEditorStore } from "@/state/useEditorStore";
import { can } from "@/utils/plan";
import { getPitchViewBounds } from "@/board/pitch/Pitch";

// Props for the FramesBar component

type FramesBarProps = {
  board: Board;
  stage: Konva.Stage | null;
};

export default function FramesBar({ board, stage }: FramesBarProps) {
  const setActiveFrameIndex = useProjectStore(
    (state) => state.setActiveFrameIndex
  );
  const addFrame = useProjectStore((state) => state.addFrame);
  const duplicateFrame = useProjectStore((state) => state.duplicateFrame);
  const deleteFrame = useProjectStore((state) => state.deleteFrame);
  const plan = useProjectStore((state) => state.plan);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setPlaying = useEditorStore((state) => state.setPlaying);
  const frameDurationMs = useEditorStore((state) => state.frameDurationMs);
  const setFrameDurationMs = useEditorStore(
    (state) => state.setFrameDurationMs
  );
  const loopPlayback = useEditorStore((state) => state.loopPlayback);
  const setLoopPlayback = useEditorStore((state) => state.setLoopPlayback);
  const playheadFrame = useEditorStore((state) => state.playheadFrame);
  const setPlayheadFrame = useEditorStore((state) => state.setPlayheadFrame);
  const viewport = useEditorStore((state) => state.viewport);
  const setViewport = useEditorStore((state) => state.setViewport);
  const [minimized, setMinimized] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const playStartRef = useRef<number | null>(null);
  const playOriginRef = useRef<number>(board.activeFrameIndex);
  const tickingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordRafRef = useRef<number | null>(null);
  const recordLoopRef = useRef<boolean>(false);
  const recordViewportRef = useRef<typeof viewport | null>(null);
  const recordStopTimeoutRef = useRef<number | null>(null);
  const recordStartTimeoutRef = useRef<number | null>(null);
  const recordHasPlayedRef = useRef(false);
  const scrubRef = useRef<HTMLDivElement | null>(null);
  const scrubbingRef = useRef(false);
  const [recordStatus, setRecordStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const canRecord = can(plan, "video.export");
  const showWatermark =
    plan !== "PAID" || board.watermarkEnabled === undefined
      ? true
      : board.watermarkEnabled;

  const lastFrameIndex = Math.max(0, board.frames.length - 1);
  const timelineValue = Math.min(lastFrameIndex, Math.max(0, playheadFrame));
  const ticks = useMemo(
    () =>
      board.frames.map((frame, index) => ({
        id: frame.id,
        index,
        left:
          board.frames.length > 1
            ? (index / (board.frames.length - 1)) * 100
            : 0,
      })),
    [board.frames]
  );

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      return;
    }

    const lastIndex = Math.max(0, board.frames.length - 1);
    const startIndex = Math.min(
      lastIndex,
      Math.max(0, Math.floor(playheadFrame))
    );
    playOriginRef.current = startIndex;
    if (board.activeFrameIndex !== startIndex) {
      setActiveFrameIndex(board.id, startIndex);
    }
    const durations = board.frames.map((frame) =>
      frame.durationMs && frame.durationMs > 0 ? frame.durationMs : frameDurationMs
    );
    const startFraction = Math.max(0, Math.min(1, playheadFrame - startIndex));
    playStartRef.current =
      performance.now() -
      Math.max(0, durations[startIndex] * startFraction);
    const totalDuration = durations
      .slice(startIndex, lastIndex + 1)
      .reduce((sum, value) => sum + value, 0);
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
      if (!playStartRef.current) {
        playStartRef.current = now;
      }
      const elapsed = now - playStartRef.current;
      const total = Math.max(totalDuration, 1);
      if (!loopPlayback && elapsed >= total) {
        setPlaying(false);
        setActiveFrameIndex(board.id, lastIndex);
        setPlayheadFrame(lastIndex);
        return;
      }
      const elapsedCycle = loopPlayback ? elapsed % total : Math.min(elapsed, total);
      const { playhead, index } = resolvePlayhead(elapsedCycle);
      setPlayheadFrame(playhead);
      const nextIndex = index;
      if (nextIndex !== board.activeFrameIndex) {
        tickingRef.current = true;
        setActiveFrameIndex(board.id, nextIndex);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [
    isPlaying,
    frameDurationMs,
    loopPlayback,
    board.frames,
    board.id,
    setActiveFrameIndex,
    setPlayheadFrame,
    setPlaying,
  ]);

  useEffect(() => {
    const handleRecord = () => {
      if (recording) {
        return;
      }
      setActiveFrameIndex(board.id, 0);
      setPlayheadFrame(0);
      startRecording();
    };
    window.addEventListener("tacticsboard:record", handleRecord);
    return () => window.removeEventListener("tacticsboard:record", handleRecord);
  }, [recording, board.id, setActiveFrameIndex, setPlayheadFrame]);

  const prevPlayingRef = useRef(isPlaying);

  useEffect(() => {
    if (isPlaying) {
      if (tickingRef.current) {
        tickingRef.current = false;
      }
      prevPlayingRef.current = true;
      return;
    }
    const wasPlaying = prevPlayingRef.current;
    prevPlayingRef.current = false;
    playStartRef.current = performance.now();
    playOriginRef.current = board.activeFrameIndex;

    if (wasPlaying) {
      const safeValue = Math.min(
        lastFrameIndex,
        Math.max(0, playheadFrame)
      );
      setPlayheadFrame(safeValue);
      return;
    }

    const isWholeFrame =
      Math.abs(playheadFrame - Math.round(playheadFrame)) < 0.001;
    if (
      !scrubbingRef.current &&
      isWholeFrame &&
      playheadFrame !== board.activeFrameIndex
    ) {
      setPlayheadFrame(board.activeFrameIndex);
    }
  }, [
    board.activeFrameIndex,
    board.id,
    isPlaying,
    lastFrameIndex,
    playheadFrame,
    setActiveFrameIndex,
    setPlayheadFrame,
  ]);

  useEffect(() => {
    if (!recording || isPlaying) {
      return;
    }
    if (!recordHasPlayedRef.current) {
      return;
    }
    if (recordStopTimeoutRef.current) {
      return;
    }
    recordStopTimeoutRef.current = window.setTimeout(() => {
      stopRecording();
    }, 2000);
  }, [recording, isPlaying]);

  const startRecording = () => {
    if (!canRecord) {
      window.alert("Video export is not available on this plan.");
      return;
    }
    if (!stage) {
      window.alert("Canvas not ready yet.");
      return;
    }
    const layers = stage.getLayers();
    if (layers.length === 0) {
      window.alert("No layers to record.");
      return;
    }
    const pixelRatio = window.devicePixelRatio ?? 1;
    const pitchBounds = getPitchViewBounds(board.pitchView);
    const viewRotation =
      board.pitchView === "DEF_HALF" || board.pitchView === "OFF_HALF" ? -90 : 0;
    const effectiveBounds =
      viewRotation === 0
        ? pitchBounds
        : {
            x: pitchBounds.x + pitchBounds.width / 2 - pitchBounds.height / 2,
            y: pitchBounds.y + pitchBounds.height / 2 - pitchBounds.width / 2,
            width: pitchBounds.height,
            height: pitchBounds.width,
          };
    const recordCanvas =
      recordCanvasRef.current ?? document.createElement("canvas");
    recordCanvasRef.current = recordCanvas;
    recordCanvasRef.current = recordCanvas;
    const ctx = recordCanvas.getContext("2d");
    if (!ctx) {
      window.alert("Unable to record canvas.");
      return;
    }
    setRecordStatus(null);
    const drawFrame = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const stageScale = stage.scaleX();
      const stageOffsetX = stage.x();
      const stageOffsetY = stage.y();
      const srcX = (effectiveBounds.x * stageScale + stageOffsetX) * pixelRatio;
      const srcY = (effectiveBounds.y * stageScale + stageOffsetY) * pixelRatio;
      const srcW = effectiveBounds.width * stageScale * pixelRatio;
      const srcH = effectiveBounds.height * stageScale * pixelRatio;
      const targetW = Math.max(1, Math.round(srcW));
      const targetH = Math.max(1, Math.round(srcH));
      if (recordCanvas.width !== targetW || recordCanvas.height !== targetH) {
        recordCanvas.width = targetW;
        recordCanvas.height = targetH;
      }
      ctx.clearRect(0, 0, recordCanvas.width, recordCanvas.height);
      ctx.fillStyle = "#1f5f3f";
      ctx.fillRect(0, 0, recordCanvas.width, recordCanvas.height);
      layers.forEach((layer) => {
        const canvas = (layer.getCanvas() as any)?._canvas as
          | HTMLCanvasElement
          | undefined;
        if (canvas) {
            ctx.drawImage(
              canvas,
              srcX,
              srcY,
              srcW,
              srcH,
              0,
              0,
              recordCanvas.width,
              recordCanvas.height
            );
          }
        });
        if (showWatermark) {
          const watermarkText =
            plan === "PAID"
              ? board.watermarkText?.trim() ||
                "Created with Teamzone Web Tools - https://teamzone-web-tools.vercel.app/"
              : "Created with Teamzone Web Tools - https://teamzone-web-tools.vercel.app/";
        const padding = 12 * pixelRatio;
        const innerInset = 16 * pixelRatio;
        ctx.save();
        ctx.font = `bold ${Math.round(16 * pixelRatio)}px Arial`;
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 8 * pixelRatio;
          ctx.fillText(
            watermarkText,
            recordCanvas.width - padding - innerInset,
            recordCanvas.height - padding - innerInset
          );
          ctx.restore();
        }
      recordRafRef.current = requestAnimationFrame(drawFrame);
    };
    recordRafRef.current = requestAnimationFrame(drawFrame);

    const stream = recordCanvas.captureStream(30);
    recordChunksRef.current = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
      });
    } catch {
      recorder = new MediaRecorder(stream);
    }
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordChunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      if (recordRafRef.current) {
        cancelAnimationFrame(recordRafRef.current);
        recordRafRef.current = null;
      }
      const blob = new Blob(recordChunksRef.current, {
        type: recorder.mimeType || "video/webm",
      });
      if (blob.size === 0) {
        setRecordStatus({
          type: "error",
          message: "Recording failed. No data captured.",
        });
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${board.name.replace(/\s+/g, "_")}.webm`;
      link.click();
      URL.revokeObjectURL(url);
      setRecordStatus({
        type: "success",
        message: "Recording saved.",
      });
    };
    recorder.onerror = () => {
      setRecordStatus({
        type: "error",
        message: "Recording failed.",
      });
    };
    recorder.start();
    recorderRef.current = recorder;
    recordLoopRef.current = loopPlayback;
    recordViewportRef.current = viewport;
    setViewport({ zoom: 1, offsetX: 0, offsetY: 0 });
    setLoopPlayback(false);
    setActiveFrameIndex(board.id, 0);
    setPlayheadFrame(0);
    setPlaying(false);
    setRecording(true);
    recordHasPlayedRef.current = false;
    if (recordStartTimeoutRef.current) {
      clearTimeout(recordStartTimeoutRef.current);
    }
    recordStartTimeoutRef.current = window.setTimeout(() => {
      setPlaying(true);
      recordHasPlayedRef.current = true;
      recordStartTimeoutRef.current = null;
    }, 2000);
  };

  const stopRecording = () => {
    recordHasPlayedRef.current = false;
    if (recordStartTimeoutRef.current) {
      clearTimeout(recordStartTimeoutRef.current);
      recordStartTimeoutRef.current = null;
    }
    if (recordStopTimeoutRef.current) {
      clearTimeout(recordStopTimeoutRef.current);
      recordStopTimeoutRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (recordRafRef.current) {
      cancelAnimationFrame(recordRafRef.current);
      recordRafRef.current = null;
    }
    setRecording(false);
    setPlaying(false);
    setLoopPlayback(recordLoopRef.current);
    if (recordViewportRef.current) {
      setViewport(recordViewportRef.current);
      recordViewportRef.current = null;
    }
  };

  useEffect(() => {
    if (!isPlaying || board.mode !== "DYNAMIC") {
      return;
    }
    return;
  }, [isPlaying, board.mode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(max-width: 1024px)");
    const update = () => setIsMobileViewport(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) {
      return;
    }
    setDragOffset({ x: 0, y: 0 });
  }, [isMobileViewport]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!dragStartRef.current) {
        return;
      }
      setDragOffset({
        x: dragStartRef.current.x + event.clientX,
        y: dragStartRef.current.y + event.clientY,
      });
    };
    const handleUp = () => {
      dragStartRef.current = null;
      setDragOffset((prev) => {
        if (Math.abs(prev.x) < 24 && Math.abs(prev.y) < 24) {
          return { x: 0, y: 0 };
        }
        return prev;
      });
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  const handleScrubAt = (clientX: number) => {
    const track = scrubRef.current;
    if (!track) {
      return;
    }
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const ratio = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / rect.width)
    );
    const value =
      board.frames.length > 1
        ? ratio * (board.frames.length - 1)
        : 0;
    const baseIndex = Math.floor(value);
    setPlaying(false);
    setActiveFrameIndex(board.id, baseIndex);
    setPlayheadFrame(value);
  };

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!scrubbingRef.current) {
        return;
      }
      handleScrubAt(event.clientX);
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (!scrubbingRef.current) {
        return;
      }
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      handleScrubAt(touch.clientX);
    };
    const handleUp = () => {
      if (!scrubbingRef.current) {
        return;
      }
      scrubbingRef.current = false;
    };
    const handleTouchEnd = () => {
      if (!scrubbingRef.current) {
        return;
      }
      scrubbingRef.current = false;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [board.frames.length]);

  const handleDragStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-scrub]")) {
      return;
    }
    if (target.closest("button, input, select, label")) {
      return;
    }
    dragStartRef.current = {
      x: dragOffset.x - event.clientX,
      y: dragOffset.y - event.clientY,
    };
  };

  if (board.mode !== "DYNAMIC") {
    return null;
  }

  if (minimized) {
    return (
      <div
        className="absolute bottom-4 left-4 z-10"
        style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
      >
        <div className="w-[320px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-xl shadow-black/30">
          <div
            className="flex items-center justify-center border-b border-[var(--line)] bg-[var(--panel-2)] px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--ink-1)]"
            onMouseDown={handleDragStart}
          >
            <span>Video controller</span>
            <button
              className="ml-auto rounded-full border border-[var(--line)] p-1 text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              onClick={() => setMinimized(false)}
              title="Expand"
              aria-label="Expand"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 9V4h5" />
                <path d="M20 9V4h-5" />
                <path d="M4 15v5h5" />
                <path d="M20 15v5h-5" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--ink-0)]">
            <button
              className="rounded-full border border-[var(--line)] p-2 hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              onClick={() => setPlaying(!isPlaying)}
              title={isPlaying ? "Pause" : "Play"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M9 6v12M15 6v12" />
                </svg>
              ) : (
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 6l10 6-10 6V6z" />
                </svg>
              )}
            </button>
            <button
              className="rounded-full border border-[var(--line)] p-2 hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              onClick={() =>
                setActiveFrameIndex(
                  board.id,
                  Math.max(0, board.activeFrameIndex - 1)
                )
              }
              title="Previous frame"
              aria-label="Previous frame"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6l-8 6 8 6V6z" />
                <path d="M6 6v12" />
              </svg>
            </button>
            <button
              className="rounded-full border border-[var(--line)] p-2 hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              onClick={() =>
                setActiveFrameIndex(
                  board.id,
                  Math.min(board.frames.length - 1, board.activeFrameIndex + 1)
                )
              }
              title="Next frame"
              aria-label="Next frame"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 6l8 6-8 6V6z" />
                <path d="M18 6v12" />
              </svg>
            </button>
            <button
              className="rounded-full border border-[var(--line)] p-2 hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              onClick={() => addFrame(board.id)}
              title="Add frame"
              aria-label="Add frame"
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
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button
              className="rounded-full border border-[var(--line)] p-2 hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
              onClick={() =>
                deleteFrame(board.id, board.frames[board.activeFrameIndex].id)
              }
              title="Delete frame"
              aria-label="Delete frame"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 7h16" />
                <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                <path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
            <button
              className={`rounded-full border p-2 ${
                recording
                  ? "border-[var(--accent-1)] text-[var(--accent-1)]"
                  : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              }`}
              onClick={recording ? stopRecording : startRecording}
              title={recording ? "Stop recording" : "Record video"}
              aria-label={recording ? "Stop recording" : "Record video"}
              disabled={!canRecord}
              data-locked={!canRecord}
            >
              {recording ? (
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <rect x="7" y="7" width="10" height="10" rx="2" />
                </svg>
              ) : (
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <circle cx="12" cy="12" r="6" />
                </svg>
              )}
            </button>
            {recordStatus && (
              <span
                className={`text-[10px] ${
                  recordStatus.type === "success"
                    ? "text-[var(--accent-0)]"
                    : "text-[var(--accent-1)]"
                }`}
              >
                {recordStatus.message}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mt-2 mx-auto w-[calc(100vw-1rem)] min-w-0 max-w-[calc(100vw-1rem)] overflow-hidden cursor-default rounded-3xl border border-[var(--line)] bg-[var(--panel)] px-2 py-2 shadow-xl shadow-black/30 md:w-full md:max-w-full md:cursor-grab md:px-4"
      style={
        isMobileViewport
          ? undefined
          : { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }
      }
      onMouseDown={handleDragStart}
    >
      <div className="relative flex flex-col gap-2 text-xs text-[var(--ink-1)] md:flex-row md:items-center md:gap-3">
        <div
          className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto overflow-y-hidden pb-1 pr-1 md:w-auto md:shrink-0 md:gap-2 md:overflow-visible md:pb-0"
          style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
        >
          <button
            className="rounded-full border border-[var(--line)] p-[6px] text-[11px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={() => setMinimized(true)}
            title="Minimize"
            aria-label="Minimize"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M5 12h14" />
            </svg>
          </button>
          <button
            className="rounded-full border border-[var(--line)] p-[6px] text-[11px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={() => addFrame(board.id)}
            title="Add frame"
            aria-label="Add frame"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            className="rounded-full border border-[var(--line)] p-[6px] text-[11px] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
            onClick={() =>
              deleteFrame(board.id, board.frames[board.activeFrameIndex].id)
            }
            title="Delete frame"
            aria-label="Delete frame"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7h16" />
              <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              <path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
          <button
            className="rounded-full border border-[var(--line)] p-[6px] text-[11px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={() =>
              duplicateFrame(board.id, board.frames[board.activeFrameIndex].id)
            }
            title="Duplicate frame"
            aria-label="Duplicate frame"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="7" y="7" width="10" height="10" rx="2" />
              <path d="M5 15V7a2 2 0 0 1 2-2h8" />
            </svg>
          </button>
          <button
            className="rounded-full border border-[var(--line)] p-[6px] text-[11px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={() => setPlaying(!isPlaying)}
            disabled={board.mode !== "DYNAMIC"}
            title={isPlaying ? "Pause" : "Play"}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M9 6v12M15 6v12" />
              </svg>
            ) : (
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 6l10 6-10 6V6z" />
              </svg>
            )}
          </button>
          <button
            className={`rounded-full border p-[6px] text-[11px] ${
              recording
                ? "border-[var(--accent-1)] text-[var(--accent-1)]"
                : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            }`}
            onClick={recording ? stopRecording : startRecording}
            title={recording ? "Stop recording" : "Record video"}
            aria-label={recording ? "Stop recording" : "Record video"}
            disabled={!canRecord}
            data-locked={!canRecord}
          >
            {recording ? (
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="currentColor"
              >
                <rect x="7" y="7" width="10" height="10" rx="2" />
              </svg>
            ) : (
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="currentColor"
              >
                <circle cx="12" cy="12" r="6" />
              </svg>
            )}
          </button>
          {recordStatus && (
            <span
              className={`hidden text-[10px] md:inline ${
                recordStatus.type === "success"
                  ? "text-[var(--accent-0)]"
                  : "text-[var(--accent-1)]"
              }`}
            >
              {recordStatus.message}
            </span>
          )}
          <button
            className="rounded-full border border-[var(--line)] p-[6px] text-[11px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={() =>
              setActiveFrameIndex(
                board.id,
                Math.max(0, board.activeFrameIndex - 1)
              )
            }
            title="Previous frame"
            aria-label="Previous frame"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6l-8 6 8 6V6z" />
              <path d="M6 6v12" />
            </svg>
          </button>
          <button
            className="rounded-full border border-[var(--line)] p-[6px] text-[11px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={() =>
              setActiveFrameIndex(
                board.id,
                Math.min(board.frames.length - 1, board.activeFrameIndex + 1)
              )
            }
            title="Next frame"
            aria-label="Next frame"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 6l8 6-8 6V6z" />
              <path d="M18 6v12" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <select
              className="h-7 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-2 text-xs text-[var(--ink-0)] md:h-8"
              value={frameDurationMs}
              onChange={(event) =>
                setFrameDurationMs(Number(event.target.value))
              }
            >
              <option value={1500} className="bg-[var(--panel-2)] text-[var(--ink-0)]">
                1.5
              </option>
              <option value={1000} className="bg-[var(--panel-2)] text-[var(--ink-0)]">
                1.0
              </option>
              <option value={700} className="bg-[var(--panel-2)] text-[var(--ink-0)]">
                0.7
              </option>
              <option value={500} className="bg-[var(--panel-2)] text-[var(--ink-0)]">
                0.5
              </option>
              <option value={300} className="bg-[var(--panel-2)] text-[var(--ink-0)]">
                0.3
              </option>
            </select>
            <button
              className={`rounded-full border p-[6px] text-[11px] ${
                loopPlayback
                  ? "border-[var(--accent-0)] text-[var(--accent-0)]"
                  : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              }`}
              onClick={() => setLoopPlayback(!loopPlayback)}
              title="Loop playback"
              aria-label="Loop playback"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 7h3v3" />
                <path d="M7 17H4v-3" />
                <path d="M20 10a8 8 0 0 0-14-4" />
                <path d="M4 14a8 8 0 0 0 14 4" />
              </svg>
            </button>
          </div>
        </div>
        <div
          className="relative h-7 w-full md:ml-4 md:h-8 md:flex-1"
          ref={scrubRef}
          data-scrub
          onPointerDown={(event) => {
            event.stopPropagation();
            scrubbingRef.current = true;
            handleScrubAt(event.clientX);
          }}
          onTouchStart={(event) => {
            event.stopPropagation();
            const touch = event.touches[0];
            if (!touch) {
              return;
            }
            scrubbingRef.current = true;
            handleScrubAt(touch.clientX);
          }}
        >
          <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[var(--line)]" />
          {ticks.map((tick) => (
            <div
              key={tick.id}
              className="absolute top-1/2"
              style={{ left: `${tick.left}%` }}
            >
              <div
                className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border md:h-3 md:w-3 ${
                  tick.index === board.activeFrameIndex
                    ? "border-[var(--accent-0)] bg-[var(--accent-0)]"
                    : "border-[var(--accent-0)] bg-transparent"
                }`}
              />
            </div>
          ))}
          <div
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-0)] md:h-5 md:w-5"
            style={{
              left:
                board.frames.length > 1
                  ? `${(timelineValue / (board.frames.length - 1)) * 100}%`
                  : "0%",
            }}
            data-scrub
            onTouchStart={(event) => {
              event.stopPropagation();
              const touch = event.touches[0];
              if (!touch) {
                return;
              }
              scrubbingRef.current = true;
              handleScrubAt(touch.clientX);
            }}
          />
        </div>
      </div>
    </div>
  );
}
