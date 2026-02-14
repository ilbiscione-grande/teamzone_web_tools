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
  const resetCanvasViewport = useEditorStore((state) => state.setViewport);
  const setAttachBallToPlayer = useEditorStore(
    (state) => state.setAttachBallToPlayer
  );
  const updateProjectMeta = useProjectStore((state) => state.updateProjectMeta);
  const updateBoard = useProjectStore((state) => state.updateBoard);
  const setActiveBoard = useProjectStore((state) => state.setActiveBoard);
  const [stage, setStage] = useState<Konva.Stage | null>(null);
  const [propertiesFloating, setPropertiesFloating] = useState(false);
  const [propertiesPos, setPropertiesPos] = useState({ x: 24, y: 140 });
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showMaximizedNotes, setShowMaximizedNotes] = useState(true);
  const [isMaximizedPenMode, setIsMaximizedPenMode] = useState(false);
  const [mobileToolboxOpen, setMobileToolboxOpen] = useState(false);
  const [viewport, setViewport] = useState({ width: 1366, height: 768 });
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [notesWidthBonus, setNotesWidthBonus] = useState(0);
  const [manualNotesWidth, setManualNotesWidth] = useState<number | null>(null);
  const [isResizingNotes, setIsResizingNotes] = useState(false);
  const maximizedNotesRef = useRef<HTMLDivElement | null>(null);
  const notesResizeDragRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);
  const [maximizedInkStrokes, setMaximizedInkStrokes] = useState<number[][]>(
    []
  );
  const drawingStrokeIndexRef = useRef<number | null>(null);

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
    if (isMaximized) {
      return;
    }
    setIsMaximizedPenMode(false);
    setMaximizedInkStrokes([]);
    drawingStrokeIndexRef.current = null;
  }, [isMaximized]);
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setIsCoarsePointer(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  useEffect(() => {
    if (!isMaximized || !showMaximizedNotes) {
      setNotesWidthBonus(0);
      return;
    }
    if (manualNotesWidth != null) {
      return;
    }
    const node = maximizedNotesRef.current;
    if (!node) {
      return;
    }
    const overflow = Math.max(0, node.scrollHeight - node.clientHeight);
    if (overflow <= 0) {
      if (notesWidthBonus !== 0) {
        setNotesWidthBonus(0);
      }
      return;
    }
    // Convert vertical overflow into extra width to reduce line wraps.
    const nextBonus = Math.min(260, Math.max(24, Math.ceil(overflow * 0.75)));
    if (Math.abs(nextBonus - notesWidthBonus) > 8) {
      setNotesWidthBonus(nextBonus);
    }
  }, [
    isMaximized,
    showMaximizedNotes,
    viewport.width,
    viewport.height,
    project?.sessionNotes,
    board?.notes,
    project?.sessionNotesFields,
    board?.notesFields,
    notesWidthBonus,
    manualNotesWidth,
  ]);
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = notesResizeDragRef.current;
      if (!drag) {
        return;
      }
      event.preventDefault();
      const deltaX = drag.startX - event.clientX;
      const next = drag.startWidth + deltaX;
      const minWidth = 320;
      const maxWidth = Math.max(minWidth, Math.min(860, viewport.width - 240));
      setManualNotesWidth(Math.max(minWidth, Math.min(maxWidth, Math.round(next))));
    };
    const onUp = () => {
      notesResizeDragRef.current = null;
      setIsResizingNotes(false);
    };
    const onCancel = () => {
      notesResizeDragRef.current = null;
      setIsResizingNotes(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [viewport.width]);
  useEffect(() => {
    if (!isResizingNotes || typeof document === "undefined") {
      return;
    }
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [isResizingNotes]);

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
  const equipmentOptions = [
    "Cones",
    "Bibs",
    "Balls",
    "Mini goals",
    "Hurdles",
    "Poles",
  ];
  const compactVertical = viewport.height <= 860;
  const isMobileLayout =
    viewport.width <= 1024 && (isCoarsePointer || viewport.height <= 860);
  const isPortraitMobile = isMobileLayout && viewport.height > viewport.width;
  const forcePortraitPitch = isPortraitMobile;
  useEffect(() => {
    if (!isMobileLayout || !board) {
      return;
    }
    resetCanvasViewport({ zoom: 1, offsetX: 0, offsetY: 0 });
  }, [isMobileLayout, board?.id, resetCanvasViewport]);
  useEffect(() => {
    if (!isMobileLayout || typeof window === "undefined") {
      return;
    }
    // Keep mobile editor hard-anchored to the left edge to avoid horizontal drift.
    window.scrollTo({ left: 0, top: window.scrollY, behavior: "auto" });
  }, [isMobileLayout, board?.id, board?.pitchView]);
  if (!project || !board) {
    return null;
  }

  const sessionTraining = project.sessionNotesFields?.training ?? {};
  const boardTraining = board.notesFields?.training ?? {};
  const updateSessionTrainingField = (
    key: keyof NonNullable<typeof sessionTraining>,
    value: string
  ) => {
    updateProjectMeta({
      sessionNotesFields: {
        ...(project.sessionNotesFields ?? {}),
        training: {
          ...sessionTraining,
          [key]: value,
        },
      },
    });
  };
  const updateBoardTrainingField = (
    key: keyof NonNullable<typeof boardTraining>,
    value: string
  ) => {
    updateBoard(board.id, {
      notesFields: {
        ...(board.notesFields ?? {}),
        training: {
          ...boardTraining,
          [key]: value,
        },
      },
    });
  };
  const toggleSessionEquipment = (item: string) => {
    const current = sessionTraining.equipment ?? [];
    const next = current.includes(item)
      ? current.filter((entry) => entry !== item)
      : [...current, item];
    updateProjectMeta({
      sessionNotesFields: {
        ...(project.sessionNotesFields ?? {}),
        training: {
          ...sessionTraining,
          equipment: next,
        },
      },
    });
  };
  const toggleBoardEquipment = (item: string) => {
    const current = boardTraining.equipment ?? [];
    const next = current.includes(item)
      ? current.filter((entry) => entry !== item)
      : [...current, item];
    updateBoard(board.id, {
      notesFields: {
        ...(board.notesFields ?? {}),
        training: {
          ...boardTraining,
          equipment: next,
        },
      },
    });
  };
  const formatDateTimeSv = (value?: string) => {
    if (!value || !value.trim()) {
      return "-";
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    const months = [
      "jan",
      "feb",
      "mar",
      "apr",
      "maj",
      "jun",
      "jul",
      "aug",
      "sep",
      "okt",
      "nov",
      "dec",
    ];
    const day = parsed.getDate();
    const month = months[parsed.getMonth()] ?? "";
    const year = parsed.getFullYear();
    const hh = `${parsed.getHours()}`.padStart(2, "0");
    const mm = `${parsed.getMinutes()}`.padStart(2, "0");
    return `${day} ${month} ${year} ${hh}:${mm}`;
  };

  if (isMaximized && board) {
    const sessionDateText = formatDateTimeSv(sessionTraining.dateTime);
    const sessionNotesText = (project.sessionNotes ?? "").trim();
    const boardNotesText = (board.notes ?? "").trim();
    const boardEquipmentText = (boardTraining.equipment ?? []).join(", ").trim();
    const sessionRows = [
      { label: "Session focus", value: (sessionTraining.mainFocus ?? "").trim() },
      { label: "Notes", value: sessionNotesText },
    ].filter((row) => row.value.length > 0);
    const boardRows = [
      { label: "Main focus", value: (boardTraining.mainFocus ?? "").trim() },
      { label: "Part goals", value: (boardTraining.partGoals ?? "").trim() },
      { label: "Organisation", value: (boardTraining.organisation ?? "").trim() },
      { label: "Key behaviours", value: (boardTraining.keyBehaviours ?? "").trim() },
      {
        label: "Coach instructions",
        value: (boardTraining.coachInstructions ?? "").trim(),
      },
      { label: "Equipment", value: boardEquipmentText },
      { label: "Board notes", value: boardNotesText },
    ].filter((row) => row.value.length > 0);
    const viewportAspect = viewport.width / Math.max(1, viewport.height);
    const notesWidthRatio =
      viewportAspect >= 1.75
        ? 0.42
        : viewportAspect >= 1.55
        ? 0.39
        : viewportAspect >= 1.35
        ? 0.35
        : 0.31;
    const baseNotesWidth = Math.round(
      Math.min(700, Math.max(420, viewport.width * notesWidthRatio))
    );
    const autoNotesWidth = Math.round(
      Math.min(
        Math.max(420, viewport.width - 320),
        Math.max(420, baseNotesWidth + notesWidthBonus)
      )
    );
    const notesWidth = manualNotesWidth ?? autoNotesWidth;
    const appendInkPoint = (event: {
      currentTarget: HTMLDivElement;
      clientX: number;
      clientY: number;
    }) => {
      const index = drawingStrokeIndexRef.current;
      if (index == null) {
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setMaximizedInkStrokes((prev) =>
        prev.map((stroke, strokeIndex) =>
          strokeIndex === index ? [...stroke, x, y] : stroke
        )
      );
    };
    return (
      <div className="fixed inset-0 z-50 flex h-[100dvh] flex-col bg-[var(--panel)]">
        <div
          className={`relative flex-1 overflow-hidden ${
            showMaximizedNotes
              ? `grid ${compactVertical ? "gap-2 p-2" : "gap-3 p-3"}`
              : ""
          }`}
          style={
            showMaximizedNotes
              ? { gridTemplateColumns: `minmax(0,1fr) 10px ${notesWidth}px` }
              : undefined
          }
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
              <div
                className={`absolute inset-0 z-40 ${
                  isMaximizedPenMode ? "pointer-events-auto" : "pointer-events-none"
                }`}
                style={{ touchAction: "none" }}
                onPointerDown={(event) => {
                  if (!isMaximizedPenMode) {
                    return;
                  }
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  const x = event.clientX - rect.left;
                  const y = event.clientY - rect.top;
                  setMaximizedInkStrokes((prev) => {
                    const index = prev.length;
                    drawingStrokeIndexRef.current = index;
                    return [...prev, [x, y]];
                  });
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (!isMaximizedPenMode) {
                    return;
                  }
                  event.preventDefault();
                  appendInkPoint(event);
                }}
                onPointerUp={(event) => {
                  if (!isMaximizedPenMode) {
                    return;
                  }
                  event.preventDefault();
                  appendInkPoint(event);
                  drawingStrokeIndexRef.current = null;
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onPointerCancel={() => {
                  drawingStrokeIndexRef.current = null;
                }}
              >
                <svg className="h-full w-full">
                  {maximizedInkStrokes.map((points, index) => (
                    <polyline
                      key={`ink-${index}`}
                      points={points.join(",")}
                      fill="none"
                      stroke="#ffffff"
                      strokeOpacity={0.96}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                </svg>
              </div>
            </div>
          )}
          {showMaximizedNotes && (
            <div
              className="pointer-events-none absolute top-4 z-20 rounded-full border border-[var(--line)] bg-[var(--panel-2)]/80 px-3 py-1 text-[10px] text-[var(--ink-1)]"
              style={{
                right: `${notesWidth + (compactVertical ? 30 : 38)}px`,
                top: compactVertical ? "10px" : "16px",
              }}
            >
              {sessionDateText}
            </div>
          )}
          {showMaximizedNotes && (
            <button
              type="button"
              className={`relative z-20 h-full cursor-col-resize rounded-full border transition ${
                isResizingNotes
                  ? "border-[var(--accent-2)] bg-[var(--panel-2)]"
                  : "border-[var(--line)] bg-[var(--panel-2)]/70 hover:border-[var(--accent-2)]"
              }`}
              style={{ touchAction: "none" }}
              title="Drag to resize notes panel (double click to auto-fit)"
              onDoubleClick={() => setManualNotesWidth(null)}
              onPointerDown={(event) => {
                event.preventDefault();
                notesResizeDragRef.current = {
                  startX: event.clientX,
                  startWidth: notesWidth,
                };
                setIsResizingNotes(true);
                (event.currentTarget as HTMLButtonElement).setPointerCapture(
                  event.pointerId
                );
              }}
            >
              <span className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-[var(--line)]" />
              <span className="absolute left-1/2 top-1/2 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--ink-1)]/55" />
              <span className="absolute left-1/2 top-1/2 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--line)]" />
            </button>
          )}
          {showMaximizedNotes && (
            <div
              ref={maximizedNotesRef}
              className="min-h-0 overflow-y-auto rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-2"
            >
              <div className="space-y-2">
                <section className="rounded-2xl border border-[var(--line)] p-2">
                  <div className="space-y-2 text-[11px] text-[var(--ink-1)]">
                    {sessionRows.length === 0 ? (
                      <p className="text-xs text-[var(--ink-1)]">No session notes.</p>
                    ) : (
                      sessionRows.map((row) => (
                        <div key={row.label} className="space-y-1">
                          <p className="text-[10px] uppercase tracking-wide">{row.label}</p>
                          <p className="whitespace-pre-wrap text-xs text-[var(--ink-0)]">
                            {row.value}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </section>
                <section className="rounded-2xl border border-[var(--line)] p-2">
                  <div className="mb-2">
                    <select
                      className="h-8 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2 text-xs text-[var(--ink-0)]"
                      value={board.id}
                      onChange={(event) => setActiveBoard(event.target.value)}
                    >
                      {project.boards.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                          className="bg-[var(--panel-2)] text-[var(--ink-0)]"
                        >
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 text-[11px] text-[var(--ink-1)]">
                    {boardRows.length === 0 ? (
                      <p className="text-xs text-[var(--ink-1)]">No board notes.</p>
                    ) : (
                      boardRows.map((row) => (
                        <div key={row.label} className="space-y-1">
                          <p className="text-[10px] uppercase tracking-wide">{row.label}</p>
                          <p className="whitespace-pre-wrap text-xs text-[var(--ink-0)]">
                            {row.value}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </section>
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
              <div
                className={`absolute inset-0 z-40 ${
                  isMaximizedPenMode ? "pointer-events-auto" : "pointer-events-none"
                }`}
                style={{ touchAction: "none" }}
                onPointerDown={(event) => {
                  if (!isMaximizedPenMode) {
                    return;
                  }
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  const x = event.clientX - rect.left;
                  const y = event.clientY - rect.top;
                  setMaximizedInkStrokes((prev) => {
                    const index = prev.length;
                    drawingStrokeIndexRef.current = index;
                    return [...prev, [x, y]];
                  });
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (!isMaximizedPenMode) {
                    return;
                  }
                  event.preventDefault();
                  appendInkPoint(event);
                }}
                onPointerUp={(event) => {
                  if (!isMaximizedPenMode) {
                    return;
                  }
                  event.preventDefault();
                  appendInkPoint(event);
                  drawingStrokeIndexRef.current = null;
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onPointerCancel={() => {
                  drawingStrokeIndexRef.current = null;
                }}
              >
                <svg className="h-full w-full">
                  {maximizedInkStrokes.map((points, index) => (
                    <polyline
                      key={`ink-${index}`}
                      points={points.join(",")}
                      fill="none"
                      stroke="#ffffff"
                      strokeOpacity={0.96}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                </svg>
              </div>
            </>
          )}
          <div className="absolute right-4 top-4 z-30 flex gap-2">
            <button
              className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                showMaximizedNotes
                  ? "border-[var(--accent-2)] bg-[var(--panel-2)] text-[var(--accent-2)]"
                  : "border-[var(--line)] bg-[var(--panel-2)]/70 text-[var(--ink-1)]"
              }`}
              onClick={() => setShowMaximizedNotes((prev) => !prev)}
              title={showMaximizedNotes ? "Hide notes" : "Show notes"}
              aria-label={showMaximizedNotes ? "Hide notes" : "Show notes"}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 5h16v14H4z" />
                <path d="M8 9h8M8 13h8M8 17h5" />
              </svg>
            </button>
            <button
              className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                isMaximizedPenMode
                  ? "border-[var(--accent-2)] bg-[var(--panel-2)] text-[var(--accent-2)]"
                  : "border-[var(--line)] bg-[var(--panel-2)]/70 text-[var(--ink-1)]"
              }`}
              onClick={() => {
                setIsMaximizedPenMode((prev) => !prev);
              }}
              title={isMaximizedPenMode ? "Exit pen mode" : "Pen mode"}
              aria-label={isMaximizedPenMode ? "Exit pen mode" : "Pen mode"}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5l4 4L7 21l-4 1 1-4 12.5-14.5z" />
              </svg>
            </button>
            <button
              className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                maximizedInkStrokes.length > 0
                  ? "border-[var(--accent-1)] bg-[var(--panel-2)] text-[var(--accent-1)]"
                  : "border-[var(--line)] bg-[var(--panel-2)]/70 text-[var(--ink-1)]"
              }`}
              onClick={() => {
                setMaximizedInkStrokes([]);
                drawingStrokeIndexRef.current = null;
              }}
              title="Clear pen strokes"
              aria-label="Clear pen strokes"
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
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel-2)]/70 text-[var(--ink-1)] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
              onClick={() => setIsMaximized(false)}
              title="Close full screen"
              aria-label="Close full screen"
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
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {board.mode === "DYNAMIC" && (
          <div className={compactVertical ? "px-2 pb-2" : "px-4 pb-4"}>
            <FramesBar board={board} stage={stage} />
          </div>
        )}
      </div>
    );
  }

  if (isMobileLayout) {
    return (
      <div className="grid h-[100dvh] w-screen max-w-[100vw] grid-rows-[auto_1fr_auto] overflow-x-hidden overflow-y-hidden">
        <div className="relative z-[210] min-w-0 overflow-x-hidden px-2 pt-2">
          <TopBar />
        </div>
        <div className="relative z-0 min-h-0 min-w-0 overflow-x-hidden px-2 pb-2">
          <div className="relative h-full w-full min-w-0 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--panel)] shadow-xl shadow-black/30">
            <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full border border-[var(--line)] bg-[var(--panel-2)]/80 px-2 py-1 text-[9px] uppercase tracking-widest text-[var(--accent-2)]">
              {modeText}
            </div>
            <BoardCanvas
              board={board}
              forcePortrait={forcePortraitPitch}
              onStageReady={(nextStage) => {
                setStage(nextStage);
                setStageRef(nextStage);
              }}
              isMaximized={isMaximized}
              onToggleMaximize={() => {
                setShowMaximizedNotes(true);
                setIsMaximized(true);
              }}
            />
          </div>
        </div>
        <div className="px-2 pb-2">
          <FramesBar board={board} stage={stage} />
        </div>
        <button
          className={`fixed right-3 z-[460] flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel)]/95 text-[var(--ink-0)] shadow-lg shadow-black/40 ${
            board.mode === "DYNAMIC" ? "bottom-32" : "bottom-16"
          }`}
          onClick={() => setMobileToolboxOpen((prev) => !prev)}
          aria-label={mobileToolboxOpen ? "Close toolbox" : "Open toolbox"}
          title={mobileToolboxOpen ? "Close toolbox" : "Open toolbox"}
        >
          {mobileToolboxOpen ? (
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
        {mobileToolboxOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/40"
            onClick={() => setMobileToolboxOpen(false)}
          >
            <div
              className="absolute inset-x-0 bottom-0 top-[20dvh] flex flex-col rounded-t-3xl border border-[var(--line)] bg-[var(--panel)] p-3 shadow-2xl shadow-black/40"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="display-font text-sm text-[var(--accent-0)]">
                  Tools
                </span>
                <button
                  className="rounded-full border border-[var(--line)] p-1 text-[var(--ink-1)]"
                  onClick={() => setMobileToolboxOpen(false)}
                  aria-label="Close toolbox panel"
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
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]/95 p-2">
                <Toolbox mobileCompact />
              </div>
              {selection.length > 0 && (
                <div className="mt-2 max-h-[35dvh] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--panel)]/95 p-3">
                  <PropertiesPanel
                    floating={false}
                    onToggleFloating={() => {}}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid h-[100dvh] grid-rows-[auto_1fr] overflow-hidden">
      <div className={compactVertical ? "px-3 pt-2" : "px-6 pt-4"}>
        <TopBar />
      </div>
      <div
        className={`grid min-h-0 grid-cols-[minmax(0,1fr)_320px] ${
          compactVertical ? "gap-2 px-3 pb-3" : "gap-4 px-6 pb-6"
        }`}
      >
        <div className="relative flex min-h-0 flex-col overflow-visible">
          <div className="relative flex-1 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--panel)] shadow-xl shadow-black/30">
            <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-full border border-[var(--line)] bg-[var(--panel-2)]/80 px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--accent-2)]">
              {modeText}
            </div>
            <BoardCanvas
              board={board}
              forcePortrait={forcePortraitPitch}
              onStageReady={(nextStage) => {
                setStage(nextStage);
                setStageRef(nextStage);
              }}
              isMaximized={isMaximized}
              onToggleMaximize={() => {
                setShowMaximizedNotes(true);
                setIsMaximized(true);
              }}
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
