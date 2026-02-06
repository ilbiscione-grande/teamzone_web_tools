"use client";

import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/state/useProjectStore";
import { deserializeProject } from "@/persistence/serialize";
import { loadProject, saveProject } from "@/persistence/storage";
import type {
  BoardShare,
  BoardSharePermission,
  Project,
  PublicProject,
  SquadPreset,
} from "@/models";
import { can, getPlanLimits } from "@/utils/plan";
import { createId } from "@/utils/id";
import { clone } from "@/utils/clone";
import { getDefaultBoardSettings } from "@/state/projectHelpers";
import AdBanner from "@/components/AdBanner";
import PlanModal from "@/components/PlanModal";
import BetaNoticeModal from "@/components/BetaNoticeModal";
import { fetchProjectCloud } from "@/persistence/cloud";
import { submitContactMessage } from "@/persistence/contact";
import {
  fetchPublicProjects,
  fetchPublicProjectForOwner,
  publishPublicProject,
  unpublishPublicProject,
  reportPublicProject,
} from "@/persistence/publicProjects";
import { fetchSquadPresets } from "@/persistence/squadPresets";
import {
  createBoardShare,
  fetchLatestCommentsForShares,
  fetchSharedBoards,
  fetchSharesByOwner,
} from "@/persistence/shares";

export default function ProjectList() {
  const categoryOptions = [
    "Warmup",
    "Passing",
    "Shooting",
    "Finishing",
    "Possession",
    "Pressing",
    "Counter",
    "Transition",
    "Defending",
    "Attacking",
    "Set pieces",
    "Small-sided games",
    "Fitness",
    "Other",
  ];
  const index = useProjectStore((state) => state.index);
  const openProject = useProjectStore((state) => state.openProject);
  const openProjectFromData = useProjectStore((state) => state.openProjectFromData);
  const openSharedBoard = useProjectStore((state) => state.openSharedBoard);
  const createProject = useProjectStore((state) => state.createProject);
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const loadSample = useProjectStore((state) => state.loadSample);
  const plan = useProjectStore((state) => state.plan);
  const project = useProjectStore((state) => state.project);
  const authUser = useProjectStore((state) => state.authUser);
  const [planOpen, setPlanOpen] = useState(false);
  const [betaOpen, setBetaOpen] = useState(false);
  const [name, setName] = useState("");
  const [homeKit, setHomeKit] = useState({
    shirt: "#e24a3b",
    shorts: "#0f1b1a",
    socks: "#f06d4f",
    vest: "",
  });
  const [awayKit, setAwayKit] = useState({
    shirt: "#2f6cf6",
    shorts: "#0f1b1a",
    socks: "#f2f1e9",
    vest: "",
  });
  const [attachBallToPlayer, setAttachBallToPlayer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [sharedBoards, setSharedBoards] = useState<BoardShare[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [sharedUnread, setSharedUnread] = useState(0);
  const [commentUnread, setCommentUnread] = useState(0);
  const [sharedByMe, setSharedByMe] = useState<BoardShare[]>([]);
  const [sharedByMeLoading, setSharedByMeLoading] = useState(false);
  const [sharedByMeError, setSharedByMeError] = useState<string | null>(null);
  const [publicProjects, setPublicProjects] = useState<PublicProject[]>([]);
  const [publicProjectsLoading, setPublicProjectsLoading] = useState(false);
  const [publicProjectsError, setPublicProjectsError] = useState<string | null>(null);
  const [publicProjectId, setPublicProjectId] = useState<string | null>(null);
  const [publicProjectEntry, setPublicProjectEntry] = useState<PublicProject | null>(null);
  const [publicProjectTitle, setPublicProjectTitle] = useState("");
  const [publicProjectDescription, setPublicProjectDescription] = useState("");
  const [publicProjectCategory, setPublicProjectCategory] = useState("");
  const [publicProjectTags, setPublicProjectTags] = useState("");
  const [publicProjectStatus, setPublicProjectStatus] = useState<string | null>(null);
  const [publicProjectLoading, setPublicProjectLoading] = useState(false);
  const [publicProjectsQuery, setPublicProjectsQuery] = useState("");
  const [publicProjectsCategory, setPublicProjectsCategory] = useState("");
  const [shareProjectOpen, setShareProjectOpen] = useState(false);
  const [shareProjectId, setShareProjectId] = useState<string | null>(null);
  const [shareProjectMode, setShareProjectMode] = useState<"user" | "public">(
    "user"
  );
  const [shareRecipient, setShareRecipient] = useState("");
  const [sharePermission, setSharePermission] =
    useState<BoardSharePermission>("comment");
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [shareSending, setShareSending] = useState(false);
  const [shareBoardIds, setShareBoardIds] = useState<string[]>([]);
  const [publicProjectBoardIds, setPublicProjectBoardIds] = useState<string[]>([]);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactStatus, setContactStatus] = useState<string | null>(null);
  const [contactSending, setContactSending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"training" | "match" | "education">("match");
  const [createPitchView, setCreatePitchView] = useState<"FULL" | "DEF_HALF" | "OFF_HALF" | "GREEN_EMPTY">("FULL");
  const [createPitchOverlay, setCreatePitchOverlay] = useState<"NONE" | "THIRDS" | "ZONES_18" | "CORRIDORS">("NONE");
  const [createPitchShape, setCreatePitchShape] = useState<"none" | "circle" | "square" | "rect">("none");
  const [createPlayerLabel, setCreatePlayerLabel] = useState({
    showName: true,
    showPosition: false,
    showNumber: false,
  });
  const [createBoards, setCreateBoards] = useState<string[]>([]);
  const [squadPresets, setSquadPresets] = useState<SquadPreset[]>([]);
  const [squadPresetsLoading, setSquadPresetsLoading] = useState(false);
  const [squadPresetsError, setSquadPresetsError] = useState<string | null>(null);
  const [homeSquadPresetId, setHomeSquadPresetId] = useState("");
  const [awaySquadPresetId, setAwaySquadPresetId] = useState("");
  const [consoleTab, setConsoleTab] = useState<
    "projects" | "shared" | "library"
  >("projects");
  const fileRef = useRef<HTMLInputElement>(null);
  const limits = getPlanLimits(plan);
  const projectCount = new Set(
    [...index.map((item) => item.id), project?.id].filter(Boolean)
  ).size;
  const projectLimitReached =
    Number.isFinite(limits.maxProjects) && projectCount >= limits.maxProjects;

  const getBoardTemplates = (
    mode: "training" | "match" | "education",
    planMode: typeof plan
  ): {
    id: string;
    name: string;
    pitchView?: "FULL" | "DEF_HALF" | "OFF_HALF" | "GREEN_EMPTY";
    pitchShape?: "none" | "circle" | "square" | "rect";
  }[] => {
    if (planMode !== "PAID") {
      return [{ id: "board-1", name: "Board 1", pitchView: "FULL" }];
    }
    if (mode === "match") {
      return [
        { id: "team-setup", name: "Team Setup", pitchView: "FULL" },
        { id: "build-up", name: "Build-up", pitchView: "FULL" },
        { id: "off-setup", name: "Offensive Setup", pitchView: "FULL" },
        { id: "off-corners", name: "Offensive Corners", pitchView: "OFF_HALF" },
        { id: "def-corners", name: "Defensive Corners", pitchView: "DEF_HALF" },
        { id: "off-fk", name: "Offensive Freekicks", pitchView: "OFF_HALF" },
        { id: "def-fk", name: "Defensive Freekicks", pitchView: "DEF_HALF" },
        { id: "off-throw", name: "Offensive Throw-ins", pitchView: "OFF_HALF" },
        { id: "def-throw", name: "Defensive Throw-ins", pitchView: "DEF_HALF" },
      ];
    }
    if (mode === "education") {
      return [
        { id: "principle", name: "Principle", pitchView: "FULL" },
        { id: "build-up", name: "Build-up", pitchView: "FULL" },
        { id: "pressing", name: "Pressing", pitchView: "FULL" },
        { id: "transitions", name: "Transitions", pitchView: "FULL" },
        { id: "attacking", name: "Attacking shape", pitchView: "FULL" },
        { id: "defending", name: "Defensive shape", pitchView: "FULL" },
      ];
    }
    return [
      { id: "warmup", name: "Warmup", pitchView: "GREEN_EMPTY", pitchShape: "square" },
      { id: "technical", name: "Technical", pitchView: "GREEN_EMPTY", pitchShape: "square" },
      { id: "passing", name: "Passing", pitchView: "GREEN_EMPTY", pitchShape: "square" },
      { id: "possession", name: "Possession", pitchView: "GREEN_EMPTY", pitchShape: "square" },
      { id: "finishing", name: "Finishing", pitchView: "GREEN_EMPTY", pitchShape: "square" },
      { id: "small-sided", name: "Small-sided", pitchView: "GREEN_EMPTY", pitchShape: "square" },
    ];
  };

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

  const sharedSeenKey = authUser
    ? `tacticsboard:sharedSeenAt:${authUser.id}`
    : null;
  const commentsSeenKey = authUser
    ? `tacticsboard:commentsSeen:${authUser.id}`
    : null;

  const loadCommentsSeen = () => {
    if (!commentsSeenKey || typeof window === "undefined") {
      return {} as Record<string, number>;
    }
    const raw = window.localStorage.getItem(commentsSeenKey);
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw) as Record<string, number>;
    } catch {
      return {};
    }
  };

  const persistCommentsSeen = (next: Record<string, number>) => {
    if (!commentsSeenKey || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(commentsSeenKey, JSON.stringify(next));
  };

  const refreshShared = async () => {
    if (!authUser || !can(plan, "board.share")) {
      setSharedBoards([]);
      setSharedUnread(0);
      return;
    }
    if (typeof window !== "undefined" && !navigator.onLine) {
      setSharedError("Offline. Shared boards are unavailable.");
      return;
    }
    setSharedLoading(true);
    setSharedError(null);
    const result = await fetchSharedBoards();
    if (!result.ok) {
      setSharedError(result.error);
      setSharedBoards([]);
      setSharedLoading(false);
      return;
    }
    setSharedBoards(result.shares);
    const seenAt = sharedSeenKey
      ? Number(window.localStorage.getItem(sharedSeenKey) ?? 0)
      : 0;
    const newShares = result.shares.filter(
      (share) => new Date(share.createdAt).getTime() > seenAt
    );
    setSharedUnread(newShares.length);
    setSharedLoading(false);
  };

  useEffect(() => {
    refreshShared();
    const interval = window.setInterval(refreshShared, 30000);
    return () => window.clearInterval(interval);
  }, [authUser, plan]);

  useEffect(() => {
    if (!authUser || !can(plan, "board.share")) {
      setSharedByMe([]);
      return;
    }
    if (typeof window !== "undefined" && !navigator.onLine) {
      setSharedByMeError("Offline. Shared boards are unavailable.");
      return;
    }
    setSharedByMeLoading(true);
    setSharedByMeError(null);
    fetchSharesByOwner()
      .then((result) => {
        if (!result.ok) {
          setSharedByMeError(result.error);
          setSharedByMe([]);
          return;
        }
        setSharedByMe(result.shares);
      })
      .finally(() => setSharedByMeLoading(false));
  }, [authUser, plan]);

  useEffect(() => {
    setPublicProjectsLoading(true);
    setPublicProjectsError(null);
    fetchPublicProjects()
      .then((result) => {
        if (!result.ok) {
          setPublicProjectsError(result.error);
          setPublicProjects([]);
          return;
        }
        setPublicProjects(result.projects);
      })
      .finally(() => setPublicProjectsLoading(false));
  }, []);

  const openPublicProject = async (projectId: string) => {
    setPublicProjectId(projectId);
    setPublicProjectTitle("");
    setPublicProjectDescription("");
    setPublicProjectCategory("");
    setPublicProjectTags("");
    setPublicProjectStatus(null);
    setPublicProjectEntry(null);
    if (!authUser) {
      setPublicProjectLoading(false);
      return;
    }
    setPublicProjectLoading(true);
    const result = await fetchPublicProjectForOwner(projectId);
    if (result.ok) {
      setPublicProjectEntry(result.project);
      if (result.project) {
        setPublicProjectTitle(result.project.title || "");
        setPublicProjectDescription(result.project.description || "");
        setPublicProjectCategory(result.project.category || "");
        setPublicProjectTags((result.project.tags || []).join(", "));
      }
    }
    setPublicProjectLoading(false);
  };

  const onPublishProject = async () => {
    if (!authUser) {
      setPublicProjectStatus("Please sign in to publish.");
      return;
    }
    if (!can(plan, "board.share")) {
      setPublicProjectStatus("Publishing is available on paid plans.");
      return;
    }
    if (!publicProjectId) {
      setPublicProjectStatus("Choose a project to publish.");
      return;
    }
    if (!publicProjectTitle.trim()) {
      setPublicProjectStatus("Enter a title.");
      return;
    }
    if (publicProjectBoardIds.length === 0) {
      setPublicProjectStatus("Select at least one board to publish.");
      return;
    }
    let projectToPublish = loadProject(publicProjectId, authUser.id);
    if (!projectToPublish && navigator.onLine) {
      projectToPublish = await fetchProjectCloud(publicProjectId);
    }
    if (!projectToPublish) {
      setPublicProjectStatus("Project not available.");
      return;
    }
    const boardsToPublish = projectToPublish.boards.filter((board) =>
      publicProjectBoardIds.includes(board.id)
    );
    if (boardsToPublish.length === 0) {
      setPublicProjectStatus("No selected boards available.");
      return;
    }
    const payloadProject = clone(projectToPublish);
    payloadProject.boards = boardsToPublish;
    payloadProject.activeBoardId =
      boardsToPublish[0]?.id ?? payloadProject.activeBoardId;
    setPublicProjectLoading(true);
    const tags = publicProjectTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const result = await publishPublicProject({
      project: payloadProject,
      title: publicProjectTitle.trim(),
      description: publicProjectDescription.trim(),
      category: publicProjectCategory.trim(),
      tags,
    });
    if (!result.ok) {
      setPublicProjectStatus(result.error);
      setPublicProjectLoading(false);
      return;
    }
    setPublicProjectEntry(result.project);
    setPublicProjects((prev) => {
      const next = prev.filter((entry) => entry.id !== result.project.id);
      return [result.project, ...next];
    });
    setPublicProjectStatus("Project published to library.");
    setPublicProjectLoading(false);
  };

  const onUnpublishProject = async () => {
    if (!publicProjectEntry) {
      return;
    }
    if (!window.confirm("Remove this project from the public library?")) {
      return;
    }
    const result = await unpublishPublicProject(publicProjectEntry.id);
    if (!result.ok) {
      setPublicProjectStatus(result.error);
      return;
    }
    setPublicProjects((prev) => prev.filter((entry) => entry.id !== publicProjectEntry.id));
    setPublicProjectEntry(null);
    setPublicProjectStatus("Project removed from library.");
  };

  const onReportProject = async (projectId: string) => {
    if (!authUser) {
      setPublicProjectsError("Please sign in to report.");
      return;
    }
    const reason = window.prompt("Why are you reporting this project?") ?? "";
    if (!reason.trim()) {
      return;
    }
    const result = await reportPublicProject({ projectId, reason: reason.trim() });
    if (!result.ok) {
      setPublicProjectsError(result.error);
      return;
    }
    setPublicProjectsError("Report submitted.");
  };

  const onImportProject = (entry: PublicProject) => {
    const nextProject = clone(entry.projectData);
    nextProject.id = createId();
    nextProject.name = entry.title || entry.projectName;
    nextProject.createdAt = new Date().toISOString();
    nextProject.updatedAt = nextProject.createdAt;
    openProjectFromData(nextProject);
  };

  useEffect(() => {
    const paid = plan === "PAID";
    const nextMode = paid ? createMode : "match";
    if (!paid && createMode !== "match") {
      setCreateMode("match");
    }
    const defaults = getDefaultBoardSettings(nextMode);
    setAttachBallToPlayer(defaults.attachBallToPlayer);
    setCreatePitchView(paid ? defaults.pitchView : "FULL");
    setCreatePitchOverlay(defaults.pitchOverlay);
    setCreatePitchShape(paid ? defaults.pitchShape : "none");
    setCreatePlayerLabel(defaults.playerLabel);
    const defaultsBoards = getBoardTemplates(nextMode, plan);
    setCreateBoards(defaultsBoards.map((board) => board.id));
    setHomeSquadPresetId("");
    setAwaySquadPresetId("");
  }, [createMode, plan]);

  useEffect(() => {
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
  }, [authUser, plan]);

  const onCreate = () => {
    if (!name.trim()) {
      setError("Enter a project name.");
      return;
    }
    setCreateOpen(true);
  };

  const onImport = async (file: File) => {
    if (!can(plan, "project.import")) {
      setError("Import is not available on this plan.");
      return;
    }
    const text = await file.text();
    const result = deserializeProject(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const project = result.project as Project;
    if (can(plan, "project.save")) {
      saveProject(project, authUser?.id ?? null);
    }
    openProject(project.id);
    setError(null);
  };

  const onContactSubmit = async () => {
    if (!contactMessage.trim()) {
      setContactStatus("Please enter a message.");
      return;
    }
    setContactSending(true);
    setContactStatus(null);
    const result = await submitContactMessage({
      plan,
      userEmail: contactEmail.trim() || authUser?.email || null,
      subject: contactSubject.trim() || undefined,
      message: contactMessage.trim(),
      url: typeof window !== "undefined" ? window.location.href : undefined,
      userAgent: typeof window !== "undefined" ? window.navigator.userAgent : undefined,
    });
    if (!result.ok) {
      setContactStatus(result.error);
      setContactSending(false);
      return;
    }
    setContactStatus("Message sent. We'll get back to you.");
    setContactMessage("");
    setContactSubject("");
    setContactSending(false);
  };

  const openProjectShare = (projectId: string) => {
    setShareProjectId(projectId);
    setShareRecipient("");
    setSharePermission("comment");
    setShareStatus(null);
    setShareProjectMode("user");
    const fallbackProject = loadProject(projectId, authUser?.id ?? null);
    setShareBoardIds(fallbackProject?.boards.map((board) => board.id) ?? []);
    setPublicProjectBoardIds(
      fallbackProject?.boards.map((board) => board.id) ?? []
    );
    setShareProjectOpen(true);
    void openPublicProject(projectId);
  };

  const onShareProject = async () => {
    if (!can(plan, "board.share")) {
      setShareStatus("Sharing is available on paid plans only.");
      return;
    }
    if (!authUser) {
      setShareStatus("Please sign in to share.");
      return;
    }
    if (!shareProjectId) {
      setShareStatus("Choose a project to share.");
      return;
    }
    const email = shareRecipient.trim();
    if (!email) {
      setShareStatus("Enter a recipient email.");
      return;
    }
    setShareSending(true);
    setShareStatus(null);
    let projectToShare = loadProject(shareProjectId, authUser.id);
    if (!projectToShare && navigator.onLine) {
      projectToShare = await fetchProjectCloud(shareProjectId);
    }
    if (!projectToShare) {
      setShareStatus("Project not available.");
      setShareSending(false);
      return;
    }
    if (shareBoardIds.length === 0) {
      setShareStatus("Select at least one board to share.");
      setShareSending(false);
      return;
    }
    const boardsToShare = projectToShare.boards.filter((board) =>
      shareBoardIds.includes(board.id)
    );
    if (boardsToShare.length === 0) {
      setShareStatus("This project has no boards to share.");
      setShareSending(false);
      return;
    }
    const results = await Promise.all(
      boardsToShare.map((board) =>
        createBoardShare({
          project: projectToShare,
          board,
          recipientEmail: email,
          permission: sharePermission,
        })
      )
    );
    const failures = results.filter((result) => !result.ok);
    if (failures.length > 0) {
      setShareStatus(
        `Shared ${results.length - failures.length}/${
          results.length
        } boards. ${failures[0].error}`
      );
    } else {
      setShareStatus(`Shared ${results.length} boards.`);
    }
    setShareSending(false);
  };

  const filteredPublicProjects = publicProjects
    .filter((entry) => {
      if (entry.status === "unverified") {
        return entry.ownerId === authUser?.id;
      }
      return true;
    })
    .filter((entry) => {
      if (!publicProjectsCategory.trim()) {
        return true;
      }
      return entry.category
        .toLowerCase()
        .includes(publicProjectsCategory.trim().toLowerCase());
    })
    .filter((entry) => {
      if (!publicProjectsQuery.trim()) {
        return true;
      }
      const query = publicProjectsQuery.trim().toLowerCase();
      const haystack = [
        entry.title,
        entry.projectName,
        entry.description,
        entry.category ?? "",
        entry.tags?.join(" ") ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

  return (
    <div className="h-screen overflow-y-auto px-8 py-12" data-scrollable>
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col gap-2">
          <span className="display-font text-xs uppercase tracking-[0.4em] text-[var(--accent-2)]">
            Tactics Board Web
          </span>
          <h1 className="display-font text-5xl text-[var(--ink-0)]">
            Project Console
          </h1>
          {!can(plan, "project.save") && (
            <div className="inline-flex w-fit rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--accent-1)]">
              Free mode - no save · Max {getPlanLimits(plan).maxProjects} project · Max{" "}
              {getPlanLimits(plan).maxBoards} boards
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
            <div className="rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1">
              Projects {projectCount}/
              {Number.isFinite(limits.maxProjects) ? limits.maxProjects : "inf"}
            </div>
            <div className="rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1">
              Boards {project?.boards?.length ?? 0}/
              {Number.isFinite(limits.maxBoards) ? limits.maxBoards : "inf"}
            </div>
            {authUser && (
              <div className="rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1 text-[var(--accent-2)]">
                {authUser.name}
              </div>
            )}
            <div
              className={`rounded-full border px-3 py-1 ${
                isOffline
                  ? "border-[var(--accent-1)] text-[var(--accent-1)]"
                  : "border-[var(--line)] text-[var(--ink-1)]"
              }`}
              title={
                isOffline
                  ? "Offline. Only projects saved on this device are available."
                  : "Online"
              }
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
                  {isOffline ? (
                    <>
                      <path d="M2 2l20 20" />
                      <path d="M4.5 8.5a12 12 0 0 1 15 1" />
                      <path d="M8 12a7 7 0 0 1 8.5 1.5" />
                      <path d="M12 16h.01" />
                    </>
                  ) : (
                    <>
                      <path d="M5 9.5a11 11 0 0 1 14 1" />
                      <path d="M8 13a6.5 6.5 0 0 1 8 1.5" />
                      <path d="M12 16h.01" />
                    </>
                  )}
                </svg>
                {isOffline ? "Offline" : "Online"}
              </span>
            </div>
            <button
              className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] uppercase tracking-widest hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              onClick={() => setPlanOpen(true)}
            >
              Account
            </button>
          </div>
          <p className="max-w-2xl text-sm text-[var(--ink-1)]">
            Create a new tactics project, resume from local storage, or import a
            JSON file.
          </p>
          <a
            className="text-xs uppercase tracking-[0.3em] text-[var(--accent-2)] hover:text-[var(--accent-0)]"
            href="https://x.com/teamzoneapp"
            target="_blank"
            rel="noreferrer"
          >
            @teamzoneapp
          </a>
          <div className="mt-4 rounded-3xl border border-[var(--accent-0)]/60 bg-[var(--accent-0)]/90 p-4 text-black shadow-xl shadow-black/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.4em] text-black/70">
                  Beta notice
                </p>
                <p className="text-sm text-black">
                  This app is in beta and may contain bugs or incomplete
                  features. Please report issues so we can improve it quickly.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-full border border-black/40 px-4 py-2 text-xs font-semibold text-black hover:border-black/70"
                  onClick={() => setBetaOpen(true)}
                >
                  Report a bug
                </button>
                <button
                  className="rounded-full border border-black/40 px-4 py-2 text-xs font-semibold text-black hover:border-black/70"
                  onClick={() => setContactOpen(true)}
                >
                  Contact us
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {[
            { id: "projects", label: "Projects" },
            { id: "shared", label: "Shared" },
            { id: "library", label: "Library" },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-widest ${
                consoleTab === tab.id
                  ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                  : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
              }`}
              onClick={() => setConsoleTab(tab.id as typeof consoleTab)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {consoleTab === "projects" && (
        <section className="grid gap-6 rounded-3xl border border-[var(--line)] bg-[var(--panel)]/80 p-6 shadow-2xl shadow-black/40 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <h2 className="display-font text-xl text-[var(--accent-0)]">
              New Project
            </h2>
            <AdBanner />
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                className="h-12 flex-1 rounded-full border border-[var(--line)] bg-transparent px-4 text-sm text-[var(--ink-0)] placeholder:text-[var(--ink-1)] focus:outline-none"
                placeholder="Project name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <button
                className="h-12 rounded-full bg-[var(--accent-0)] px-6 text-sm font-semibold text-black transition hover:brightness-110"
                onClick={onCreate}
                disabled={projectLimitReached}
                data-locked={projectLimitReached}
                title={
                  projectLimitReached
                    ? "Project limit reached for this plan."
                    : "Create project"
                }
              >
                Create
              </button>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-[var(--ink-1)]">
              <button
                className="rounded-full border border-[var(--line)] px-4 py-2 hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                onClick={loadSample}
                disabled={projectLimitReached}
                data-locked={projectLimitReached}
                title={
                  projectLimitReached
                    ? "Project limit reached for this plan."
                    : "Load sample project"
                }
              >
                Load sample project
              </button>
              <button
                className="rounded-full border border-[var(--line)] px-4 py-2 hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                onClick={() => fileRef.current?.click()}
                disabled={!can(plan, "project.import")}
                data-locked={!can(plan, "project.import")}
                title={
                  can(plan, "project.import")
                    ? "Import JSON"
                    : "Import is not available on this plan."
                }
              >
                Import JSON
              </button>
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
            {error ? (
              <p className="text-xs text-[var(--accent-1)]">{error}</p>
            ) : null}
          </div>

          <div className="space-y-3">
            <h2 className="display-font text-xl text-[var(--accent-0)]">
              Recent Projects
            </h2>
            <div className="space-y-2">
              {index.length === 0 ? (
                <p className="text-sm text-[var(--ink-1)]">
                  No saved projects yet.
                </p>
              ) : (
                index.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--ink-0)]">
                        {project.name}
                      </p>
                      <p className="text-xs text-[var(--ink-1)]">
                        Updated {new Date(project.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                        onClick={() => {
                          if (typeof window !== "undefined" && !navigator.onLine) {
                            const cached = loadProject(project.id, authUser?.id ?? null);
                            if (!cached) {
                              setError(
                                "This project is not available offline yet. Reconnect to sync."
                              );
                              return;
                            }
                          }
                          setError(null);
                          openProject(project.id);
                        }}
                      >
                        Open
                      </button>
                      <button
                        className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                        onClick={() => openProjectShare(project.id)}
                        disabled={!can(plan, "board.share")}
                        data-locked={!can(plan, "board.share")}
                        title={
                          can(plan, "board.share")
                            ? "Share project boards"
                            : "Sharing is available on paid plans."
                        }
                      >
                        Share
                      </button>
                      <button
                        className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete "${project.name}"? This cannot be undone.`
                            )
                          ) {
                            deleteProject(project.id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
        )}

        {consoleTab === "shared" && (
        <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)]/80 p-6 shadow-2xl shadow-black/40">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="display-font text-lg text-[var(--accent-0)]">
                  Shared with me
                </h3>
                {(sharedUnread > 0 || commentUnread > 0) && (
                  <span className="rounded-full border border-[var(--accent-0)] px-2 py-1 text-[10px] uppercase tracking-widest text-[var(--accent-0)]">
                    {sharedUnread > 0
                      ? `${sharedUnread} new`
                      : ""}
                    {sharedUnread > 0 && commentUnread > 0 ? " · " : ""}
                    {commentUnread > 0 ? `${commentUnread} comments` : ""}
                  </span>
                )}
              </div>
              {!authUser || !can(plan, "board.share") ? (
                <p className="text-sm text-[var(--ink-1)]">
                  Sign in with sharing enabled to access shared boards.
                </p>
              ) : sharedLoading ? (
                <p className="text-sm text-[var(--ink-1)]">
                  Loading shared boards...
                </p>
              ) : sharedError ? (
                <p className="text-sm text-[var(--accent-1)]">
                  {sharedError}
                </p>
              ) : sharedBoards.length === 0 ? (
                <p className="text-sm text-[var(--ink-1)]">
                  No shared boards yet.
                </p>
              ) : (
                sharedBoards.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--ink-0)]">
                        {share.boardName}
                      </p>
                      <p className="text-xs text-[var(--ink-1)]">
                        {share.projectName} · {share.ownerEmail}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                        {share.permission} access
                      </p>
                    </div>
                    <button
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                      onClick={() => {
                        if (sharedSeenKey && typeof window !== "undefined") {
                          window.localStorage.setItem(
                            sharedSeenKey,
                            String(Date.now())
                          );
                          const nextSeen = loadCommentsSeen();
                          nextSeen[share.id] = Date.now();
                          persistCommentsSeen(nextSeen);
                        }
                        openSharedBoard(share);
                      }}
                    >
                      Open
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="mt-6 space-y-2">
              <h3 className="display-font text-lg text-[var(--accent-0)]">
                Shared by me
              </h3>
              {!authUser || !can(plan, "board.share") ? (
                <p className="text-sm text-[var(--ink-1)]">
                  Sign in with sharing enabled to view your shared boards.
                </p>
              ) : sharedByMeLoading ? (
                <p className="text-sm text-[var(--ink-1)]">
                  Loading shared boards...
                </p>
              ) : sharedByMeError ? (
                <p className="text-sm text-[var(--accent-1)]">
                  {sharedByMeError}
                </p>
              ) : sharedByMe.length === 0 ? (
                <p className="text-sm text-[var(--ink-1)]">
                  You have not shared any boards yet.
                </p>
              ) : (
                sharedByMe.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--ink-0)]">
                        {share.boardName}
                      </p>
                      <p className="text-xs text-[var(--ink-1)]">
                        {share.projectName} · Shared with {share.recipientEmail}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                        {share.permission} access
                      </p>
                    </div>
                    <button
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                      onClick={() => {
                        if (commentsSeenKey && typeof window !== "undefined") {
                          const nextSeen = loadCommentsSeen();
                          nextSeen[share.id] = Date.now();
                          persistCommentsSeen(nextSeen);
                        }
                        openSharedBoard(share);
                      }}
                    >
                      Open
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
        )}

        {consoleTab === "library" && (
        <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)]/80 p-6 shadow-2xl shadow-black/40">
          <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="display-font text-lg text-[var(--accent-0)]">
                  Project library
                </h3>
                <span className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                  {publicProjects.length}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="h-9 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                  placeholder="Search title, tags"
                  value={publicProjectsQuery}
                  onChange={(event) => setPublicProjectsQuery(event.target.value)}
                />
                <select
                  className="h-9 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                  value={publicProjectsCategory}
                  onChange={(event) => setPublicProjectsCategory(event.target.value)}
                >
                  <option value="">Filter category</option>
                  {categoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              {publicProjectsLoading ? (
                <p className="text-sm text-[var(--ink-1)]">
                  Loading project library...
                </p>
              ) : publicProjectsError ? (
                <p className="text-sm text-[var(--accent-1)]">
                  {publicProjectsError}
                </p>
              ) : filteredPublicProjects.length === 0 ? (
                <p className="text-sm text-[var(--ink-1)]">
                  No public projects yet.
                </p>
              ) : (
                filteredPublicProjects.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--ink-0)]">
                            {entry.title || entry.projectName}
                          </p>
                          <p className="text-xs text-[var(--ink-1)]">
                            {entry.projectName} · {entry.ownerEmail}
                          </p>
                          <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                            {entry.status}
                          </p>
                          {entry.category ? (
                            <p className="text-[11px] text-[var(--ink-1)]">
                              Category: {entry.category}
                            </p>
                          ) : null}
                          {entry.tags?.length ? (
                            <p className="text-[11px] text-[var(--ink-1)]">
                              {entry.tags.join(", ")}
                            </p>
                          ) : null}
                          {entry.description ? (
                            <p className="mt-1 text-[11px] text-[var(--ink-1)]">
                              {entry.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <button
                            className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                            onClick={() => onImportProject(entry)}
                          >
                            Import
                          </button>
                          <button
                            className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                            onClick={() => onReportProject(entry.id)}
                          >
                            Report
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
        </section>
        )}
      </div>
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink-0)] shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between p-6 pb-0">
              <div>
                <h2 className="display-font text-xl text-[var(--accent-0)]">New project settings</h2>
                <p className="text-xs text-[var(--ink-1)]">Choose a mode and defaults for this project.</p>
              </div>
              <button
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                onClick={() => setCreateOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 max-h-[calc(90vh-96px)] overflow-y-auto p-6 pt-0" data-scrollable>
              <input
                className="h-10 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                placeholder="Project name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <div className="grid grid-cols-3 gap-2">
                {["training", "match", "education"].map((mode) => (
                  <button
                    key={mode}
                    className={`rounded-2xl border px-3 py-2 text-xs ${
                      createMode === mode
                        ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                        : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                    } ${plan !== "PAID" ? "cursor-not-allowed opacity-50" : ""}`}
                    onClick={() =>
                      plan === "PAID" &&
                      setCreateMode(mode as "training" | "match" | "education")
                    }
                    disabled={plan !== "PAID"}
                    data-locked={plan !== "PAID"}
                    title={
                      plan !== "PAID"
                        ? "Mode selection is available on paid plans."
                        : undefined
                    }
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">Labels</p>
                  <label className="flex items-center justify-between text-xs">
                    <span>Show name</span>
                    <input
                      type="checkbox"
                      checked={createPlayerLabel.showName}
                      onChange={(event) =>
                        setCreatePlayerLabel((prev) => ({
                          ...prev,
                          showName: event.target.checked,
                        }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between text-xs">
                    <span>Show position</span>
                    <input
                      type="checkbox"
                      checked={createPlayerLabel.showPosition}
                      onChange={(event) =>
                        setCreatePlayerLabel((prev) => ({
                          ...prev,
                          showPosition: event.target.checked,
                        }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between text-xs">
                    <span>Show number</span>
                    <input
                      type="checkbox"
                      checked={createPlayerLabel.showNumber}
                      onChange={(event) =>
                        setCreatePlayerLabel((prev) => ({
                          ...prev,
                          showNumber: event.target.checked,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">Pitch</p>
                  <select
                    className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                    value={createPitchView}
                    onChange={(event) => {
                      const nextView = event.target.value as
                        | "FULL"
                        | "DEF_HALF"
                        | "OFF_HALF"
                        | "GREEN_EMPTY";
                      setCreatePitchView(nextView);
                      if (nextView !== "GREEN_EMPTY") {
                        setCreatePitchShape("none");
                      }
                    }}
                  >
                    <option value="FULL">Full</option>
                    <option value="DEF_HALF">Half (def)</option>
                    <option value="OFF_HALF">Half (off)</option>
                    <option value="GREEN_EMPTY">Empty</option>
                  </select>
                  {createPitchView === "GREEN_EMPTY" && (
                    <select
                      className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                      value={createPitchShape}
                      onChange={(event) => setCreatePitchShape(event.target.value as any)}
                    >
                      <option value="none">No shape</option>
                      <option value="circle">Circle</option>
                      <option value="square">Square</option>
                      <option value="rect">Rectangle</option>
                    </select>
                  )}
                  <select
                    className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                    value={createPitchOverlay}
                    onChange={(event) => setCreatePitchOverlay(event.target.value as any)}
                  >
                    <option value="NONE">No overlay</option>
                    <option value="THIRDS">Thirds</option>
                    <option value="ZONES_18">Zones</option>
                    <option value="CORRIDORS">Corridors</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-3">
                <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">Boards to create</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {getBoardTemplates(createMode, plan).map((board) => {
                    const checked = createBoards.includes(board.id);
                    return (
                      <label
                        key={board.id}
                        className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs"
                      >
                        <span className="text-[var(--ink-0)]">{board.name}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setCreateBoards((prev) =>
                              event.target.checked
                                ? [...prev, board.id]
                                : prev.filter((id) => id !== board.id)
                            );
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-3">
                <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                  Match squad presets
                </p>
                {plan !== "PAID" ? (
                  <p className="text-xs text-[var(--ink-1)]">
                    Squad presets are available for paid plans.
                  </p>
                ) : squadPresetsLoading ? (
                  <p className="text-xs text-[var(--ink-1)]">
                    Loading presets...
                  </p>
                ) : squadPresetsError ? (
                  <p className="text-xs text-[var(--accent-1)]">
                    {squadPresetsError}
                  </p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-[11px] uppercase text-[var(--ink-1)]">
                        Home preset
                      </span>
                      <select
                        className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                        value={homeSquadPresetId}
                        onChange={(event) => setHomeSquadPresetId(event.target.value)}
                        disabled={plan !== "PAID"}
                        data-locked={plan !== "PAID"}
                      >
                        <option value="">No preset</option>
                        {squadPresets.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] uppercase text-[var(--ink-1)]">
                        Away preset
                      </span>
                      <select
                        className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                        value={awaySquadPresetId}
                        onChange={(event) => setAwaySquadPresetId(event.target.value)}
                        disabled={plan !== "PAID"}
                        data-locked={plan !== "PAID"}
                      >
                        <option value="">No preset</option>
                        {squadPresets.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>
              <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-3">
                <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">Team colors</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase text-[var(--ink-1)]">Home kit</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2">
                        <span>Shirt</span>
                        <input
                          type="color"
                          value={homeKit.shirt}
                          onChange={(event) =>
                            setHomeKit((prev) => ({
                              ...prev,
                              shirt: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span>Shorts</span>
                        <input
                          type="color"
                          value={homeKit.shorts}
                          onChange={(event) =>
                            setHomeKit((prev) => ({
                              ...prev,
                              shorts: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span>Socks</span>
                        <input
                          type="color"
                          value={homeKit.socks}
                          onChange={(event) =>
                            setHomeKit((prev) => ({
                              ...prev,
                              socks: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase text-[var(--ink-1)]">Away kit</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2">
                        <span>Shirt</span>
                        <input
                          type="color"
                          value={awayKit.shirt}
                          onChange={(event) =>
                            setAwayKit((prev) => ({
                              ...prev,
                              shirt: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span>Shorts</span>
                        <input
                          type="color"
                          value={awayKit.shorts}
                          onChange={(event) =>
                            setAwayKit((prev) => ({
                              ...prev,
                              shorts: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span>Socks</span>
                        <input
                          type="color"
                          value={awayKit.socks}
                          onChange={(event) =>
                            setAwayKit((prev) => ({
                              ...prev,
                              socks: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <label className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-3 py-2 text-xs">
                <span>Attach ball to player on drop</span>
                <input
                  type="checkbox"
                  checked={attachBallToPlayer}
                  onChange={(event) => setAttachBallToPlayer(event.target.checked)}
                />
              </label>
              <button
                className="h-10 w-full rounded-full bg-[var(--accent-0)] px-5 text-xs font-semibold text-black transition hover:brightness-110"
                onClick={() => {
                  const limits = getPlanLimits(plan);
                  const existingIds = new Set(index.map((item) => item.id));
                  if (project) {
                    existingIds.add(project.id);
                  }
                  if (existingIds.size >= limits.maxProjects) {
                    setError("Project limit reached for this plan.");
                    return;
                  }
                  if (!name.trim()) {
                    setError("Enter a project name.");
                    return;
                  }
                  const templates = getBoardTemplates(createMode, plan).filter((board) =>
                    createBoards.includes(board.id)
                  );
                  const homePreset = squadPresets.find(
                    (preset) => preset.id === homeSquadPresetId
                  );
                  const awayPreset = squadPresets.find(
                    (preset) => preset.id === awaySquadPresetId
                  );
                  createProject(name.trim(), {
                    homeKit,
                    awayKit,
                    attachBallToPlayer,
                    mode: createMode,
                    pitchView: createPitchView,
                    pitchOverlay: createPitchOverlay,
                    pitchShape: createPitchShape,
                    playerLabel: createPlayerLabel,
                    boardTemplates:
                      templates.length > 0
                        ? templates.map((board) => ({
                            id: board.id,
                            name: board.name,
                            pitchView: board.pitchView,
                            pitchShape: board.pitchShape,
                          }))
                        : undefined,
                    homeSquadPreset: homePreset?.squad,
                    awaySquadPreset: awayPreset?.squad,
                  });
                  setCreateOpen(false);
                  setName("");
                }}
              >
                Create project
              </button>
            </div>
          </div>
        </div>
      )}
      <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} />
      <BetaNoticeModal
        open={betaOpen}
        onClose={() => setBetaOpen(false)}
        context="console"
      />
      {shareProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink-0)] shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="display-font text-xl text-[var(--accent-0)]">
                  Share project
                </h2>
                <p className="text-xs text-[var(--ink-1)]">
                  Choose whether to share by email or publish to the library.
                </p>
              </div>
              <button
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                onClick={() => setShareProjectOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "user", label: "Share by email" },
                  { id: "public", label: "Publish to library" },
                ].map((option) => (
                  <button
                    key={option.id}
                    className={`rounded-2xl border px-3 py-2 text-xs ${
                      shareProjectMode === option.id
                        ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                        : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                    }`}
                    onClick={() =>
                      setShareProjectMode(option.id as "user" | "public")
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {shareProjectMode === "user" ? (
                <>
                  <input
                    className="h-10 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                    placeholder="Recipient email"
                    value={shareRecipient}
                    onChange={(event) => setShareRecipient(event.target.value)}
                  />
                  <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-3">
                    <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                      Boards to share
                    </p>
                    {(() => {
                      const projectToShare = shareProjectId
                        ? loadProject(shareProjectId, authUser?.id ?? null) ??
                          (project?.id === shareProjectId ? project : null)
                        : null;
                      const boards = projectToShare?.boards ?? [];
                      if (boards.length === 0) {
                        return (
                          <p className="text-xs text-[var(--ink-1)]">
                            No boards available.
                          </p>
                        );
                      }
                      return boards.map((board) => {
                        const checked = shareBoardIds.includes(board.id);
                        return (
                          <label
                            key={board.id}
                            className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs"
                          >
                            <span className="text-[var(--ink-0)]">
                              {board.name}
                            </span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                setShareBoardIds((prev) =>
                                  event.target.checked
                                    ? [...prev, board.id]
                                    : prev.filter((id) => id !== board.id)
                                );
                              }}
                            />
                          </label>
                        );
                      });
                    })()}
                  </div>
                  <select
                    className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                    value={sharePermission}
                    onChange={(event) =>
                      setSharePermission(
                        event.target.value as BoardSharePermission
                      )
                    }
                  >
                    <option value="comment">Comment</option>
                    <option value="view">View only</option>
                  </select>
                  <button
                    className="h-10 w-full rounded-full bg-[var(--accent-0)] px-5 text-xs font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                    onClick={onShareProject}
                    disabled={shareSending}
                  >
                    {shareSending ? "Sharing..." : "Share boards"}
                  </button>
                  {shareStatus ? (
                    <p className="text-xs text-[var(--accent-1)]">
                      {shareStatus}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-3">
                    <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">Boards to publish</p>
                    {(() => {
                      const projectToPublish = shareProjectId
                        ? loadProject(shareProjectId, authUser?.id ?? null) ??
                          (project?.id === shareProjectId ? project : null)
                        : null;
                      const boards = projectToPublish?.boards ?? [];
                      if (boards.length === 0) {
                        return (
                          <p className="text-xs text-[var(--ink-1)]">No boards available.</p>
                        );
                      }
                      return boards.map((board) => {
                        const checked = publicProjectBoardIds.includes(board.id);
                        return (
                          <label
                            key={board.id}
                            className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs"
                          >
                            <span className="text-[var(--ink-0)]">{board.name}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                setPublicProjectBoardIds((prev) =>
                                  event.target.checked
                                    ? [...prev, board.id]
                                    : prev.filter((id) => id !== board.id)
                                );
                              }}
                            />
                          </label>
                        );
                      });
                    })()}
                  </div>
                  <input
                    className="h-10 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                    placeholder="Title"
                    value={publicProjectTitle}
                    onChange={(event) =>
                      setPublicProjectTitle(event.target.value)
                    }
                    disabled={!can(plan, "board.share")}
                  />
                  <textarea
                    className="min-h-[80px] w-full rounded-2xl border border-[var(--line)] bg-transparent p-2 text-xs text-[var(--ink-0)]"
                    placeholder="Description"
                    value={publicProjectDescription}
                    onChange={(event) =>
                      setPublicProjectDescription(event.target.value)
                    }
                    disabled={!can(plan, "board.share")}
                  />
                  <select
                    className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                    value={publicProjectCategory}
                    onChange={(event) =>
                      setPublicProjectCategory(event.target.value)
                    }
                    disabled={!can(plan, "board.share")}
                  >
                    <option value="">Category</option>
                    {categoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <input
                    className="h-10 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                    placeholder="Tags (comma separated)"
                    value={publicProjectTags}
                    onChange={(event) =>
                      setPublicProjectTags(event.target.value)
                    }
                    disabled={!can(plan, "board.share")}
                  />
                  <div className="flex gap-2">
                    <button
                      className="h-10 flex-1 rounded-full bg-[var(--accent-0)] px-5 text-xs font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                      onClick={onPublishProject}
                      disabled={!can(plan, "board.share") || publicProjectLoading}
                    >
                      {publicProjectEntry ? "Update listing" : "Publish project"}
                    </button>
                    <button
                      className="h-10 flex-1 rounded-full border border-[var(--line)] px-5 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)] disabled:cursor-not-allowed disabled:opacity-70"
                      onClick={onUnpublishProject}
                      disabled={!publicProjectEntry || publicProjectLoading}
                    >
                      Remove
                    </button>
                  </div>
                  {!can(plan, "board.share") && (
                    <p className="text-[11px] text-[var(--accent-1)]">
                      Publishing is available on paid plans.
                    </p>
                  )}
                  {publicProjectEntry && (
                    <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                      Status: {publicProjectEntry.status}
                    </p>
                  )}
                  {publicProjectStatus ? (
                    <p className="text-xs text-[var(--accent-1)]">
                      {publicProjectStatus}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {contactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink-0)] shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="display-font text-xl text-[var(--accent-0)]">
                  Contact Teamzone
                </h2>
                <p className="text-xs text-[var(--ink-1)]">
                  For questions or feedback outside of bug reports.
                </p>
              </div>
              <button
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                onClick={() => setContactOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <input
                className="h-10 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                placeholder="Your email (optional)"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
              />
              <input
                className="h-10 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                placeholder="Subject (optional)"
                value={contactSubject}
                onChange={(event) => setContactSubject(event.target.value)}
              />
              <textarea
                className="min-h-[120px] w-full rounded-2xl border border-[var(--line)] bg-transparent p-2 text-xs text-[var(--ink-0)]"
                placeholder="Message"
                value={contactMessage}
                onChange={(event) => setContactMessage(event.target.value)}
              />
              <button
                className="h-10 w-full rounded-full bg-[var(--accent-0)] px-5 text-xs font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={onContactSubmit}
                disabled={contactSending}
              >
                {contactSending ? "Sending..." : "Send message"}
              </button>
              {contactStatus ? (
                <p className="text-xs text-[var(--accent-1)]">{contactStatus}</p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
