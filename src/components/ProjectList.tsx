"use client";

import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/state/useProjectStore";
import { deserializeProject } from "@/persistence/serialize";
import { loadProject } from "@/persistence/storage";
import type {
  BoardSharePermission,
  JerseyType,
  Project,
  PublicProject,
  Squad,
  TeamDirectoryClub,
  TeamDirectoryTeam,
} from "@/models";
import { can, getPlanLimits } from "@/utils/plan";
import { createId } from "@/utils/id";
import { clone } from "@/utils/clone";
import {
  duplicateProjectWithFreshIds,
  FORMATION_PRESETS,
  getDefaultBoardSettings,
} from "@/state/projectHelpers";
import AdBanner from "@/components/AdBanner";
import PlanModal from "@/components/PlanModal";
import BetaNoticeModal from "@/components/BetaNoticeModal";
import ColorPalettePicker from "@/components/ColorPalettePicker";
import { fetchProjectCloud } from "@/persistence/cloud";
import { submitContactMessage } from "@/persistence/contact";
import {
  fetchPublicProjects,
  fetchPublicProjectData,
  fetchPublicProjectForOwner,
  publishPublicProject,
  unpublishPublicProject,
  reportPublicProject,
} from "@/persistence/publicProjects";
import {
  createBoardShare,
  fetchBoardShareById,
  fetchLatestCommentsForShares,
  fetchSharedBoards,
  fetchSharesByOwner,
} from "@/persistence/shares";
import {
  createProjectFromTemplate,
  loadProjectTemplates,
  type ProjectTemplate,
} from "@/persistence/projectTemplates";
import { loadDefaultLinkedTeams } from "@/persistence/defaultLinkedTeams";
import {
  loadActiveTeamSelection,
  saveActiveTeamSelection,
  type ActiveTeamSelection,
} from "@/persistence/activeTeamSelection";
import { fetchClubTeamDirectory } from "@/persistence/teamDirectory";
import {
  fetchAdminAnalytics,
  fetchAdminReports,
  fetchAdminUserMemberships,
  fetchAdminUsers,
  createAdminClub,
  createAdminUserClubMembership,
  createAdminTeam,
  createAdminUserTeamMembership,
  updateAdminClubDetails,
  updateAdminTeamDetails,
  updateAdminUserClubMembership,
  updateAdminUserTeamMembership,
  updateAdminUserFlags,
  type AdminClubMembershipRow,
  type AdminTeamMembershipRow,
  type AdminUserMemberships,
  type AdminReportRow,
  type AdminAnalyticsResponse,
  type AdminUserRow,
} from "@/persistence/admin";
import { usePollLeader } from "@/hooks/usePollLeader";

export default function ProjectList() {
  const teamJerseyTypeOptions: JerseyType[] = [
    "solid",
    "split",
    "stripe",
    "sash",
    "pinstripe",
  ];
  type ShareListItem = {
    id: string;
    ownerId: string;
    ownerEmail: string;
    recipientEmail: string;
    boardId: string;
    boardName: string;
    projectName: string;
    permission: BoardSharePermission;
    createdAt: string;
    updatedAt: string;
  };
  const showBetaUi = process.env.NEXT_PUBLIC_BETA_UI === "true";
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
  const syncStatus = useProjectStore((state) => state.syncStatus);
  const plan = useProjectStore((state) => state.plan);
  const project = useProjectStore((state) => state.project);
  const authUser = useProjectStore((state) => state.authUser);
  const isSharedPollLeader = usePollLeader(
    `shared:${authUser?.id ?? "anon"}`,
    !!authUser?.id
  );
  const [planOpen, setPlanOpen] = useState(false);
  const [betaOpen, setBetaOpen] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
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
  const [sharedBoards, setSharedBoards] = useState<ShareListItem[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [sharedUnread, setSharedUnread] = useState(0);
  const [commentUnread, setCommentUnread] = useState(0);
  const [sharedByMe, setSharedByMe] = useState<ShareListItem[]>([]);
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
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState<string | null>(null);
  const [adminReports, setAdminReports] = useState<AdminReportRow[]>([]);
  const [adminReportsLoading, setAdminReportsLoading] = useState(false);
  const [adminReportsError, setAdminReportsError] = useState<string | null>(null);
  const [adminAnalytics, setAdminAnalytics] =
    useState<AdminAnalyticsResponse | null>(null);
  const [adminAnalyticsLoading, setAdminAnalyticsLoading] = useState(false);
  const [adminAnalyticsError, setAdminAnalyticsError] = useState<string | null>(
    null
  );
  const [adminUpdatingUserId, setAdminUpdatingUserId] = useState<string | null>(
    null
  );
  const [adminMembershipEditorUserId, setAdminMembershipEditorUserId] = useState<string | null>(
    null
  );
  const [adminMembershipTab, setAdminMembershipTab] = useState<"clubs" | "teams">("clubs");
  const [adminMemberships, setAdminMemberships] = useState<Record<string, AdminUserMemberships>>(
    {}
  );
  const [adminMembershipsLoadingUserId, setAdminMembershipsLoadingUserId] = useState<string | null>(
    null
  );
  const [adminMembershipsError, setAdminMembershipsError] = useState<string | null>(null);
  const [adminNewClubId, setAdminNewClubId] = useState("");
  const [adminNewClubName, setAdminNewClubName] = useState("");
  const [adminNewClubRole, setAdminNewClubRole] = useState("member");
  const [adminNewClubAdmin, setAdminNewClubAdmin] = useState(false);
  const [adminNewTeamClubId, setAdminNewTeamClubId] = useState("");
  const [adminNewTeamId, setAdminNewTeamId] = useState("");
  const [adminNewTeamName, setAdminNewTeamName] = useState("");
  const [adminNewTeamType, setAdminNewTeamType] = useState("other");
  const [adminNewTeamAgeGroup, setAdminNewTeamAgeGroup] = useState("");
  const [adminNewTeamSeasonLabel, setAdminNewTeamSeasonLabel] = useState("");
  const [adminNewTeamRole, setAdminNewTeamRole] = useState("player");
  const [adminNewTeamPosition, setAdminNewTeamPosition] = useState("");
  const [adminNewTeamAdmin, setAdminNewTeamAdmin] = useState(false);
  const [adminQuery, setAdminQuery] = useState("");
  const [adminUsersPage, setAdminUsersPage] = useState(1);
  const [recentProjectsPage, setRecentProjectsPage] = useState(1);
  const [projectsQuery, setProjectsQuery] = useState("");
  const [favoriteProjectIds, setFavoriteProjectIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<
    "training" | "match" | "education" | "custom"
  >("match");
  const [createPitchView, setCreatePitchView] = useState<"FULL" | "DEF_HALF" | "OFF_HALF" | "GREEN_EMPTY">("FULL");
  const [createPitchOverlay, setCreatePitchOverlay] = useState<"NONE" | "THIRDS" | "ZONES_18" | "CORRIDORS">("NONE");
  const [createPitchShape, setCreatePitchShape] = useState<"none" | "circle" | "square" | "rect">("none");
  const [createPlayerLabel, setCreatePlayerLabel] = useState({
    showName: true,
    showPosition: false,
    showNumber: false,
  });
  const [createBoards, setCreateBoards] = useState<string[]>([]);
  const [createBoardNames, setCreateBoardNames] = useState<Record<string, string>>(
    {}
  );
  const [editingCreateBoardId, setEditingCreateBoardId] = useState<string | null>(
    null
  );
  const [startingFormation, setStartingFormation] = useState<string>("none");
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>(
    []
  );
  const [createTeamDirectory, setCreateTeamDirectory] = useState<TeamDirectoryClub[]>([]);
  const [createTeamDirectoryLoading, setCreateTeamDirectoryLoading] = useState(false);
  const [createTeamDirectoryError, setCreateTeamDirectoryError] = useState<string | null>(null);
  const [selectedHomeTeamId, setSelectedHomeTeamId] = useState("");
  const [selectedAwayTeamId, setSelectedAwayTeamId] = useState("");
  const [activeTeamSelection, setActiveTeamSelection] =
    useState<ActiveTeamSelection | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [consoleTab, setConsoleTab] = useState<
    "recent" | "favourites" | "shared" | "library" | "admin"
  >("recent");
  const fileRef = useRef<HTMLInputElement>(null);
  const limits = getPlanLimits(plan);
  const projectCount = new Set(
    [...index.map((item) => item.id), project?.id].filter(Boolean)
  ).size;
  const projectLimitReached =
    Number.isFinite(limits.maxProjects) && projectCount >= limits.maxProjects;
  const recentProjectsPageSize = 8;
  const favouriteSet = new Set(favoriteProjectIds);
  const visibleProjects =
    consoleTab === "favourites"
      ? index.filter((item) => favouriteSet.has(item.id))
      : index;
  const filteredProjects = visibleProjects.filter((item) => {
    const query = projectsQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }
    const haystack = [item.name, item.id, item.updatedAt].join(" ").toLowerCase();
    return haystack.includes(query);
  });
  const totalRecentProjectsPages = Math.max(
    1,
    Math.ceil(filteredProjects.length / recentProjectsPageSize)
  );
  const paginatedRecentProjects = filteredProjects.slice(
    (recentProjectsPage - 1) * recentProjectsPageSize,
    recentProjectsPage * recentProjectsPageSize
  );
  const adminUsersPageSize = 15;
  const filteredAdminUsers = adminUsers.filter((user) => {
    const q = adminQuery.trim().toLowerCase();
    if (!q) {
      return true;
    }
    return (
      user.id.toLowerCase().includes(q) ||
      (user.email ?? "").toLowerCase().includes(q) ||
      (user.name ?? "").toLowerCase().includes(q)
    );
  });
  const totalAdminUsersPages = Math.max(
    1,
    Math.ceil(filteredAdminUsers.length / adminUsersPageSize)
  );
  const paginatedAdminUsers = filteredAdminUsers.slice(
    (adminUsersPage - 1) * adminUsersPageSize,
    adminUsersPage * adminUsersPageSize
  );
  const activeAdminMemberships = adminMembershipEditorUserId
    ? adminMemberships[adminMembershipEditorUserId] ?? null
    : null;
  const activeAdminMembershipUser = adminMembershipEditorUserId
    ? adminUsers.find((user) => user.id === adminMembershipEditorUserId) ?? null
    : null;
  const adminAvailableTeamsForNewMembership = activeAdminMemberships
    ? activeAdminMemberships.teams.filter((team) => team.clubId === adminNewTeamClubId)
    : [];

  const getBoardTemplates = (
    mode: "training" | "match" | "education",
    planMode: typeof plan
  ): {
    id: string;
    name: string;
    pitchView?: "FULL" | "DEF_HALF" | "OFF_HALF" | "GREEN_EMPTY";
    pitchShape?: "none" | "circle" | "square" | "rect";
    pitchRotation?: 0 | 180;
  }[] => {
    if (planMode !== "PAID") {
      return [{ id: "board-1", name: "Board 1", pitchView: "FULL" }];
    }
    if (mode === "match") {
      return [
        {
          id: "team-setup",
          name: "Team Setup",
          pitchView: "FULL",
          pitchRotation: 180,
        },
        {
          id: "build-up",
          name: "Build-up",
          pitchView: "FULL",
          pitchRotation: 180,
        },
        {
          id: "off-setup",
          name: "Offensive Setup",
          pitchView: "FULL",
          pitchRotation: 180,
        },
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const query = window.matchMedia("(max-width: 900px)");
    const update = () => setIsSmallScreen(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
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
    if (!isSharedPollLeader) {
      return;
    }
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
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
    if (consoleTab !== "shared") {
      return;
    }
    refreshShared();
    const interval = window.setInterval(refreshShared, 120000);
    return () => window.clearInterval(interval);
  }, [authUser, plan, consoleTab, isSharedPollLeader]);

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

  const onImportProject = async (entry: PublicProject) => {
    let projectData = entry.projectData;
    if (!projectData) {
      const result = await fetchPublicProjectData(entry.id);
      if (!result.ok) {
        setPublicProjectsError(result.error);
        return;
      }
      projectData = result.projectData;
    }
    const nextProject = clone(projectData);
    nextProject.id = createId();
    nextProject.name = entry.title || entry.projectName;
    nextProject.createdAt = new Date().toISOString();
    nextProject.updatedAt = nextProject.createdAt;
    openProjectFromData(nextProject);
  };

  const openSharedBoardById = async (shareId: string) => {
    const result = await fetchBoardShareById(shareId);
    if (!result.ok) {
      setSharedError(result.error);
      return;
    }
    openSharedBoard(result.share);
  };

  useEffect(() => {
    const paid = plan === "PAID";
    const nextMode = paid ? createMode : "match";
    if (!paid && createMode !== "match") {
      setCreateMode("match");
    }
    if (nextMode === "custom") {
      return;
    }
    const defaults = getDefaultBoardSettings(nextMode);
    setAttachBallToPlayer(defaults.attachBallToPlayer);
    setCreatePitchView(paid ? defaults.pitchView : "FULL");
    setCreatePitchOverlay(defaults.pitchOverlay);
    setCreatePitchShape(paid ? defaults.pitchShape : "none");
    setCreatePlayerLabel(defaults.playerLabel);
    const defaultsBoards = getBoardTemplates(nextMode, plan);
    setCreateBoards(defaultsBoards.map((board) => board.id));
    setCreateBoardNames(
      defaultsBoards.reduce<Record<string, string>>((acc, board) => {
        acc[board.id] = board.name;
        return acc;
      }, {})
    );
    setEditingCreateBoardId(null);
    setStartingFormation("none");
  }, [createMode, plan]);
  useEffect(() => {
    if (!createOpen) {
      return;
    }
    if (plan !== "PAID" || !authUser) {
      setProjectTemplates([]);
      setSelectedTemplateId("");
      return;
    }
    const templates = loadProjectTemplates(authUser?.id ?? null);
    setProjectTemplates(templates);
    if (templates.length === 0) {
      setSelectedTemplateId("");
      return;
    }
    setSelectedTemplateId((current) =>
      current && templates.some((item) => item.id === current)
        ? current
        : templates[0]!.id
    );
  }, [authUser?.id, createOpen, plan]);
  useEffect(() => {
    setActiveTeamSelection(loadActiveTeamSelection(authUser?.id ?? null));
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser) {
      setCreateTeamDirectory([]);
      setCreateTeamDirectoryError(null);
      setSelectedHomeTeamId("");
      setSelectedAwayTeamId("");
      return;
    }
    let cancelled = false;
    setCreateTeamDirectoryLoading(true);
    setCreateTeamDirectoryError(null);
    fetchClubTeamDirectory()
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (!result.ok) {
          setCreateTeamDirectory([]);
          setCreateTeamDirectoryError(result.error);
          return;
        }
        setCreateTeamDirectory(result.clubs);
      })
      .finally(() => {
        if (!cancelled) {
          setCreateTeamDirectoryLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const availableCreateTeams = createTeamDirectory.flatMap((club) =>
    club.teams.map((team) => ({
      club,
      team,
    }))
  );
  const availableCreateClubs = createTeamDirectory.filter((club) => club.teams.length > 0);
  const activeCreateClubId =
    activeTeamSelection?.clubId &&
    availableCreateClubs.some((club) => club.id === activeTeamSelection.clubId)
      ? activeTeamSelection.clubId
      : activeTeamSelection?.teamId
        ? availableCreateTeams.find(({ team }) => team.id === activeTeamSelection.teamId)?.club.id ??
          availableCreateClubs[0]?.id ??
          ""
        : availableCreateClubs[0]?.id ?? "";
  const activeCreateClub =
    availableCreateClubs.find((club) => club.id === activeCreateClubId) ?? null;
  const activeCreateClubTeams = activeCreateClub?.teams ?? [];

  const setCurrentActiveTeam = (teamId: string) => {
    const nextEntry =
      availableCreateTeams.find(({ team }) => team.id === teamId) ?? null;
    if (!nextEntry) {
      return;
    }
    const nextSelection: ActiveTeamSelection = {
      clubId: nextEntry.club.id,
      teamId: nextEntry.team.id,
      clubName: nextEntry.club.name,
      teamName: nextEntry.team.name,
      updatedAt: new Date().toISOString(),
    };
    setActiveTeamSelection(nextSelection);
    saveActiveTeamSelection(
      {
        clubId: nextSelection.clubId,
        teamId: nextSelection.teamId,
        clubName: nextSelection.clubName,
        teamName: nextSelection.teamName,
      },
      authUser?.id ?? null
    );
  };

  const setCurrentActiveClub = (clubId: string) => {
    const nextClub = availableCreateClubs.find((club) => club.id === clubId) ?? null;
    const nextTeam = nextClub?.teams[0] ?? null;
    if (!nextTeam) {
      return;
    }
    setCurrentActiveTeam(nextTeam.id);
  };

  useEffect(() => {
    if (availableCreateTeams.length === 0) {
      return;
    }
    const activeTeamId =
      activeTeamSelection?.teamId &&
      availableCreateTeams.some(({ team }) => team.id === activeTeamSelection.teamId)
        ? activeTeamSelection.teamId
        : availableCreateTeams[0]!.team.id;
    if (activeTeamId !== activeTeamSelection?.teamId) {
      setCurrentActiveTeam(activeTeamId);
    }
    const defaultLinkedTeams = loadDefaultLinkedTeams(authUser?.id ?? null);
    setSelectedHomeTeamId((current) =>
      current && availableCreateTeams.some(({ team }) => team.id === current)
        ? current
        : activeTeamId &&
            availableCreateTeams.some(({ team }) => team.id === activeTeamId)
          ? activeTeamId
        : defaultLinkedTeams.homeTeamId &&
            availableCreateTeams.some(
              ({ team }) => team.id === defaultLinkedTeams.homeTeamId
            )
          ? defaultLinkedTeams.homeTeamId
          : availableCreateTeams[0]!.team.id
    );
    setSelectedAwayTeamId((current) =>
      current && availableCreateTeams.some(({ team }) => team.id === current)
        ? current
        : defaultLinkedTeams.awayTeamId &&
            availableCreateTeams.some(
              ({ team }) => team.id === defaultLinkedTeams.awayTeamId
            )
          ? defaultLinkedTeams.awayTeamId
          : availableCreateTeams.find(({ team }) => team.id !== activeTeamId)?.team.id ?? ""
    );
  }, [createOpen, availableCreateTeams, authUser?.id, activeTeamSelection?.teamId]);

  const getCreateTeamById = (teamId: string): TeamDirectoryTeam | null =>
    availableCreateTeams.find(({ team }) => team.id === teamId)?.team ?? null;

  const selectedHomeTeam = getCreateTeamById(selectedHomeTeamId);
  const selectedAwayTeam = getCreateTeamById(selectedAwayTeamId);
  const createEmptySquadPreset = (
    sideName: string,
    kit: {
      shirt: string;
      shirtSecondary?: string;
      shorts: string;
      socks: string;
      vest?: string;
      jerseyType?: "solid" | "split" | "stripe" | "sash" | "pinstripe";
    }
  ): Squad => ({
    id: createId(),
    name: sideName,
    kit: { ...kit },
    players: [],
    substituteIds: [],
  });

  useEffect(() => {
    if (selectedHomeTeam) {
      setHomeKit({
        ...selectedHomeTeam.squad.kit,
        vest: selectedHomeTeam.squad.kit.vest ?? "",
      });
    }
  }, [selectedHomeTeam]);

  useEffect(() => {
    if (selectedAwayTeam) {
      setAwayKit({
        ...selectedAwayTeam.squad.kit,
        vest: selectedAwayTeam.squad.kit.vest ?? "",
      });
    }
  }, [selectedAwayTeam]);

  const onCreate = () => {
    if (!name.trim()) {
      setError("Enter a project name.");
      return;
    }
    setCreateOpen(true);
  };

  const createTemplateOptions =
    createMode === "custom" ? [] : getBoardTemplates(createMode, plan);

  const readJsonFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsText(file);
    });

  const onImport = async (file: File) => {
    if (!can(plan, "project.import")) {
      setError("Import is not available on this plan.");
      return;
    }
    try {
      const text = await readJsonFile(file);
      const result = deserializeProject(text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const project = result.project as Project;
      openProjectFromData(project);
      setError(null);
    } catch {
      setError("Could not import file. Check that it is a valid JSON export.");
    }
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

  const refreshAdminData = async () => {
    setAdminUsersLoading(true);
    setAdminReportsLoading(true);
    setAdminAnalyticsLoading(true);
    setAdminUsersError(null);
    setAdminReportsError(null);
    setAdminAnalyticsError(null);
    const [usersResult, reportsResult, analyticsResult] = await Promise.all([
      fetchAdminUsers(),
      fetchAdminReports(),
      fetchAdminAnalytics(),
    ]);
    if (!usersResult.ok) {
      setAdminUsersError(usersResult.error);
      setAdminUsers([]);
    } else {
      setAdminUsers(usersResult.users);
    }
    if (!reportsResult.ok) {
      setAdminReportsError(reportsResult.error);
      setAdminReports([]);
    } else {
      setAdminReports(reportsResult.reports);
    }
    if (!analyticsResult.ok) {
      setAdminAnalyticsError(analyticsResult.error);
      setAdminAnalytics(null);
    } else {
      setAdminAnalytics(analyticsResult.analytics);
    }
    setAdminUsersLoading(false);
    setAdminReportsLoading(false);
    setAdminAnalyticsLoading(false);
  };

  useEffect(() => {
    if (consoleTab !== "admin" || !authUser?.isAdmin) {
      return;
    }
    void refreshAdminData();
  }, [consoleTab, authUser?.isAdmin]);

  useEffect(() => {
    if (consoleTab === "admin" && !authUser?.isAdmin) {
      setConsoleTab("recent");
    }
  }, [consoleTab, authUser?.isAdmin]);

  useEffect(() => {
    if (!activeAdminMemberships) {
      return;
    }
    const nextTeamId =
      activeAdminMemberships.teams.find((team) => team.clubId === adminNewTeamClubId)?.id ?? "";
    setAdminNewTeamId((current) =>
      current &&
      activeAdminMemberships.teams.some(
        (team) => team.id === current && team.clubId === adminNewTeamClubId
      )
        ? current
        : nextTeamId
    );
  }, [activeAdminMemberships, adminNewTeamClubId]);

  useEffect(() => {
    setAdminUsersPage(1);
  }, [adminQuery]);

  useEffect(() => {
    if (adminUsersPage > totalAdminUsersPages) {
      setAdminUsersPage(totalAdminUsersPages);
    }
  }, [adminUsersPage, totalAdminUsersPages]);

  useEffect(() => {
    if (recentProjectsPage > totalRecentProjectsPages) {
      setRecentProjectsPage(totalRecentProjectsPages);
    }
  }, [recentProjectsPage, totalRecentProjectsPages]);

  useEffect(() => {
    if (consoleTab === "recent" || consoleTab === "favourites") {
      setRecentProjectsPage(1);
    }
  }, [consoleTab]);

  useEffect(() => {
    setRecentProjectsPage(1);
  }, [projectsQuery]);

  const favoritesStorageKey = authUser?.id
    ? `tacticsboard:favourites:${authUser.id}`
    : "tacticsboard:favourites:anon";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const raw = window.localStorage.getItem(favoritesStorageKey);
    if (!raw) {
      setFavoriteProjectIds([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        setFavoriteProjectIds(parsed.filter((item) => typeof item === "string"));
      } else {
        setFavoriteProjectIds([]);
      }
    } catch {
      setFavoriteProjectIds([]);
    }
  }, [favoritesStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      favoritesStorageKey,
      JSON.stringify(favoriteProjectIds)
    );
  }, [favoriteProjectIds, favoritesStorageKey]);

  const onDuplicateProject = async (projectId: string) => {
    let sourceProject = loadProject(projectId, authUser?.id ?? null);
    if (!sourceProject && authUser && typeof window !== "undefined" && navigator.onLine) {
      sourceProject = await fetchProjectCloud(projectId);
    }
    if (!sourceProject) {
      setError("Project is not available to duplicate.");
      return;
    }
    if (!Array.isArray(sourceProject.boards) || sourceProject.boards.length === 0) {
      setError("Project data is incomplete. Open the source project once and try again.");
      return;
    }
    const duplicate = duplicateProjectWithFreshIds(
      sourceProject,
      `${sourceProject.name} (copy)`
    );
    openProjectFromData(duplicate);
    setError(null);
  };

  const loadAdminMembershipsForUser = async (userId: string) => {
    setAdminMembershipsLoadingUserId(userId);
    setAdminMembershipsError(null);
    const result = await fetchAdminUserMemberships(userId);
    if (!result.ok) {
      setAdminMembershipsError(result.error);
      setAdminMembershipsLoadingUserId(null);
      return;
    }
    setAdminMemberships((prev) => ({
      ...prev,
      [userId]: result.memberships,
    }));
    const firstClubId = result.memberships.clubs[0]?.id ?? "";
    const firstTeamClubId = result.memberships.clubs[0]?.id ?? "";
    const firstTeamId =
      result.memberships.teams.find((team) => team.clubId === firstTeamClubId)?.id ?? "";
    setAdminNewClubId(firstClubId);
    setAdminNewClubName("");
    setAdminNewClubRole("member");
    setAdminNewClubAdmin(false);
    setAdminNewTeamClubId(firstTeamClubId);
    setAdminNewTeamId(firstTeamId);
    setAdminNewTeamName("");
    setAdminNewTeamType("other");
    setAdminNewTeamAgeGroup("");
    setAdminNewTeamSeasonLabel("");
    setAdminNewTeamRole("player");
    setAdminNewTeamPosition("");
    setAdminNewTeamAdmin(false);
    setAdminMembershipsLoadingUserId(null);
  };

  const toggleAdminMembershipEditor = async (userId: string) => {
    if (adminMembershipEditorUserId === userId) {
      setAdminMembershipEditorUserId(null);
      setAdminMembershipsError(null);
      return;
    }
    setAdminMembershipTab("clubs");
    setAdminMembershipEditorUserId(userId);
    await loadAdminMembershipsForUser(userId);
  };

  const saveAdminClubMembership = async (
    userId: string,
    membership: AdminClubMembershipRow
  ) => {
    setAdminUpdatingUserId(userId);
    setAdminMembershipsError(null);
    const result = await updateAdminUserClubMembership({
      membershipId: membership.id,
      clubRole: membership.clubRole,
      isClubAdmin: membership.isClubAdmin,
    });
    if (!result.ok) {
      setAdminMembershipsError(result.error);
      setAdminUpdatingUserId(null);
      return;
    }
    await loadAdminMembershipsForUser(userId);
    setAdminUpdatingUserId(null);
  };

  const saveAdminTeamMembership = async (
    userId: string,
    membership: AdminTeamMembershipRow
  ) => {
    setAdminUpdatingUserId(userId);
    setAdminMembershipsError(null);
    const result = await updateAdminUserTeamMembership({
      membershipId: membership.id,
      teamRole: membership.teamRole,
      teamPosition: membership.teamPosition,
      isTeamAdmin: membership.isTeamAdmin,
    });
    if (!result.ok) {
      setAdminMembershipsError(result.error);
      setAdminUpdatingUserId(null);
      return;
    }
    await loadAdminMembershipsForUser(userId);
    setAdminUpdatingUserId(null);
  };

  const saveAdminClubDetails = async (
    userId: string,
    membership: AdminClubMembershipRow
  ) => {
    setAdminUpdatingUserId(userId);
    setAdminMembershipsError(null);
    const result = await updateAdminClubDetails({
      clubId: membership.clubId,
      clubName: membership.clubName,
      clubLogoUrl: membership.clubLogoUrl,
      kitShirt: membership.kitShirt,
      kitShirtSecondary: membership.kitShirtSecondary,
      kitShorts: membership.kitShorts,
      kitSocks: membership.kitSocks,
      kitVest: membership.kitVest,
      kitJerseyType: membership.kitJerseyType,
    });
    if (!result.ok) {
      setAdminMembershipsError(result.error);
      setAdminUpdatingUserId(null);
      return;
    }
    await loadAdminMembershipsForUser(userId);
    setAdminUpdatingUserId(null);
  };

  const patchAdminTeamMembershipDraft = (
    userId: string,
    membershipId: string,
    patch: Partial<AdminTeamMembershipRow>
  ) => {
    setAdminMemberships((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] ?? activeAdminMemberships),
        teamMemberships: (
          prev[userId]?.teamMemberships ?? activeAdminMemberships?.teamMemberships ?? []
        ).map((entry) =>
          entry.id === membershipId ? { ...entry, ...patch } : entry
        ),
      },
    }));
  };

  const saveAdminTeamDetails = async (
    userId: string,
    membership: AdminTeamMembershipRow
  ) => {
    setAdminUpdatingUserId(userId);
    setAdminMembershipsError(null);
    const result = await updateAdminTeamDetails({
      teamId: membership.teamId,
      teamName: membership.teamName,
      teamLogoUrl: membership.teamLogoUrl,
      teamType: membership.teamType,
      ageGroup: membership.ageGroup,
      seasonLabel: membership.seasonLabel,
      kitShirt: membership.kitShirt,
      kitShirtSecondary: membership.kitShirtSecondary,
      kitShorts: membership.kitShorts,
      kitSocks: membership.kitSocks,
      kitVest: membership.kitVest,
      kitJerseyType: membership.kitJerseyType,
    });
    if (!result.ok) {
      setAdminMembershipsError(result.error);
      setAdminUpdatingUserId(null);
      return;
    }
    await loadAdminMembershipsForUser(userId);
    setAdminUpdatingUserId(null);
  };

  const addAdminClubMembership = async (userId: string) => {
    if (!adminNewClubId) {
      setAdminMembershipsError("Select a club.");
      return;
    }
    setAdminUpdatingUserId(userId);
    setAdminMembershipsError(null);
    const result = await createAdminUserClubMembership({
      userId,
      clubId: adminNewClubId,
      clubRole: adminNewClubRole,
      isClubAdmin: adminNewClubAdmin,
    });
    if (!result.ok) {
      setAdminMembershipsError(result.error);
      setAdminUpdatingUserId(null);
      return;
    }
    await loadAdminMembershipsForUser(userId);
    setAdminUpdatingUserId(null);
  };

  const createAdminClubForUser = async (userId: string) => {
    if (!adminNewClubName.trim()) {
      setAdminMembershipsError("Enter a club name.");
      return;
    }
    setAdminUpdatingUserId(userId);
    setAdminMembershipsError(null);
    const result = await createAdminClub({
      userId,
      clubName: adminNewClubName,
      clubRole: adminNewClubRole,
      isClubAdmin: true,
    });
    if (!result.ok) {
      setAdminMembershipsError(result.error);
      setAdminUpdatingUserId(null);
      return;
    }
    await loadAdminMembershipsForUser(userId);
    setAdminUpdatingUserId(null);
  };

  const addAdminTeamMembership = async (userId: string) => {
    if (!adminNewTeamId) {
      setAdminMembershipsError("Select a team.");
      return;
    }
    setAdminUpdatingUserId(userId);
    setAdminMembershipsError(null);
    const result = await createAdminUserTeamMembership({
      userId,
      teamId: adminNewTeamId,
      teamRole: adminNewTeamRole,
      teamPosition: adminNewTeamPosition,
      isTeamAdmin: adminNewTeamAdmin,
    });
    if (!result.ok) {
      setAdminMembershipsError(result.error);
      setAdminUpdatingUserId(null);
      return;
    }
    await loadAdminMembershipsForUser(userId);
    setAdminUpdatingUserId(null);
  };

  const createAdminTeamForUser = async (userId: string) => {
    if (!adminNewTeamClubId || !adminNewTeamName.trim()) {
      setAdminMembershipsError("Select a club and enter a team name.");
      return;
    }
    setAdminUpdatingUserId(userId);
    setAdminMembershipsError(null);
    const result = await createAdminTeam({
      userId,
      clubId: adminNewTeamClubId,
      teamName: adminNewTeamName,
      teamType: adminNewTeamType,
      ageGroup: adminNewTeamAgeGroup,
      seasonLabel: adminNewTeamSeasonLabel,
      teamRole: adminNewTeamRole,
      teamPosition: adminNewTeamPosition,
      isTeamAdmin: adminNewTeamAdmin,
    });
    if (!result.ok) {
      setAdminMembershipsError(result.error);
      setAdminUpdatingUserId(null);
      return;
    }
    await loadAdminMembershipsForUser(userId);
    setAdminUpdatingUserId(null);
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

  const consoleTabs = (
    [
      { id: "recent", label: "Recent" },
      { id: "favourites", label: "Favourites" },
      { id: "shared", label: "Shared" },
      { id: "library", label: "Library" },
    ] as const
  );

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
            {authUser?.isAdmin ? (
              <button
                className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-widest ${
                  consoleTab === "admin"
                    ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--accent-0)]"
                    : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                }`}
                onClick={() => setConsoleTab("admin")}
              >
                Admin
              </button>
            ) : null}
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
          {showBetaUi && (
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
          )}
          {isSmallScreen && (
            <div className="mt-3 rounded-2xl border border-[var(--line)] bg-black/20 p-3 text-xs text-[var(--ink-1)]">
              This site is designed for larger screens. For the best experience,
              use a tablet or desktop.
            </div>
          )}
        </header>

        {(consoleTab === "recent" || consoleTab === "favourites") && (
        <section className="grid gap-6 rounded-3xl border border-[var(--line)] bg-[var(--panel)]/80 p-6 shadow-2xl shadow-black/40 md:grid-cols-[0.95fr_1.05fr]">
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
                    void onImport(file);
                  }
                  event.currentTarget.value = "";
                }}
              />
            </div>
            {error ? (
              <p className="text-xs text-[var(--accent-1)]">{error}</p>
            ) : null}
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/60 p-3">
              <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                Current team
              </p>
              {availableCreateTeams.length > 0 ? (
                <>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                        Current club
                      </span>
                      <select
                        className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-sm text-[var(--ink-0)]"
                        value={activeCreateClubId}
                        onChange={(event) => setCurrentActiveClub(event.target.value)}
                      >
                        {availableCreateClubs.map((club) => (
                          <option key={`console-club-${club.id}`} value={club.id}>
                            {club.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                        Current team
                      </span>
                      <select
                        className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-sm text-[var(--ink-0)]"
                        value={activeTeamSelection?.teamId ?? ""}
                        onChange={(event) => setCurrentActiveTeam(event.target.value)}
                      >
                        {activeCreateClubTeams.map((team) => (
                          <option key={`console-active-${team.id}`} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--ink-1)]">
                    Used as the default Home team when you create a new project.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm text-[var(--ink-0)]">
                    {activeTeamSelection
                      ? `${activeTeamSelection.clubName ?? "Team"} / ${activeTeamSelection.teamName}`
                      : "No team selected yet"}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--ink-1)]">
                    No available teams found for this user yet.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {consoleTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`rounded-full border px-4 py-2 text-xs uppercase tracking-widest ${
                    String(consoleTab) === tab.id
                      ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                      : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                  }`}
                  onClick={() => setConsoleTab(tab.id as typeof consoleTab)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <input
              className="h-9 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)] placeholder:text-[var(--ink-1)]"
              placeholder="Search projects"
              value={projectsQuery}
              onChange={(event) => setProjectsQuery(event.target.value)}
            />
            {syncStatus.state === "syncing" ? (
              <p className="text-xs text-[var(--ink-1)]">Refreshing...</p>
            ) : null}
            <div className="space-y-2">
              {filteredProjects.length === 0 ? (
                <p className="text-sm text-[var(--ink-1)]">
                  {projectsQuery.trim()
                    ? "No projects match your search."
                    : consoleTab === "favourites"
                    ? "No favourite projects yet."
                    : "No saved projects yet."}
                </p>
              ) : (
                paginatedRecentProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--ink-0)]">
                        {project.name}
                      </p>
                      <p className="text-xs text-[var(--ink-1)]">
                        Updated {new Date(project.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
                      <button
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                          favouriteSet.has(project.id)
                            ? "border-[var(--accent-0)] text-[var(--accent-0)]"
                            : "border-[var(--line)] text-[var(--ink-0)]"
                        } hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]`}
                        onClick={() =>
                          setFavoriteProjectIds((prev) =>
                            prev.includes(project.id)
                              ? prev.filter((id) => id !== project.id)
                              : [...prev, project.id]
                          )
                        }
                        aria-label="Toggle favourite"
                        title={
                          favouriteSet.has(project.id)
                            ? "Remove from favourites"
                            : "Add to favourites"
                        }
                      >
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill={favouriteSet.has(project.id) ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 5.9L12 16.8 6.6 19.5l1-5.9L3.3 9.4l6-.9z" />
                        </svg>
                      </button>
                      <button
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-0)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
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
                        aria-label="Open project"
                        title="Open project"
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
                          <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
                          <circle cx="12" cy="12" r="2.5" />
                        </svg>
                      </button>
                      <button
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-0)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                        onClick={() => void onDuplicateProject(project.id)}
                        aria-label="Duplicate project"
                        title="Duplicate project"
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
                          <rect x="9" y="9" width="11" height="11" rx="2" />
                          <rect x="4" y="4" width="11" height="11" rx="2" />
                        </svg>
                      </button>
                      <button
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-0)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                        onClick={() => openProjectShare(project.id)}
                        disabled={!can(plan, "board.share")}
                        data-locked={!can(plan, "board.share")}
                        aria-label="Share project"
                        title={
                          can(plan, "board.share")
                            ? "Share project boards"
                            : "Sharing is available on paid plans."
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
                          strokeLinejoin="round"
                        >
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <path d="M8.6 10.8l6.8-3.6M8.6 13.2l6.8 3.6" />
                        </svg>
                      </button>
                      <button
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-0)] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete "${project.name}"? This cannot be undone.`
                            )
                          ) {
                            deleteProject(project.id);
                          }
                        }}
                        aria-label="Delete project"
                        title="Delete project"
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
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M6 6l1 14h10l1-14" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
              {filteredProjects.length > recentProjectsPageSize ? (
                <div className="mt-2 flex items-center justify-between text-xs text-[var(--ink-1)]">
                  <button
                    className="rounded-full border border-[var(--line)] px-3 py-1 disabled:opacity-40"
                    onClick={() =>
                      setRecentProjectsPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={recentProjectsPage <= 1}
                  >
                    Prev
                  </button>
                  <span>
                    Page {recentProjectsPage} / {totalRecentProjectsPages}
                  </span>
                  <button
                    className="rounded-full border border-[var(--line)] px-3 py-1 disabled:opacity-40"
                    onClick={() =>
                      setRecentProjectsPage((prev) =>
                        Math.min(totalRecentProjectsPages, prev + 1)
                      )
                    }
                    disabled={recentProjectsPage >= totalRecentProjectsPages}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </section>
        )}

        {consoleTab === "shared" && (
        <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)]/80 p-6 shadow-2xl shadow-black/40">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {consoleTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`rounded-full border px-4 py-2 text-xs uppercase tracking-widest ${
                    String(consoleTab) === tab.id
                      ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                      : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                  }`}
                  onClick={() => setConsoleTab(tab.id as typeof consoleTab)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
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
                        void openSharedBoardById(share.id);
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
                        void openSharedBoardById(share.id);
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
              <div className="flex flex-wrap gap-2">
                {consoleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`rounded-full border px-4 py-2 text-xs uppercase tracking-widest ${
                      String(consoleTab) === tab.id
                        ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                        : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                    }`}
                    onClick={() => setConsoleTab(tab.id as typeof consoleTab)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
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

        {consoleTab === "admin" && authUser?.isAdmin && (
          <section className="space-y-4 rounded-3xl border border-[var(--line)] bg-[var(--panel)]/80 p-6 shadow-2xl shadow-black/40">
            <div className="flex flex-wrap gap-2">
              {consoleTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`rounded-full border px-4 py-2 text-xs uppercase tracking-widest ${
                    String(consoleTab) === tab.id
                      ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                      : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                  }`}
                  onClick={() => setConsoleTab(tab.id as typeof consoleTab)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="display-font text-lg text-[var(--accent-0)]">
                Admin
              </h3>
              <div className="flex items-center gap-2">
                <input
                  className="h-9 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                  placeholder="Search email/name/id"
                  value={adminQuery}
                  onChange={(event) => setAdminQuery(event.target.value)}
                />
                <button
                  className="rounded-full border border-[var(--line)] px-3 py-2 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                  onClick={() => void refreshAdminData()}
                >
                  Refresh
                </button>
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/50 p-3">
                <h4 className="text-xs uppercase tracking-widest text-[var(--ink-1)]">
                  Users
                </h4>
                {adminUsersLoading ? (
                  <p className="text-xs text-[var(--ink-1)]">Loading users...</p>
                ) : adminUsersError ? (
                  <p className="text-xs text-[var(--accent-1)]">{adminUsersError}</p>
                ) : (
                  <div className="space-y-2 pr-1">
                    {paginatedAdminUsers.map((user) => (
                        <article
                          key={user.id}
                          className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2"
                        >
                          <p className="text-xs font-semibold text-[var(--ink-0)]">
                            {user.email ?? user.id}
                          </p>
                          <p className="text-[11px] text-[var(--ink-1)]">
                            {user.name ?? "No name"} · {user.plan}
                          </p>
                          <p className="truncate text-[10px] text-[var(--ink-1)]">
                            {user.id}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={user.betaUser}
                                disabled={adminUpdatingUserId === user.id}
                                onChange={async (event) => {
                                  setAdminUpdatingUserId(user.id);
                                  const result = await updateAdminUserFlags({
                                    id: user.id,
                                    betaUser: event.target.checked,
                                  });
                                  if (result.ok) {
                                    setAdminUsers((prev) =>
                                      prev.map((entry) =>
                                        entry.id === user.id
                                          ? { ...entry, betaUser: event.target.checked }
                                          : entry
                                      )
                                    );
                                  } else {
                                    setAdminUsersError(result.error);
                                  }
                                  setAdminUpdatingUserId(null);
                                }}
                              />
                              Beta user
                            </label>
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={user.isAdmin}
                                disabled={adminUpdatingUserId === user.id}
                                onChange={async (event) => {
                                  setAdminUpdatingUserId(user.id);
                                  const result = await updateAdminUserFlags({
                                    id: user.id,
                                    isAdmin: event.target.checked,
                                  });
                                  if (result.ok) {
                                    setAdminUsers((prev) =>
                                      prev.map((entry) =>
                                        entry.id === user.id
                                          ? { ...entry, isAdmin: event.target.checked }
                                          : entry
                                      )
                                    );
                                  } else {
                                    setAdminUsersError(result.error);
                                  }
                                  setAdminUpdatingUserId(null);
                                }}
                              />
                              Admin
                            </label>
                            <button
                              className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                              onClick={() => void toggleAdminMembershipEditor(user.id)}
                            >
                              Memberships
                            </button>
                          </div>
                        </article>
                      ))}
                    {filteredAdminUsers.length > adminUsersPageSize ? (
                      <div className="mt-2 flex items-center justify-between text-xs text-[var(--ink-1)]">
                        <button
                          className="rounded-full border border-[var(--line)] px-3 py-1 disabled:opacity-40"
                          onClick={() =>
                            setAdminUsersPage((prev) => Math.max(1, prev - 1))
                          }
                          disabled={adminUsersPage <= 1}
                        >
                          Prev
                        </button>
                        <span>
                          Page {adminUsersPage} / {totalAdminUsersPages}
                        </span>
                        <button
                          className="rounded-full border border-[var(--line)] px-3 py-1 disabled:opacity-40"
                          onClick={() =>
                            setAdminUsersPage((prev) =>
                              Math.min(totalAdminUsersPages, prev + 1)
                            )
                          }
                          disabled={adminUsersPage >= totalAdminUsersPages}
                        >
                          Next
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/50 p-3">
                <h4 className="text-xs uppercase tracking-widest text-[var(--ink-1)]">
                  Reports / Moderation
                </h4>
                {adminReportsLoading ? (
                  <p className="text-xs text-[var(--ink-1)]">Loading reports...</p>
                ) : adminReportsError ? (
                  <p className="text-xs text-[var(--accent-1)]">{adminReportsError}</p>
                ) : (
                  <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
                    {adminReports.map((row) => (
                      <article
                        key={row.id}
                        className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                          <span className="rounded-full border border-[var(--line)] px-2 py-1">
                            {row.report_type}
                          </span>
                          <span className="rounded-full border border-[var(--line)] px-2 py-1">
                            {row.source}
                          </span>
                          <span>{new Date(row.created_at).toLocaleString()}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--ink-0)]">
                          {row.body}
                        </p>
                        <p className="mt-2 text-[10px] text-[var(--ink-1)]">
                          {row.user_email ?? "anonymous"} · {row.project_name ?? "n/a"} /{" "}
                          {row.board_name ?? "n/a"}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/40 p-3">
              <h4 className="text-xs uppercase tracking-widest text-[var(--ink-1)]">
                Usage analytics (last 30 days)
              </h4>
              {adminAnalyticsLoading ? (
                <p className="text-xs text-[var(--ink-1)]">Loading analytics...</p>
              ) : adminAnalyticsError ? (
                <p className="text-xs text-[var(--accent-1)]">{adminAnalyticsError}</p>
              ) : !adminAnalytics ? (
                <p className="text-xs text-[var(--ink-1)]">No analytics data yet.</p>
              ) : (
                <>
                  {(() => {
                    const networkCounters = adminAnalytics.networkCounters ?? [];
                    return (
                      <>
                  <div className="grid gap-2 sm:grid-cols-5">
                    {[
                      { label: "Events", value: String(adminAnalytics.summary.totalEvents) },
                      {
                        label: "Active users",
                        value: String(adminAnalytics.summary.activeUsers30d),
                      },
                      { label: "Logins", value: String(adminAnalytics.summary.loginCount30d) },
                      {
                        label: "Avg session (min)",
                        value: String(adminAnalytics.summary.averageSessionMinutes),
                      },
                      {
                        label: "Total hours",
                        value: String(adminAnalytics.summary.totalHours30d),
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2"
                      >
                        <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                          {item.label}
                        </p>
                        <p className="text-sm font-semibold text-[var(--ink-0)]">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
                      <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                        Most used tools
                      </p>
                      <div className="mt-2 space-y-2">
                        {adminAnalytics.toolUsage.slice(0, 8).map((entry) => {
                          const max = adminAnalytics.toolUsage[0]?.count ?? 1;
                          const pct = Math.max(4, Math.round((entry.count / max) * 100));
                          return (
                            <div key={entry.tool} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[var(--ink-0)]">{entry.tool}</span>
                                <span className="text-[var(--ink-1)]">{entry.count}</span>
                              </div>
                              <div className="h-2 rounded-full bg-black/25">
                                <div
                                  className="h-2 rounded-full bg-[var(--accent-0)]"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
                      <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                        Login methods
                      </p>
                      <div className="mt-2 space-y-2">
                        {adminAnalytics.loginMethods.map((entry) => {
                          const max = adminAnalytics.loginMethods[0]?.count ?? 1;
                          const pct = Math.max(6, Math.round((entry.count / max) * 100));
                          return (
                            <div key={entry.method} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[var(--ink-0)]">{entry.method}</span>
                                <span className="text-[var(--ink-1)]">{entry.count}</span>
                              </div>
                              <div className="h-2 rounded-full bg-black/25">
                                <div
                                  className="h-2 rounded-full bg-[var(--accent-2)]"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
                      <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                        Daily activity (14d)
                      </p>
                      <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                        {adminAnalytics.dailyActivity.map((day) => (
                          <div
                            key={day.day}
                            className="flex items-center justify-between text-xs text-[var(--ink-1)]"
                          >
                            <span>{day.day}</span>
                            <span>
                              {day.activeUsers} users · {day.events} events
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
                      <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                        Recent logins
                      </p>
                      <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                        {adminAnalytics.recentLogins.slice(0, 20).map((item, index) => (
                          <div
                            key={`${item.at}-${index}`}
                            className="rounded-lg border border-[var(--line)] px-2 py-1 text-xs text-[var(--ink-1)]"
                          >
                            <p className="text-[var(--ink-0)]">{item.userEmail ?? "unknown"}</p>
                            <p>{new Date(item.at).toLocaleString()} · {item.provider}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
                    <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                      Network calls (aggregated)
                    </p>
                    <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                      {networkCounters.length === 0 ? (
                        <p className="text-xs text-[var(--ink-1)]">No network counters yet.</p>
                      ) : (
                        networkCounters.slice(0, 20).map((entry) => (
                          <div
                            key={entry.key}
                            className="rounded-lg border border-[var(--line)] px-2 py-1"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate text-[var(--ink-0)]">{entry.key}</span>
                              <span className="text-[var(--ink-1)]">{entry.calls} calls</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--ink-1)]">
                              <span>
                                ok: {entry.ok} · error: {entry.error}
                              </span>
                              <span
                                className={
                                  entry.errorRate > 5
                                    ? "text-[var(--accent-1)]"
                                    : "text-[var(--ink-1)]"
                                }
                              >
                                {entry.errorRate}% errors
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </section>
        )}
      </div>
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink-0)] shadow-2xl shadow-black/40">
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
            <div className="mt-4 max-h-[calc(80vh-96px)] overflow-y-auto p-6 pt-2" data-scrollable>
              <input
                className="h-10 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                placeholder="Project name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <div className="grid grid-cols-4 gap-2">
                {[
                  "training",
                  "match",
                  "education",
                  ...(plan === "PAID" ? (["custom"] as const) : []),
                ].map((mode) => (
                  <button
                    key={mode}
                    className={`rounded-2xl border px-3 py-2 text-xs ${
                      createMode === mode
                        ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                        : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                    } ${plan !== "PAID" ? "cursor-not-allowed opacity-50" : ""}`}
                    onClick={() =>
                      plan === "PAID" &&
                      setCreateMode(
                        mode as "training" | "match" | "education" | "custom"
                      )
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
              {createMode === "custom" && (
                <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                    Template
                  </p>
                  {projectTemplates.length === 0 ? (
                    <p className="text-xs text-[var(--ink-1)]">
                      No saved templates yet. Open a project and use Actions -
                      Save as template.
                    </p>
                  ) : (
                    <select
                      className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                      value={selectedTemplateId}
                      onChange={(event) => setSelectedTemplateId(event.target.value)}
                    >
                      {projectTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              {createMode !== "custom" && (
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
                      onChange={(event) =>
                        setCreatePitchShape(
                          event.target.value as
                            | "none"
                            | "circle"
                            | "square"
                            | "rect"
                        )
                      }
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
                    onChange={(event) =>
                      setCreatePitchOverlay(
                        event.target.value as
                          | "NONE"
                          | "THIRDS"
                          | "ZONES_18"
                          | "CORRIDORS"
                      )
                    }
                  >
                    <option value="NONE">No overlay</option>
                    <option value="THIRDS">Thirds</option>
                    <option value="ZONES_18">Zones</option>
                    <option value="CORRIDORS">Corridors</option>
                  </select>
                </div>
              </div>
              )}
              {createMode !== "custom" && (
              <>
              <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-3">
                <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">Boards to create</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {createTemplateOptions.map((board) => {
                    const checked = createBoards.includes(board.id);
                    const boardName = createBoardNames[board.id] ?? board.name;
                    return (
                      <label
                        key={board.id}
                        className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs"
                      >
                        {editingCreateBoardId === board.id ? (
                          <input
                            autoFocus
                            className="h-7 flex-1 rounded-full border border-[var(--line)] bg-transparent px-2 text-xs text-[var(--ink-0)]"
                            value={boardName}
                            onChange={(event) =>
                              setCreateBoardNames((prev) => ({
                                ...prev,
                                [board.id]: event.target.value,
                              }))
                            }
                            onBlur={() => setEditingCreateBoardId(null)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === "Escape") {
                                setEditingCreateBoardId(null);
                              }
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="inline-flex min-w-0 items-center gap-2 truncate text-left text-[var(--ink-0)] hover:text-[var(--accent-2)]"
                            onClick={(event) => {
                              event.preventDefault();
                              setEditingCreateBoardId(board.id);
                            }}
                            title="Click to rename board"
                          >
                            <span className="truncate">{boardName}</span>
                            <svg
                              aria-hidden
                              viewBox="0 0 24 24"
                              className="h-3.5 w-3.5 shrink-0 opacity-80"
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
                        )}
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
                <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">Team colors</p>
                {createTeamDirectoryLoading ? (
                  <p className="text-[10px] text-[var(--ink-1)]">Loading club teams...</p>
                ) : null}
                {createTeamDirectoryError ? (
                  <p className="text-[10px] text-[var(--accent-1)]">{createTeamDirectoryError}</p>
                ) : null}
                {availableCreateTeams.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-[11px] uppercase text-[var(--ink-1)]">Current club</span>
                        <select
                          className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                          value={activeCreateClubId}
                          onChange={(event) => setCurrentActiveClub(event.target.value)}
                        >
                          {availableCreateClubs.map((club) => (
                            <option key={`active-club-${club.id}`} value={club.id}>
                              {club.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] uppercase text-[var(--ink-1)]">Current team</span>
                        <select
                          className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                          value={activeTeamSelection?.teamId ?? ""}
                          onChange={(event) => setCurrentActiveTeam(event.target.value)}
                        >
                          {activeCreateClubTeams.map((team) => (
                            <option key={`active-${team.id}`} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-[var(--ink-1)]">
                          New projects will use this as the default Home team.
                        </p>
                      </label>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-[11px] uppercase text-[var(--ink-1)]">Home team</span>
                      <select
                        className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                        value={selectedHomeTeamId}
                        onChange={(event) => setSelectedHomeTeamId(event.target.value)}
                      >
                        <option value="">Use saved default</option>
                        {availableCreateTeams.map(({ club, team }) => (
                          <option key={`home-${team.id}`} value={team.id}>
                            {club.name}: {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] uppercase text-[var(--ink-1)]">Away team</span>
                      <select
                        className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                        value={selectedAwayTeamId}
                        onChange={(event) => setSelectedAwayTeamId(event.target.value)}
                      >
                        <option value="">Use saved default</option>
                        {availableCreateTeams.map(({ club, team }) => (
                          <option key={`away-${team.id}`} value={team.id}>
                            {club.name}: {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  </div>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase text-[var(--ink-1)]">Home kit</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2">
                        <span>Shirt</span>
                        <ColorPalettePicker
                          value={homeKit.shirt}
                          onChange={(value) =>
                            setHomeKit((prev) => ({
                              ...prev,
                              shirt: value,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span>Shorts</span>
                        <ColorPalettePicker
                          value={homeKit.shorts}
                          onChange={(value) =>
                            setHomeKit((prev) => ({
                              ...prev,
                              shorts: value,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span>Socks</span>
                        <ColorPalettePicker
                          value={homeKit.socks}
                          onChange={(value) =>
                            setHomeKit((prev) => ({
                              ...prev,
                              socks: value,
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
                        <ColorPalettePicker
                          value={awayKit.shirt}
                          onChange={(value) =>
                            setAwayKit((prev) => ({
                              ...prev,
                              shirt: value,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span>Shorts</span>
                        <ColorPalettePicker
                          value={awayKit.shorts}
                          onChange={(value) =>
                            setAwayKit((prev) => ({
                              ...prev,
                              shorts: value,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span>Socks</span>
                        <ColorPalettePicker
                          value={awayKit.socks}
                          onChange={(value) =>
                            setAwayKit((prev) => ({
                              ...prev,
                              socks: value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-3">
                <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                  Starting formation
                </p>
                <select
                  className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                  value={startingFormation}
                  onChange={(event) => setStartingFormation(event.target.value)}
                >
                  <option value="none">No formation</option>
                  {Object.keys(FORMATION_PRESETS).map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--ink-1)]">
                  Adds players in this formation to the first board.
                </p>
              </div>
              <label className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-3 py-2 text-xs">
                <span>Attach ball to player on drop</span>
                <input
                  type="checkbox"
                  checked={attachBallToPlayer}
                  onChange={(event) => setAttachBallToPlayer(event.target.checked)}
                />
              </label>
              </>
              )}
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
                  if (createMode === "custom") {
                    if (plan !== "PAID" || !authUser) {
                      setError("Custom templates are available on paid plans.");
                      return;
                    }
                    const template = projectTemplates.find(
                      (item) => item.id === selectedTemplateId
                    );
                    if (!template) {
                      setError("Select a template first.");
                      return;
                    }
                    openProjectFromData(
                      createProjectFromTemplate(template, name.trim())
                    );
                    setCreateOpen(false);
                    setName("");
                    setError(null);
                    return;
                  }
                  const templates = createTemplateOptions.filter((board) =>
                    createBoards.includes(board.id)
                  );
                  const homeSquadPreset =
                    selectedHomeTeam?.squad ?? createEmptySquadPreset("Home", homeKit);
                  const awaySquadPreset =
                    selectedAwayTeam?.squad ?? createEmptySquadPreset("Away", awayKit);
                  createProject(name.trim(), {
                    homeKit,
                    awayKit,
                    attachBallToPlayer,
                    mode: createMode as "training" | "match" | "education",
                    pitchView: createPitchView,
                    pitchOverlay: createPitchOverlay,
                    pitchShape: createPitchShape,
                    playerLabel: createPlayerLabel,
                    boardTemplates:
                      templates.length > 0
                        ? templates.map((board) => ({
                            id: board.id,
                            name:
                              createBoardNames[board.id]?.trim() || board.name,
                            pitchView: board.pitchView,
                            pitchShape: board.pitchShape,
                          }))
                        : undefined,
                    homeTeamId: selectedHomeTeam?.id,
                    awayTeamId: selectedAwayTeam?.id,
                    homeSquadPreset,
                    awaySquadPreset,
                    startingFormation:
                      startingFormation !== "none"
                        ? startingFormation
                        : undefined,
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
      {showBetaUi && (
        <BetaNoticeModal
          open={betaOpen}
          onClose={() => setBetaOpen(false)}
          context="console"
        />
      )}
      {activeAdminMembershipUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-5xl rounded-3xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink-0)] shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-5">
              <div>
                <h2 className="display-font text-xl text-[var(--accent-0)]">
                  Memberships
                </h2>
                <p className="text-sm text-[var(--ink-0)]">
                  {activeAdminMembershipUser.email ?? activeAdminMembershipUser.name ?? activeAdminMembershipUser.id}
                </p>
                <p className="text-xs text-[var(--ink-1)]">
                  Create clubs and teams, then assign this user to them.
                </p>
              </div>
              <button
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                onClick={() => {
                  setAdminMembershipEditorUserId(null);
                  setAdminMembershipsError(null);
                }}
              >
                Close
              </button>
            </div>
            <div className="max-h-[calc(100vh-120px)] overflow-y-auto px-6 py-5">
              {adminMembershipsLoadingUserId === activeAdminMembershipUser.id ? (
                <p className="text-[11px] text-[var(--ink-1)]">
                  Loading memberships...
                </p>
              ) : null}
              {adminMembershipsError ? (
                <p className="mb-4 text-[11px] text-[var(--accent-1)]">
                  {adminMembershipsError}
                </p>
              ) : null}
              {activeAdminMemberships ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    {[
                      { id: "clubs", label: `Clubs (${activeAdminMemberships.clubMemberships.length})` },
                      { id: "teams", label: `Teams (${activeAdminMemberships.teamMemberships.length})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        className={`rounded-full border px-4 py-2 text-[11px] uppercase tracking-wide transition ${
                          adminMembershipTab === tab.id
                            ? "border-[var(--accent-0)] text-[var(--accent-0)]"
                            : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                        }`}
                        onClick={() => setAdminMembershipTab(tab.id as "clubs" | "teams")}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {adminMembershipTab === "clubs" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                        Club memberships
                      </p>
                      <span className="text-[10px] text-[var(--ink-1)]">
                        {activeAdminMemberships.clubMemberships.length}
                      </span>
                    </div>
                    {activeAdminMemberships.clubMemberships.map((membership) => (
                      <div
                        key={membership.id}
                        className="grid gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-2)]/40 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
                            {membership.clubLogoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={membership.clubLogoUrl}
                                alt={membership.clubName || "Club logo"}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
                                No logo
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                              Club appearance
                            </p>
                            <p className="text-xs text-[var(--ink-1)]">
                              Shared logo for the whole club.
                            </p>
                          </div>
                        </div>
                        <input
                          className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--ink-0)]"
                          value={membership.clubName}
                          onChange={(event) =>
                            setAdminMemberships((prev) => ({
                              ...prev,
                              [activeAdminMembershipUser.id]: {
                                ...(prev[activeAdminMembershipUser.id] ?? activeAdminMemberships),
                                clubMemberships: (
                                  prev[activeAdminMembershipUser.id]?.clubMemberships ??
                                  activeAdminMemberships.clubMemberships
                                ).map((entry) =>
                                  entry.id === membership.id
                                    ? { ...entry, clubName: event.target.value }
                                    : entry
                                ),
                              },
                            }))
                          }
                          placeholder="Club name"
                        />
                        <input
                          className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                          value={membership.clubLogoUrl ?? ""}
                          onChange={(event) =>
                            setAdminMemberships((prev) => ({
                              ...prev,
                              [activeAdminMembershipUser.id]: {
                                ...(prev[activeAdminMembershipUser.id] ?? activeAdminMemberships),
                                clubMemberships: (
                                  prev[activeAdminMembershipUser.id]?.clubMemberships ??
                                  activeAdminMemberships.clubMemberships
                                ).map((entry) =>
                                  entry.id === membership.id
                                    ? {
                                        ...entry,
                                        clubLogoUrl: event.target.value || null,
                                      }
                                    : entry
                                ),
                              },
                            }))
                          }
                          placeholder="Club logo URL or data URL"
                        />
                        <div className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                                Club kit
                              </p>
                              <p className="text-xs text-[var(--ink-1)]">
                                Base colors inherited by all teams unless a team overrides them.
                              </p>
                            </div>
                            <div className="flex items-end gap-2">
                              {[
                                membership.kitShirt,
                                membership.kitShirtSecondary,
                                membership.kitShorts,
                                membership.kitSocks,
                              ].map((color, index) => (
                                <span
                                  key={`${membership.id}-club-kit-swatch-${index}`}
                                  className="h-7 w-7 rounded-full border border-[var(--line)]"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            <label className="grid gap-1 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                              Shirt
                              <input
                                className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs normal-case tracking-normal text-[var(--ink-0)]"
                                value={membership.kitShirt}
                                onChange={(event) =>
                                  setAdminMemberships((prev) => ({
                                    ...prev,
                                    [activeAdminMembershipUser.id]: {
                                      ...(prev[activeAdminMembershipUser.id] ?? activeAdminMemberships),
                                      clubMemberships: (
                                        prev[activeAdminMembershipUser.id]?.clubMemberships ??
                                        activeAdminMemberships.clubMemberships
                                      ).map((entry) =>
                                        entry.id === membership.id
                                          ? { ...entry, kitShirt: event.target.value }
                                          : entry
                                      ),
                                    },
                                  }))
                                }
                                placeholder="#e4573f"
                              />
                            </label>
                            <label className="grid gap-1 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                              Shirt secondary
                              <input
                                className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs normal-case tracking-normal text-[var(--ink-0)]"
                                value={membership.kitShirtSecondary}
                                onChange={(event) =>
                                  setAdminMemberships((prev) => ({
                                    ...prev,
                                    [activeAdminMembershipUser.id]: {
                                      ...(prev[activeAdminMembershipUser.id] ?? activeAdminMemberships),
                                      clubMemberships: (
                                        prev[activeAdminMembershipUser.id]?.clubMemberships ??
                                        activeAdminMemberships.clubMemberships
                                      ).map((entry) =>
                                        entry.id === membership.id
                                          ? { ...entry, kitShirtSecondary: event.target.value }
                                          : entry
                                      ),
                                    },
                                  }))
                                }
                                placeholder="#f3f3f3"
                              />
                            </label>
                            <label className="grid gap-1 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                              Shorts
                              <input
                                className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs normal-case tracking-normal text-[var(--ink-0)]"
                                value={membership.kitShorts}
                                onChange={(event) =>
                                  setAdminMemberships((prev) => ({
                                    ...prev,
                                    [activeAdminMembershipUser.id]: {
                                      ...(prev[activeAdminMembershipUser.id] ?? activeAdminMemberships),
                                      clubMemberships: (
                                        prev[activeAdminMembershipUser.id]?.clubMemberships ??
                                        activeAdminMemberships.clubMemberships
                                      ).map((entry) =>
                                        entry.id === membership.id
                                          ? { ...entry, kitShorts: event.target.value }
                                          : entry
                                      ),
                                    },
                                  }))
                                }
                                placeholder="#f3f3f3"
                              />
                            </label>
                            <label className="grid gap-1 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                              Socks
                              <input
                                className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs normal-case tracking-normal text-[var(--ink-0)]"
                                value={membership.kitSocks}
                                onChange={(event) =>
                                  setAdminMemberships((prev) => ({
                                    ...prev,
                                    [activeAdminMembershipUser.id]: {
                                      ...(prev[activeAdminMembershipUser.id] ?? activeAdminMemberships),
                                      clubMemberships: (
                                        prev[activeAdminMembershipUser.id]?.clubMemberships ??
                                        activeAdminMemberships.clubMemberships
                                      ).map((entry) =>
                                        entry.id === membership.id
                                          ? { ...entry, kitSocks: event.target.value }
                                          : entry
                                      ),
                                    },
                                  }))
                                }
                                placeholder="#f3f3f3"
                              />
                            </label>
                            <label className="grid gap-1 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                              Vest
                              <input
                                className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs normal-case tracking-normal text-[var(--ink-0)]"
                                value={membership.kitVest ?? ""}
                                onChange={(event) =>
                                  setAdminMemberships((prev) => ({
                                    ...prev,
                                    [activeAdminMembershipUser.id]: {
                                      ...(prev[activeAdminMembershipUser.id] ?? activeAdminMemberships),
                                      clubMemberships: (
                                        prev[activeAdminMembershipUser.id]?.clubMemberships ??
                                        activeAdminMemberships.clubMemberships
                                      ).map((entry) =>
                                        entry.id === membership.id
                                          ? { ...entry, kitVest: event.target.value || null }
                                          : entry
                                      ),
                                    },
                                  }))
                                }
                                placeholder="#f5d06a"
                              />
                            </label>
                            <label className="grid gap-1 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                              Jersey type
                              <select
                                className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs normal-case tracking-normal text-[var(--ink-0)]"
                                value={membership.kitJerseyType}
                                onChange={(event) =>
                                  setAdminMemberships((prev) => ({
                                    ...prev,
                                    [activeAdminMembershipUser.id]: {
                                      ...(prev[activeAdminMembershipUser.id] ?? activeAdminMemberships),
                                      clubMemberships: (
                                        prev[activeAdminMembershipUser.id]?.clubMemberships ??
                                        activeAdminMemberships.clubMemberships
                                      ).map((entry) =>
                                        entry.id === membership.id
                                          ? {
                                              ...entry,
                                              kitJerseyType:
                                                event.target.value as AdminClubMembershipRow["kitJerseyType"],
                                            }
                                          : entry
                                      ),
                                    },
                                  }))
                                }
                              >
                                {teamJerseyTypeOptions.map((option) => (
                                  <option key={`${membership.id}-club-jersey-${option}`} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </div>
                        <select
                          className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                          value={membership.clubRole}
                          onChange={(event) =>
                            setAdminMemberships((prev) => ({
                              ...prev,
                              [activeAdminMembershipUser.id]: {
                                ...(prev[activeAdminMembershipUser.id] ?? activeAdminMemberships),
                                clubMemberships: (
                                  prev[activeAdminMembershipUser.id]?.clubMemberships ??
                                  activeAdminMemberships.clubMemberships
                                ).map((entry) =>
                                  entry.id === membership.id
                                    ? { ...entry, clubRole: event.target.value }
                                    : entry
                                ),
                              },
                            }))
                          }
                        >
                          {["member", "staff", "board", "guardian", "other"].map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <label className="inline-flex items-center gap-2 text-xs text-[var(--ink-0)]">
                          <input
                            type="checkbox"
                            checked={membership.isClubAdmin}
                            onChange={(event) =>
                              setAdminMemberships((prev) => ({
                                ...prev,
                                [activeAdminMembershipUser.id]: {
                                  ...(prev[activeAdminMembershipUser.id] ?? activeAdminMemberships),
                                  clubMemberships: (
                                    prev[activeAdminMembershipUser.id]?.clubMemberships ??
                                    activeAdminMemberships.clubMemberships
                                  ).map((entry) =>
                                    entry.id === membership.id
                                      ? { ...entry, isClubAdmin: event.target.checked }
                                      : entry
                                  ),
                                },
                              }))
                            }
                          />
                          Club admin
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-full border border-[var(--accent-2)] px-3 py-2 text-[10px] uppercase tracking-wide text-[var(--accent-2)] hover:brightness-110"
                            onClick={() =>
                              void saveAdminClubDetails(
                                activeAdminMembershipUser.id,
                                (
                                  adminMemberships[activeAdminMembershipUser.id]?.clubMemberships ??
                                  activeAdminMemberships.clubMemberships
                                ).find((entry) => entry.id === membership.id) ?? membership
                              )
                            }
                          >
                            Save club
                          </button>
                          <button
                            className="rounded-full border border-[var(--line)] px-3 py-2 text-[10px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                            onClick={() =>
                              void saveAdminClubMembership(
                                activeAdminMembershipUser.id,
                                (
                                  adminMemberships[activeAdminMembershipUser.id]?.clubMemberships ??
                                  activeAdminMemberships.clubMemberships
                                ).find((entry) => entry.id === membership.id) ?? membership
                              )
                            }
                          >
                            Save membership
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="grid gap-2 rounded-xl border border-dashed border-[var(--line)] p-3">
                      <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                        Add existing club
                      </p>
                      <select
                        className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                        value={adminNewClubId}
                        onChange={(event) => setAdminNewClubId(event.target.value)}
                      >
                        {activeAdminMemberships.clubs.map((club) => (
                          <option key={club.id} value={club.id}>
                            {club.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                        value={adminNewClubRole}
                        onChange={(event) => setAdminNewClubRole(event.target.value)}
                      >
                        {["member", "staff", "board", "guardian", "other"].map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <label className="inline-flex items-center gap-2 text-xs text-[var(--ink-0)]">
                        <input
                          type="checkbox"
                          checked={adminNewClubAdmin}
                          onChange={(event) => setAdminNewClubAdmin(event.target.checked)}
                        />
                        Club admin
                      </label>
                      <button
                        className="rounded-full border border-[var(--accent-0)] px-3 py-2 text-[10px] uppercase tracking-wide text-[var(--accent-0)]"
                        onClick={() => void addAdminClubMembership(activeAdminMembershipUser.id)}
                      >
                        Add club
                      </button>
                    </div>
                    <div className="grid gap-2 rounded-xl border border-dashed border-[var(--line)] p-3">
                      <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                        Create new club
                      </p>
                      <input
                        className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                        value={adminNewClubName}
                        onChange={(event) => setAdminNewClubName(event.target.value)}
                        placeholder="Create new club"
                      />
                      <select
                        className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                        value={adminNewClubRole}
                        onChange={(event) => setAdminNewClubRole(event.target.value)}
                      >
                        {["member", "staff", "board", "guardian", "other"].map((option) => (
                          <option key={`new-club-role-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <button
                        className="rounded-full border border-[var(--accent-2)] px-3 py-2 text-[10px] uppercase tracking-wide text-[var(--accent-2)]"
                        onClick={() => void createAdminClubForUser(activeAdminMembershipUser.id)}
                      >
                        Create club
                      </button>
                    </div>
                  </div>
                  ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                        Team memberships
                      </p>
                      <span className="text-[10px] text-[var(--ink-1)]">
                        {activeAdminMemberships.teamMemberships.length}
                      </span>
                    </div>
                    {activeAdminMemberships.teamMemberships.map((membership) => (
                      <div
                        key={membership.id}
                        className="grid gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-2)]/40 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
                            {membership.teamLogoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={membership.teamLogoUrl}
                                alt={membership.teamName || "Team logo"}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
                                No logo
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                              Team appearance
                            </p>
                            <p className="text-xs text-[var(--ink-1)]">
                              Shared logo for this team.
                            </p>
                          </div>
                        </div>
                        <input
                          className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--ink-0)]"
                          value={membership.teamName}
                          onChange={(event) =>
                            patchAdminTeamMembershipDraft(
                              activeAdminMembershipUser.id,
                              membership.id,
                              { teamName: event.target.value }
                            )
                          }
                          placeholder="Team name"
                        />
                        <input
                          className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                          value={membership.teamLogoUrl ?? ""}
                          onChange={(event) =>
                            patchAdminTeamMembershipDraft(
                              activeAdminMembershipUser.id,
                              membership.id,
                              { teamLogoUrl: event.target.value || null }
                            )
                          }
                          placeholder="Team logo URL or data URL"
                        />
                        <input
                          className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                          value={membership.teamType}
                          onChange={(event) =>
                            patchAdminTeamMembershipDraft(
                              activeAdminMembershipUser.id,
                              membership.id,
                              { teamType: event.target.value }
                            )
                          }
                          placeholder="Type"
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                            value={membership.ageGroup ?? ""}
                            onChange={(event) =>
                              patchAdminTeamMembershipDraft(
                                activeAdminMembershipUser.id,
                                membership.id,
                                { ageGroup: event.target.value || null }
                              )
                            }
                            placeholder="Age group"
                          />
                          <input
                            className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                            value={membership.seasonLabel ?? ""}
                            onChange={(event) =>
                              patchAdminTeamMembershipDraft(
                                activeAdminMembershipUser.id,
                                membership.id,
                                { seasonLabel: event.target.value || null }
                              )
                            }
                            placeholder="Season"
                          />
                        </div>
                        <div className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                                Team kit override
                              </p>
                              <p className="text-xs text-[var(--ink-1)]">
                                Leave fields empty to inherit the club's default colors.
                              </p>
                            </div>
                            <div className="flex items-end gap-2">
                              {[
                                membership.kitShirt || "transparent",
                                membership.kitShirtSecondary || "transparent",
                                membership.kitShorts || "transparent",
                                membership.kitSocks || "transparent",
                              ].map((color, index) => (
                                <span
                                  key={`${membership.id}-kit-swatch-${index}`}
                                  className="h-7 w-7 rounded-full border border-[var(--line)]"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            <label className="grid gap-1 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                              Shirt
                              <input
                                className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs normal-case tracking-normal text-[var(--ink-0)]"
                                value={membership.kitShirt ?? ""}
                                onChange={(event) =>
                                  patchAdminTeamMembershipDraft(
                                    activeAdminMembershipUser.id,
                                    membership.id,
                                    { kitShirt: event.target.value || null }
                                  )
                                }
                                placeholder="Use club default"
                              />
                            </label>
                            <label className="grid gap-1 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                              Shirt secondary
                              <input
                                className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs normal-case tracking-normal text-[var(--ink-0)]"
                                value={membership.kitShirtSecondary ?? ""}
                                onChange={(event) =>
                                  patchAdminTeamMembershipDraft(
                                    activeAdminMembershipUser.id,
                                    membership.id,
                                    { kitShirtSecondary: event.target.value || null }
                                  )
                                }
                                placeholder="Use club default"
                              />
                            </label>
                            <label className="grid gap-1 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                              Shorts
                              <input
                                className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs normal-case tracking-normal text-[var(--ink-0)]"
                                value={membership.kitShorts ?? ""}
                                onChange={(event) =>
                                  patchAdminTeamMembershipDraft(
                                    activeAdminMembershipUser.id,
                                    membership.id,
                                    { kitShorts: event.target.value || null }
                                  )
                                }
                                placeholder="Use club default"
                              />
                            </label>
                            <label className="grid gap-1 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                              Socks
                              <input
                                className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs normal-case tracking-normal text-[var(--ink-0)]"
                                value={membership.kitSocks ?? ""}
                                onChange={(event) =>
                                  patchAdminTeamMembershipDraft(
                                    activeAdminMembershipUser.id,
                                    membership.id,
                                    { kitSocks: event.target.value || null }
                                  )
                                }
                                placeholder="Use club default"
                              />
                            </label>
                            <label className="grid gap-1 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                              Vest
                              <input
                                className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs normal-case tracking-normal text-[var(--ink-0)]"
                                value={membership.kitVest ?? ""}
                                onChange={(event) =>
                                  patchAdminTeamMembershipDraft(
                                    activeAdminMembershipUser.id,
                                    membership.id,
                                    { kitVest: event.target.value || null }
                                  )
                                }
                                placeholder="Use club default"
                              />
                            </label>
                            <label className="grid gap-1 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                              Jersey type
                              <select
                                className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs normal-case tracking-normal text-[var(--ink-0)]"
                                value={membership.kitJerseyType ?? ""}
                                onChange={(event) =>
                                  patchAdminTeamMembershipDraft(
                                    activeAdminMembershipUser.id,
                                    membership.id,
                                    {
                                      kitJerseyType:
                                        (event.target.value || null) as AdminTeamMembershipRow["kitJerseyType"],
                                    }
                                  )
                                }
                              >
                                <option value="">Use club default</option>
                                {teamJerseyTypeOptions.map((option) => (
                                  <option key={`${membership.id}-jersey-${option}`} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </div>
                        <select
                          className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                          value={membership.teamRole}
                          onChange={(event) =>
                            patchAdminTeamMembershipDraft(
                              activeAdminMembershipUser.id,
                              membership.id,
                              { teamRole: event.target.value }
                            )
                          }
                        >
                          {["leader", "player", "guardian", "relative", "staff", "other"].map(
                            (option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            )
                          )}
                        </select>
                        <input
                          className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                          value={membership.teamPosition ?? ""}
                          onChange={(event) =>
                            patchAdminTeamMembershipDraft(
                              activeAdminMembershipUser.id,
                              membership.id,
                              { teamPosition: event.target.value }
                            )
                          }
                          placeholder="Position"
                        />
                        <label className="inline-flex items-center gap-2 text-xs text-[var(--ink-0)]">
                          <input
                            type="checkbox"
                            checked={membership.isTeamAdmin}
                            onChange={(event) =>
                              patchAdminTeamMembershipDraft(
                                activeAdminMembershipUser.id,
                                membership.id,
                                { isTeamAdmin: event.target.checked }
                              )
                            }
                          />
                          Team admin
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-full border border-[var(--accent-2)] px-3 py-2 text-[10px] uppercase tracking-wide text-[var(--accent-2)] hover:brightness-110"
                            onClick={() =>
                              void saveAdminTeamDetails(
                                activeAdminMembershipUser.id,
                                (
                                  adminMemberships[activeAdminMembershipUser.id]?.teamMemberships ??
                                  activeAdminMemberships.teamMemberships
                                ).find((entry) => entry.id === membership.id) ?? membership
                              )
                            }
                          >
                            Save team
                          </button>
                          <button
                            className="rounded-full border border-[var(--line)] px-3 py-2 text-[10px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                            onClick={() =>
                              void saveAdminTeamMembership(
                                activeAdminMembershipUser.id,
                                (
                                  adminMemberships[activeAdminMembershipUser.id]?.teamMemberships ??
                                  activeAdminMemberships.teamMemberships
                                ).find((entry) => entry.id === membership.id) ?? membership
                              )
                            }
                          >
                            Save membership
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="grid gap-2 rounded-xl border border-dashed border-[var(--line)] p-3">
                      <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                        Add existing team
                      </p>
                      <select
                        className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                        value={adminNewTeamClubId}
                        onChange={(event) => setAdminNewTeamClubId(event.target.value)}
                      >
                        {activeAdminMemberships.clubs.map((club) => (
                          <option key={club.id} value={club.id}>
                            {club.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                        value={adminNewTeamId}
                        onChange={(event) => setAdminNewTeamId(event.target.value)}
                      >
                        {adminAvailableTeamsForNewMembership.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                        value={adminNewTeamRole}
                        onChange={(event) => setAdminNewTeamRole(event.target.value)}
                      >
                        {["leader", "player", "guardian", "relative", "staff", "other"].map(
                          (option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          )
                        )}
                      </select>
                      <input
                        className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                        value={adminNewTeamPosition}
                        onChange={(event) => setAdminNewTeamPosition(event.target.value)}
                        placeholder="Position"
                      />
                      <label className="inline-flex items-center gap-2 text-xs text-[var(--ink-0)]">
                        <input
                          type="checkbox"
                          checked={adminNewTeamAdmin}
                          onChange={(event) => setAdminNewTeamAdmin(event.target.checked)}
                        />
                        Team admin
                      </label>
                      <button
                        className="rounded-full border border-[var(--accent-0)] px-3 py-2 text-[10px] uppercase tracking-wide text-[var(--accent-0)]"
                        onClick={() => void addAdminTeamMembership(activeAdminMembershipUser.id)}
                      >
                        Add team
                      </button>
                    </div>
                    <div className="grid gap-2 rounded-xl border border-dashed border-[var(--line)] p-3">
                      <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                        Create new team
                      </p>
                      <select
                        className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                        value={adminNewTeamClubId}
                        onChange={(event) => setAdminNewTeamClubId(event.target.value)}
                      >
                        {activeAdminMemberships.clubs.map((club) => (
                          <option key={`new-team-club-${club.id}`} value={club.id}>
                            {club.name}
                          </option>
                        ))}
                      </select>
                      <input
                        className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                        value={adminNewTeamName}
                        onChange={(event) => setAdminNewTeamName(event.target.value)}
                        placeholder="Create new team"
                      />
                      <input
                        className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                        value={adminNewTeamType}
                        onChange={(event) => setAdminNewTeamType(event.target.value)}
                        placeholder="Type"
                      />
                      <input
                        className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                        value={adminNewTeamAgeGroup}
                        onChange={(event) => setAdminNewTeamAgeGroup(event.target.value)}
                        placeholder="Age group"
                      />
                      <input
                        className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                        value={adminNewTeamSeasonLabel}
                        onChange={(event) => setAdminNewTeamSeasonLabel(event.target.value)}
                        placeholder="Season"
                      />
                      <button
                        className="rounded-full border border-[var(--accent-2)] px-3 py-2 text-[10px] uppercase tracking-wide text-[var(--accent-2)]"
                        onClick={() => void createAdminTeamForUser(activeAdminMembershipUser.id)}
                      >
                        Create team
                      </button>
                    </div>
                  </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
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
