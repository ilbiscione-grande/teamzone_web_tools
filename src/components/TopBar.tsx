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
import MatchGraphicsModal from "@/components/MatchGraphicsModal";
import ManageTeamsModal from "@/components/ManageTeamsModal";
import ManageTeamsBaseRoster from "@/components/manage-teams/ManageTeamsBaseRoster";
import ManageTeamsBoardRoster from "@/components/manage-teams/ManageTeamsBoardRoster";
import ManageTeamsRoster from "@/components/manage-teams/ManageTeamsRoster";
import ManageTeamsSourcePanel from "@/components/manage-teams/ManageTeamsSourcePanel";
import ManageTeamsTeamSetup from "@/components/manage-teams/ManageTeamsTeamSetup";
import {
  buildManageTeamRosterRows,
  findManageTeamRosterRow,
} from "@/components/manage-teams/manageTeamRosterModel";
import { getActiveBoard, getBoardOverridePlayerKey, getBoardSquads } from "@/utils/board";
import { createId } from "@/utils/id";
import {
  updateTeamWithSquad,
} from "@/persistence/teamSquads";
import {
  fetchClubTeamDirectory,
  updateClubDirectoryDetails,
  updateTeamDirectoryDetails,
} from "@/persistence/teamDirectory";
import { saveDefaultTeamSquad } from "@/persistence/defaultTeamSquads";
import { saveDefaultLinkedTeam } from "@/persistence/defaultLinkedTeams";
import {
  loadActiveTeamSelection,
  saveActiveTeamSelection,
  type ActiveTeamSelection,
} from "@/persistence/activeTeamSelection";
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

type ManagePlayersSortKey = "default" | "name" | "position" | "number";
type ManageRosterFilter = "all" | "visible" | "hidden" | "guests" | "regular";
type ManageRosterView = "base" | "board";
type ManageTeamsTopPanel = "none" | "source" | "appearance";
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
  const addSquadWithData = useProjectStore((state) => state.addSquadWithData);
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
  const [manageSelectedDirectoryClubId, setManageSelectedDirectoryClubId] = useState("");
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
  const [manageClubNameDraft, setManageClubNameDraft] = useState("");
  const [manageTeamNameDraft, setManageTeamNameDraft] = useState("");
  const [manageTeamTypeDraft, setManageTeamTypeDraft] = useState("other");
  const [manageAgeGroupDraft, setManageAgeGroupDraft] = useState("");
  const [manageSeasonLabelDraft, setManageSeasonLabelDraft] = useState("");
  const [manageDetailsSaving, setManageDetailsSaving] = useState(false);
  const [manageTopPanel, setManageTopPanel] =
    useState<ManageTeamsTopPanel>("none");
  const [jerseyType, setJerseyType] = useState<JerseyType>("solid");
  const [shareLinkOpen, setShareLinkOpen] = useState(false);
  const [shareLinkStatus, setShareLinkStatus] = useState<string | null>(null);
  const [shareLinkUrl, setShareLinkUrl] = useState<string | null>(null);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [shareLinkQrError, setShareLinkQrError] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [matchGraphicsOpen, setMatchGraphicsOpen] = useState(false);
  const [activeTeamSelection, setActiveTeamSelection] =
    useState<ActiveTeamSelection | null>(null);
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
  const refreshManageTeamDirectory = async () => {
    if (!authUser || plan !== "PAID") {
      setSquadPresets([]);
      setSquadPresetDirectory([]);
      setSquadPresetsError(null);
      return;
    }
    setSquadPresetsLoading(true);
    setSquadPresetsError(null);
    const result = await fetchClubTeamDirectory();
    if (!result.ok) {
      setSquadPresetsError(result.error);
      setSquadPresets([]);
      setSquadPresetDirectory([]);
      setSquadPresetsLoading(false);
      return;
    }
    setSquadPresetDirectory(result.clubs);
    setSquadPresets(flattenDirectoryTeamsToPresets(result.clubs));
    setSquadPresetsLoading(false);
  };
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
      homeTeamId: project.teamContext?.homeTeamId,
      awayTeamId: project.teamContext?.awayTeamId,
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
    setActiveTeamSelection(loadActiveTeamSelection(authUser?.id ?? null));
  }, [authUser?.id, squadPresetsOpen]);

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
      setManageSelectedDirectoryClubId("");
      return;
    }
    void refreshManageTeamDirectory();
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
  const currentHomeLinkedTeamId = project?.teamContext?.homeTeamId;
  const currentAwayLinkedTeamId = project?.teamContext?.awayTeamId;
  const manageLinkedTeamId =
    manageSide === "home" ? currentHomeLinkedTeamId : currentAwayLinkedTeamId;
  const manageBaseSquad =
    project?.squads.find((item) => item.id === manageSquadId) ?? null;
  const currentHomeManagedSquad =
    project?.squads.find((item) => item.id === activeBoard?.homeSquadId) ?? null;
  const currentAwayManagedSquad =
    project?.squads.find((item) => item.id === activeBoard?.awaySquadId) ?? null;
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
  const manageDirectoryClubs = useMemo(
    () => squadPresetDirectory.filter((club) => club.teams.length > 0),
    [squadPresetDirectory]
  );
  const currentHomeLinkedTeam =
    manageDirectoryTeams.find((team) => team.teamId === currentHomeLinkedTeamId) ?? null;
  const currentAwayLinkedTeam =
    manageDirectoryTeams.find((team) => team.teamId === currentAwayLinkedTeamId) ?? null;
  const managedDirectoryTeam =
    manageDirectoryTeams.find((team) => team.teamId === manageLinkedTeamId) ??
    manageDirectoryTeams.find((team) => team.teamId === manageSquad?.id) ??
    null;
  const selectedManageDirectoryTeam =
    manageDirectoryTeams.find((team) => team.teamId === manageSelectedDirectoryTeamId) ??
    null;
  const selectedManageDirectoryClub =
    manageDirectoryClubs.find((club) => club.id === manageSelectedDirectoryClubId) ?? null;
  const selectedManageDirectoryClubTeams = selectedManageDirectoryClub?.teams ?? [];
  const currentActiveDirectoryTeam =
    activeTeamSelection?.teamId
      ? manageDirectoryTeams.find((team) => team.teamId === activeTeamSelection.teamId) ?? null
      : null;
  const currentActiveClubId =
    currentActiveDirectoryTeam?.clubId ??
    activeTeamSelection?.clubId ??
    manageDirectoryClubs[0]?.id ??
    "";
  const currentActiveClubTeams =
    manageDirectoryClubs.find((club) => club.id === currentActiveClubId)?.teams ?? [];
  const setCurrentActiveTeam = (teamId: string, clubName: string, teamName: string) => {
    const nextTeam =
      manageDirectoryTeams.find((team) => team.teamId === teamId) ?? null;
    const nextSelection: ActiveTeamSelection = {
      clubId: nextTeam?.clubId ?? null,
      teamId,
      clubName,
      teamName,
      updatedAt: new Date().toISOString(),
    };
    setActiveTeamSelection(nextSelection);
    saveActiveTeamSelection(
      {
        clubId: nextSelection.clubId,
        teamId,
        clubName,
        teamName,
      },
      authUser?.id ?? null
    );
    setManagePresetStatus(`Current team set to ${clubName} / ${teamName}.`);
  };
  const setCurrentActiveTeamById = (teamId: string) => {
    const nextTeam = manageDirectoryTeams.find((team) => team.teamId === teamId) ?? null;
    if (!nextTeam) {
      return;
    }
    setCurrentActiveTeam(nextTeam.teamId, nextTeam.clubName, nextTeam.teamName);
  };
  const setCurrentActiveClub = (clubId: string) => {
    const nextClub = manageDirectoryClubs.find((club) => club.id === clubId) ?? null;
    const nextTeam = nextClub?.teams[0] ?? null;
    if (!nextClub || !nextTeam) {
      return;
    }
    setCurrentActiveTeam(nextTeam.id, nextClub.name, nextTeam.name);
  };
  const managedDirectoryMemberMap = useMemo(() => {
    const entries = new Map<string, ManageDirectoryMemberOption>();
    managedDirectoryTeam?.members.forEach((member) => {
      entries.set(member.id, member);
    });
    return entries;
  }, [managedDirectoryTeam]);
  const managedDirectoryMemberOrderMap = useMemo(() => {
    const entries = new Map<string, number>();
    managedDirectoryTeam?.members.forEach((member, index) => {
      entries.set(member.id, member.sortOrder ?? index);
    });
    return entries;
  }, [managedDirectoryTeam]);
  const manageBaseRosterRows = useMemo(
    () =>
      buildManageTeamRosterRows({
        snapshotSquad: manageSquad,
        linkedMembers: managedDirectoryTeam?.members ?? [],
        linkedTeamId: managedDirectoryTeam?.teamId,
        linkedTeamName: managedDirectoryTeam?.teamName,
      }),
    [manageSquad, managedDirectoryTeam]
  );
  const manageMembershipSummary = useMemo(() => {
    let linkedMembers = 0;
    let localOnly = 0;
    let guests = 0;
    manageBaseRosterRows.forEach((row) => {
      const player = row.player;
      if (player.guest) {
        guests += 1;
      }
      if (row.source === "linked") {
        linkedMembers += 1;
      } else {
        localOnly += 1;
      }
    });
    return { linkedMembers, localOnly, guests };
  }, [manageBaseRosterRows]);
  useEffect(() => {
    setManageClubNameDraft(managedDirectoryTeam?.clubName ?? "");
    setManageTeamNameDraft(managedDirectoryTeam?.teamName ?? manageSquad?.name ?? "");
    setManageTeamTypeDraft(managedDirectoryTeam?.teamType ?? "other");
    setManageAgeGroupDraft(managedDirectoryTeam?.ageGroup ?? "");
    setManageSeasonLabelDraft(managedDirectoryTeam?.seasonLabel ?? "");
  }, [managedDirectoryTeam, manageSquad?.name]);
  useEffect(() => {
    if (!squadPresetsOpen) {
      return;
    }
    const nextClubId =
      managedDirectoryTeam?.clubId ||
      selectedManageDirectoryTeam?.clubId ||
      manageDirectoryClubs[0]?.id ||
      "";
    setManageSelectedDirectoryClubId((current) => current || nextClubId);
    if (managedDirectoryTeam) {
      setManageSelectedDirectoryTeamId(managedDirectoryTeam.teamId);
      return;
    }
    setManageSelectedDirectoryTeamId(
      (current) => current || manageDirectoryTeams[0]?.teamId || ""
    );
  }, [
    manageDirectoryClubs,
    manageDirectoryTeams,
    managedDirectoryTeam,
    selectedManageDirectoryTeam?.clubId,
    squadPresetsOpen,
  ]);
  useEffect(() => {
    if (!squadPresetsOpen || !manageSelectedDirectoryClubId) {
      return;
    }
    const nextClub = manageDirectoryClubs.find((club) => club.id === manageSelectedDirectoryClubId);
    const nextTeams = nextClub?.teams ?? [];
    if (nextTeams.length === 0) {
      return;
    }
    setManageSelectedDirectoryTeamId((current) =>
      nextTeams.some((team) => team.id === current) ? current : nextTeams[0]!.id
    );
  }, [manageDirectoryClubs, manageSelectedDirectoryClubId, squadPresetsOpen]);
  const sortedManagePlayers = useMemo(() => {
    if (!manageSquad) {
      return [];
    }
    const substitutes = new Set(editableSquad?.substituteIds ?? []);
    const withIndex = manageBaseRosterRows.map((row, index) => ({
      row,
      player: row.player,
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
      const aMemberOrder =
        (a.player.teamMemberId
          ? managedDirectoryMemberOrderMap.get(a.player.teamMemberId)
          : undefined) ?? managedDirectoryMemberOrderMap.get(a.player.id);
      const bMemberOrder =
        (b.player.teamMemberId
          ? managedDirectoryMemberOrderMap.get(b.player.teamMemberId)
          : undefined) ?? managedDirectoryMemberOrderMap.get(b.player.id);
      if (aMemberOrder != null || bMemberOrder != null) {
        if (aMemberOrder == null) {
          return 1;
        }
        if (bMemberOrder == null) {
          return -1;
        }
        if (aMemberOrder !== bMemberOrder) {
          return aMemberOrder - bMemberOrder;
        }
      }
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
  }, [
    editableSquad?.substituteIds,
    managePlayersSortDir,
    managePlayersSortKey,
    manageBaseRosterRows,
    manageSquad,
    managedDirectoryMemberOrderMap,
  ]);
  const updateEditableSquad = (
    payload: Partial<SquadPreset["squad"]>
  ) => {
    if (manageSquad) {
      updateSquad(manageSquad.id, payload);
    }
  };
  const ensureManageBasePlayer = (playerId: string) => {
    if (!manageSquad) {
      return null;
    }
    const row = findManageTeamRosterRow(manageBaseRosterRows, playerId);
    const existing =
      row?.localSnapshotId
        ? manageSquad.players.find((player) => player.id === row.localSnapshotId)
        : manageSquad.players.find((player) => player.id === playerId) ??
          manageSquad.players.find((player) => player.teamMemberId === playerId) ??
          manageSquad.players.find((player) => player.sourcePlayerId === playerId);
    if (existing && row?.hasLocalSnapshot !== false) {
      return existing;
    }
    const member = row?.linkedMember ?? managedDirectoryMemberMap.get(playerId);
    if (!member || !managedDirectoryTeam) {
      return null;
    }
    const nextPlayer: SquadPlayer = {
      id: createId(),
      teamMemberId: playerId,
      sourcePlayerId: playerId,
      sourceTeamId: managedDirectoryTeam.teamId,
      sourceTeamName: managedDirectoryTeam.teamName,
      name: member.displayName,
      positionLabel: member.teamPosition?.trim() || "POS",
      guest: member.isGuest,
      active: member.isActive,
      number: member.shirtNumber ?? undefined,
      photoUrl: member.photoUrl ?? undefined,
    };
    addSquadPlayer(manageSquad.id, nextPlayer);
    return nextPlayer;
  };
  const updateManageBasePlayer = (
    squadId: string,
    playerId: string,
    payload: Partial<SquadPlayer>
  ) => {
    if (!manageSquad || squadId !== manageSquad.id) {
      return;
    }
    const player = ensureManageBasePlayer(playerId);
    if (!player) {
      return;
    }
    updateSquadPlayer(squadId, player.id, payload);
  };
  const removeManageBasePlayer = (squadId: string, playerId: string) => {
    if (!manageSquad || squadId !== manageSquad.id) {
      return;
    }
    const row = findManageTeamRosterRow(manageBaseRosterRows, playerId);
    if (!row?.localSnapshotId) {
      return;
    }
    removeSquadPlayer(squadId, row.localSnapshotId);
  };
  const isManageBaseCaptain = (playerId: string) => {
    if (!editableSquad?.captainId) {
      return false;
    }
    const row = findManageTeamRosterRow(manageBaseRosterRows, playerId);
    if (!row) {
      return false;
    }
    return (
      manageSquad?.players.some(
        (player) =>
          player.id === editableSquad.captainId &&
          (player.id === row.localSnapshotId ||
            player.id === row.identity ||
            player.teamMemberId === row.identity ||
            player.sourcePlayerId === row.identity)
      ) ?? false
    );
  };
  const isManageBaseSubstitute = (playerId: string) => {
    const substituteIds = editableSquad?.substituteIds ?? [];
    const row = findManageTeamRosterRow(manageBaseRosterRows, playerId);
    if (!row) {
      return false;
    }
    return (
      manageSquad?.players.some(
        (player) =>
          substituteIds.includes(player.id) &&
          (player.id === row.localSnapshotId ||
            player.id === row.identity ||
            player.teamMemberId === row.identity ||
            player.sourcePlayerId === row.identity)
      ) ?? false
    );
  };
  const toggleManageBaseCaptain = (playerId: string) => {
    if (!manageSquad) {
      return;
    }
    if (isManageBaseCaptain(playerId)) {
      updateEditableSquad({ captainId: undefined });
      return;
    }
    const player = ensureManageBasePlayer(playerId);
    if (!player) {
      return;
    }
    updateEditableSquad({ captainId: player.id });
  };
  const toggleManageBaseSubstitute = (playerId: string) => {
    if (!manageSquad) {
      return;
    }
    const player = ensureManageBasePlayer(playerId);
    if (!player) {
      return;
    }
    const current = editableSquad?.substituteIds ?? [];
    const next = current.includes(player.id)
      ? current.filter((id) => id !== player.id)
      : [...current, player.id];
    updateEditableSquad({ substituteIds: next });
  };
  const setProjectTeamContextForSide = (
    side: "home" | "away",
    teamId?: string
  ) => {
    if (!project) {
      return;
    }
    const nextTeamContext = {
      homeTeamId:
        side === "home" ? teamId : project.teamContext?.homeTeamId,
      awayTeamId:
        side === "away" ? teamId : project.teamContext?.awayTeamId,
    };
    updateProjectMeta({
      teamContext:
        nextTeamContext.homeTeamId || nextTeamContext.awayTeamId
          ? nextTeamContext
          : undefined,
    });
  };
  const updateManageBoardOverride = (
    updater: (current: {
      hiddenPlayerIds?: string[];
      guestPlayers?: SquadPlayer[];
      numberOverrides?: Record<string, number | undefined>;
      positionOverrides?: Record<string, string>;
    }) => {
      hiddenPlayerIds?: string[];
      guestPlayers?: SquadPlayer[];
      numberOverrides?: Record<string, number | undefined>;
      positionOverrides?: Record<string, string>;
    }
  ) => {
    if (!activeBoard || !manageBaseSquad) {
      return;
    }
    const current = activeBoard.squadOverrides?.[manageBaseSquad.id] ?? {
      hiddenPlayerIds: [],
      guestPlayers: [],
      numberOverrides: {},
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
    const sortedRows = sortedManagePlayers
      .map((player) =>
        findManageTeamRosterRow(
          manageBaseRosterRows,
          player.teamMemberId ?? player.sourcePlayerId ?? player.id
        )
      )
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    const needle = manageBaseSearch.trim().toLowerCase();
    if (!needle) {
      return sortedRows;
    }
    return sortedRows.filter((row) => {
      const player = row.player;
      const haystack =
        `${player.name} ${player.positionLabel} ${player.number ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [manageBaseRosterRows, manageBaseSearch, sortedManagePlayers]);
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
    setManageTopPanel("none");
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
    const squadForSave = {
      ...editableSquad,
      players: manageBaseRosterRows.map((row) => row.player),
    };
    if (!manageLinkedTeamId) {
      setManagePresetStatus(
        "This side is not linked to a team yet. Use Switch team first."
      );
      return;
    }
    const existingTeam =
      squadPresets.find((item) => item.id === manageLinkedTeamId) ??
      (managedDirectoryTeam
        ? {
            id: managedDirectoryTeam.teamId,
            userId: "",
            teamId: managedDirectoryTeam.teamId,
            teamName: managedDirectoryTeam.teamName,
            name: managedDirectoryTeam.teamName,
            squad: squadForSave,
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
          }
        : null);
    if (existingTeam) {
      const result = await updateTeamWithSquad({
        id: existingTeam.id,
        name: nextName,
        squad: squadForSave,
      });
      if (!result.ok) {
        setManagePresetStatus(result.error);
        return;
      }
      setSquadPresets((prev) =>
        prev.map((item) => (item.id === result.team.id ? result.team : item))
      );
      setProjectTeamContextForSide(manageSide, result.team.id);
      setManageSelectedDirectoryTeamId(result.team.id);
      saveDefaultLinkedTeam(manageSide, result.team.id, authUser?.id ?? null);
      saveDefaultTeamSquad(manageSide, result.team.squad, authUser?.id ?? null);
      setManagePresetStatus(
        "Linked team updated for this side."
      );
      return;
    }
    setManagePresetStatus("Linked team could not be found in your team directory.");
  };

  const cloneSquadIntoTargetSide = (
    sourceSquad: SquadPreset["squad"],
    side: "home" | "away"
  ) => {
    if (!activeBoard) {
      setManagePresetStatus("No active board available.");
      return null;
    }
    const targetSquadId =
      side === "home" ? activeBoard.homeSquadId : activeBoard.awaySquadId;
    const targetSquad =
      project?.squads.find((item) => item.id === targetSquadId) ?? null;

    const playerIdMap = new Map<string, string>();
    const nextPlayers = sourceSquad.players.map((player, index) => {
      const targetPlayerId = targetSquad?.players[index]?.id ?? createId();
      playerIdMap.set(player.id, targetPlayerId);
      return {
        ...player,
        id: targetPlayerId,
      };
    });

    const nextCaptainId = sourceSquad.captainId
      ? playerIdMap.get(sourceSquad.captainId)
      : undefined;
    const nextSubstituteIds = (sourceSquad.substituteIds ?? [])
      .map((id) => playerIdMap.get(id))
      .filter((id): id is string => Boolean(id));

    const nextPayload = {
      name: sourceSquad.name,
      clubLogo: sourceSquad.clubLogo,
      kit: { ...sourceSquad.kit },
      captainId: nextCaptainId,
      substituteIds: nextSubstituteIds,
      players: nextPlayers,
    };

    if (targetSquad) {
      updateSquad(targetSquad.id, nextPayload);
      return targetSquad.id;
    }

    const nextSquadId = createId();
    addSquadWithData({
      id: nextSquadId,
      ...nextPayload,
    });
    updateBoard(activeBoard.id, {
      homeSquadId: side === "home" ? nextSquadId : activeBoard.homeSquadId,
      awaySquadId: side === "away" ? nextSquadId : activeBoard.awaySquadId,
    });
    return nextSquadId;
  };

  const saveManageDirectoryDetails = async () => {
    if (!managedDirectoryTeam) {
      setManagePresetStatus("This side is not linked to a team yet.");
      return;
    }
    setManageDetailsSaving(true);
    setManagePresetStatus(null);
    try {
      if (managedDirectoryTeam.isCurrentUserClubAdmin) {
        const clubResult = await updateClubDirectoryDetails({
          id: managedDirectoryTeam.clubId,
          name: manageClubNameDraft,
        });
        if (!clubResult.ok) {
          setManagePresetStatus(clubResult.error);
          return;
        }
      }
      if (managedDirectoryTeam.isCurrentUserTeamAdmin) {
        const teamResult = await updateTeamDirectoryDetails({
          id: managedDirectoryTeam.teamId,
          name: manageTeamNameDraft,
          teamType: manageTeamTypeDraft,
          ageGroup: manageAgeGroupDraft,
          seasonLabel: manageSeasonLabelDraft,
        });
        if (!teamResult.ok) {
          setManagePresetStatus(teamResult.error);
          return;
        }
      }
      await refreshManageTeamDirectory();
      setManagePresetStatus("Linked club/team details updated.");
    } finally {
      setManageDetailsSaving(false);
    }
  };

  const loadDirectoryTeamIntoSide = (teamId: string, side: "home" | "away") => {
    const selectedTeam =
      manageDirectoryTeams.find((team) => team.teamId === teamId) ?? null;
    if (!selectedTeam) {
      setManagePresetStatus("Select a team to load.");
      return;
    }
    const nextSquadId = cloneSquadIntoTargetSide(selectedTeam.squad, side);
    if (!nextSquadId) {
      return;
    }
    setProjectTeamContextForSide(side, teamId);
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
    if (side === manageSide) {
      setManagePresetStatus(
        side === "home"
          ? "You are already editing the Home team."
          : "You are already editing the Away team."
      );
      return;
    }
    const nextSquadId = cloneSquadIntoTargetSide(manageSquad, side);
    if (!nextSquadId) {
      return;
    }
    setProjectTeamContextForSide(side, manageLinkedTeamId);
    setManageSide(side);
    setManagePresetStatus(
      side === "home"
        ? "Current side copied to Home team."
        : "Current side copied to Away team."
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
    const overridePlayer =
      manageBaseSquad?.players.find((item) => item.id === playerId) ??
      manageBoardSquad?.players.find((item) => item.id === playerId);
    const overrideKey = overridePlayer
      ? getBoardOverridePlayerKey(overridePlayer)
      : playerId;
    updateManageBoardOverride((current) => {
      const hidden = new Set(current.hiddenPlayerIds ?? []);
      if (nextVisible) {
        hidden.delete(playerId);
        hidden.delete(overrideKey);
      } else {
        hidden.add(overrideKey);
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
      const basePlayer = manageBaseSquad?.players.find((item) => item.id === playerId);
      const overrideKey = basePlayer ? getBoardOverridePlayerKey(basePlayer) : playerId;
      const basePosition = basePlayer?.positionLabel ?? "";
      if (!trimmed || trimmed === basePosition) {
        delete nextOverrides[playerId];
        delete nextOverrides[overrideKey];
      } else {
        nextOverrides[overrideKey] = trimmed;
      }
      return { ...current, positionOverrides: nextOverrides };
    });
  };
  const manageSetBoardPlayerNumber = (playerId: string, value: string) => {
    const parsed = Number(value);
    updateManageBoardOverride((current) => {
      const guests = [...(current.guestPlayers ?? [])];
      const guestIndex = guests.findIndex((item) => item.id === playerId);
      if (guestIndex >= 0) {
        guests[guestIndex] = {
          ...guests[guestIndex],
          number: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
        };
        return { ...current, guestPlayers: guests };
      }
      const nextOverrides = { ...(current.numberOverrides ?? {}) };
      const basePlayer = manageBaseSquad?.players.find((item) => item.id === playerId);
      const overrideKey = basePlayer ? getBoardOverridePlayerKey(basePlayer) : playerId;
      const baseNumber = basePlayer?.number;
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed === baseNumber) {
        delete nextOverrides[playerId];
        delete nextOverrides[overrideKey];
      } else {
        nextOverrides[overrideKey] = parsed;
      }
      return { ...current, numberOverrides: nextOverrides };
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
      const nextNumberOverrides = { ...(current.numberOverrides ?? {}) };
      const nextPositionOverrides = { ...(current.positionOverrides ?? {}) };
      delete nextNumberOverrides[playerId];
      delete nextPositionOverrides[playerId];
      return {
        ...current,
        guestPlayers: nextGuests,
        hiddenPlayerIds: nextHidden,
        numberOverrides: nextNumberOverrides,
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
                      setMatchGraphicsOpen(true);
                    }}
                    disabled={!activeBoard || !can(plan, "squad.export")}
                    data-locked={!activeBoard || !can(plan, "squad.export")}
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
                      <rect x="3" y="4" width="18" height="14" rx="2" />
                      <path d="M7 8h7M7 12h5M16 15l2-2 2 2" />
                    </svg>
                    Match graphics
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
        <ManageTeamsModal
          open={squadPresetsOpen}
          manageSide={manageSide}
          currentHomeTeamName={currentHomeLinkedTeam?.teamName ?? currentHomeManagedSquad?.name}
          currentAwayTeamName={currentAwayLinkedTeam?.teamName ?? currentAwayManagedSquad?.name}
          topControls={
            <>
              <button
                className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-[10px] uppercase tracking-wide ${
                  manageTopPanel === "source"
                    ? "border-[var(--accent-0)] text-[var(--accent-0)]"
                    : "border-[var(--line)] text-[var(--ink-1)]"
                }`}
                onClick={() =>
                  setManageTopPanel((current) =>
                    current === "source" ? "none" : "source"
                  )
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
                  <path d="M12 3v18" />
                  <path d="M3 12h18" />
                </svg>
                Source
              </button>
              <button
                className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-[10px] uppercase tracking-wide ${
                  manageTopPanel === "appearance"
                    ? "border-[var(--accent-0)] text-[var(--accent-0)]"
                    : "border-[var(--line)] text-[var(--ink-1)]"
                }`}
                onClick={() =>
                  setManageTopPanel((current) =>
                    current === "appearance" ? "none" : "appearance"
                  )
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
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 1-3 0 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 1 0-3 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 1 3 0 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c0 .38.22.74.6 1a1.7 1.7 0 0 1 0 3c-.38.26-.6.62-.6 1Z" />
                </svg>
                Appearance
              </button>
            </>
          }
          onManageSideChange={setManageSide}
          onApplyToHome={() => setManagedTeamToSide("home")}
          onApplyToAway={() => setManagedTeamToSide("away")}
          onClose={closeSquadPresetsModal}
        >
                <div className="px-4 py-4 text-xs text-[var(--ink-1)] sm:px-6" data-scrollable>
                <div className="mx-auto max-w-5xl">
                  <div className="relative">
                    <ManageTeamsRoster
                      manageSquad={manageSquad}
                      manageSide={manageSide}
                      manageRosterView={manageRosterView}
                      manageMembershipSummary={manageMembershipSummary}
                      manageBaseSearch={manageBaseSearch}
                      manageBoardSearch={manageBoardSearch}
                      manageBoardFilter={manageBoardFilter}
                      manageGuestName={manageGuestName}
                      manageGuestPosition={manageGuestPosition}
                      manageGuestNumber={manageGuestNumber}
                      onManageRosterViewChange={setManageRosterView}
                      onManageBaseSearchChange={setManageBaseSearch}
                      onManageBoardSearchChange={setManageBoardSearch}
                      onManageBoardFilterChange={setManageBoardFilter}
                      onManageGuestNameChange={setManageGuestName}
                      onManageGuestPositionChange={setManageGuestPosition}
                      onManageGuestNumberChange={setManageGuestNumber}
                      onAddMember={() =>
                        manageSquad &&
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
                      onAddGuestMember={() =>
                        manageSquad &&
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
                      onAddBoardGuest={manageAddBoardGuest}
                      onShowAllBoardPlayers={() =>
                        updateManageBoardOverride((current) => ({
                          ...current,
                          hiddenPlayerIds: [],
                        }))
                      }
                      onResetBoardPositions={() =>
                        updateManageBoardOverride((current) => ({
                          ...current,
                          positionOverrides: {},
                        }))
                      }
                    onResetBoardRoster={() =>
                      updateManageBoardOverride(() => ({
                        hiddenPlayerIds: [],
                        guestPlayers: [],
                        numberOverrides: {},
                        positionOverrides: {},
                      }))
                    }
                    baseRosterToolbar={
                      <button
                        className="rounded-full border border-[var(--line)] px-2 py-1 text-[10px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                        onClick={() => toggleManagePlayersSort("default")}
                        title="Reset to default sort"
                      >
                        Default sort{manageSortIndicator("default")}
                      </button>
                    }
                    >
                        {manageSquad ? (
                          manageRosterView === "base" ? (
                            <ManageTeamsBaseRoster
                              manageSquadId={manageSquad.id}
                              filteredManageBasePlayers={filteredManageBasePlayers}
                              manageSortIndicator={manageSortIndicator}
                              managedDirectoryMemberMap={managedDirectoryMemberMap}
                              onToggleManagePlayersSort={toggleManagePlayersSort}
                              onUpdateSquadPlayer={updateManageBasePlayer}
                              onToggleCaptain={toggleManageBaseCaptain}
                              onToggleSubstitute={toggleManageBaseSubstitute}
                              isCaptain={isManageBaseCaptain}
                              isSubstitute={isManageBaseSubstitute}
                              onRemoveSquadPlayer={removeManageBasePlayer}
                              positionOptions={MANAGE_POSITION_OPTIONS}
                            />
                        ) : (
                          <ManageTeamsBoardRoster
                            sortedManageBoardPlayers={sortedManageBoardPlayers}
                          onSetBoardPlayerNumber={manageSetBoardPlayerNumber}
                          onSetBoardPlayerPosition={manageSetBoardPlayerPosition}
                          onToggleBoardPlayerVisible={manageToggleBoardPlayerVisible}
                          onPromoteBoardGuest={managePromoteBoardGuest}
                          onRemoveBoardGuest={manageRemoveBoardGuest}
                          />
                        )
                        ) : null}
                      </ManageTeamsRoster>
                    </div>
                    {manageTopPanel !== "none" ? (
                      <div className="absolute inset-0 z-20 flex items-start justify-center rounded-[28px] bg-black/35 p-3 backdrop-blur-[1px] sm:p-5">
                        <div className="w-full max-w-3xl rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-2xl shadow-black/35 sm:p-5">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-widest text-[var(--accent-0)]">
                                {manageTopPanel === "source" ? "Source" : "Appearance"}
                              </p>
                              <p className="text-xs text-[var(--ink-1)]">
                                {manageTopPanel === "source"
                                  ? "Load teams, inspect the current source, or save this side for reuse."
                                  : "Update the visual setup for the currently edited side."}
                              </p>
                            </div>
                            <button
                              className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide text-[var(--ink-1)] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                              onClick={() => setManageTopPanel("none")}
                            >
                              Close
                            </button>
                          </div>
                          {manageTopPanel === "source" ? (
                            <ManageTeamsSourcePanel
                              canUsePresetStorage={canUsePresetStorage}
                              managedDirectoryTeam={managedDirectoryTeam}
                              currentActiveTeamName={
                                activeTeamSelection
                                  ? `${activeTeamSelection.clubName ?? "Team"} / ${activeTeamSelection.teamName}`
                                  : null
                              }
                              currentActiveClubId={currentActiveClubId}
                              currentActiveTeamId={activeTeamSelection?.teamId ?? ""}
                              currentActiveClubTeams={currentActiveClubTeams.map((team) => ({
                                id: team.id,
                                name: team.name,
                              }))}
                              currentSourceName={
                                managedDirectoryTeam
                                  ? `${managedDirectoryTeam.clubName} / ${managedDirectoryTeam.teamName}`
                                  : manageSquad?.name?.trim() || manageLinkedTeamId || null
                              }
                              currentSourceDescription={
                                managedDirectoryTeam
                                  ? null
                                  : manageLinkedTeamId
                                    ? "This side is linked to a saved team outside the loaded club directory view."
                                  : null
                              }
                              manageDirectoryClubs={manageDirectoryClubs.map((club) => ({
                                id: club.id,
                                name: club.name,
                              }))}
                              manageDirectoryTeams={manageDirectoryTeams}
                              manageSelectedDirectoryClubId={manageSelectedDirectoryClubId}
                              manageSelectedDirectoryTeamId={manageSelectedDirectoryTeamId}
                              selectedManageDirectoryTeam={selectedManageDirectoryTeam}
                              selectedManageDirectoryClubTeams={selectedManageDirectoryClubTeams.map(
                                (team) => ({
                                  id: team.id,
                                  name: team.name,
                                })
                              )}
                              squadPresetsLoading={squadPresetsLoading}
                              squadPresetsError={squadPresetsError}
                              managePresetStatus={managePresetStatus}
                              manageClubNameDraft={manageClubNameDraft}
                              manageTeamNameDraft={manageTeamNameDraft}
                              manageTeamTypeDraft={manageTeamTypeDraft}
                              manageAgeGroupDraft={manageAgeGroupDraft}
                              manageSeasonLabelDraft={manageSeasonLabelDraft}
                              manageDetailsSaving={manageDetailsSaving}
                              onCurrentActiveClubIdChange={setCurrentActiveClub}
                              onCurrentActiveTeamIdChange={setCurrentActiveTeamById}
                              onManageSelectedDirectoryClubIdChange={setManageSelectedDirectoryClubId}
                              onManageSelectedDirectoryTeamIdChange={setManageSelectedDirectoryTeamId}
                              onManageClubNameDraftChange={setManageClubNameDraft}
                              onManageTeamNameDraftChange={setManageTeamNameDraft}
                              onManageTeamTypeDraftChange={setManageTeamTypeDraft}
                              onManageAgeGroupDraftChange={setManageAgeGroupDraft}
                              onManageSeasonLabelDraftChange={setManageSeasonLabelDraft}
                              onSaveManageDirectoryDetails={saveManageDirectoryDetails}
                              onLoadDirectoryTeamIntoSide={loadDirectoryTeamIntoSide}
                              onSaveReusableTeam={saveManagePreset}
                              onSetManagedTeamAsCurrent={
                                managedDirectoryTeam
                                  ? () =>
                                      setCurrentActiveTeam(
                                        managedDirectoryTeam.teamId,
                                        managedDirectoryTeam.clubName,
                                        managedDirectoryTeam.teamName
                                      )
                                  : null
                              }
                            />
                          ) : (
                            <ManageTeamsTeamSetup
                              editableSquad={editableSquad}
                              jerseyType={jerseyType}
                              shirtTypes={SHIRT_TYPES}
                              manageLogoRef={manageLogoRef}
                              updateEditableSquad={updateEditableSquad}
                              onJerseyTypeChange={setJerseyType}
                              renderShirtIcon={renderShirtIcon}
                            />
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
            </ManageTeamsModal>
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
      {matchGraphicsOpen && activeBoard && (
        <MatchGraphicsModal
          open={matchGraphicsOpen}
          onClose={() => setMatchGraphicsOpen(false)}
          project={project}
          board={activeBoard}
        />
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
