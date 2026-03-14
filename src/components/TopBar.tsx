"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/state/useProjectStore";
import { serializeProject, deserializeProject } from "@/persistence/serialize";
import { saveProject } from "@/persistence/storage";
import { useEditorStore } from "@/state/useEditorStore";
import type {
  Board,
  BoardMode,
  JerseyType,
  PitchOverlay,
  PitchView,
  ProjectMode,
  SquadPlayer,
  SquadPreset,
  TeamDirectoryClub,
} from "@/models";
import FormationMenu from "@/components/FormationMenu";
import { can, getPlanLimits } from "@/utils/plan";
import AdBanner from "@/components/AdBanner";
import { usePlanGate } from "@/hooks/usePlanGate";
import PlanModal from "@/components/PlanModal";
import BetaNoticeModal from "@/components/BetaNoticeModal";
import ShareBoardModal from "@/components/ShareBoardModal";
import CommentsModal from "@/components/CommentsModal";
import { getActiveBoard, getBoardSquads } from "@/utils/board";
import { createId } from "@/utils/id";
import {
  createTeamWithSquad,
  fetchTeamsWithSquad,
  updateTeamWithSquad,
} from "@/persistence/teamSquads";
import { fetchClubTeamDirectory } from "@/persistence/teamDirectory";
import { saveDefaultTeamSquad } from "@/persistence/defaultTeamSquads";
import {
  createProjectShareLink,
  fetchProjectShareLinkForOwner,
} from "@/persistence/projectShareLinks";
import {
  deleteProjectTemplate,
  loadProjectTemplates,
  renameProjectTemplate,
  saveProjectTemplate,
  type ProjectTemplate,
} from "@/persistence/projectTemplates";
import { getPitchViewBounds } from "@/board/pitch/Pitch";
import { getStageRef } from "@/utils/stageRef";
import { clone } from "@/utils/clone";
import { duplicateProjectWithFreshIds } from "@/state/projectHelpers";
import ColorPalettePicker from "@/components/ColorPalettePicker";

type ManagePlayersSortKey = "default" | "name" | "position" | "number";
type ManageRosterFilter = "all" | "visible" | "hidden" | "guests" | "regular";
type ManageRosterView = "base" | "board";
const SHARE_LINK_BASE_URL = "https://webtools.teamzoneapp.se";
const MANAGE_POSITION_OPTIONS = [
  "Goalkeeper (GK)",
  "Right Back (RB)",
  "Right Center Back (RCB)",
  "Center Back (CB)",
  "Left Center Back (LCB)",
  "Left Back (LB)",
  "Right Wing Back (RWB)",
  "Left Wing Back (LWB)",
  "Defensive Midfielder (DM)",
  "Central Defensive Midfielder (CDM)",
  "Central Midfielder (CM)",
  "Attacking Midfielder (AM)",
  "Central Attacking Midfielder (CAM)",
  "Right Midfielder (RM)",
  "Left Midfielder (LM)",
  "Right Winger (RW)",
  "Left Winger (LW)",
  "Striker (ST)",
  "Center Forward (CF)",
  "Second Striker (SS)",
] as const;

type ManageDirectoryTeamOption = {
  clubId: string;
  clubName: string;
  clubMembershipRole: string;
  isCurrentUserClubAdmin: boolean;
  teamId: string;
  teamName: string;
  teamType: string;
  ageGroup?: string | null;
  seasonLabel?: string | null;
  status: string;
  isCurrentUserTeamAdmin: boolean;
  squad: SquadPreset["squad"];
  members: TeamDirectoryClub["teams"][number]["members"];
};

const SHIRT_TYPES: Array<{
  id: JerseyType;
  label: string;
}> = [
  { id: "solid", label: "Solid" },
  { id: "split", label: "Split" },
  { id: "stripe", label: "Stripe" },
  { id: "sash", label: "Sash" },
  { id: "pinstripe", label: "Pinstripe" },
];

type ManageDirectoryMemberOption = TeamDirectoryClub["teams"][number]["members"][number];

const flattenDirectoryTeamsToPresets = (clubs: TeamDirectoryClub[]): SquadPreset[] =>
  clubs.flatMap((club) =>
    club.teams.map((team) => ({
      id: team.id,
      userId: "",
      teamId: team.id,
      teamName: team.name,
      name: team.name,
      squad: team.squad,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }))
  );

export default function TopBar() {
  const project = useProjectStore((state) => state.project);
  const updateProjectMeta = useProjectStore((state) => state.updateProjectMeta);
  const updateBoard = useProjectStore((state) => state.updateBoard);
  const setActiveBoard = useProjectStore((state) => state.setActiveBoard);
  const setBoardMode = useProjectStore((state) => state.setBoardMode);
  const setBoardPitchView = useProjectStore((state) => state.setBoardPitchView);
  const setActiveFrameIndex = useProjectStore(
    (state) => state.setActiveFrameIndex
  );
  const updateSquad = useProjectStore((state) => state.updateSquad);
  const addSquadPlayer = useProjectStore((state) => state.addSquadPlayer);
  const updateSquadPlayer = useProjectStore((state) => state.updateSquadPlayer);
  const removeSquadPlayer = useProjectStore((state) => state.removeSquadPlayer);
  const openProject = useProjectStore((state) => state.openProject);
  const openProjectFromData = useProjectStore((state) => state.openProjectFromData);
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
  const [squadPresetDirectory, setSquadPresetDirectory] = useState<TeamDirectoryClub[]>([]);
  const [squadPresetsLoading, setSquadPresetsLoading] = useState(false);
  const [squadPresetsError, setSquadPresetsError] = useState<string | null>(null);
  const [manageSide, setManageSide] = useState<"home" | "away">("home");
  const [manageSelectedDirectoryTeamId, setManageSelectedDirectoryTeamId] = useState("");
  const [managePlayersSortKey, setManagePlayersSortKey] =
    useState<ManagePlayersSortKey>("default");
  const [managePlayersSortDir, setManagePlayersSortDir] = useState<"asc" | "desc">(
    "asc"
  );
  const [manageRosterView, setManageRosterView] =
    useState<ManageRosterView>("base");
  const [manageBoardSearch, setManageBoardSearch] = useState("");
  const [manageBaseSearch, setManageBaseSearch] = useState("");
  const [manageBoardFilter, setManageBoardFilter] =
    useState<ManageRosterFilter>("all");
  const [manageGuestName, setManageGuestName] = useState("");
  const [manageGuestPosition, setManageGuestPosition] = useState("");
  const [manageGuestNumber, setManageGuestNumber] = useState("");
  const [managePresetStatus, setManagePresetStatus] = useState<string | null>(
    null
  );
  const [jerseyType, setJerseyType] = useState<JerseyType>("solid");
  const [shareLinkOpen, setShareLinkOpen] = useState(false);
  const [shareLinkStatus, setShareLinkStatus] = useState<string | null>(null);
  const [shareLinkUrl, setShareLinkUrl] = useState<string | null>(null);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [shareLinkQrError, setShareLinkQrError] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfScope, setPdfScope] = useState<"board" | "project">("board");
  const [pdfSelectedBoardIds, setPdfSelectedBoardIds] = useState<string[]>([]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const manageLogoRef = useRef<HTMLInputElement>(null);
  const [hideBetaBanner, setHideBetaBanner] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [manageTemplatesOpen, setManageTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [templateStatus, setTemplateStatus] = useState<string | null>(null);
  const [boardActionsOpen, setBoardActionsOpen] = useState(false);
  const [projectActionsOpen, setProjectActionsOpen] = useState(false);
  const [newProjectChoiceOpen, setNewProjectChoiceOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const [titleWidth, setTitleWidth] = useState<number | null>(null);
  const showAds = plan === "FREE";
  const canUseTemplates = plan === "PAID" && !!authUser;
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

  const createEmptyProjectFromCurrentDefaults = () => {
    if (!project) {
      return;
    }
    const name = window.prompt("New project name") ?? "";
    if (!name.trim()) {
      return;
    }
    createProject(name.trim(), {
      homeKit: project.settings?.homeKit,
      awayKit: project.settings?.awayKit,
      attachBallToPlayer: project.settings?.attachBallToPlayer ?? false,
    });
  };

  const duplicateCurrentProject = () => {
    if (!project) {
      return;
    }
    const suggestedName = `${project.name} (copy)`;
    const name = window.prompt("Duplicate project name", suggestedName) ?? "";
    if (!name.trim()) {
      return;
    }
    const duplicated = duplicateProjectWithFreshIds(project, name.trim());
    openProjectFromData(duplicated);
  };

  const refreshTemplates = () => {
    if (!canUseTemplates) {
      setTemplates([]);
      return;
    }
    setTemplates(loadProjectTemplates(authUser?.id ?? null));
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
    const onOpenManageTeams = () => setSquadPresetsOpen(true);
    window.addEventListener(
      "tacticsboard:open-manage-teams",
      onOpenManageTeams as EventListener
    );
    return () => {
      window.removeEventListener(
        "tacticsboard:open-manage-teams",
        onOpenManageTeams as EventListener
      );
    };
  }, []);
  useEffect(() => {
    if (!actionsOpen && !boardActionsOpen && !projectActionsOpen) {
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
      setBoardActionsOpen(false);
      setProjectActionsOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("mousedown", handleClick);
    };
  }, [actionsOpen, boardActionsOpen, projectActionsOpen]);

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
      setManageSelectedDirectoryTeamId("");
      return;
    }
    if (!authUser || plan !== "PAID") {
      setSquadPresets([]);
      setSquadPresetDirectory([]);
      setSquadPresetsError(null);
      return;
    }
    setSquadPresetsLoading(true);
    setSquadPresetsError(null);
    fetchClubTeamDirectory()
      .then((result) => {
        if (!result.ok) {
          return fetchTeamsWithSquad().then((legacyResult) => {
            if (!legacyResult.ok) {
              setSquadPresetsError(legacyResult.error);
              setSquadPresets([]);
              setSquadPresetDirectory([]);
              return;
            }
            setSquadPresetDirectory([
              {
                id: "legacy-personal-club",
                name: "My teams",
                slug: "my-teams",
                logoUrl: null,
                status: "active",
                membershipRole: "member",
                isCurrentUserClubAdmin: true,
                teams: legacyResult.teams.map((team) => ({
                  id: team.id,
                  clubId: "legacy-personal-club",
                  name: team.name,
                  slug: null,
                  teamType: "other",
                  ageGroup: null,
                  seasonLabel: null,
                  status: "active",
                  squad: team.squad,
                  members: team.squad.players.map((player, index) => ({
                    id: player.id,
                    userId: null,
                    displayName: player.name,
                    memberRole: "player",
                    teamPosition: player.positionLabel,
                    isTeamAdmin: false,
                    isGuest: player.guest ?? false,
                    isActive: player.active ?? true,
                    shirtNumber: player.number ?? null,
                    photoUrl: player.photoUrl ?? null,
                    sortOrder: index,
                  })),
                  isCurrentUserTeamAdmin: true,
                })),
              },
            ]);
            setSquadPresets(legacyResult.teams);
          });
        }
        setSquadPresetDirectory(result.clubs);
        setSquadPresets(flattenDirectoryTeamsToPresets(result.clubs));
      })
      .finally(() => setSquadPresetsLoading(false));
  }, [squadPresetsOpen, authUser, plan]);
  useEffect(() => {
    if (!manageTemplatesOpen) {
      setTemplateStatus(null);
      return;
    }
    if (!canUseTemplates) {
      setTemplates([]);
      return;
    }
    setTemplates(loadProjectTemplates(authUser?.id ?? null));
  }, [authUser?.id, canUseTemplates, manageTemplatesOpen]);
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem("tacticsboard:hideBetaBanner");
    setHideBetaBanner(stored === "true");
  }, []);

  const activeBoard = useMemo(() => getActiveBoard(project ?? null), [project]);
  const activeBoardId = activeBoard?.id ?? project?.activeBoardId ?? project?.boards[0]?.id;
  const boardSquads = getBoardSquads(project ?? null, activeBoard ?? null);
  const manageSquadId =
    manageSide === "home" ? activeBoard?.homeSquadId : activeBoard?.awaySquadId;
  const manageBaseSquad =
    project?.squads.find((item) => item.id === manageSquadId) ?? null;
  const manageBoardSquad =
    manageSide === "home" ? boardSquads.home : boardSquads.away;
  const manageSquad = manageBaseSquad;
  const editableSquad = manageBaseSquad;
  const manageDirectoryTeams = useMemo<ManageDirectoryTeamOption[]>(
    () =>
      squadPresetDirectory.flatMap((club) =>
        club.teams.map((team) => ({
          clubId: club.id,
          clubName: club.name,
          clubMembershipRole: club.membershipRole,
          isCurrentUserClubAdmin: club.isCurrentUserClubAdmin,
          teamId: team.id,
          teamName: team.name,
          teamType: team.teamType,
          ageGroup: team.ageGroup,
          seasonLabel: team.seasonLabel,
          status: team.status,
          isCurrentUserTeamAdmin: team.isCurrentUserTeamAdmin,
          squad: team.squad,
          members: team.members,
        }))
      ),
    [squadPresetDirectory]
  );
  const managedDirectoryTeam =
    manageDirectoryTeams.find((team) => team.teamId === manageSquad?.id) ?? null;
  const selectedManageDirectoryTeam =
    manageDirectoryTeams.find((team) => team.teamId === manageSelectedDirectoryTeamId) ??
    null;
  const managedDirectoryMemberMap = useMemo(() => {
    const entries = new Map<string, ManageDirectoryMemberOption>();
    managedDirectoryTeam?.members.forEach((member) => {
      entries.set(member.id, member);
    });
    return entries;
  }, [managedDirectoryTeam]);
  const manageMembershipSummary = useMemo(() => {
    const players = manageSquad?.players ?? [];
    let linkedMembers = 0;
    let localOnly = 0;
    let guests = 0;
    players.forEach((player) => {
      if (player.guest) {
        guests += 1;
      }
      const member =
        managedDirectoryMemberMap.get(player.id) ??
        (player.sourcePlayerId
          ? managedDirectoryMemberMap.get(player.sourcePlayerId)
          : undefined);
      if (member) {
        linkedMembers += 1;
      } else {
        localOnly += 1;
      }
    });
    return { linkedMembers, localOnly, guests };
  }, [manageSquad?.players, managedDirectoryMemberMap]);
  useEffect(() => {
    if (!squadPresetsOpen) {
      return;
    }
    if (managedDirectoryTeam) {
      setManageSelectedDirectoryTeamId(managedDirectoryTeam.teamId);
      return;
    }
    setManageSelectedDirectoryTeamId(
      (current) => current || manageDirectoryTeams[0]?.teamId || ""
    );
  }, [manageDirectoryTeams, managedDirectoryTeam, squadPresetsOpen]);
  const sortedManagePlayers = useMemo(() => {
    if (!manageSquad) {
      return [];
    }
    const substitutes = new Set(editableSquad?.substituteIds ?? []);
    const withIndex = manageSquad.players.map((player, index) => ({
      player,
      index,
    }));
    const numberValue = (value: number | undefined): number =>
      typeof value === "number" && Number.isFinite(value)
        ? value
        : Number.POSITIVE_INFINITY;
    const textValue = (value?: string) => value?.trim().toLowerCase() ?? "";
    const defaultCompare = (
      a: (typeof withIndex)[number],
      b: (typeof withIndex)[number]
    ) => {
      const aShown = a.player.active !== false ? 0 : 1;
      const bShown = b.player.active !== false ? 0 : 1;
      if (aShown !== bShown) {
        return aShown - bShown;
      }
      const aSub = substitutes.has(a.player.id) ? 1 : 0;
      const bSub = substitutes.has(b.player.id) ? 1 : 0;
      if (aSub !== bSub) {
        return aSub - bSub;
      }
      const aNumber = numberValue(a.player.number);
      const bNumber = numberValue(b.player.number);
      if (aNumber !== bNumber) {
        return aNumber - bNumber;
      }
      return textValue(a.player.name).localeCompare(textValue(b.player.name), "sv");
    };
    const compare = (a: (typeof withIndex)[number], b: (typeof withIndex)[number]) => {
      if (managePlayersSortKey === "default") {
        const value = defaultCompare(a, b);
        return value !== 0 ? value : a.index - b.index;
      }
      let value = 0;
      if (managePlayersSortKey === "name") {
        value = textValue(a.player.name).localeCompare(textValue(b.player.name), "sv");
      } else if (managePlayersSortKey === "position") {
        value = textValue(a.player.positionLabel).localeCompare(
          textValue(b.player.positionLabel),
          "sv"
        );
      } else if (managePlayersSortKey === "number") {
        value = numberValue(a.player.number) - numberValue(b.player.number);
      }
      if (value === 0) {
        value = defaultCompare(a, b);
      }
      const direction = managePlayersSortDir === "asc" ? 1 : -1;
      return value * direction || a.index - b.index;
    };
    return [...withIndex].sort(compare).map((entry) => entry.player);
  }, [editableSquad?.substituteIds, managePlayersSortDir, managePlayersSortKey, manageSquad]);
  const updateEditableSquad = (
    payload: Partial<SquadPreset["squad"]>
  ) => {
    if (manageSquad) {
      updateSquad(manageSquad.id, payload);
    }
  };
  const updateManageBoardOverride = (
    updater: (current: {
      hiddenPlayerIds?: string[];
      guestPlayers?: SquadPlayer[];
      positionOverrides?: Record<string, string>;
    }) => {
      hiddenPlayerIds?: string[];
      guestPlayers?: SquadPlayer[];
      positionOverrides?: Record<string, string>;
    }
  ) => {
    if (!activeBoard || !manageBaseSquad) {
      return;
    }
    const current = activeBoard.squadOverrides?.[manageBaseSquad.id] ?? {
      hiddenPlayerIds: [],
      guestPlayers: [],
      positionOverrides: {},
    };
    const next = updater(current);
    updateBoard(activeBoard.id, {
      squadOverrides: {
        ...(activeBoard.squadOverrides ?? {}),
        [manageBaseSquad.id]: next,
      },
    });
  };
  const sortedManageBoardPlayers = useMemo(() => {
    const list = manageBoardSquad?.players ?? [];
    const needle = manageBoardSearch.trim().toLowerCase();
    return list.filter((player) => {
      if (manageBoardFilter === "visible" && player.active === false) {
        return false;
      }
      if (manageBoardFilter === "hidden" && player.active !== false) {
        return false;
      }
      if (manageBoardFilter === "guests" && !player.guest) {
        return false;
      }
      if (manageBoardFilter === "regular" && player.guest) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack =
        `${player.name} ${player.positionLabel} ${player.number ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [manageBoardFilter, manageBoardSearch, manageBoardSquad?.players]);
  const filteredManageBasePlayers = useMemo(() => {
    const needle = manageBaseSearch.trim().toLowerCase();
    if (!needle) {
      return sortedManagePlayers;
    }
    return sortedManagePlayers.filter((player) => {
      const haystack =
        `${player.name} ${player.positionLabel} ${player.number ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [manageBaseSearch, sortedManagePlayers]);
  const isSharedView = project?.isShared ?? false;
  const limits = getPlanLimits(plan);
  const projectCount = new Set(
    [...index.map((item) => item.id), project?.id].filter(Boolean)
  ).size;
  const projectLimitReached =
    Number.isFinite(limits.maxProjects) && projectCount >= limits.maxProjects;
  const boardLimitReached =
    Number.isFinite(limits.maxBoards) &&
    (project?.boards.length ?? 0) >= limits.maxBoards;
  const modeLabel =
    project?.settings?.mode ?? ("match" as "training" | "match" | "education");
  const modeText = modeLabel.charAt(0).toUpperCase() + modeLabel.slice(1);
  const canUsePresetStorage = plan === "PAID" && Boolean(authUser);
  const shareLinkQrUrl = shareLinkUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=16&data=${encodeURIComponent(
        shareLinkUrl
      )}`
    : null;
  const shareLinkQrDownloadName = `${(project?.name ?? "project")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project"}-share-qr.png`;
  useEffect(() => {
    if (!shareLinkOpen || !project || !authUser || plan !== "PAID") {
      return;
    }
    let cancelled = false;
    setShareLinkStatus("Loading existing share link...");
    setShareLinkCopied(false);
    setShareLinkQrError(false);
    fetchProjectShareLinkForOwner(project.id)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (!result.ok) {
          setShareLinkUrl(null);
          setShareLinkStatus(result.error);
          return;
        }
        if (!result.token) {
          setShareLinkUrl(null);
          setShareLinkStatus("No share link yet. Generate one below.");
          return;
        }
        setShareLinkUrl(`${SHARE_LINK_BASE_URL}/share/${result.token}`);
        setShareLinkStatus(null);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setShareLinkUrl(null);
        setShareLinkStatus("Unable to load existing share link.");
      });
    return () => {
      cancelled = true;
    };
  }, [authUser, plan, project, shareLinkOpen]);
  const closeSquadPresetsModal = () => {
    setSquadPresetsOpen(false);
  };
  const saveManagePreset = async () => {
    if (!editableSquad) {
      setManagePresetStatus("No team data available.");
      return;
    }
    const nextName = editableSquad.name.trim();
    if (!nextName) {
      setManagePresetStatus("Enter a team name.");
      return;
    }
    setManagePresetStatus(null);
    const existingTeam =
      (manageSquad ? squadPresets.find((item) => item.id === manageSquad.id) : null) ??
      squadPresets.find(
        (item) => item.name.trim().toLowerCase() === nextName.toLowerCase()
      ) ?? squadPresets[0];
    if (existingTeam) {
      const result = await updateTeamWithSquad({
        id: existingTeam.id,
        name: nextName,
        squad: editableSquad,
      });
      if (!result.ok) {
        setManagePresetStatus(result.error);
        return;
      }
      setSquadPresets((prev) =>
        prev.map((item) => (item.id === result.team.id ? result.team : item))
      );
      saveDefaultTeamSquad(manageSide, result.team.squad, authUser?.id ?? null);
      setManagePresetStatus(
        "Current squad snapshot saved to Team DB and set as default for new projects. This board keeps its local copy until you load the saved team."
      );
      return;
    }
    const result = await createTeamWithSquad({
      name: nextName,
      squad: editableSquad,
    });
    if (!result.ok) {
      setManagePresetStatus(result.error);
      return;
    }
    setSquadPresets((prev) => [result.team, ...prev]);
    saveDefaultTeamSquad(manageSide, result.team.squad, authUser?.id ?? null);
    setManagePresetStatus(
      "Current squad snapshot saved to Team DB and set as default for new projects. This board keeps its local copy until you load the saved team."
    );
  };

  const loadDirectoryTeamIntoSide = (teamId: string, side: "home" | "away") => {
    const selectedTeam =
      manageDirectoryTeams.find((team) => team.teamId === teamId) ?? null;
    if (!selectedTeam) {
      setManagePresetStatus("Select a team to load.");
      return;
    }
    const targetSquadId =
      side === "home" ? activeBoard?.homeSquadId : activeBoard?.awaySquadId;
    const targetSquad =
      project?.squads.find((item) => item.id === targetSquadId) ?? null;
    if (!targetSquad) {
      setManagePresetStatus("No target squad available on this board.");
      return;
    }
    updateSquad(targetSquad.id, {
      name: selectedTeam.squad.name,
      clubLogo: selectedTeam.squad.clubLogo,
      kit: { ...selectedTeam.squad.kit },
      captainId: selectedTeam.squad.captainId,
      substituteIds: [...(selectedTeam.squad.substituteIds ?? [])],
      players: selectedTeam.squad.players.map((player) => ({ ...player })),
    });
    setManageSide(side);
    setManageSelectedDirectoryTeamId(teamId);
    setManagePresetStatus(
      `${selectedTeam.clubName} / ${selectedTeam.teamName} loaded as ${
        side === "home" ? "Home" : "Away"
      } team.`
    );
  };

  const setManagedTeamToSide = (side: "home" | "away") => {
    if (!manageSquad) {
      setManagePresetStatus("No team data available.");
      return;
    }
    const targetSquadId =
      side === "home" ? activeBoard?.homeSquadId : activeBoard?.awaySquadId;
    const targetSquad =
      project?.squads.find((item) => item.id === targetSquadId) ?? null;
    if (!targetSquad) {
      setManagePresetStatus("No target squad available on this board.");
      return;
    }
    updateSquad(targetSquad.id, {
      name: manageSquad.name,
      clubLogo: manageSquad.clubLogo,
      kit: { ...manageSquad.kit },
      captainId: manageSquad.captainId,
      substituteIds: [...(manageSquad.substituteIds ?? [])],
      players: manageSquad.players.map((player) => ({ ...player })),
    });
    setManageSide(side);
    setManagePresetStatus(
      side === "home" ? "Set as Home team." : "Set as Away team."
    );
  };
  const toggleManagePlayersSort = (key: ManagePlayersSortKey) => {
    if (key === "default") {
      setManagePlayersSortKey("default");
      setManagePlayersSortDir("asc");
      return;
    }
    if (managePlayersSortKey === key) {
      setManagePlayersSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setManagePlayersSortKey(key);
    setManagePlayersSortDir("asc");
  };
  const manageSortIndicator = (key: ManagePlayersSortKey) => {
    if (managePlayersSortKey !== key) {
      return "";
    }
    if (key === "default") {
      return " •";
    }
    return managePlayersSortDir === "asc" ? " ↑" : " ↓";
  };
  const manageToggleBoardPlayerVisible = (playerId: string, nextVisible: boolean) => {
    updateManageBoardOverride((current) => {
      const hidden = new Set(current.hiddenPlayerIds ?? []);
      if (nextVisible) {
        hidden.delete(playerId);
      } else {
        hidden.add(playerId);
      }
      return {
        ...current,
        hiddenPlayerIds: Array.from(hidden),
      };
    });
  };
  const manageSetBoardPlayerPosition = (playerId: string, value: string) => {
    const trimmed = value.trim();
    updateManageBoardOverride((current) => {
      const guests = [...(current.guestPlayers ?? [])];
      const guestIndex = guests.findIndex((item) => item.id === playerId);
      if (guestIndex >= 0) {
        guests[guestIndex] = {
          ...guests[guestIndex],
          positionLabel: trimmed,
        };
        return { ...current, guestPlayers: guests };
      }
      const nextOverrides = { ...(current.positionOverrides ?? {}) };
      const basePosition =
        manageBaseSquad?.players.find((item) => item.id === playerId)?.positionLabel ?? "";
      if (!trimmed || trimmed === basePosition) {
        delete nextOverrides[playerId];
      } else {
        nextOverrides[playerId] = trimmed;
      }
      return { ...current, positionOverrides: nextOverrides };
    });
  };
  const manageAddBoardGuest = () => {
    if (!manageGuestName.trim()) {
      return;
    }
    const parsedNumber = Number(manageGuestNumber);
    updateManageBoardOverride((current) => ({
      ...current,
      guestPlayers: [
        ...(current.guestPlayers ?? []),
        {
          id: createId(),
          name: manageGuestName.trim(),
          positionLabel: manageGuestPosition.trim() || "Guest",
          guest: true,
          active: true,
          number:
            Number.isFinite(parsedNumber) && parsedNumber > 0
              ? parsedNumber
              : undefined,
        },
      ],
    }));
    setManageGuestName("");
    setManageGuestPosition("");
    setManageGuestNumber("");
  };
  const manageRemoveBoardGuest = (playerId: string) => {
    updateManageBoardOverride((current) => {
      const nextGuests = (current.guestPlayers ?? []).filter(
        (item) => item.id !== playerId
      );
      const nextHidden = (current.hiddenPlayerIds ?? []).filter((id) => id !== playerId);
      const nextPositionOverrides = { ...(current.positionOverrides ?? {}) };
      delete nextPositionOverrides[playerId];
      return {
        ...current,
        guestPlayers: nextGuests,
        hiddenPlayerIds: nextHidden,
        positionOverrides: nextPositionOverrides,
      };
    });
  };
  const managePromoteBoardGuest = (player: SquadPlayer) => {
    if (!manageBaseSquad || !player.guest) {
      return;
    }
    if (!manageBaseSquad.players.some((item) => item.id === player.id)) {
      addSquadPlayer(manageBaseSquad.id, {
        ...player,
        guest: false,
        active: true,
      });
    }
    manageRemoveBoardGuest(player.id);
  };
  const renderShirtIcon = (
    type: JerseyType,
    primary: string,
    secondary: string,
    className: string
  ) => (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <clipPath id={`shirt-clip-${type}`}>
          <path d="M25 18h50l13 13-10 11-8-7v47H30V35l-8 7-10-11z" />
        </clipPath>
      </defs>
      <path
        d="M25 18h50l13 13-10 11-8-7v47H30V35l-8 7-10-11z"
        fill="#0b1c1d"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="2"
      />
      <g clipPath={`url(#shirt-clip-${type})`}>
        <rect x="20" y="14" width="60" height="72" fill={primary} />
        {type === "split" ? (
          <rect x="50" y="14" width="30" height="72" fill={secondary} />
        ) : null}
        {type === "stripe" ? (
          <rect x="42" y="14" width="16" height="72" fill={secondary} />
        ) : null}
        {type === "sash" ? (
          <path d="M16 70L78 8l10 10-62 62z" fill={secondary} opacity="0.95" />
        ) : null}
        {type === "pinstripe"
          ? [26, 34, 42, 50, 58, 66, 74].map((x) => (
              <rect key={x} x={x} y="14" width="3" height="72" fill={secondary} />
            ))
          : null}
      </g>
      <rect x="42" y="18" width="16" height="10" rx="4" fill="#0b1c1d" />
    </svg>
  );

  useEffect(() => {
    setJerseyType(editableSquad?.kit.jerseyType ?? "solid");
  }, [editableSquad?.kit.jerseyType]);

  useEffect(() => {
    if (!project) {
      return;
    }
    if (!pdfOpen) {
      return;
    }
    if (pdfScope === "board") {
      setPdfSelectedBoardIds(activeBoard ? [activeBoard.id] : []);
      return;
    }
    setPdfSelectedBoardIds(project.boards.map((board) => board.id));
  }, [pdfOpen, pdfScope, project, activeBoard]);

  if (!project) {
    return null;
  }

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

  const onRenameBoard = () => {
    if (!activeBoard) {
      return;
    }
    const nextName = window.prompt("Board name", activeBoard.name);
    if (nextName && nextName.trim()) {
      updateBoard(activeBoard.id, { name: nextName.trim() });
    }
  };

  const onDeleteBoard = () => {
    if (!activeBoard) {
      return;
    }
    if (!window.confirm("Delete this board?")) {
      return;
    }
    deleteBoard(activeBoard.id);
  };

  const onDuplicateBoard = () => {
    if (!activeBoard) {
      return;
    }
    const nextName =
      window.prompt("Duplicate board name", `${activeBoard.name} Copy`) ?? "";
    if (nextName.trim()) {
      if (boardLimitReached) {
        window.alert("Board limit reached for this plan.");
        return;
      }
      duplicateBoard(activeBoard.id, nextName.trim());
    }
  };

  const onAddBoard = () => {
    const name = window.prompt("Board name") ?? "";
    if (name.trim()) {
      if (getPlanLimits(plan).maxBoards <= (project.boards?.length ?? 0)) {
        window.alert("Board limit reached for this plan.");
        return;
      }
      addBoard(name.trim());
    }
  };

  const waitForPaint = async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  };

  const formatFieldLabel = (key: string) =>
    key
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\w/, (value) => value.toUpperCase());

  const getTemplateKey = (board: Board) => {
    if (board.notesTemplate === "TRAINING") {
      return "training";
    }
    if (board.notesTemplate === "MATCH") {
      return "match";
    }
    if (board.notesTemplate === "EDUCATION") {
      return "education";
    }
    return project.settings.mode;
  };

  const toText = (value: unknown) => {
    if (typeof value === "string") {
      return value.trim();
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .join(", ");
    }
    return "";
  };

  const buildPdfNotesLayout = (board: Board) => {
    const templateKey = getTemplateKey(board);
    const scopedSessionFields = (project.sessionNotesFields?.[
      templateKey as keyof typeof project.sessionNotesFields
    ] ?? {}) as Record<string, unknown>;
    const scopedBoardFields = (
      board.notesFields?.[templateKey as keyof typeof board.notesFields] ?? {}
    ) as Record<string, unknown>;
    const boardText = board.notes?.trim() ?? "";
    const dateText = toText(scopedSessionFields.dateTime) || "";

    const value = (key: string) => toText(scopedBoardFields[key]);
    const makeBlock = (title: string, text: string) =>
      text ? { title, text } : null;
    const compactBlocks = (
      items: Array<{ title: string; text: string } | null>
    ) => items.filter((item): item is { title: string; text: string } => Boolean(item));

    if (templateKey === "training") {
      return {
        dateText,
        left: compactBlocks([
          makeBlock("Main Focus", value("mainFocus")),
          makeBlock("Organisation", value("organisation")),
          makeBlock("Equipment", value("equipment")),
        ]),
        right: compactBlocks([
          makeBlock("Part Goals", value("partGoals")),
          makeBlock("Key Behaviours", value("keyBehaviours")),
          makeBlock("Instructions", value("coachInstructions")),
        ]),
        description: boardText,
      };
    }

    if (templateKey === "match") {
      return {
        dateText,
        left: compactBlocks([
          makeBlock("Opposition", value("opposition")),
          makeBlock("With Ball", value("ourGameWithBall")),
          makeBlock("Without Ball", value("ourGameWithoutBall")),
        ]),
        right: compactBlocks([
          makeBlock("Counters", value("counters")),
          makeBlock("Key Roles", value("keyRoles")),
          makeBlock("Reminders", value("importantReminders")),
        ]),
        description: boardText || value("matchMessage"),
      };
    }

    return {
      dateText,
      left: compactBlocks([
        makeBlock("Tema", value("tema")),
        makeBlock("Grundprincip", value("grundprincip")),
        makeBlock("What to See", value("whatToSee")),
      ]),
      right: compactBlocks([
        makeBlock("What to Do", value("whatToDo")),
        makeBlock("Usual Errors", value("usualErrors")),
        makeBlock("Match Connection", value("matchConnection")),
      ]),
      description: boardText || value("reflections"),
    };
  };

  const moveSelectedBoard = (boardId: string, direction: -1 | 1) => {
    setPdfSelectedBoardIds((prev) => {
      const index = prev.indexOf(boardId);
      if (index < 0) {
        return prev;
      }
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  };

  const captureBoardImage = async (board: Board): Promise<string | null> => {
    const stage = getStageRef();
    if (!stage) {
      return null;
    }
    const editorState = useEditorStore.getState();
    const previousPlayState = editorState.isPlaying;
    const previousPlayhead = editorState.playheadFrame;
    const previousFrameIndex = board.activeFrameIndex;

    editorState.setPlaying(false);
    if (board.mode === "DYNAMIC") {
      if (board.activeFrameIndex !== 0) {
        setActiveFrameIndex(board.id, 0);
      }
      if (previousPlayhead !== 0) {
        editorState.setPlayheadFrame(0);
      }
    }
    await waitForPaint();

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
    const pixelRatio = window.devicePixelRatio ?? 1;
    const stageScale = stage.scaleX();
    const stageOffsetX = stage.x();
    const stageOffsetY = stage.y();
    const srcX = (effectiveBounds.x * stageScale + stageOffsetX) * pixelRatio;
    const srcY = (effectiveBounds.y * stageScale + stageOffsetY) * pixelRatio;
    const srcW = effectiveBounds.width * stageScale * pixelRatio;
    const srcH = effectiveBounds.height * stageScale * pixelRatio;
    const targetW = Math.max(1, Math.round(srcW));
    const targetH = Math.max(1, Math.round(srcH));
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.fillStyle = "#1f5f3f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    stage.getLayers().forEach((layer) => {
      const layerCanvas = (layer.getCanvas() as { _canvas?: HTMLCanvasElement })
        ?._canvas;
      if (!layerCanvas) {
        return;
      }
      ctx.drawImage(
        layerCanvas,
        srcX,
        srcY,
        srcW,
        srcH,
        0,
        0,
        canvas.width,
        canvas.height
      );
    });
    const imageData = canvas.toDataURL("image/png");

    if (board.mode === "DYNAMIC") {
      if (previousFrameIndex !== 0) {
        setActiveFrameIndex(board.id, previousFrameIndex);
      }
      if (previousPlayhead !== 0) {
        editorState.setPlayheadFrame(previousPlayhead);
      }
    }
    if (previousPlayState) {
      editorState.setPlaying(true);
    }

    return imageData;
  };

  const loadJsPdf = async () => {
    type JsPdfInstance = {
      addPage: () => void;
      setPage: (pageNumber: number) => void;
      setLineWidth: (width: number) => void;
      setFontSize: (size: number) => void;
      setFont: (fontName: string, fontStyle?: string) => void;
      text: (
        text: string | string[],
        x: number,
        y: number,
        options?: Record<string, unknown>
      ) => void;
      line: (x1: number, y1: number, x2: number, y2: number) => void;
      roundedRect: (
        x: number,
        y: number,
        w: number,
        h: number,
        rx: number,
        ry: number,
        style?: string
      ) => void;
      addImage: (
        imageData: string,
        format: string,
        x: number,
        y: number,
        width: number,
        height: number,
        alias?: string,
        compression?: string
      ) => void;
      splitTextToSize: (text: string, maxWidth: number) => string[];
      save: (filename: string) => void;
    };
    type JsPdfCtor = new (options?: Record<string, unknown>) => JsPdfInstance;
    const existing = (window as unknown as { jspdf?: { jsPDF?: unknown } }).jspdf
      ?.jsPDF;
    if (existing) {
      return existing as JsPdfCtor;
    }
    const loadFrom = (src: string) =>
      new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });
    try {
      await loadFrom("/vendor/jspdf.umd.min.js");
    } catch {
      await loadFrom("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
    }
    const loaded = (window as unknown as { jspdf?: { jsPDF?: unknown } }).jspdf
      ?.jsPDF;
    if (!loaded) {
      throw new Error("jsPDF was not available after loading.");
    }
    return loaded as JsPdfCtor;
  };

  const getImageSize = (src: string) =>
    new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
      };
      img.onerror = () => reject(new Error("Failed to read captured image."));
      img.src = src;
    });

  const downloadPdfFile = async (
    pages: Array<{ boardName: string; image: string; board: Board }>,
    generatedAtLabel: string
  ) => {
    const JsPdf = await loadJsPdf();
    const doc = new JsPdf({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;

    const renderHeaderFooter = (pageNumber: number, totalPages: number, dateText: string) => {
      doc.setLineWidth(0.2);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(project.name, margin, 7.5);
      doc.text(dateText || generatedAtLabel, pageWidth - margin, 7.5, {
        align: "right",
      });
      doc.line(margin, 9.5, pageWidth - margin, 9.5);
      doc.line(margin, pageHeight - 9.5, pageWidth - margin, pageHeight - 9.5);
      doc.text("Teamzone Web Tools - webtools.teamzoneapp.se", margin, pageHeight - 4.5);
      doc.text(`Page ${pageNumber}/${totalPages}`, pageWidth - margin, pageHeight - 4.5, {
        align: "right",
      });
    };

    let pageNumber = 1;
    const descriptionChunks: Array<{ dateText: string; lines: string[] }> = [];

    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      if (index > 0) {
        doc.addPage();
        pageNumber += 1;
      }
      const layout = buildPdfNotesLayout(page.board);
      renderHeaderFooter(pageNumber, 0, layout.dateText);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(page.board.name, margin, 16.5);

      const imageDims = await getImageSize(page.image);
      const maxImageWidth = contentWidth;
      const maxImageHeight = 105;
      const ratio = Math.min(
        maxImageWidth / imageDims.width,
        maxImageHeight / imageDims.height
      );
      const imageWidth = imageDims.width * ratio;
      const imageHeight = imageDims.height * ratio;
      const imageX = margin + (contentWidth - imageWidth) / 2;
      const imageY = 19;
      doc.addImage(page.image, "PNG", imageX, imageY, imageWidth, imageHeight);

      const bodyTop = imageY + imageHeight + 8;
      const bodyBottom = pageHeight - 12;
      const rightBoxWidth = 58;
      const leftWidth = contentWidth - rightBoxWidth - 6;
      const rightX = margin + leftWidth + 6;
      const rightY = bodyTop;
      const rightHeight = bodyBottom - bodyTop;

      if (layout.right.length > 0) {
        doc.setLineWidth(0.6);
        doc.roundedRect(rightX, rightY, rightBoxWidth, rightHeight, 8, 8, "S");
      }

      let yLeft = bodyTop + 4;
      const leftLineHeight = 4;
      layout.left.forEach((block) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.8);
        doc.text(block.title, margin, yLeft);
        yLeft += leftLineHeight;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const lines = doc.splitTextToSize(block.text, leftWidth);
        doc.text(lines, margin, yLeft);
        yLeft += lines.length * 3.8 + 2.6;
      });

      if (layout.description) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.8);
        doc.text("Description", margin, yLeft);
        yLeft += leftLineHeight;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const descriptionLines = doc.splitTextToSize(layout.description, leftWidth);
        const maxDescriptionLinesOnFirstPage = Math.max(
          1,
          Math.floor((bodyBottom - yLeft) / 3.8)
        );
        const firstDescriptionChunk = descriptionLines.slice(
          0,
          maxDescriptionLinesOnFirstPage
        );
        const remainingDescription = descriptionLines.slice(
          maxDescriptionLinesOnFirstPage
        );
        doc.text(firstDescriptionChunk, margin, yLeft);

        if (remainingDescription.length > 0) {
          descriptionChunks.push({
            dateText: layout.dateText,
            lines: remainingDescription,
          });
        }
      }

      let yRight = bodyTop + 8;
      layout.right.forEach((block) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.8);
        doc.text(block.title, rightX + rightBoxWidth / 2, yRight, { align: "center" });
        yRight += 4.2;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const lines = doc.splitTextToSize(block.text, rightBoxWidth - 7);
        doc.text(lines, rightX + 3.5, yRight);
        yRight += lines.length * 3.8 + 2.8;
      });
    }

    for (const overflow of descriptionChunks) {
      let offset = 0;
      const linesPerPage = 66;
      while (offset < overflow.lines.length) {
        doc.addPage();
        pageNumber += 1;
        const chunk = overflow.lines.slice(offset, offset + linesPerPage);
        renderHeaderFooter(pageNumber, 0, overflow.dateText);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(chunk, margin, 17.5);
        offset += linesPerPage;
      }
    }

    const totalPages = pageNumber;
    for (let i = 1; i <= totalPages; i += 1) {
      doc.setPage(i as unknown as number);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Page ${i}/${totalPages}`, pageWidth - margin, pageHeight - 4.5, {
        align: "right",
      });
    }

    const safeName = project.name.replace(/[^\w\d-_]+/g, "_").slice(0, 60);
    doc.save(`${safeName || "project"}_export.pdf`);
    return true;
  };

  const onExportPdf = async () => {
    if (!can(plan, "project.export")) {
      setPdfStatus("PDF export is not available on this plan.");
      return;
    }
    if (!activeBoard) {
      setPdfStatus("No active board.");
      return;
    }
    setPdfBusy(true);
    setPdfStatus("Preparing PDF...");
    try {
      const originalBoardId = project.activeBoardId ?? project.boards[0]?.id;
      const targets =
        pdfScope === "project"
          ? pdfSelectedBoardIds
              .map((id) => project.boards.find((board) => board.id === id))
              .filter((board): board is Board => Boolean(board))
          : [activeBoard].filter(Boolean) as Board[];
      if (targets.length === 0) {
        setPdfStatus("Select at least one board.");
        return;
      }
      const pages: Array<{ boardName: string; image: string; board: Board }> = [];

      for (const targetBoard of targets) {
        if (project.activeBoardId !== targetBoard.id) {
          setActiveBoard(targetBoard.id);
          await waitForPaint();
        }
        const image = await captureBoardImage(targetBoard);
        if (!image) {
          continue;
        }
        pages.push({
          boardName: targetBoard.name,
          board: targetBoard,
          image,
        });
      }

      if (originalBoardId && project.activeBoardId !== originalBoardId) {
        setActiveBoard(originalBoardId);
      }

      if (pages.length === 0) {
        setPdfStatus("Could not capture boards for PDF export.");
        return;
      }
      const generatedAtLabel = new Intl.DateTimeFormat("sv-SE", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());
      const opened = await downloadPdfFile(pages, generatedAtLabel);
      setPdfStatus(
        opened
          ? "PDF downloaded."
          : "Could not generate PDF."
      );
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div
      className={`relative z-[220] grid w-full min-w-0 max-w-full items-center gap-3 overflow-visible rounded-3xl border border-[var(--line)] bg-[var(--panel)] px-3 py-3 shadow-2xl shadow-black/40 sm:px-5 sm:py-4 ${
        showAds
          ? "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
          : "grid-cols-1"
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
      <div className="flex min-w-0 items-center justify-between gap-2 overflow-visible">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex flex-col">
            <span
              className="display-font hidden text-[10px] uppercase tracking-[0.25em] text-[var(--accent-0)] md:block"
              style={titleWidth ? { width: `${titleWidth}px` } : undefined}
            >
              Teamzone Web Tools
            </span>
            <h1
              ref={titleRef}
              className="display-font text-base leading-none text-[var(--ink-0)] sm:text-2xl"
            >
              Tactics Board
            </h1>
          </div>
          <div
            className="relative flex min-w-0 max-w-[52vw] items-center gap-1 rounded-full border border-[var(--line)] bg-transparent px-2 py-1 md:max-w-none"
            data-actions-menu
          >
            <button
              className="h-6 min-w-0 truncate bg-transparent text-left text-xs text-[var(--ink-0)] focus:outline-none sm:h-7 sm:text-sm md:hidden"
              onClick={() => setProjectActionsOpen((prev) => !prev)}
              title="Project menu"
              aria-label="Project menu"
            >
              {project.name}
            </button>
            <input
              className="hidden h-6 min-w-0 bg-transparent text-xs text-[var(--ink-0)] focus:outline-none sm:h-7 sm:text-sm md:block"
              value={project.name}
              onChange={(event) =>
                updateProjectMeta({ name: event.target.value })
              }
            />
            <div className="h-5 w-px bg-[var(--line)]" />
            <button
              className="hidden rounded-full border border-[var(--line)] p-1 text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)] md:inline-flex"
              onClick={() => setNewProjectChoiceOpen(true)}
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
            {projectActionsOpen && (
              <div className="fixed left-3 right-3 top-28 z-[520] w-auto rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2 text-[11px] text-[var(--ink-0)] shadow-xl shadow-black/30 md:hidden">
                <button
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                  onClick={() => {
                    setProjectActionsOpen(false);
                    const name = window.prompt("Project name", project.name) ?? "";
                    if (name.trim()) {
                      updateProjectMeta({ name: name.trim() });
                    }
                  }}
                >
                  Edit name
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                  onClick={() => {
                    setProjectActionsOpen(false);
                    setNewProjectChoiceOpen(true);
                  }}
                  disabled={projectLimitReached}
                  data-locked={projectLimitReached}
                >
                  New project
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--ink-1)]">
          <div
            className="relative flex items-center gap-2 rounded-full border border-[var(--line)] bg-transparent px-2 py-1"
            data-actions-menu
          >
            <select
              className="hidden h-7 max-w-[180px] rounded-full bg-[var(--panel-2)] px-2 text-xs text-[var(--ink-0)] focus:outline-none sm:max-w-none sm:text-sm md:block"
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
            <button
              className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] p-1 text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)] md:hidden"
              onClick={() => setBoardActionsOpen((prev) => !prev)}
              title="Boards"
              aria-label="Boards"
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
                <rect x="3" y="4" width="18" height="4" rx="1" />
                <rect x="3" y="10" width="18" height="4" rx="1" />
                <rect x="3" y="16" width="18" height="4" rx="1" />
              </svg>
            </button>
            <button
              className="hidden rounded-full border border-[var(--line)] p-1 text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)] md:inline-flex"
              onClick={() => setBoardActionsOpen((prev) => !prev)}
              title="Board actions"
              aria-label="Board actions"
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
                <circle cx="6" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="18" cy="12" r="1.5" />
              </svg>
            </button>
            {boardActionsOpen && (
              <div className="fixed left-3 right-3 top-28 z-[520] w-auto rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2 text-[11px] text-[var(--ink-0)] shadow-xl shadow-black/30 md:absolute md:left-auto md:right-0 md:top-10 md:z-[320] md:w-56">
                <div className="mb-2 space-y-1 border-b border-[var(--line)] pb-2 md:hidden">
                  {project.boards.map((item) => (
                    <button
                      key={item.id}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-[var(--panel-2)] ${
                        item.id === activeBoardId
                          ? "text-[var(--accent-2)]"
                          : "text-[var(--ink-0)]"
                      }`}
                      onClick={() => {
                        setBoardActionsOpen(false);
                        setActiveBoard(item.id);
                        setTool("player");
                      }}
                    >
                      <span className="truncate">{item.name}</span>
                      {item.id === activeBoardId && <span>•</span>}
                    </button>
                  ))}
                </div>
                <button
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                  onClick={() => {
                    setBoardActionsOpen(false);
                    onRenameBoard();
                  }}
                >
                  Edit board name
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                  onClick={() => {
                    setBoardActionsOpen(false);
                    onDuplicateBoard();
                  }}
                  disabled={boardLimitReached}
                  data-locked={boardLimitReached}
                >
                  Duplicate board
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                  onClick={() => {
                    setBoardActionsOpen(false);
                    onAddBoard();
                  }}
                  disabled={boardLimitReached}
                  data-locked={boardLimitReached}
                >
                  New board
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                  onClick={() => {
                    setBoardActionsOpen(false);
                    onDeleteBoard();
                  }}
                  disabled={project.boards.length <= 1}
                  data-locked={project.boards.length <= 1}
                >
                  Delete board
                </button>
              </div>
            )}
          </div>
          <select
            className="hidden h-9 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-sm text-[var(--ink-0)] md:block"
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
          <div className="hidden md:block">
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
              <span className="hidden text-[9px] uppercase tracking-widest text-[var(--ink-1)] sm:block">
                Actions
              </span>
              {actionsOpen && (
                <div className="fixed left-3 right-3 top-28 z-[520] w-auto rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2 text-[11px] text-[var(--ink-0)] shadow-xl shadow-black/30 md:absolute md:left-auto md:right-0 md:top-10 md:z-[320] md:w-44">
                  <div className="space-y-2 px-3 py-2 md:hidden">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                      Board mode
                    </p>
                    <select
                      className="h-8 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                      value={activeBoard?.mode ?? "STATIC"}
                      onChange={(event) =>
                        activeBoard &&
                        setBoardMode(activeBoard.id, event.target.value as BoardMode)
                      }
                    >
                      <option value="STATIC">STATIC</option>
                      <option value="DYNAMIC">DYNAMIC</option>
                    </select>
                    <div className="pt-1">
                      <FormationMenu />
                    </div>
                  </div>
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
                      if (!canUseTemplates) {
                        window.alert("Templates are available for paid users.");
                        return;
                      }
                      if (!project) {
                        return;
                      }
                      const suggested = `${project.name} template`;
                      const name =
                        window.prompt("Template name", suggested) ?? "";
                      if (!name.trim()) {
                        return;
                      }
                      const result = saveProjectTemplate(
                        project,
                        name,
                        authUser?.id ?? null
                      );
                      if (!result.ok) {
                        window.alert(result.error);
                        return;
                      }
                      window.alert(`Template "${result.template.name}" saved.`);
                    }}
                    disabled={!project || !canUseTemplates}
                    data-locked={!project || !canUseTemplates}
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
                      <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />
                    </svg>
                    Save as template
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                    onClick={() => {
                      setActionsOpen(false);
                      setManageTemplatesOpen(true);
                    }}
                    disabled={!canUseTemplates}
                    data-locked={!canUseTemplates}
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
                      <path d="M3 7h18" />
                      <path d="M8 7V5h8v2" />
                      <rect x="4" y="7" width="16" height="13" rx="2" />
                      <path d="M8 12h8M8 16h5" />
                    </svg>
                    Manage templates
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                    onClick={() => {
                      setActionsOpen(false);
                      setPdfOpen(true);
                      setPdfStatus(null);
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
                      <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
                      <path d="M9 13h6M9 17h6M9 9h2" />
                    </svg>
                    Export PDF
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
                        setShareLinkOpen(true);
                        setShareLinkStatus(null);
                        setShareLinkUrl(null);
                        setShareLinkCopied(false);
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
                      <path d="M10 14l4-4" />
                      <path d="M7 17a4 4 0 0 1 0-6l3-3a4 4 0 0 1 6 6l-1 1" />
                    </svg>
                    Share project link
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-[var(--panel-2)]"
                    onClick={() => {
                      setActionsOpen(false);
                      setSquadPresetsOpen(true);
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
                      <path d="M7 20v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2" />
                      <circle cx="12" cy="7" r="3" />
                      <path d="M5 12h.01M19 12h.01" />
                    </svg>
                    Manage teams
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
      {newProjectChoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink-0)] shadow-2xl shadow-black/40">
            <div className="space-y-1">
              <h2 className="display-font text-lg text-[var(--accent-0)]">Create project</h2>
              <p className="text-xs text-[var(--ink-1)]">
                Choose if you want an empty project or a copy of the current one.
              </p>
            </div>
            <div className="mt-4 grid gap-2">
              <button
                className="rounded-2xl border border-[var(--line)] px-4 py-3 text-left text-sm hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                onClick={() => {
                  setNewProjectChoiceOpen(false);
                  createEmptyProjectFromCurrentDefaults();
                }}
              >
                New project
              </button>
              <button
                className="rounded-2xl border border-[var(--line)] px-4 py-3 text-left text-sm hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                onClick={() => {
                  setNewProjectChoiceOpen(false);
                  duplicateCurrentProject();
                }}
              >
                Duplicate current project
              </button>
            </div>
            <button
              className="mt-4 w-full rounded-full border border-[var(--line)] px-4 py-2 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
              onClick={() => setNewProjectChoiceOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {squadPresetsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--panel)] text-[var(--ink-0)] shadow-2xl shadow-black/40">
            <div className="sticky top-0 z-10 border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_94%,transparent)] px-4 py-4 backdrop-blur sm:px-6">
              <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/20 px-4 py-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                    <div className="min-w-0">
                      <h2 className="display-font text-xl text-[var(--accent-0)]">
                        Team manager
                      </h2>
                      <p className="text-xs text-[var(--ink-1)]">
                        Edit the board-local squad here. Database updates only happen when you press Save to Team DB.
                      </p>
                    </div>
                    <div className="inline-flex w-fit rounded-full border border-[var(--line)] bg-[var(--panel)]/60 p-1 text-[11px] uppercase tracking-wide">
                    {[
                      { id: "home", label: "Home" },
                      { id: "away", label: "Away" },
                    ].map((side) => (
                      <button
                        key={side.id}
                        className={`rounded-full px-4 py-2 ${
                          manageSide === side.id
                            ? "bg-[var(--accent-0)] text-black"
                            : "text-[var(--ink-1)]"
                        }`}
                        onClick={() => setManageSide(side.id as "home" | "away")}
                      >
                        Editing {side.label}
                      </button>
                    ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
                    <span className="rounded-full border border-[var(--line)] px-2.5 py-1">
                      Active side: {manageSide}
                    </span>
                    <span className="rounded-full border border-[var(--line)] px-2.5 py-1">
                      Mode: Team manager
                    </span>
                    <span className="rounded-full border border-[var(--line)] px-2.5 py-1">
                      Scope: Project / board
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-stretch gap-2 xl:justify-end">
                    <button
                      className="rounded-full border border-[var(--line)] px-4 py-2 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                      onClick={() => setManagedTeamToSide("home")}
                    >
                      Apply to Home
                    </button>
                    <button
                      className="rounded-full border border-[var(--line)] px-4 py-2 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                      onClick={() => setManagedTeamToSide("away")}
                    >
                      Apply to Away
                    </button>
                    {canUsePresetStorage ? (
                      <button
                        className="flex flex-col items-center gap-1 rounded-xl border border-[var(--line)] p-2 hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                        title="Save to Team DB"
                        aria-label="Save to Team DB"
                        onClick={saveManagePreset}
                      >
                        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h13l3 3v13H4z" />
                          <path d="M8 4v6h8V4" />
                          <path d="M8 20v-6h8v6" />
                        </svg>
                        <span className="text-[9px] uppercase tracking-wide">Save to DB</span>
                      </button>
                    ) : null}
                    <button
                      className="flex flex-col items-center gap-1 rounded-xl border border-[var(--line)] p-2 hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                      onClick={closeSquadPresetsModal}
                      aria-label="Close"
                      title="Close"
                    >
                      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 6l12 12" />
                        <path d="M18 6l-12 12" />
                      </svg>
                      <span className="text-[9px] uppercase tracking-wide">Close</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="max-h-[calc(92vh-128px)] space-y-4 overflow-y-auto px-4 py-4 text-xs text-[var(--ink-1)] sm:px-6" data-scrollable>
                {!canUsePresetStorage ? (
                  <p className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)]/50 px-3 py-2 text-xs text-[var(--ink-1)]">
                    Free/Auth plans can edit teams locally in this project. Team presets are available on paid plans.
                  </p>
                ) : null}
                <div className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/35 px-4 py-2.5 text-[11px] text-[var(--ink-1)]">
                  <span className="shrink-0 rounded-full border border-[var(--line)] px-2 py-0.5 text-[9px] uppercase tracking-widest">
                    Info
                  </span>
                  <p className="min-w-0 truncate">
                    Changes here affect this project/board first. Use <span className="text-[var(--accent-0)]">Save to DB</span> to save the current squad as a reusable team snapshot in the database.
                  </p>
                </div>
                <details className="group rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/25">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <p className="shrink-0 text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                        Team source and loading
                      </p>
                      <p className="truncate text-[11px] text-[var(--ink-1)]">
                        {managedDirectoryTeam
                          ? `${managedDirectoryTeam.clubName} / ${managedDirectoryTeam.teamName}`
                          : "This board is currently using a local project squad."}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
                      {managedDirectoryTeam ? (
                        <>
                          <span className="rounded-full border border-[var(--line)] px-2 py-1">
                            {managedDirectoryTeam.teamType}
                          </span>
                          {managedDirectoryTeam.isCurrentUserTeamAdmin ? (
                            <span className="rounded-full border border-[var(--accent-0)] px-2 py-1 text-[var(--accent-0)]">
                              Team admin
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="rounded-full border border-[var(--accent-1)] px-2 py-1 text-[var(--accent-1)]">
                          Local squad
                        </span>
                      )}
                      <span className="transition-transform group-open:rotate-180">⌄</span>
                    </div>
                  </summary>
                  <div className="grid gap-4 border-t border-[var(--line)] px-4 py-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]/40 p-4">
                      <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                        Current board squad
                      </p>
                      {managedDirectoryTeam ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-sm text-[var(--ink-0)]">
                            {managedDirectoryTeam.clubName} / {managedDirectoryTeam.teamName}
                          </p>
                          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
                            <span className="rounded-full border border-[var(--line)] px-2 py-1">
                              Club role: {managedDirectoryTeam.clubMembershipRole}
                            </span>
                            <span className="rounded-full border border-[var(--line)] px-2 py-1">
                              Team type: {managedDirectoryTeam.teamType}
                            </span>
                            {managedDirectoryTeam.ageGroup ? (
                              <span className="rounded-full border border-[var(--line)] px-2 py-1">
                                {managedDirectoryTeam.ageGroup}
                              </span>
                            ) : null}
                            {managedDirectoryTeam.seasonLabel ? (
                              <span className="rounded-full border border-[var(--line)] px-2 py-1">
                                {managedDirectoryTeam.seasonLabel}
                              </span>
                            ) : null}
                            {managedDirectoryTeam.isCurrentUserClubAdmin ? (
                              <span className="rounded-full border border-[var(--accent-2)] px-2 py-1 text-[var(--accent-2)]">
                                Club admin
                              </span>
                            ) : null}
                            {managedDirectoryTeam.isCurrentUserTeamAdmin ? (
                              <span className="rounded-full border border-[var(--accent-0)] px-2 py-1 text-[var(--accent-0)]">
                                Team admin
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-[var(--ink-1)]">
                          This board is currently using a local project squad. Saving to DB creates or updates a reusable team snapshot, but does not automatically relink this board to that saved team.
                        </p>
                      )}
                    </div>
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]/40 p-4">
                      <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                        Load club team
                      </p>
                      {manageDirectoryTeams.length > 0 ? (
                        <>
                          <select
                            className="mt-2 h-10 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--ink-0)]"
                            value={manageSelectedDirectoryTeamId}
                            onChange={(event) => setManageSelectedDirectoryTeamId(event.target.value)}
                          >
                            {manageDirectoryTeams.map((team) => (
                              <option key={team.teamId} value={team.teamId} className="bg-slate-900">
                                {team.clubName} / {team.teamName}
                              </option>
                            ))}
                          </select>
                          {selectedManageDirectoryTeam ? (
                            <p className="mt-2 text-[11px] text-[var(--ink-1)]">
                              {selectedManageDirectoryTeam.teamType}
                              {selectedManageDirectoryTeam.ageGroup
                                ? ` • ${selectedManageDirectoryTeam.ageGroup}`
                                : ""}
                              {selectedManageDirectoryTeam.seasonLabel
                                ? ` • ${selectedManageDirectoryTeam.seasonLabel}`
                                : ""}
                            </p>
                          ) : null}
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <button
                              className="rounded-full border border-[var(--line)] px-3 py-2 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                              onClick={() =>
                                loadDirectoryTeamIntoSide(manageSelectedDirectoryTeamId, "home")
                              }
                            >
                              Load as Home
                            </button>
                            <button
                              className="rounded-full border border-[var(--line)] px-3 py-2 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                              onClick={() =>
                                loadDirectoryTeamIntoSide(manageSelectedDirectoryTeamId, "away")
                              }
                            >
                              Load as Away
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="mt-2 text-xs text-[var(--ink-1)]">
                          No club teams available yet for this account.
                        </p>
                      )}
                    </div>
                  </div>
                </details>
                <div className="space-y-3 rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/25 p-4">
                  <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                    Team details
                  </p>
                  <div className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)] xl:grid-cols-[180px_minmax(0,1fr)_180px]">
                    <button
                      className="flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/55 text-[11px] text-[var(--ink-1)] lg:h-full"
                      onClick={() => manageLogoRef.current?.click()}
                      title="Change club logo"
                    >
                      {editableSquad?.clubLogo ? (
                        <img
                          src={editableSquad.clubLogo}
                          alt="Club logo"
                          className="h-full w-full object-contain p-2"
                        />
                      ) : (
                        <span>Club Logo</span>
                      )}
                    </button>
                    <div className="flex min-h-[220px] flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/35 p-4">
                      <span className="text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
                        Squad name
                      </span>
                      <input
                        className="h-9 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--ink-0)]"
                        value={editableSquad?.name ?? ""}
                        onChange={(event) => {
                          updateEditableSquad({ name: event.target.value });
                        }}
                        placeholder="Team name"
                      />
                      {editableSquad ? (
                        <>
                          <span className="text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
                            Team colors
                          </span>
                          <div className="grid gap-2 md:grid-cols-2">
                            <label className="space-y-1">
                              <span className="text-[10px] text-[var(--ink-1)]">Shirt Base</span>
                              <ColorPalettePicker
                                value={editableSquad.kit.shirt}
                                onChange={(value) =>
                                  updateEditableSquad({
                                    kit: { ...editableSquad.kit, shirt: value },
                                  })
                                }
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="text-[10px] text-[var(--ink-1)]">Shirt Secondary</span>
                              <ColorPalettePicker
                                value={editableSquad.kit.shirtSecondary ?? editableSquad.kit.shirt}
                                onChange={(value) =>
                                  updateEditableSquad({
                                    kit: {
                                      ...editableSquad.kit,
                                      shirtSecondary: value,
                                    },
                                  })
                                }
                              />
                            </label>
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <label className="space-y-1">
                              <span className="text-[10px] text-[var(--ink-1)]">Shorts</span>
                              <ColorPalettePicker
                                value={editableSquad.kit.shorts}
                                onChange={(value) =>
                                  updateEditableSquad({
                                    kit: { ...editableSquad.kit, shorts: value },
                                  })
                                }
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="text-[10px] text-[var(--ink-1)]">Socks</span>
                              <ColorPalettePicker
                                value={editableSquad.kit.socks}
                                onChange={(value) =>
                                  updateEditableSquad({
                                    kit: { ...editableSquad.kit, socks: value },
                                  })
                                }
                              />
                            </label>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] text-[var(--ink-1)]">Type of jersey</span>
                            {SHIRT_TYPES.map((item) => (
                              <button
                                key={item.id}
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
                                  (editableSquad.kit.jerseyType ?? jerseyType) === item.id
                                    ? "border-[var(--accent-0)]"
                                    : "border-[var(--line)]"
                                }`}
                                onClick={() => {
                                  setJerseyType(item.id);
                                  updateEditableSquad({
                                    kit: { ...editableSquad.kit, jerseyType: item.id },
                                  });
                                }}
                                title={item.label}
                                aria-label={item.label}
                              >
                                {renderShirtIcon(
                                  item.id,
                                  editableSquad.kit.shirt,
                                  editableSquad.kit.shirtSecondary ?? editableSquad.kit.shirt,
                                  "h-5 w-5"
                                )}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                    <div className="hidden min-h-[220px] flex-col items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/35 p-4 xl:flex">
                      {editableSquad ? (
                        <div className="flex flex-col items-center gap-1">
                          {renderShirtIcon(
                            editableSquad.kit.jerseyType ?? jerseyType,
                            editableSquad.kit.shirt,
                            editableSquad.kit.shirtSecondary ?? editableSquad.kit.shirt,
                            "h-24 w-24"
                          )}
                          <svg viewBox="0 0 64 40" className="h-7 w-11" aria-hidden>
                            <path
                              d="M6 6h52l-4 28H36V22H28v12H10z"
                              fill={editableSquad.kit.shorts}
                              stroke="rgba(255,255,255,0.25)"
                              strokeWidth="2"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <svg viewBox="0 0 64 40" className="h-7 w-11" aria-hidden>
                            <path
                              d="M16 5h12v14l8 6v8H16z"
                              fill={editableSquad.kit.socks}
                              stroke="rgba(255,255,255,0.25)"
                              strokeWidth="2"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M36 5h12v14l8 6v8H36z"
                              fill={editableSquad.kit.socks}
                              stroke="rgba(255,255,255,0.25)"
                              strokeWidth="2"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <input
                    ref={manageLogoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === "string") {
                          updateEditableSquad({ clubLogo: reader.result });
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
                <div className="space-y-4 rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/40 p-4">
                  {manageSquad ? (
                    <>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <span className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                          Players
                        </span>
                        <div className="flex items-center gap-2 self-start lg:self-auto">
                          <button
                            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-wide ${
                              manageRosterView === "base"
                                ? "border-[var(--accent-0)] text-[var(--ink-0)]"
                                : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                            }`}
                            onClick={() => setManageRosterView("base")}
                          >
                            Base
                          </button>
                          <button
                            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-wide ${
                              manageRosterView === "board"
                                ? "border-[var(--accent-0)] text-[var(--ink-0)]"
                                : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                            }`}
                            onClick={() => setManageRosterView("board")}
                          >
                            Board
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
                        <span className="rounded-full border border-[var(--line)] px-2 py-1">
                          Linked members: {manageMembershipSummary.linkedMembers}
                        </span>
                        <span className="rounded-full border border-[var(--line)] px-2 py-1">
                          Local only: {manageMembershipSummary.localOnly}
                        </span>
                        <span className="rounded-full border border-[var(--line)] px-2 py-1">
                          Guests: {manageMembershipSummary.guests}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                        <input
                          className="h-8 flex-1 rounded-full border border-[var(--line)] bg-transparent px-3 text-[11px] text-[var(--ink-0)]"
                          placeholder={
                            manageRosterView === "base"
                              ? "Search base squad..."
                              : "Search board roster..."
                          }
                          value={
                            manageRosterView === "base"
                              ? manageBaseSearch
                              : manageBoardSearch
                          }
                          onChange={(event) =>
                            manageRosterView === "base"
                              ? setManageBaseSearch(event.target.value)
                              : setManageBoardSearch(event.target.value)
                          }
                        />
                        {manageRosterView === "board" ? (
                          <select
                            className="h-8 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-[11px]"
                            value={manageBoardFilter}
                            onChange={(event) =>
                              setManageBoardFilter(
                                event.target.value as ManageRosterFilter
                              )
                            }
                          >
                            <option value="all">All</option>
                            <option value="visible">Visible</option>
                            <option value="hidden">Hidden</option>
                            <option value="guests">Guests</option>
                            <option value="regular">Regular</option>
                          </select>
                        ) : null}
                      </div>
                      {manageRosterView === "base" ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                          <button
                            className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                            onClick={() =>
                              addSquadPlayer(manageSquad.id, {
                                id: createId(),
                                name: "New Member",
                                positionLabel: "",
                                guest: false,
                                active: true,
                                number: undefined,
                                vestColor: undefined,
                              })
                            }
                          >
                            Add member
                          </button>
                          <button
                            className="rounded-full border border-[var(--accent-0)] px-3 py-1 text-[11px] uppercase tracking-wide text-[var(--accent-0)] hover:brightness-110"
                            onClick={() =>
                              addSquadPlayer(manageSquad.id, {
                                id: createId(),
                                name: "Guest Member",
                                positionLabel: "",
                                guest: true,
                                active: true,
                                number: undefined,
                                vestColor: undefined,
                              })
                            }
                          >
                            Add guest member
                          </button>
                        </div>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-3">
                          <input
                            className="h-8 rounded-md border border-[var(--line)] bg-transparent px-2 text-[11px] text-[var(--ink-0)]"
                            placeholder="Guest name"
                            value={manageGuestName}
                            onChange={(event) => setManageGuestName(event.target.value)}
                          />
                          <input
                            className="h-8 rounded-md border border-[var(--line)] bg-transparent px-2 text-[11px] text-[var(--ink-0)]"
                            placeholder="Position"
                            value={manageGuestPosition}
                            onChange={(event) => setManageGuestPosition(event.target.value)}
                          />
                          <input
                            className="h-8 rounded-md border border-[var(--line)] bg-transparent px-2 text-[11px] text-[var(--ink-0)]"
                            placeholder="#"
                            value={manageGuestNumber}
                            onChange={(event) => setManageGuestNumber(event.target.value)}
                          />
                        </div>
                      )}
                      {manageRosterView === "board" ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                          <button
                            className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                            onClick={manageAddBoardGuest}
                          >
                            Add board guest
                          </button>
                          <button
                            className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                            onClick={() =>
                              updateManageBoardOverride((current) => ({
                                ...current,
                                hiddenPlayerIds: [],
                              }))
                            }
                          >
                            Show all
                          </button>
                          <button
                            className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                            onClick={() =>
                              updateManageBoardOverride((current) => ({
                                ...current,
                                positionOverrides: {},
                              }))
                            }
                          >
                            Reset positions
                          </button>
                          <button
                            className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                            onClick={() =>
                              updateManageBoardOverride(() => ({
                                hiddenPlayerIds: [],
                                guestPlayers: [],
                                positionOverrides: {},
                              }))
                            }
                          >
                            Reset board roster
                          </button>
                        </div>
                      ) : null}
                      {manageRosterView === "base" ? (
                        <>
                          <div className="space-y-3 lg:hidden">
                            <p className="text-[10px] leading-relaxed text-[var(--ink-1)]">
                              Edit members as cards on mobile. Visibility, captain and substitute remain available in each card.
                            </p>
                            <div className="max-h-[52vh] space-y-3 overflow-auto pr-1" data-scrollable>
                              {filteredManageBasePlayers.map((player) => {
                                const linkedMember =
                                  managedDirectoryMemberMap.get(player.id) ??
                                  (player.sourcePlayerId
                                    ? managedDirectoryMemberMap.get(player.sourcePlayerId)
                                    : undefined);
                                const substitutes = editableSquad?.substituteIds ?? [];
                                const isCaptain = editableSquad?.captainId === player.id;
                                const isSub = substitutes.includes(player.id);
                                return (
                                  <div
                                    key={player.id}
                                    className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/60 p-3"
                                  >
                                    <div className="grid grid-cols-[64px_minmax(0,1fr)_36px] gap-2">
                                      <input
                                        className="h-10 rounded-xl border border-[var(--line)] bg-transparent px-2 text-center text-sm text-[var(--ink-0)]"
                                        value={player.number ?? ""}
                                        onChange={(event) =>
                                          updateSquadPlayer(manageSquad.id, player.id, {
                                            number: event.target.value
                                              ? Number(event.target.value)
                                              : undefined,
                                          })
                                        }
                                      />
                                      <input
                                        className="h-10 rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--ink-0)]"
                                        value={player.name}
                                        onChange={(event) =>
                                          updateSquadPlayer(manageSquad.id, player.id, {
                                            name: event.target.value,
                                          })
                                        }
                                      />
                                      <button
                                        className={`h-10 rounded-xl border text-[11px] font-semibold ${
                                          player.guest
                                            ? "border-[var(--accent-0)] bg-[var(--accent-0)] text-black"
                                            : "border-[var(--line)] text-[var(--ink-1)]"
                                        }`}
                                        onClick={() =>
                                          updateSquadPlayer(manageSquad.id, player.id, {
                                            guest: !player.guest,
                                          })
                                        }
                                      >
                                        G
                                      </button>
                                    </div>
                                    <div className="flex flex-wrap gap-1 text-[9px] uppercase tracking-wide">
                                      {linkedMember ? (
                                        <>
                                          <span className="rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[var(--ink-1)]">
                                            {linkedMember.memberRole}
                                          </span>
                                          {linkedMember.teamPosition ? (
                                            <span className="rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[var(--ink-1)]">
                                              {linkedMember.teamPosition}
                                            </span>
                                          ) : null}
                                          {linkedMember.isTeamAdmin ? (
                                            <span className="rounded-full border border-[var(--accent-2)] px-1.5 py-0.5 text-[var(--accent-2)]">
                                              Team admin
                                            </span>
                                          ) : null}
                                        </>
                                      ) : (
                                        <span className="rounded-full border border-[var(--accent-1)] px-1.5 py-0.5 text-[var(--accent-1)]">
                                          Local only
                                        </span>
                                      )}
                                      {player.guest ? (
                                        <span className="rounded-full border border-[var(--accent-0)] px-1.5 py-0.5 text-[var(--accent-0)]">
                                          Guest
                                        </span>
                                      ) : null}
                                    </div>
                                    <select
                                      className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 text-sm text-[var(--ink-0)]"
                                      value={player.positionLabel}
                                      onChange={(event) =>
                                        updateSquadPlayer(manageSquad.id, player.id, {
                                          positionLabel: event.target.value,
                                        })
                                      }
                                    >
                                      <option value="" className="bg-[var(--panel-2)] text-[var(--ink-0)]" />
                                      {MANAGE_POSITION_OPTIONS.map((pos) => (
                                        <option
                                          key={pos}
                                          value={pos}
                                          className="bg-[var(--panel-2)] text-[var(--ink-0)]"
                                        >
                                          {pos}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
                                      <label className="flex flex-col items-center gap-2 rounded-xl border border-[var(--line)] py-2">
                                        <span>Visible</span>
                                        <input
                                          type="checkbox"
                                          checked={player.active !== false}
                                          onChange={(event) =>
                                            updateSquadPlayer(manageSquad.id, player.id, {
                                              active: event.target.checked,
                                            })
                                          }
                                        />
                                      </label>
                                      <button
                                        className={`rounded-xl border py-2 ${
                                          isCaptain
                                            ? "border-[var(--accent-0)] text-[var(--accent-0)]"
                                            : "border-[var(--line)] text-[var(--ink-1)]"
                                        }`}
                                        onClick={() =>
                                          updateEditableSquad({
                                            captainId: isCaptain ? undefined : player.id,
                                          })
                                        }
                                      >
                                        Captain
                                      </button>
                                      <button
                                        className={`rounded-xl border py-2 ${
                                          isSub
                                            ? "border-[var(--accent-0)] text-[var(--accent-0)]"
                                            : "border-[var(--line)] text-[var(--ink-1)]"
                                        }`}
                                        onClick={() => {
                                          const next = isSub
                                            ? substitutes.filter((id) => id !== player.id)
                                            : [...substitutes, player.id];
                                          updateEditableSquad({ substituteIds: next });
                                        }}
                                      >
                                        Sub
                                      </button>
                                      <button
                                        className="rounded-xl border border-[var(--line)] py-2 text-[var(--ink-1)] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                                        onClick={() => removeSquadPlayer(manageSquad.id, player.id)}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="hidden grid-cols-[28px_minmax(0,1fr)_190px_88px_72px_72px_20px] items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)] lg:grid">
                            <button
                              className="text-left hover:text-[var(--accent-2)]"
                              onClick={() => toggleManagePlayersSort("number")}
                              title="Sort by number"
                            >
                              #{manageSortIndicator("number")}
                            </button>
                            <button
                              className="text-left hover:text-[var(--accent-2)]"
                              onClick={() => toggleManagePlayersSort("name")}
                              title="Sort by name"
                            >
                              Name{manageSortIndicator("name")}
                            </button>
                            <button
                              className="text-left hover:text-[var(--accent-2)]"
                              onClick={() => toggleManagePlayersSort("position")}
                              title="Sort by position"
                            >
                              Position{manageSortIndicator("position")}
                            </button>
                            <span className="text-center">Show in Squad</span>
                            <span className="text-center">Captain</span>
                            <span className="text-center">Substitute</span>
                            <span />
                          </div>
                          <p className="text-[10px] text-[var(--ink-1)]">
                            All players are listed here. Use &quot;Show in Squad&quot; to control who appears in the Squad tab.
                          </p>
                          <div className="flex justify-end">
                            <button
                              className="rounded-full border border-[var(--line)] px-2 py-1 text-[10px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                              onClick={() => toggleManagePlayersSort("default")}
                              title="Reset to default sort"
                            >
                              Default sort{manageSortIndicator("default")}
                            </button>
                          </div>
                          <div className="hidden max-h-56 space-y-2 overflow-auto pr-1 lg:block" data-scrollable>
                            {filteredManageBasePlayers.map((player) => {
                              const linkedMember =
                                managedDirectoryMemberMap.get(player.id) ??
                                (player.sourcePlayerId
                                  ? managedDirectoryMemberMap.get(player.sourcePlayerId)
                                  : undefined);
                              return (
                              <div
                                key={player.id}
                                className="grid grid-cols-[28px_minmax(0,1fr)_190px_88px_72px_72px_20px] items-center gap-2"
                              >
                                <input
                                  className="h-7 rounded-md border border-[var(--line)] bg-transparent px-1 text-center text-[11px] text-[var(--ink-0)]"
                                  value={player.number ?? ""}
                                  onChange={(event) =>
                                    updateSquadPlayer(manageSquad.id, player.id, {
                                      number: event.target.value
                                        ? Number(event.target.value)
                                        : undefined,
                                    })
                                  }
                                />
                                <div className="min-w-0 space-y-1">
                                  <div className="flex items-center gap-1">
                                    <input
                                      className="h-7 w-full rounded-md border border-[var(--line)] bg-transparent px-1 text-[11px] text-[var(--ink-0)]"
                                      value={player.name}
                                      onChange={(event) =>
                                        updateSquadPlayer(manageSquad.id, player.id, {
                                          name: event.target.value,
                                        })
                                      }
                                    />
                                    <button
                                      className={`h-7 min-w-[30px] rounded-md border px-1 text-[10px] font-semibold ${
                                        player.guest
                                          ? "border-[var(--accent-0)] bg-[var(--accent-0)] text-black"
                                          : "border-[var(--line)] text-[var(--ink-1)]"
                                      }`}
                                      onClick={() =>
                                        updateSquadPlayer(manageSquad.id, player.id, {
                                          guest: !player.guest,
                                        })
                                      }
                                      title="Guest player"
                                      aria-label="Guest player"
                                    >
                                      G
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-1 text-[9px] uppercase tracking-wide">
                                    {linkedMember ? (
                                      <>
                                        <span className="rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[var(--ink-1)]">
                                          {linkedMember.memberRole}
                                        </span>
                                        {linkedMember.teamPosition ? (
                                          <span className="rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[var(--ink-1)]">
                                            {linkedMember.teamPosition}
                                          </span>
                                        ) : null}
                                        {linkedMember.isTeamAdmin ? (
                                          <span className="rounded-full border border-[var(--accent-2)] px-1.5 py-0.5 text-[var(--accent-2)]">
                                            Team admin
                                          </span>
                                        ) : null}
                                      </>
                                    ) : (
                                      <span className="rounded-full border border-[var(--accent-1)] px-1.5 py-0.5 text-[var(--accent-1)]">
                                        Local only
                                      </span>
                                    )}
                                    {player.guest ? (
                                      <span className="rounded-full border border-[var(--accent-0)] px-1.5 py-0.5 text-[var(--accent-0)]">
                                        Guest
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                <select
                                  className="h-7 w-full rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-2 text-[10px] text-[var(--ink-0)]"
                                  value={player.positionLabel}
                                  onChange={(event) =>
                                    updateSquadPlayer(manageSquad.id, player.id, {
                                      positionLabel: event.target.value,
                                    })
                                  }
                                >
                                  <option value="" className="bg-[var(--panel-2)] text-[var(--ink-0)]">
                                    
                                  </option>
                                  {MANAGE_POSITION_OPTIONS.map((pos) => (
                                    <option
                                      key={pos}
                                      value={pos}
                                      className="bg-[var(--panel-2)] text-[var(--ink-0)]"
                                    >
                                      {pos}
                                    </option>
                                  ))}
                                </select>
                                <div className="flex h-full w-full items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={player.active !== false}
                                    onChange={(event) =>
                                      updateSquadPlayer(manageSquad.id, player.id, {
                                        active: event.target.checked,
                                      })
                                    }
                                    title="Show in Squad"
                                    aria-label="Show in Squad"
                                  />
                                </div>
                                {(() => {
                                  const substitutes = editableSquad?.substituteIds ?? [];
                                  const isCaptain = editableSquad?.captainId === player.id;
                                  const isSub = substitutes.includes(player.id);
                                  return (
                                    <>
                                    <div className="flex h-full w-full items-center justify-center">
                                      <button
                                        className={`h-4 w-4 rounded-full border ${
                                          isCaptain
                                            ? "border-[var(--accent-0)] bg-[var(--accent-0)]"
                                            : "border-[var(--line)]"
                                        }`}
                                        onClick={() =>
                                          updateEditableSquad({
                                            captainId: isCaptain ? undefined : player.id,
                                          })
                                        }
                                        title="Captain"
                                        aria-label="Captain"
                                      />
                                    </div>
                                    <div className="flex h-full w-full items-center justify-center">
                                      <button
                                        className={`h-4 w-4 rounded-full border ${
                                          isSub
                                            ? "border-[var(--accent-0)] bg-[var(--accent-0)]"
                                            : "border-[var(--line)]"
                                        }`}
                                        onClick={() => {
                                          const next = isSub
                                            ? substitutes.filter((id) => id !== player.id)
                                            : [...substitutes, player.id];
                                          updateEditableSquad({ substituteIds: next });
                                        }}
                                        title="Substitute"
                                        aria-label="Substitute"
                                      />
                                    </div>
                                    </>
                                  );
                                })()}
                                <button
                                  className="rounded-full border border-[var(--line)] p-1 text-[10px] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                                  onClick={() => removeSquadPlayer(manageSquad.id, player.id)}
                                  title="Delete"
                                  aria-label="Delete"
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
                                    <path d="M4 7h16" />
                                    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                    <path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12" />
                                  </svg>
                                </button>
                              </div>
                            );
                            })}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-3 lg:hidden">
                            <div className="max-h-[52vh] space-y-3 overflow-auto pr-1" data-scrollable>
                              {sortedManageBoardPlayers.map((player) => (
                                <div
                                  key={player.id}
                                  className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/60 p-3"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm text-[var(--ink-0)]">
                                        {player.name}
                                      </p>
                                      <div className="mt-1 flex flex-wrap gap-1 text-[9px] uppercase tracking-wide">
                                        {player.guest ? (
                                          <span className="rounded-full border border-[var(--accent-0)] px-1.5 py-0.5 text-[var(--accent-0)]">
                                            Guest
                                          </span>
                                        ) : (
                                          <span className="rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[var(--ink-1)]">
                                            Team member
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      className={`rounded-full border px-2 py-1 text-[10px] ${
                                        player.active === false
                                          ? "border-[var(--line)] text-[var(--ink-1)]"
                                          : "border-[var(--accent-0)] text-[var(--accent-0)]"
                                      }`}
                                      onClick={() =>
                                        manageToggleBoardPlayerVisible(
                                          player.id,
                                          player.active === false
                                        )
                                      }
                                    >
                                      {player.active === false ? "Show" : "Hide"}
                                    </button>
                                  </div>
                                  <input
                                    className="h-10 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--ink-0)]"
                                    value={player.positionLabel}
                                    onChange={(event) =>
                                      manageSetBoardPlayerPosition(player.id, event.target.value)
                                    }
                                  />
                                  {player.guest ? (
                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        className="rounded-xl border border-[var(--accent-2)] px-3 py-2 text-[11px] text-[var(--accent-2)]"
                                        onClick={() => managePromoteBoardGuest(player)}
                                      >
                                        Promote
                                      </button>
                                      <button
                                        className="rounded-xl border border-[var(--accent-1)] px-3 py-2 text-[11px] text-[var(--accent-1)]"
                                        onClick={() => manageRemoveBoardGuest(player.id)}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="hidden grid-cols-[minmax(0,1fr)_130px_170px] items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)] lg:grid">
                            <span>Name</span>
                            <span>Position on board</span>
                            <span>Actions</span>
                          </div>
                          <div className="hidden max-h-56 space-y-2 overflow-auto pr-1 lg:block" data-scrollable>
                            {sortedManageBoardPlayers.map((player) => (
                              <div
                                key={player.id}
                                className="grid grid-cols-[minmax(0,1fr)_130px_170px] items-center gap-2"
                              >
                                <div className="truncate text-[11px] text-[var(--ink-0)]">
                                  {player.name}
                                  {player.guest ? (
                                    <span className="ml-1 rounded-full border border-[var(--accent-0)] px-1 text-[9px] uppercase text-[var(--accent-0)]">
                                      Guest
                                    </span>
                                  ) : null}
                                </div>
                                <input
                                  className="h-7 rounded-md border border-[var(--line)] bg-transparent px-2 text-[11px] text-[var(--ink-0)]"
                                  value={player.positionLabel}
                                  onChange={(event) =>
                                    manageSetBoardPlayerPosition(
                                      player.id,
                                      event.target.value
                                    )
                                  }
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    className={`rounded-full border px-2 py-1 text-[10px] ${
                                      player.active === false
                                        ? "border-[var(--line)] text-[var(--ink-1)]"
                                        : "border-[var(--accent-0)] text-[var(--accent-0)]"
                                    }`}
                                    onClick={() =>
                                      manageToggleBoardPlayerVisible(
                                        player.id,
                                        player.active === false
                                      )
                                    }
                                  >
                                    {player.active === false ? "Show" : "Hide"}
                                  </button>
                                  {player.guest ? (
                                    <>
                                      <button
                                        className="rounded-full border border-[var(--accent-2)] px-2 py-1 text-[10px] text-[var(--accent-2)]"
                                        onClick={() => managePromoteBoardGuest(player)}
                                      >
                                        Promote
                                      </button>
                                      <button
                                        className="rounded-full border border-[var(--accent-1)] px-2 py-1 text-[10px] text-[var(--accent-1)]"
                                        onClick={() => manageRemoveBoardGuest(player.id)}
                                      >
                                        Remove
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-[var(--ink-1)]">
                      No team data available.
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/25 px-4 py-3 text-[11px] text-[var(--ink-1)]">
                  You are editing the <span className="text-[var(--accent-0)]">{manageSide === "home" ? "Home" : "Away"}</span> squad. Use the header actions to apply this edited squad to Home or Away.
                </div>
                {squadPresetsLoading ? (
                  <p className="text-xs text-[var(--ink-1)]">Loading teams...</p>
                ) : null}
                {squadPresetsError ? (
                  <p className="text-xs text-[var(--accent-1)]">
                    {squadPresetsError}
                  </p>
                ) : null}
                {managePresetStatus ? (
                  <p className="text-xs text-[var(--accent-1)]">{managePresetStatus}</p>
                ) : null}
              </div>
          </div>
        </div>
      )}
      {manageTemplatesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink-0)] shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="display-font text-xl text-[var(--accent-0)]">
                  Manage templates
                </h2>
                <p className="text-xs text-[var(--ink-1)]">
                  Templates are available on paid plans.
                </p>
              </div>
              <button
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                onClick={() => {
                  setManageTemplatesOpen(false);
                  setTemplateStatus(null);
                }}
              >
                Close
              </button>
            </div>
            <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto pr-1" data-scrollable>
              {templates.length === 0 ? (
                <p className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-3 text-xs text-[var(--ink-1)]">
                  No templates saved yet.
                </p>
              ) : (
                templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--ink-0)]">
                        {template.name}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                        Updated {new Date(template.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                      onClick={() => {
                        const nextName = window.prompt(
                          "Rename template",
                          template.name
                        );
                        if (!nextName || !nextName.trim()) {
                          return;
                        }
                        const result = renameProjectTemplate(
                          template.id,
                          nextName,
                          authUser?.id ?? null
                        );
                        if (!result.ok) {
                          setTemplateStatus(result.error);
                          return;
                        }
                        setTemplates(result.templates);
                        setTemplateStatus("Template renamed.");
                      }}
                    >
                      Rename
                    </button>
                    <button
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                      onClick={() => {
                        if (!window.confirm(`Delete template "${template.name}"?`)) {
                          return;
                        }
                        const result = deleteProjectTemplate(
                          template.id,
                          authUser?.id ?? null
                        );
                        if (!result.ok) {
                          setTemplateStatus(result.error);
                          return;
                        }
                        setTemplates(result.templates);
                        setTemplateStatus("Template deleted.");
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                onClick={() => refreshTemplates()}
              >
                Refresh
              </button>
              {templateStatus ? (
                <p className="text-xs text-[var(--accent-1)]">{templateStatus}</p>
              ) : null}
            </div>
          </div>
        </div>
      )}
      {shareLinkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink-0)] shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="display-font text-xl text-[var(--accent-0)]">
                  Share project link
                </h2>
                <p className="text-xs text-[var(--ink-1)]">
                  View-only link for this project.
                </p>
              </div>
              <button
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                onClick={() => {
                  setShareLinkOpen(false);
                  setShareLinkCopied(false);
                  setShareLinkQrError(false);
                }}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs text-[var(--ink-1)]">
              <button
                className="h-10 w-full rounded-full bg-[var(--accent-0)] px-5 text-xs font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={async () => {
                  setShareLinkStatus(null);
                  setShareLinkUrl(null);
                  setShareLinkCopied(false);
                  setShareLinkQrError(false);
                  const result = await createProjectShareLink(project);
                  if (!result.ok) {
                    setShareLinkStatus(result.error);
                    return;
                  }
                  const url = `${SHARE_LINK_BASE_URL}/share/${result.token}`;
                  setShareLinkUrl(url);
                  setShareLinkStatus("Link created.");
                }}
                disabled={plan !== "PAID" || !authUser}
              >
                Generate link
              </button>
              {plan !== "PAID" ? (
                <p className="text-xs text-[var(--ink-1)]">
                  Paid plan required to create share links.
                </p>
              ) : null}
              {shareLinkUrl && (
                <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-3">
                  <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                    Share URL
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      className="h-9 flex-1 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                      value={shareLinkUrl}
                      readOnly
                    />
                    <button
                      className="rounded-full border border-[var(--line)] px-3 py-2 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(shareLinkUrl);
                          setShareLinkCopied(true);
                          setShareLinkStatus("Link copied.");
                          window.setTimeout(() => setShareLinkCopied(false), 1600);
                        } catch {
                          setShareLinkCopied(false);
                          setShareLinkStatus(
                            "Could not copy automatically. Copy from the field above."
                          );
                        }
                      }}
                    >
                      {shareLinkCopied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="pt-1">
                    <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                      QR code
                    </p>
                    <div className="mt-2 flex flex-col items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
                      {!shareLinkQrError && shareLinkQrUrl ? (
                        <img
                          src={shareLinkQrUrl}
                          alt="QR code for project share link"
                          className="h-44 w-44 rounded-lg border border-[var(--line)] bg-white p-1"
                          loading="lazy"
                          onError={() => setShareLinkQrError(true)}
                        />
                      ) : (
                        <p className="text-center text-xs text-[var(--ink-1)]">
                          Could not load QR code right now.
                        </p>
                      )}
                      {shareLinkQrUrl ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                            onClick={async () => {
                              try {
                                const response = await fetch(shareLinkQrUrl);
                                if (!response.ok) {
                                  throw new Error("Download failed");
                                }
                                const blob = await response.blob();
                                const downloadUrl = URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.href = downloadUrl;
                                link.download = shareLinkQrDownloadName;
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                URL.revokeObjectURL(downloadUrl);
                                setShareLinkStatus("QR code downloaded.");
                              } catch {
                                setShareLinkStatus(
                                  "Could not download QR automatically. Open QR image and save manually."
                                );
                              }
                            }}
                          >
                            Download QR
                          </button>
                          <a
                            className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                            href={shareLinkQrUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open QR image
                          </a>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
              {shareLinkStatus ? (
                <p className="text-xs text-[var(--accent-1)]">
                  {shareLinkStatus}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}
      {pdfOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink-0)] shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="display-font text-xl text-[var(--accent-0)]">
                  Export PDF
                </h2>
                <p className="text-xs text-[var(--ink-1)]">
                  Export board screenshots with session and board notes.
                </p>
              </div>
              <button
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                onClick={() => setPdfOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`rounded-2xl border px-3 py-2 text-xs ${
                    pdfScope === "board"
                      ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                      : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                  }`}
                  onClick={() => {
                    setPdfScope("board");
                    setPdfSelectedBoardIds(activeBoard ? [activeBoard.id] : []);
                  }}
                >
                  Current board
                </button>
                <button
                  className={`rounded-2xl border px-3 py-2 text-xs ${
                    pdfScope === "project"
                      ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                      : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                  }`}
                  onClick={() => {
                    setPdfScope("project");
                    setPdfSelectedBoardIds(project.boards.map((board) => board.id));
                  }}
                >
                  Whole project
                </button>
              </div>
              <div className="max-h-48 space-y-2 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-3">
                {project.boards.map((board) => {
                  const isChecked = pdfSelectedBoardIds.includes(board.id);
                  const isLockedToActive =
                    pdfScope === "board" && activeBoard?.id !== board.id;
                  const selectedIndex = pdfSelectedBoardIds.indexOf(board.id);
                  return (
                    <label
                      key={board.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs"
                    >
                      <span className="flex min-w-0 items-center gap-2 truncate">
                        {selectedIndex >= 0 ? (
                          <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--ink-1)]">
                            {selectedIndex + 1}
                          </span>
                        ) : null}
                        <span className="truncate">{board.name}</span>
                      </span>
                      <div className="flex items-center gap-1">
                        {pdfScope === "project" && isChecked ? (
                          <>
                            <button
                              type="button"
                              className="rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[10px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                              title="Move up"
                              onClick={(event) => {
                                event.preventDefault();
                                moveSelectedBoard(board.id, -1);
                              }}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[10px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                              title="Move down"
                              onClick={(event) => {
                                event.preventDefault();
                                moveSelectedBoard(board.id, 1);
                              }}
                            >
                              ↓
                            </button>
                          </>
                        ) : null}
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isLockedToActive}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setPdfSelectedBoardIds((prev) => {
                            if (checked) {
                              return prev.includes(board.id)
                                ? prev
                                : [...prev, board.id];
                            }
                            return prev.filter((id) => id !== board.id);
                          });
                        }}
                      />
                      </div>
                    </label>
                  );
                })}
              </div>
              <button
                className="h-10 w-full rounded-full bg-[var(--accent-0)] px-5 text-xs font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={onExportPdf}
                disabled={pdfBusy}
              >
                {pdfBusy ? "Preparing..." : "Open print / PDF"}
              </button>
              {pdfStatus ? (
                <p className="text-xs text-[var(--accent-1)]">{pdfStatus}</p>
              ) : null}
            </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink-0)] shadow-2xl shadow-black/40">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_94%,transparent)] px-5 py-4 backdrop-blur sm:px-6">
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
            <div
              className="grid gap-4 overflow-y-auto px-5 py-4 pr-3 text-xs text-[var(--ink-1)] sm:px-6 lg:grid-cols-2"
              data-scrollable
            >
              <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/25 p-4">
                <p className="mb-2 text-[11px] uppercase">Project mode</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "match", label: "Match" },
                    { value: "training", label: "Training" },
                    { value: "education", label: "Education" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      className={`rounded-2xl border px-3 py-2 text-xs ${
                        (project.settings?.mode ?? "match") === option.value
                          ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                          : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                      }`}
                      onClick={() =>
                        updateProjectMeta({
                          settings: {
                            ...project.settings,
                            mode: option.value as ProjectMode,
                          },
                        })
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/25 p-4">
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
              {activeBoard.pitchView === "FULL" && (
                <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/25 p-4">
                  <p className="mb-2 text-[11px] uppercase">Pitch rotation</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 180].map((value) => (
                      <button
                        key={value}
                        className={`rounded-2xl border px-3 py-2 text-xs ${
                          (activeBoard.pitchRotation ?? 0) === value
                            ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                            : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                        }`}
                        onClick={() =>
                          updateBoard(activeBoard.id, {
                            pitchRotation: value as 0 | 180,
                          })
                        }
                      >
                        {value === 0 ? "Standard" : "Flipped"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/25 p-4">
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
              <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/25 p-4">
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
              <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/25 p-4">
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
                      placeholder="Teamzone Webtools - webtools.teamzoneapp.se"
                      readOnly={plan !== "PAID"}
                    />
                  </label>
                </div>
              </div>
              <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/25 p-4">
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
              </div>
              <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/25 p-4">
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
              <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/25 p-4 lg:col-span-2">
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
        </div>
      )}
    </div>
  );
}
