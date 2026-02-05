"use client";

import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/state/useProjectStore";
import { serializeProject, deserializeProject } from "@/persistence/serialize";
import { saveProject } from "@/persistence/storage";
import { useEditorStore } from "@/state/useEditorStore";
import type { BoardMode, PitchOverlay, PitchView, SquadPreset } from "@/models";
import FormationMenu from "@/components/FormationMenu";
import { can, getPlanLimits } from "@/utils/plan";
import AdBanner from "@/components/AdBanner";
import { usePlanGate } from "@/hooks/usePlanGate";
import PlanModal from "@/components/PlanModal";
import BetaNoticeModal from "@/components/BetaNoticeModal";
import ShareBoardModal from "@/components/ShareBoardModal";
import CommentsModal from "@/components/CommentsModal";
import { getBoardSquads } from "@/utils/board";
import {
  createSquadPreset,
  deleteSquadPreset,
  fetchSquadPresets,
} from "@/persistence/squadPresets";

export default function TopBar() {
  const project = useProjectStore((state) => state.project);
  const updateProjectMeta = useProjectStore((state) => state.updateProjectMeta);
  const updateBoard = useProjectStore((state) => state.updateBoard);
  const setActiveBoard = useProjectStore((state) => state.setActiveBoard);
  const setBoardMode = useProjectStore((state) => state.setBoardMode);
  const setBoardPitchView = useProjectStore((state) => state.setBoardPitchView);
  const openProject = useProjectStore((state) => state.openProject);
  const closeProject = useProjectStore((state) => state.closeProject);
  const addBoard = useProjectStore((state) => state.addBoard);
  const duplicateBoard = useProjectStore((state) => state.duplicateBoard);
  const deleteBoard = useProjectStore((state) => state.deleteBoard);
  const createProject = useProjectStore((state) => state.createProject);
  const plan = useProjectStore((state) => state.plan);
  const index = useProjectStore((state) => state.index);
  const authUser = useProjectStore((state) => state.authUser);
  const setPlan = useProjectStore((state) => state.setPlan);
  const exportGate = usePlanGate("project.export");
  const importGate = usePlanGate("project.import");
  const fileRef = useRef<HTMLInputElement>(null);
  const setTool = useEditorStore((state) => state.setTool);
  const attachBallToPlayer = useEditorStore(
    (state) => state.attachBallToPlayer
  );
  const setAttachBallToPlayer = useEditorStore(
    (state) => state.setAttachBallToPlayer
  );
  const playerTokenSize = useEditorStore((state) => state.playerTokenSize);
  const setPlayerTokenSize = useEditorStore(
    (state) => state.setPlayerTokenSize
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [betaOpen, setBetaOpen] = useState(false);
  const [squadPresetsOpen, setSquadPresetsOpen] = useState(false);
  const [squadPresets, setSquadPresets] = useState<SquadPreset[]>([]);
  const [squadPresetsLoading, setSquadPresetsLoading] = useState(false);
  const [squadPresetsError, setSquadPresetsError] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [presetSide, setPresetSide] = useState<"home" | "away">("home");
  const [presetStatus, setPresetStatus] = useState<string | null>(null);
  const [hideBetaBanner, setHideBetaBanner] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const [titleWidth, setTitleWidth] = useState<number | null>(null);
  const showAds = plan === "FREE";
  const showPlanGraceWarning =
    plan === "AUTH" &&
    authUser &&
    typeof window !== "undefined" &&
    Number(window.localStorage.getItem("tacticsboard:planCheckAt") ?? 0) > 0 &&
    Date.now() -
      Number(window.localStorage.getItem("tacticsboard:planCheckAt") ?? 0) >
      7 * 24 * 60 * 60 * 1000;
  const playerSizeOptions = [
    1.0,
    1.2,
    1.4,
    1.5,
    1.6,
    1.8,
    2.0,
    2.2,
    2.4,
    2.6,
  ];

  if (!project) {
    return null;
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const update = () => setIsOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!actionsOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      if (target.closest("[data-actions-menu]")) {
        return;
      }
      setActionsOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("mousedown", handleClick);
    };
  }, [actionsOpen]);

  useEffect(() => {
    if (!titleRef.current) {
      return;
    }
    const updateWidth = () => {
      if (titleRef.current) {
        setTitleWidth(titleRef.current.getBoundingClientRect().width);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => {
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  useEffect(() => {
    if (!squadPresetsOpen) {
      return;
    }
    if (!authUser || plan !== "PAID") {
      setSquadPresets([]);
      setSquadPresetsError(null);
      return;
    }
    setSquadPresetsLoading(true);
    setSquadPresetsError(null);
    fetchSquadPresets()
      .then((result) => {
        if (!result.ok) {
          setSquadPresetsError(result.error);
          setSquadPresets([]);
          return;
        }
        setSquadPresets(result.presets);
      })
      .finally(() => setSquadPresetsLoading(false));
  }, [squadPresetsOpen, authUser, plan]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem("tacticsboard:hideBetaBanner");
    setHideBetaBanner(stored === "true");
  }, []);

  const activeBoardId = project.activeBoardId ?? project.boards[0]?.id;
  const activeBoard = project.boards.find(
    (board) => board.id === activeBoardId
  );
  const boardSquads = getBoardSquads(project, activeBoard ?? null);
  const isSharedView = project.isShared ?? false;
  const limits = getPlanLimits(plan);
  const projectCount = new Set(
    [...index.map((item) => item.id), project.id].filter(Boolean)
  ).size;
  const projectLimitReached =
    Number.isFinite(limits.maxProjects) && projectCount >= limits.maxProjects;
  const boardLimitReached =
    Number.isFinite(limits.maxBoards) &&
    project.boards.length >= limits.maxBoards;
  const modeLabel =
    project?.settings?.mode ?? ("match" as "training" | "match" | "education");
  const modeText = modeLabel.charAt(0).toUpperCase() + modeLabel.slice(1);

  const onExport = () => {
    if (!can(plan, "project.export")) {
      window.alert("Export is not available on this plan.");
      return;
    }
    const data = serializeProject(project);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name.replace(/\s+/g, "_")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File) => {
    if (!can(plan, "project.import")) {
      window.alert("Import is not available on this plan.");
      return;
    }
    const text = await file.text();
    const result = deserializeProject(text);
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    saveProject(result.project, authUser?.id ?? null);
    openProject(result.project.id);
  };

  return (
    <div
      className={`relative grid items-center gap-4 rounded-3xl border border-[var(--line)] bg-[var(--panel)] px-5 py-4 shadow-2xl shadow-black/40 ${
        showAds ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-1"
      }`}
    >
      {!hideBetaBanner && (
        <button
          className="absolute left-[-90px] top-[-18px] z-30 flex h-8 w-64 -rotate-45 items-center justify-center bg-[var(--accent-0)] text-[10px] font-semibold uppercase leading-none tracking-[0.4em] text-black shadow-lg shadow-black/30"
          onClick={() => setBetaOpen(true)}
          title="Beta notice"
          aria-label="Beta notice"
        >
          <span className="block w-full -translate-x-2 text-center">Beta</span>
        </button>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span
              className="display-font text-[12px] uppercase tracking-[0.4em] text-[var(--accent-0)]"
              style={titleWidth ? { width: `${titleWidth}px` } : undefined}
            >
              Teamzone Web Tools
            </span>
            <h1
              ref={titleRef}
              className="display-font text-2xl text-[var(--ink-0)]"
            >
              Tactics Board
            </h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-transparent px-3 py-1">
            <input
              className="h-7 bg-transparent text-sm text-[var(--ink-0)] focus:outline-none"
              value={project.name}
              onChange={(event) =>
                updateProjectMeta({ name: event.target.value })
              }
            />
            <div className="h-6 w-px bg-[var(--line)]" />
            <button
              className="rounded-full border border-[var(--line)] p-1 text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              onClick={() => {
                const name = window.prompt("New project name") ?? "";
                if (name.trim()) {
                  createProject(name.trim(), {
                    homeKit: project.settings?.homeKit,
                    awayKit: project.settings?.awayKit,
                    attachBallToPlayer:
                      project.settings?.attachBallToPlayer ?? false,
                  });
                }
              }}
              aria-label="New project"
              disabled={projectLimitReached}
              data-locked={projectLimitReached}
              title={
                projectLimitReached
                  ? "Project limit reached for this plan."
                  : "New project"
              }
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
              className="rounded-full border border-[var(--line)] p-1 text-[var(--ink-1)] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
              onClick={closeProject}
              title="Back to list"
              aria-label="Back to list"
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
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--ink-1)]">
          <div className="flex items-center gap-3 rounded-full border border-[var(--line)] bg-transparent px-2 py-1">
            <select
              className="h-7 rounded-full bg-[var(--panel-2)] px-2 text-sm text-[var(--ink-0)] focus:outline-none"
              value={activeBoardId}
              onChange={(event) => {
                setActiveBoard(event.target.value);
                setTool("player");
              }}
            >
              {project.boards.map((board) => (
                <option
                  key={board.id}
                  value={board.id}
                  className="bg-[var(--panel-2)] text-[var(--ink-0)]"
                >
                  {board.name}
                </option>
              ))}
            </select>
            <div className="flex items-start gap-2">
              <div className="flex flex-col items-center gap-1">
                <button
                  className="rounded-full border border-[var(--line)] p-1 text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                  onClick={() => {
                    if (!activeBoard) {
                      return;
                    }
                    const nextName = window.prompt(
                      "Board name",
                      activeBoard.name
                    );
                    if (nextName && nextName.trim()) {
                      updateBoard(activeBoard.id, { name: nextName.trim() });
                    }
                  }}
                  title="Rename board"
                  aria-label="Rename board"
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
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5l4 4L7 21l-4 1 1-4 12.5-14.5z" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-col items-center gap-1">
                <button
                  className="rounded-full border border-[var(--line)] p-1 text-[var(--ink-1)] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                  onClick={() => {
                    if (!activeBoard) {
                      return;
                    }
                    if (!window.confirm("Delete this board?")) {
                      return;
                    }
                    deleteBoard(activeBoard.id);
                  }}
                  title="Delete board"
                  aria-label="Delete board"
                  disabled={project.boards.length <= 1}
                  data-locked={project.boards.length <= 1}
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
              </div>
              <div className="flex flex-col items-center gap-1">
                <button
                  className="rounded-full border border-[var(--line)] p-1 text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                  onClick={() => {
                    if (!activeBoard) {
                      return;
                    }
                    const nextName =
                      window.prompt(
                        "Duplicate board name",
                        `${activeBoard.name} Copy`
                      ) ?? "";
                    if (nextName.trim()) {
                      if (boardLimitReached) {
                        window.alert("Board limit reached for this plan.");
                        return;
                      }
                      duplicateBoard(activeBoard.id, nextName.trim());
                    }
                  }}
                  title={
                    boardLimitReached
                      ? "Board limit reached for this plan."
                      : "Duplicate board"
                  }
                  aria-label="Duplicate board"
                  disabled={boardLimitReached}
                  data-locked={boardLimitReached}
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
                    <rect x="8" y="8" width="12" height="12" rx="2" />
                    <path d="M4 16V6a2 2 0 0 1 2-2h10" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-col items-center gap-1">
                <button
                  className="rounded-full border border-[var(--line)] p-1 text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                  onClick={() => {
                    const name = window.prompt("Board name") ?? "";
                    if (name.trim()) {
                      if (
                        getPlanLimits(plan).maxBoards <=
                        (project.boards?.length ?? 0)
                      ) {
                        window.alert("Board limit reached for this plan.");
                        return;
                      }
                      addBoard(name.trim());
                    }
                  }}
                  title={
                    boardLimitReached
                      ? "Board limit reached for this plan."
                      : "Add board"
                  }
                  aria-label="Add board"
                  disabled={boardLimitReached}
                  data-locked={boardLimitReached}
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
              </div>
            </div>
          </div>
          <select
            className="h-9 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-sm text-[var(--ink-0)]"
            value={activeBoard?.mode ?? "STATIC"}
            onChange={(event) =>
              activeBoard &&
              setBoardMode(activeBoard.id, event.target.value as BoardMode)
            }
          >
            <option
              value="STATIC"
              className="bg-[var(--panel-2)] text-[var(--ink-0)]"
            >
              STATIC
            </option>
            <option
              value="DYNAMIC"
              className="bg-[var(--panel-2)] text-[var(--ink-0)]"
            >
              DYNAMIC
            </option>
          </select>
          <div className="flex flex-col items-center gap-1">
            <FormationMenu />
          </div>
          {isOffline && (
            <div
              className="rounded-full border border-[var(--accent-1)] px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--accent-1)]"
              title="Offline mode. Changes are saved locally until you reconnect."
            >
              <span className="inline-flex items-center gap-1">
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
                  <path d="M2 2l20 20" />
                  <path d="M4.5 8.5a12 12 0 0 1 15 1" />
                  <path d="M8 12a7 7 0 0 1 8.5 1.5" />
                  <path d="M12 16h.01" />
                </svg>
                Offline
              </span>
            </div>
          )}
          {showPlanGraceWarning && (
            <div
              className="rounded-full border border-[var(--accent-1)] px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--accent-1)]"
              title="Plan check expired after 7 days offline. Reconnect to restore paid access."
            >
              <span className="inline-flex items-center gap-1">
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
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                  <path d="M10.3 4.7l-7 12a2 2 0 0 0 1.7 3h14a2 2 0 0 0 1.7-3l-7-12a2 2 0 0 0-3.4 0z" />
                </svg>
                Plan check expired
              </span>
            </div>
          )}
          {isSharedView && project.sharedMeta && (
            <div className="flex flex-col items-center gap-1">
              <button
                className="rounded-full border border-[var(--line)] p-2 text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                onClick={() => setCommentsOpen(true)}
                title="Comments"
                aria-label="Comments"
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
                  <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                </svg>
              </button>
              <span className="text-[9px] uppercase tracking-widest text-[var(--ink-1)]">
                Shared
              </span>
            </div>
          )}
          {process.env.NODE_ENV !== "production" && (
            <select
              className="h-7 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-2 text-[10px] uppercase text-[var(--ink-0)]"
              value={plan}
              onChange={(event) => setPlan(event.target.value as typeof plan)}
              title="Plan (dev)"
              aria-label="Plan (dev)"
            >
              <option
                value="FREE"
                className="bg-[var(--panel-2)] text-[var(--ink-0)]"
              >
                FREE
              </option>
              <option
                value="AUTH"
                className="bg-[var(--panel-2)] text-[var(--ink-0)]"
              >
                AUTH
              </option>
              <option
                value="PAID"
                className="bg-[var(--panel-2)] text-[var(--ink-0)]"
              >
                PAID
              </option>
            </select>
          )}
          {!isSharedView && (
            <div className="relative flex flex-col items-center gap-1" data-actions-menu>
              <button
                className="rounded-full border border-[var(--line)] p-2 text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                onClick={() => setActionsOpen((prev) => !prev)}
                title="Project actions"
                aria-label="Project actions"
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
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
              <span className="text-[9px] uppercase tracking-widest text-[var(--ink-1)]">
                Actions
              </span>
              {actionsOpen && (
                <div className="absolute right-0 top-10 z-30 w-44 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2 text-[11px] text-[var(--ink-0)] shadow-xl shadow-black/30">
                  <button
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                    onClick={() => {
                      setActionsOpen(false);
                      onExport();
                    }}
                    disabled={!can(plan, "project.export")}
                    data-locked={!can(plan, "project.export")}
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
                      <path d="M5 5h11l3 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
                      <path d="M7 5v6h8V5" />
                      <path d="M7 19v-6h10v6" />
                    </svg>
                    Save project
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                    onClick={() => {
                      setActionsOpen(false);
                      fileRef.current?.click();
                    }}
                    disabled={!can(plan, "project.import")}
                    data-locked={!can(plan, "project.import")}
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
                      <path d="M4 19V7a2 2 0 0 1 2-2h9l3 3v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                      <path d="M12 10v6" />
                      <path d="M9 13l3 3 3-3" />
                    </svg>
                    Load project
                  </button>
                  {activeBoard && authUser && !isSharedView && (
                    <button
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                      onClick={() => {
                        setActionsOpen(false);
                        setShareOpen(true);
                      }}
                      disabled={!can(plan, "board.share")}
                      data-locked={!can(plan, "board.share")}
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
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <path d="M8.6 10.7l6.8-3.9" />
                        <path d="M8.6 13.3l6.8 3.9" />
                      </svg>
                      Share board
                    </button>
                  )}
                  <button
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                    onClick={() => {
                      setActionsOpen(false);
                      setSquadPresetsOpen(true);
                    }}
                    disabled={plan !== "PAID" || !authUser}
                    data-locked={plan !== "PAID" || !authUser}
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
                      <path d="M7 20v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2" />
                      <circle cx="12" cy="7" r="3" />
                      <path d="M5 12h.01M19 12h.01" />
                    </svg>
                    Manage squads
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                    onClick={() => {
                      setActionsOpen(false);
                      setPlanOpen(true);
                    }}
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
                      <path d="M20 21a8 8 0 0 0-16 0" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Account
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                    onClick={() => {
                      setActionsOpen(false);
                      setSettingsOpen(true);
                    }}
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
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                    </svg>
                    Settings
                  </button>
                </div>
              )}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onImport(file);
              }
            }}
          />
        </div>
      </div>

      {showAds && (
        <div className="flex h-full items-center justify-center">
          <AdBanner variant="side" />
        </div>
      )}

      <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} />
      {squadPresetsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink-0)] shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="display-font text-xl text-[var(--accent-0)]">
                  Match squad presets
                </h2>
                <p className="text-xs text-[var(--ink-1)]">
                  Save full match squads for new projects.
                </p>
              </div>
              <button
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                onClick={() => setSquadPresetsOpen(false)}
              >
                Close
              </button>
            </div>
            {plan !== "PAID" || !authUser ? (
              <p className="mt-4 text-xs text-[var(--ink-1)]">
                Squad presets are available for paid plans only.
              </p>
            ) : (
              <div className="mt-4 space-y-4 text-xs text-[var(--ink-1)]">
                <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                    Create preset
                  </p>
                  <input
                    className="h-9 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                    placeholder="Preset name"
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "home", label: "Home squad" },
                      { id: "away", label: "Away squad" },
                    ].map((side) => (
                      <button
                        key={side.id}
                        className={`rounded-2xl border px-3 py-2 text-[11px] uppercase tracking-wide ${
                          presetSide === side.id
                            ? "border-[var(--accent-0)] text-[var(--ink-0)]"
                            : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                        }`}
                        onClick={() => setPresetSide(side.id as "home" | "away")}
                      >
                        {side.label}
                      </button>
                    ))}
                  </div>
                  <button
                    className="rounded-full border border-[var(--line)] px-3 py-2 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                    onClick={async () => {
                      if (!presetName.trim()) {
                        setPresetStatus("Enter a preset name.");
                        return;
                      }
                      const sourceSquad =
                        presetSide === "home"
                          ? boardSquads.home
                          : boardSquads.away;
                      if (!sourceSquad) {
                        setPresetStatus("No squad data available.");
                        return;
                      }
                      setPresetStatus(null);
                      const result = await createSquadPreset({
                        name: presetName.trim(),
                        squad: sourceSquad,
                      });
                      if (!result.ok) {
                        setPresetStatus(result.error);
                        return;
                      }
                      setSquadPresets((prev) => [result.preset, ...prev]);
                      setPresetName("");
                      setPresetStatus("Preset saved.");
                    }}
                  >
                    Save preset
                  </button>
                  {presetStatus ? (
                    <p className="text-xs text-[var(--accent-1)]">
                      {presetStatus}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                    Your presets
                  </p>
                  {squadPresetsLoading ? (
                    <p className="text-xs text-[var(--ink-1)]">
                      Loading presets...
                    </p>
                  ) : squadPresetsError ? (
                    <p className="text-xs text-[var(--accent-1)]">
                      {squadPresetsError}
                    </p>
                  ) : squadPresets.length === 0 ? (
                    <p className="text-xs text-[var(--ink-1)]">
                      No presets yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {squadPresets.map((preset) => (
                        <div
                          key={preset.id}
                          className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2"
                        >
                          <div>
                            <p className="text-xs text-[var(--ink-0)]">
                              {preset.name}
                            </p>
                            <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                              {preset.squad.name}
                            </p>
                          </div>
                          <button
                            className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                            onClick={async () => {
                              if (!window.confirm("Delete this preset?")) {
                                return;
                              }
                              const result = await deleteSquadPreset(preset.id);
                              if (!result.ok) {
                                setSquadPresetsError(result.error);
                                return;
                              }
                              setSquadPresets((prev) =>
                                prev.filter((item) => item.id !== preset.id)
                              );
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <BetaNoticeModal
        open={betaOpen}
        onClose={() => setBetaOpen(false)}
        context="board"
      />
      {shareOpen && activeBoard && (
        <ShareBoardModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          project={project}
          board={activeBoard}
        />
      )}
      {commentsOpen && (
        <CommentsModal
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          project={project}
        />
      )}

      {settingsOpen && activeBoard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink-0)] shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between">
              <h2 className="display-font text-xl text-[var(--accent-0)]">
                Board Settings
              </h2>
              <button
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                onClick={() => setSettingsOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4 text-xs text-[var(--ink-1)]">
              <div>
                <p className="mb-2 text-[11px] uppercase">Pitch view</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "FULL", label: "Full" },
                    { value: "DEF_HALF", label: "Def half" },
                    { value: "OFF_HALF", label: "Off half" },
                    { value: "GREEN_EMPTY", label: "Green" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      className={`rounded-2xl border px-3 py-2 text-xs ${
                        activeBoard.pitchView === option.value
                          ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                          : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                      }`}
                      onClick={() =>
                        setBoardPitchView(
                          activeBoard.id,
                          option.value as PitchView
                        )
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] uppercase">Pitch overlay</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "NONE", label: "None" },
                    { value: "CORRIDORS", label: "Corridors" },
                    { value: "THIRDS", label: "Thirds" },
                    { value: "ZONES_18", label: "18 Zones" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      className={`rounded-2xl border px-3 py-2 text-xs ${
                        activeBoard.pitchOverlay === option.value
                          ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                          : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                      }`}
                      onClick={() =>
                        updateBoard(activeBoard.id, {
                          pitchOverlay: option.value as PitchOverlay,
                        })
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <label className="mt-2 flex items-center gap-2 rounded-2xl border border-[var(--line)] px-3 py-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={activeBoard.pitchOverlayText ?? false}
                    onChange={(event) =>
                      updateBoard(activeBoard.id, {
                        pitchOverlayText: event.target.checked,
                      })
                    }
                  />
                  Show overlay text
                </label>
              </div>
              <div>
                <p className="mb-2 text-[11px] uppercase">Player labels</p>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 rounded-2xl border border-[var(--line)] px-3 py-2 text-[11px]">
                    <input
                      type="checkbox"
                      checked={activeBoard.playerLabel?.showName ?? true}
                      onChange={(event) =>
                        updateBoard(activeBoard.id, {
                          playerLabel: {
                            ...activeBoard.playerLabel,
                            showName: event.target.checked,
                          },
                        })
                      }
                    />
                    Name
                  </label>
                  <label className="flex items-center gap-2 rounded-2xl border border-[var(--line)] px-3 py-2 text-[11px]">
                    <input
                      type="checkbox"
                      checked={activeBoard.playerLabel?.showPosition ?? false}
                      onChange={(event) =>
                        updateBoard(activeBoard.id, {
                          playerLabel: {
                            ...activeBoard.playerLabel,
                            showPosition: event.target.checked,
                          },
                        })
                      }
                    />
                    Pos
                  </label>
                  <label className="flex items-center gap-2 rounded-2xl border border-[var(--line)] px-3 py-2 text-[11px]">
                    <input
                      type="checkbox"
                      checked={activeBoard.playerLabel?.showNumber ?? false}
                      onChange={(event) =>
                        updateBoard(activeBoard.id, {
                          playerLabel: {
                            ...activeBoard.playerLabel,
                            showNumber: event.target.checked,
                          },
                        })
                      }
                    />
                    No.
                  </label>
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] uppercase">Video watermark</p>
                <div className="grid gap-2">
                  <label className="flex items-center gap-2 rounded-2xl border border-[var(--line)] px-3 py-2 text-[11px]">
                    <input
                      type="checkbox"
                      checked={
                        plan !== "PAID"
                          ? true
                          : activeBoard.watermarkEnabled ?? true
                      }
                      onChange={(event) => {
                        if (plan !== "PAID") {
                          return;
                        }
                        updateBoard(activeBoard.id, {
                          watermarkEnabled: event.target.checked,
                        });
                      }}
                      disabled={plan !== "PAID"}
                    />
                    {plan === "PAID"
                      ? "Show watermark on export"
                      : "Required on Free/Auth"}
                  </label>
                  <label className="space-y-1 text-[11px]">
                    <span>Watermark text (max 25)</span>
                    <input
                      type="text"
                      maxLength={25}
                      className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent px-2 text-xs text-[var(--ink-0)]"
                      value={activeBoard.watermarkText ?? ""}
                      onChange={(event) => {
                        if (plan !== "PAID") {
                          return;
                        }
                        updateBoard(activeBoard.id, {
                          watermarkText: event.target.value.slice(0, 25),
                        });
                      }}
                      placeholder="Created with Teamzone Web Tools - https://teamzone-web-tools.vercel.app/"
                      readOnly={plan !== "PAID"}
                    />
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-3 py-2">
                <span>Attach ball to player on drop</span>
                <input
                  type="checkbox"
                  checked={attachBallToPlayer}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setAttachBallToPlayer(checked);
                    updateProjectMeta({
                      settings: {
                        ...project.settings,
                        attachBallToPlayer: checked,
                      },
                    });
                  }}
                />
              </div>
              <div>
                <p className="mb-2 text-[11px] uppercase">Player size</p>
                <select
                  className="h-9 w-full rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                  value={playerTokenSize}
                  onChange={(event) =>
                    setPlayerTokenSize(Number(event.target.value))
                  }
                >
                  {playerSizeOptions.map((size) => (
                    <option
                      key={size}
                      value={size}
                      className="bg-[var(--panel-2)] text-[var(--ink-0)]"
                    >
                      {size.toFixed(1)}x
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-3 py-2 text-[11px]">
                <span>Hide beta banner</span>
                <input
                  type="checkbox"
                  checked={hideBetaBanner}
                  onChange={(event) => {
                    const next = event.target.checked;
                    if (next) {
                      const confirmed = window.confirm(
                        "I understand and accept that this app is in beta and may contain bugs, even if the banner is hidden."
                      );
                      if (!confirmed) {
                        return;
                      }
                    }
                    setHideBetaBanner(next);
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem(
                        "tacticsboard:hideBetaBanner",
                        next ? "true" : "false"
                      );
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
