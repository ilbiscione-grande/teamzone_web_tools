"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { useEditorStore, type Tool } from "@/state/useEditorStore";
import SquadEditor from "@/components/squad/SquadEditor";
import { useProjectStore } from "@/state/useProjectStore";
import { clone } from "@/utils/clone";
import { getActiveBoard, getBoardSquads } from "@/utils/board";
import { createPlayer } from "@/board/objects/objectFactory";
import { createId } from "@/utils/id";
import type { BoardComment, PlayerToken, Squad } from "@/models";
import {
  addBoardComment,
  fetchBoardComments,
  fetchBoardSharesForOwner,
  fetchLatestCommentsForShares,
} from "@/persistence/shares";
import { can } from "@/utils/plan";

const iconClass = "h-4 w-4";
const iconStroke = "2";

const PlayerIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);
const BallIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <circle cx="12" cy="12" r="7" />
    <path d="M5 12h14M12 5v14M7 7l10 10M17 7L7 17" />
  </svg>
);
const ConeIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M12 4l7 16H5L12 4z" />
    <path d="M7 14h10" />
  </svg>
);
const GoalIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <rect x="4" y="8" width="16" height="8" />
    <path d="M8 8v8M16 8v8" />
  </svg>
);
const TextIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M5 7h14M12 7v12M8 19h8" />
  </svg>
);
const LineIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M4 18L20 6" />
  </svg>
);
const DashedLineIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M4 18L8 14M10 12l4-4M16 6l4-4" />
  </svg>
);
const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M4 18L18 4" />
    <path d="M12 4h6v6" />
  </svg>
);
const DashedArrowIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M4 18l4-4M10 12l4-4" />
    <path d="M12 4h6v6" />
  </svg>
);
const FreehandIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M4 15c2.5-4 4.5-6 7-5 2.3 1 2 4 4 4 1.6 0 2.4-1.2 5-4" />
  </svg>
);
const CircleIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <circle cx="12" cy="12" r="6" />
  </svg>
);
const RectIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <rect x="6" y="7" width="12" height="10" />
  </svg>
);
const TriangleIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M12 6l8 12H4l8-12z" />
  </svg>
);
const SquadIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <circle cx="8" cy="9" r="2" />
    <circle cx="16" cy="9" r="2" />
    <path d="M4 18c0-2 2-3 4-3s4 1 4 3" />
    <path d="M12 18c0-2 2-3 4-3s4 1 4 3" />
  </svg>
);

const itemTools: { id: Tool; label: string; hint: string; icon: ReactNode }[] = [
  { id: "player", label: "Player", hint: "Double-click to add", icon: <PlayerIcon /> },
  { id: "ball", label: "Ball", hint: "Double-click to add", icon: <BallIcon /> },
  { id: "cone", label: "Cone", hint: "Double-click to add", icon: <ConeIcon /> },
  { id: "goal", label: "Mini-goal", hint: "Double-click to add", icon: <GoalIcon /> },
  { id: "text", label: "Text", hint: "Double-click to add", icon: <TextIcon /> },
];

const lineTools: { id: Tool; label: string; hint: string; icon: ReactNode }[] = [
  { id: "line", label: "Solid line", hint: "Drag to draw", icon: <LineIcon /> },
  { id: "line_dashed", label: "Dashed line", hint: "Drag to draw", icon: <DashedLineIcon /> },
  { id: "arrow", label: "Arrow", hint: "Drag to draw", icon: <ArrowIcon /> },
  { id: "arrow_dashed", label: "Dashed arrow", hint: "Drag to draw", icon: <DashedArrowIcon /> },
  { id: "freehand", label: "Freehand", hint: "Drag to draw", icon: <FreehandIcon /> },
];

const formTools: { id: Tool; label: string; hint: string; icon: ReactNode }[] = [
  { id: "circle", label: "Circle", hint: "Drag to draw", icon: <CircleIcon /> },
  { id: "rect", label: "Rect", hint: "Drag to draw", icon: <RectIcon /> },
  { id: "triangle", label: "Triangle", hint: "Drag to draw", icon: <TriangleIcon /> },
];

const PITCH_LENGTH = 105;
const PITCH_WIDTH = 68;

const formations: Record<string, number[]> = {
  "4-3-3": [4, 3, 3],
  "4-4-2": [4, 4, 2],
  "3-5-2": [3, 5, 2],
  "4-2-3-1": [4, 2, 3, 1],
  "3-4-3": [3, 4, 3],
};

const getLineYs = (count: number) => {
  const margin = 8;
  if (count <= 1) {
    return [PITCH_WIDTH / 2];
  }
  const spacing = (PITCH_WIDTH - margin * 2) / (count - 1);
  return Array.from({ length: count }, (_, index) => margin + spacing * index);
};

const getLineXs = (lineCount: number) => {
  if (lineCount <= 1) {
    return [PITCH_LENGTH * 0.5];
  }
  const minX = 22;
  const maxX = 88;
  const spacing = (maxX - minX) / (lineCount - 1);
  return Array.from({ length: lineCount }, (_, index) => minX + spacing * index);
};

const getFormationPositions = (formation: number[], side: "home" | "away") => {
  const positions: { x: number; y: number }[] = [];
  const gkX = side === "home" ? 8 : PITCH_LENGTH - 8;
  positions.push({ x: gkX, y: PITCH_WIDTH / 2 });
  const lineXs = getLineXs(formation.length).map((x) =>
    side === "home" ? x : PITCH_LENGTH - x
  );
  formation.forEach((count, index) => {
    const ys = getLineYs(count);
    ys.forEach((y) => positions.push({ x: lineXs[index]!, y }));
  });
  return positions;
};

const NotesIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M6 4h9l3 3v13H6z" />
    <path d="M9 12h6M9 16h6M9 8h3" />
  </svg>
);
const FramesIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <rect x="4" y="6" width="16" height="12" rx="2" />
    <path d="M8 6v12M16 6v12" />
  </svg>
);
const CommentsIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
  </svg>
);
const HighlightIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <circle cx="12" cy="12" r="6" />
    <path d="M12 6v12M6 12h12" />
  </svg>
);
const LinkIcon = () => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth={iconStroke}>
    <path d="M10 14l4-4" />
    <path d="M7 17a4 4 0 0 1 0-6l3-3a4 4 0 0 1 6 6l-1 1" />
  </svg>
);

type ToolboxProps = {
  collapsed?: boolean;
};

export default function Toolbox({ collapsed = false }: ToolboxProps) {
  const activeTool = useEditorStore((state) => state.activeTool);
  const setTool = useEditorStore((state) => state.setTool);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const [activeTab, setActiveTab] = useState<
    "items" | "draw" | "squad" | "notes" | "frames" | "shared"
  >("items");
  const [notesView, setNotesView] = useState<"edit" | "preview">("preview");
  const [showDateTimeDialog, setShowDateTimeDialog] = useState(false);
  const [dateTimeDraft, setDateTimeDraft] = useState("");
  const notesInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [showMarkdownHelp, setShowMarkdownHelp] = useState(false);
  const markdownHelpRef = useRef<HTMLButtonElement | null>(null);
  const [markdownHelpPos, setMarkdownHelpPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const project = useProjectStore((state) => state.project);
  const plan = useProjectStore((state) => state.plan);
  const authUser = useProjectStore((state) => state.authUser);
  const commentsSeenKey = authUser
    ? `tacticsboard:commentsSeen:${authUser.id}`
    : null;
  const setFrameObjects = useProjectStore((state) => state.setFrameObjects);
  const updateBoard = useProjectStore((state) => state.updateBoard);
  const selection = useEditorStore((state) => state.selection);
  const isLinkingPlayers = useEditorStore((state) => state.isLinkingPlayers);
  const linkingPlayerIds = useEditorStore(
    (state) => state.linkingPlayerIds
  );
  const isHighlighting = useEditorStore((state) => state.isHighlighting);
  const setHighlighting = useEditorStore((state) => state.setHighlighting);
  const setLinkingPlayers = useEditorStore(
    (state) => state.setLinkingPlayers
  );
  const clearLinkingPlayers = useEditorStore(
    (state) => state.clearLinkingPlayers
  );

  const board = getActiveBoard(project);
  const updateProjectMeta = useProjectStore((state) => state.updateProjectMeta);
  const [notesScope, setNotesScope] = useState<"project" | "board">("board");
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [ownerShares, setOwnerShares] = useState<
    {
      id: string;
      recipientEmail: string;
      permission: "view" | "comment";
      createdAt: string;
    }[]
  >([]);
  const [activeShareId, setActiveShareId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commentStatus, setCommentStatus] = useState<string | null>(null);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentsBusy, setCommentsBusy] = useState(false);
  const [sharedUnreadCount, setSharedUnreadCount] = useState(0);
  type NotesFields = NonNullable<NonNullable<typeof board>["notesFields"]>;
  const notesTemplate =
    project?.settings.mode === "training"
      ? "TRAINING"
      : project?.settings.mode === "education"
      ? "EDUCATION"
      : "MATCH";
  const scopedNotes = notesScope === "project" ? project?.sessionNotes : board?.notes;
  const scopedFields =
    notesScope === "project" ? project?.sessionNotesFields : board?.notesFields;
  const previewNotes = useMemo(() => {
    const raw = scopedNotes ?? "";
    if (!raw) {
      return "";
    }
    return raw.replace(/\n{3,}/g, (match) => {
      const extra = match.length - 2;
      let next = "\n\n";
      for (let i = 0; i < extra; i += 1) {
        next += "\u00A0\n\n";
      }
      return next;
    });
  }, [scopedNotes]);
  const frameIndex = board?.activeFrameIndex ?? 0;
  const objects = board?.frames[frameIndex]?.objects ?? [];
  const activeFrame = board?.frames[frameIndex];
  const frameActions = [
    "",
    "Pass",
    "Ball won",
    "Ball lost",
    "Through ball",
    "Shot",
    "Save",
    "Cross",
    "Dribble",
  ];
  const updateScopedNotes = (nextNotes: string) => {
    if (notesScope === "project") {
      if (!project) {
        return;
      }
      updateProjectMeta({ sessionNotes: nextNotes });
      return;
    }
    if (!board) {
      return;
    }
    updateBoard(board.id, { notes: nextNotes });
  };
  const updateScopedFields = (nextFields: NotesFields) => {
    if (notesScope === "project") {
      if (!project) {
        return;
      }
      updateProjectMeta({
        sessionNotesFields: nextFields,
      });
      return;
    }
    if (!board) {
      return;
    }
    updateBoard(board.id, {
      notesFields: nextFields,
    });
  };
  const updateScopedTrainingField = (
    key: keyof NonNullable<NotesFields["training"]>,
    value: string
  ) => {
    const nextFields: NotesFields = {
      ...(scopedFields ?? {}),
      training: {
        ...(scopedFields?.training ?? {}),
        [key]: value,
      },
    };
    updateScopedFields(nextFields);
  };
  const toggleScopedEquipment = (item: string) => {
    const current = scopedFields?.training?.equipment ?? [];
    const next = current.includes(item)
      ? current.filter((entry) => entry !== item)
      : [...current, item];
    const nextFields: NotesFields = {
      ...(scopedFields ?? {}),
      training: {
        ...(scopedFields?.training ?? {}),
        equipment: next,
      },
    };
    updateScopedFields(nextFields);
  };
  const notesPresets = {
    training: {
      mainFocus: [
        "Build up play - defensive third",
        "Build up play - central progression",
        "Press resistance",
        "Finishing in the box",
        "Transition defense",
      ],
      partGoals: [
        "Create central options",
        "Play through first press",
        "Support angles quickly",
      ],
      dateTime: [
        "Mon 18:00-19:30",
        "Tue 17:30-19:00",
        "Thu 18:00-19:30",
        "Sat 10:00-11:30",
      ],
      equipment: ["Cones", "Bibs", "Balls", "Mini goals", "Hurdles", "Poles"],
      organisation: [
        "7v7",
        "9v9",
        "11v11",
        "Half pitch",
        "Zoned pitch",
      ],
      keyBehaviours: [
        "Scan before receiving",
        "First touch away from pressure",
        "Immediate support after pass",
      ],
      usualErrors: [
        "Distances too long",
        "Hiding behind opponent",
        "Few switches of play",
      ],
      coachInstructions: [
        "Play the first option",
        "Set ball tempo, not running tempo",
        "Find next passing angle quickly",
      ],
    },
    match: {
      opposition: [
        "High pressing opponent",
        "Low block opponent",
        "Direct play team",
      ],
      ourGameWithBall: [
        "Short build up",
        "Direct to target player",
        "Exploit wide channels",
      ],
      ourGameWithoutBall: [
        "High press",
        "Mid block",
        "Low block",
      ],
      counters: [
        "Immediate counter-press",
        "Secure rest defense",
        "Fast vertical transition",
      ],
      keyRoles: [
        "Pivot anchors build up",
        "Wingers isolate fullback",
        "Striker pins center backs",
      ],
      importantReminders: [
        "First 10 minutes",
        "Last 15 minutes",
        "When leading/when trailing",
      ],
      matchMessage: [
        "Be brave with the ball",
        "We work together",
        "Next action matters most",
      ],
    },
    education: {
      tema: [
        "Spelbarhet mellan lagdelar",
        "Rattvand mottagning",
        "Skapa overlaga centralt",
      ],
      grundprincip: [
        "Skapa vinkel och djup",
        "Spela bort forsta pressen",
        "Locka och spela igenom",
      ],
      whatToSee: [
        "Positioner med- och motspelare",
        "Avstand och vinklar",
        "Motstandarens rorelser",
      ],
      whatToDo: [
        "Placering",
        "Tajming",
        "Beslut (spela, driva, vanda)",
      ],
      usualErrors: [
        "For tidig lopning",
        "Spel i samma linje",
        "Bolltempo utan rorelse",
      ],
      matchConnection: [
        "Nar ser vi detta i match?",
        "Hur paverkar det nasta aktion?",
      ],
      reflections: [
        "Vad hander om vi inte gor detta?",
        "Hur hjalper detta lagkamraten?",
      ],
    },
  };
  const toDateTimeLocalValue = (input?: string) => {
    if (input && input.trim()) {
      const parsed = new Date(input);
      if (!Number.isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = `${parsed.getMonth() + 1}`.padStart(2, "0");
        const d = `${parsed.getDate()}`.padStart(2, "0");
        const hh = `${parsed.getHours()}`.padStart(2, "0");
        const mm = `${parsed.getMinutes()}`.padStart(2, "0");
        return `${y}-${m}-${d}T${hh}:${mm}`;
      }
    }
    const now = new Date();
    const y = now.getFullYear();
    const m = `${now.getMonth() + 1}`.padStart(2, "0");
    const d = `${now.getDate()}`.padStart(2, "0");
    const hh = `${now.getHours()}`.padStart(2, "0");
    const mm = `${now.getMinutes()}`.padStart(2, "0");
    return `${y}-${m}-${d}T${hh}:${mm}`;
  };

  const selectedPlayers = objects.filter(
    (item) => item.type === "player" && selection.includes(item.id)
  ) as PlayerToken[];

  const handleUndo = () => {
    if (!board) {
      return;
    }
    const snapshot = undo(clone(objects));
    if (snapshot) {
      setFrameObjects(board.id, frameIndex, snapshot);
    }
  };

  const handleRedo = () => {
    if (!board) {
      return;
    }
    const snapshot = redo(clone(objects));
    if (snapshot) {
      setFrameObjects(board.id, frameIndex, snapshot);
    }
  };

  useEffect(() => {
    if (!showMarkdownHelp) {
      return;
    }
    const update = () => {
      const target = markdownHelpRef.current;
      if (!target) {
        return;
      }
      const rect = target.getBoundingClientRect();
      setMarkdownHelpPos({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    };
    update();
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [showMarkdownHelp]);

  const handleToggleHighlights = () => {
    setHighlighting(!isHighlighting);
  };

  const toggleLinkMode = () => {
    if (!board) {
      return;
    }
    if (isLinkingPlayers) {
      if (linkingPlayerIds.length >= 2) {
        const activeFrame = board.frames[frameIndex];
        const nextLinks = [
          ...((activeFrame?.playerLinks ?? board.playerLinks) ?? []),
          {
            id: createId(),
            playerIds: [...linkingPlayerIds],
            style: {
              stroke: "#f9bf4a",
              strokeWidth: 0.65,
              fill: "transparent",
              dash: [],
              opacity: 1,
              outlineStroke: "#111111",
            },
          },
        ];
        const nextFrames = board.frames.map((frame, index) =>
          index === frameIndex ? { ...frame, playerLinks: nextLinks } : frame
        );
        updateBoard(board.id, { frames: nextFrames });
      }
      setLinkingPlayers(false);
      clearLinkingPlayers();
      return;
    }
    clearLinkingPlayers();
    setLinkingPlayers(true);
  };

  const updateFrameMeta = (
    payload: Partial<NonNullable<typeof activeFrame>>
  ) => {
    if (!board || !activeFrame) {
      return;
    }
    const nextFrames = board.frames.map((frame, index) =>
      index === frameIndex ? { ...frame, ...payload } : frame
    );
    updateBoard(board.id, { frames: nextFrames });
  };

  useEffect(() => {
    setOwnerShares([]);
    setActiveShareId(null);
    setComments([]);
  }, [board?.id]);

  useEffect(() => {
    if (!board || !authUser || !can(plan, "board.share")) {
      setOwnerShares([]);
      return;
    }
    fetchBoardSharesForOwner(board.id).then((result) => {
      if (!result.ok) {
        setOwnerShares([]);
        return;
      }
      const next = result.shares.map((share) => ({
        id: share.id,
        recipientEmail: share.recipientEmail,
        permission: share.permission,
        createdAt: share.createdAt,
      }));
      setOwnerShares(next);
      if (!project?.sharedMeta) {
        setActiveShareId(next[0]?.id ?? null);
      }
    });
  }, [authUser, board?.id, plan, project?.sharedMeta]);

  useEffect(() => {
    if (!board || !authUser || !can(plan, "board.share") || project?.sharedMeta) {
      return;
    }
    let cancelled = false;
    const refreshShares = async () => {
      const result = await fetchBoardSharesForOwner(board.id);
      if (!result.ok || cancelled) {
        return;
      }
      const next = result.shares.map((share) => ({
        id: share.id,
        recipientEmail: share.recipientEmail,
        permission: share.permission,
        createdAt: share.createdAt,
      }));
      setOwnerShares(next);
      setActiveShareId((current) => {
        if (current && next.some((share) => share.id === current)) {
          return current;
        }
        return next[0]?.id ?? null;
      });
    };
    refreshShares();
    const interval = window.setInterval(refreshShares, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [authUser, board?.id, plan, project?.sharedMeta]);

  useEffect(() => {
    if (activeTab !== "shared") {
      return;
    }
    const shareId = project?.sharedMeta?.shareId ?? activeShareId;
    if (!shareId) {
      setComments([]);
      return;
    }
    if (commentsSeenKey && typeof window !== "undefined") {
      const raw = window.localStorage.getItem(commentsSeenKey);
      let nextMap: Record<string, number> = {};
      if (raw) {
        try {
          nextMap = JSON.parse(raw) as Record<string, number>;
        } catch {
          nextMap = {};
        }
      }
      nextMap[shareId] = Date.now();
      window.localStorage.setItem(commentsSeenKey, JSON.stringify(nextMap));
    }
    setCommentsBusy(true);
    setCommentStatus(null);
    fetchBoardComments(shareId)
      .then((result) => {
        if (!result.ok) {
          setCommentStatus(result.error);
          setComments([]);
          return;
        }
        setComments(result.comments);
      })
      .finally(() => setCommentsBusy(false));
  }, [activeTab, project?.sharedMeta?.shareId, activeShareId]);

  useEffect(() => {
    const shareIds = project?.sharedMeta?.shareId
      ? [project.sharedMeta.shareId]
      : ownerShares.map((share) => share.id);
    if (shareIds.length === 0 || !commentsSeenKey || !authUser) {
      setSharedUnreadCount(0);
      return;
    }
    const sharedSeenKey = `tacticsboard:sharedSeenAt:${authUser.id}`;
    let cancelled = false;
    const checkUnread = async () => {
      const result = await fetchLatestCommentsForShares(shareIds);
      if (!result.ok || cancelled) {
        return;
      }
      let seenMap: Record<string, number> = {};
      let sharedSeenAt = 0;
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(commentsSeenKey);
        if (raw) {
          try {
            seenMap = JSON.parse(raw) as Record<string, number>;
          } catch {
            seenMap = {};
          }
        }
        sharedSeenAt = Number(window.localStorage.getItem(sharedSeenKey) ?? 0);
      }
      const unreadComments = Object.entries(result.latest).filter(
        ([shareId, createdAt]) =>
          new Date(createdAt).getTime() > (seenMap[shareId] ?? 0)
      ).length;
      const unreadShares = ownerShares.filter(
        (share) => new Date(share.createdAt).getTime() > sharedSeenAt
      ).length;
      if (!cancelled) {
        setSharedUnreadCount(unreadComments + unreadShares);
      }
    };
    checkUnread();
    const interval = window.setInterval(checkUnread, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [commentsSeenKey, ownerShares, project?.sharedMeta?.shareId, authUser]);

  useEffect(() => {
    const sharedMeta = project?.sharedMeta;
    if (!sharedMeta || !authUser) {
      return;
    }
    const sharedSeenKey = `tacticsboard:sharedSeenAt:${authUser.id}`;
    let cancelled = false;
    const checkShareActive = async () => {
      const result = await fetchLatestCommentsForShares([
        sharedMeta.shareId,
      ]);
      if (!result.ok || cancelled) {
        return;
      }
      const createdAt = result.latest[sharedMeta.shareId];
      if (!createdAt) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(sharedSeenKey, String(Date.now()));
        }
        setSharedUnreadCount(0);
      }
    };
    checkShareActive();
    const interval = window.setInterval(checkShareActive, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [project?.sharedMeta, authUser]);

  useEffect(() => {
    if (
      activeTab !== "shared" ||
      !authUser ||
      ownerShares.length === 0 ||
      project?.sharedMeta
    ) {
      return;
    }
    const sharedSeenKey = `tacticsboard:sharedSeenAt:${authUser.id}`;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(sharedSeenKey, String(Date.now()));
    }
  }, [activeTab, authUser, ownerShares.length, project?.sharedMeta]);

  const handleAddComment = async () => {
    const shareId = project?.sharedMeta?.shareId ?? activeShareId;
    if (!shareId || !commentBody.trim()) {
      return;
    }
    const isOwner =
      (!project?.sharedMeta && ownerShares.length > 0 && !!authUser) ||
      authUser?.email?.toLowerCase() ===
        project?.sharedMeta?.ownerEmail.toLowerCase();
    const canComment =
      can(plan, "board.comment") &&
      ((project?.sharedMeta?.permission ?? "view") === "comment" || isOwner);
    if (!canComment) {
      setCommentStatus("Commenting is disabled for this board.");
      return;
    }
    setCommentLoading(true);
    setCommentStatus(null);
    const result = await addBoardComment({
      shareId,
      boardId: board?.id ?? project?.sharedMeta?.boardId ?? "",
      body: commentBody.trim(),
    });
    if (!result.ok) {
      setCommentStatus(result.error);
      setCommentLoading(false);
      return;
    }
    setComments((prev) => [...prev, result.comment]);
    setCommentBody("");
    setCommentLoading(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="display-font text-sm text-[var(--accent-0)]">
          Toolbox
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={handleUndo}
          >
            Undo
          </button>
          <button
            className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={handleRedo}
          >
            Redo
          </button>
        </div>
      </div>

      {!collapsed && (
      <div className="grid grid-cols-8 gap-2">
        {[
          { id: "items", label: "Items", icon: <PlayerIcon /> },
          { id: "draw", label: "Forms", icon: <LineIcon /> },
          { id: "squad", label: "Squad", icon: <SquadIcon /> },
          { id: "notes", label: "Notes", icon: <NotesIcon /> },
          { id: "frames", label: "Frames", icon: <FramesIcon /> },
          { id: "shared", label: "Shared", icon: <CommentsIcon /> },
        ].map((tab) => {
          const hasShared =
            tab.id !== "shared"
              ? true
              : !!project?.sharedMeta || ownerShares.length > 0;
          const showBadge =
            tab.id === "shared" && sharedUnreadCount > 0 && hasShared;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`relative flex flex-col items-center justify-center rounded-2xl border px-2 py-2 text-[11px] uppercase tracking-wide ${
              isActive ? "col-span-3 h-14 border-[var(--accent-0)] text-[var(--ink-0)]" : "col-span-1 h-11"
            } ${
              !isActive && hasShared
                ? "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                : !isActive
                ? "border-[var(--line)] text-[var(--ink-1)] opacity-40"
                : ""
            }`}
            disabled={!hasShared}
          >
            {showBadge && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--accent-1)]" />
            )}
            <div
              className={`flex items-center justify-center ${
                isActive ? "mb-1 w-6" : "w-4 scale-90"
              }`}
            >
              {tab.icon}
            </div>
            {isActive && <span>{tab.label}</span>}
          </button>
        );
        })}
      </div>
      )}

      {!collapsed && (
      <div className="min-h-0 flex-1 overflow-y-auto pr-1" data-scrollable>
      {activeTab === "items" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-center transition ${
                isHighlighting
                  ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                  : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
              }`}
              onClick={handleToggleHighlights}
            >
              <span className="mt-1">
                <HighlightIcon />
              </span>
              <span className="text-xs font-semibold">Highlight</span>
              <span className="text-[10px] text-[var(--ink-1)]">
                {isHighlighting ? "Click players to toggle" : "Enable highlight"}
              </span>
            </button>
            <button
              className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-center transition ${
                isLinkingPlayers
                  ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                  : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
              }`}
              onClick={toggleLinkMode}
            >
              <span className="mt-1">
                <LinkIcon />
              </span>
              <span className="text-xs font-semibold">Link line</span>
              <span className="text-[10px] text-[var(--ink-1)]">
                {isLinkingPlayers ? "Click players, press again" : "Start linking"}
              </span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
          {itemTools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setTool(tool.id)}
              className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-center transition ${
                activeTool === tool.id
                  ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                  : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
              }`}
            >
              <span className="mt-1">{tool.icon}</span>
              <span className="text-xs font-semibold">{tool.label}</span>
              <span className="text-[10px] text-[var(--ink-1)]">{tool.hint}</span>
            </button>
          ))}
          </div>
        </div>
      )}

      {activeTab === "draw" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {lineTools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setTool(tool.id)}
                className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-center transition ${
                  activeTool === tool.id
                    ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                    : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                }`}
              >
                <span className="mt-1">{tool.icon}</span>
                <span className="text-xs font-semibold">{tool.label}</span>
                <span className="text-[10px] text-[var(--ink-1)]">{tool.hint}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {formTools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setTool(tool.id)}
                className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-center transition ${
                  activeTool === tool.id
                    ? "border-[var(--accent-0)] bg-[var(--panel-2)] text-[var(--ink-0)]"
                    : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                }`}
              >
                <span className="mt-1">{tool.icon}</span>
                <span className="text-xs font-semibold">{tool.label}</span>
                <span className="text-[10px] text-[var(--ink-1)]">{tool.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === "squad" && <SquadEditor />}

      {activeTab === "notes" && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 overflow-visible">
            <div className="flex items-center gap-2">
              <p className="text-[11px] uppercase text-[var(--ink-1)]">Notes</p>
              <div className="relative">
                <button
                  type="button"
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--line)] text-[10px] text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                  aria-label="Markdown help"
                  onMouseEnter={() => setShowMarkdownHelp(true)}
                  onMouseLeave={() => setShowMarkdownHelp(false)}
                  onFocus={() => setShowMarkdownHelp(true)}
                  onBlur={() => setShowMarkdownHelp(false)}
                  ref={markdownHelpRef}
                >
                  ?
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--panel-2)] p-1">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    notesScope === "project"
                      ? "bg-[var(--accent-1)] text-[var(--ink-0)]"
                      : "text-[var(--ink-1)]"
                  }`}
                  onClick={() => setNotesScope("project")}
                >
                  Session
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    notesScope === "board"
                      ? "bg-[var(--accent-1)] text-[var(--ink-0)]"
                      : "text-[var(--ink-1)]"
                  }`}
                  onClick={() => setNotesScope("board")}
                >
                  Board
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 min-h-0 flex-1 pr-1">
            <div className="rounded-2xl border border-[var(--line)] p-3">
              <p className="mb-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
                Structured fields
              </p>
              {notesTemplate === "TRAINING" && (
                <div className="grid gap-2 text-[11px] text-[var(--ink-1)]">
                {[
                  ["mainFocus", "Main Focus"],
                  ["partGoals", "Part goals"],
                  ...(notesScope === "project"
                    ? [
                        ["dateTime", "Date/time"],
                      ]
                    : [
                        ["organisation", "Organisation"],
                        ["keyBehaviours", "Key behaviours"],
                        ["coachInstructions", "Coach instructions"],
                      ]),
                ].map(([key, label]) => {
                  if (key === "dateTime") {
                    const current = scopedFields?.training?.dateTime ?? "";
                    return (
                      <label key={key} className="space-y-1">
                        <span>{label}</span>
                        <button
                          type="button"
                          className="flex h-8 w-full items-center rounded-lg border border-[var(--line)] bg-transparent px-2 text-left text-xs text-[var(--ink-0)]"
                          onClick={() => {
                            setDateTimeDraft(toDateTimeLocalValue(current));
                            setShowDateTimeDialog(true);
                          }}
                        >
                          {current || "Choose date and time"}
                        </button>
                      </label>
                    );
                  }
                  return (
                    <label key={key} className="space-y-1">
                      <span>{label}</span>
                      <input
                        className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent px-2 text-xs text-[var(--ink-0)]"
                        value={
                          scopedFields?.training?.[
                            key as keyof NonNullable<NotesFields>["training"]
                          ] ?? ""
                        }
                        list={`notes-training-${key}`}
                        onChange={(event) => {
                          updateScopedTrainingField(
                            key as keyof NonNullable<NotesFields["training"]>,
                            event.target.value
                          );
                        }}
                      />
                      <datalist id={`notes-training-${key}`}>
                        {notesPresets.training[
                          key as keyof typeof notesPresets.training
                        ]?.map((item) => (
                          <option key={item} value={item} />
                        ))}
                      </datalist>
                    </label>
                  );
                })}
                {(notesScope === "project" || notesScope === "board") && (
                  <div className="space-y-1">
                    <span>Equipment</span>
                    <div className="grid grid-cols-2 gap-2">
                      {notesPresets.training.equipment.map((item) => {
                        const checked =
                          scopedFields?.training?.equipment?.includes(item) ??
                          false;
                        return (
                          <label
                            key={item}
                            className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleScopedEquipment(item)}
                            />
                            <span>{item}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              )}
              {notesTemplate === "MATCH" && (
                <div className="grid gap-2 text-[11px] text-[var(--ink-1)]">
                {[
                  ...(notesScope === "project"
                    ? [
                        ["opposition", "Opposition"],
                        ["ourGameWithBall", "Our game - with ball"],
                        ["ourGameWithoutBall", "Our game - without ball"],
                        ["counters", "Counters"],
                        ["keyRoles", "Key Roles"],
                        ["importantReminders", "Important reminders"],
                        ["matchMessage", "Match message"],
                      ]
                    : [
                        ["ourGameWithBall", "Our game - with ball"],
                        ["ourGameWithoutBall", "Our game - without ball"],
                        ["counters", "Counters"],
                        ["keyRoles", "Key roles"],
                      ]),
                ].map(([key, label]) => (
                  <label key={key} className="space-y-1">
                    <span>{label}</span>
                    <input
                      className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent px-2 text-xs text-[var(--ink-0)]"
                      value={scopedFields?.match?.[key as keyof NonNullable<NotesFields>["match"]] ?? ""}
                      list={`notes-match-${key}`}
                      onChange={(event) => {
                        const nextFields = {
                          ...(scopedFields ?? {}),
                          match: {
                            ...(scopedFields?.match ?? {}),
                            [key]: event.target.value,
                          },
                        };
                        updateScopedFields(nextFields);
                      }}
                    />
                    <datalist id={`notes-match-${key}`}>
                      {notesPresets.match[
                        key as keyof typeof notesPresets.match
                      ]?.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                  </label>
                ))}
              </div>
              )}
              {notesTemplate === "EDUCATION" && (
                <div className="grid gap-2 text-[11px] text-[var(--ink-1)]">
                {[
                  ...(notesScope === "project"
                    ? [
                        ["tema", "Tema"],
                        ["grundprincip", "Grundprincip"],
                        ["whatToSee", "What to see"],
                        ["matchConnection", "Match connection"],
                        ["reflections", "Reflections"],
                      ]
                    : [
                        ["tema", "Tema"],
                        ["whatToSee", "What to see"],
                        ["whatToDo", "What to do"],
                        ["usualErrors", "Usual errors"],
                      ]),
                ].map(([key, label]) => (
                  <label key={key} className="space-y-1">
                    <span>{label}</span>
                    <input
                      className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent px-2 text-xs text-[var(--ink-0)]"
                      value={scopedFields?.education?.[key as keyof NonNullable<NotesFields>["education"]] ?? ""}
                      list={`notes-education-${key}`}
                      onChange={(event) => {
                        const nextFields = {
                          ...(scopedFields ?? {}),
                          education: {
                            ...(scopedFields?.education ?? {}),
                            [key]: event.target.value,
                          },
                        };
                        updateScopedFields(nextFields);
                      }}
                    />
                    <datalist id={`notes-education-${key}`}>
                      {notesPresets.education[
                        key as keyof typeof notesPresets.education
                      ]?.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                  </label>
                ))}
              </div>
              )}
            </div>
            <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-2xl border border-[var(--line)] p-3">
              <p className="mb-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
                {notesScope === "project" ? "Session / Project notes" : "Board notes"}
              </p>
              {notesView === "edit" ? (
                <textarea
                  className="min-h-[12rem] resize-none rounded-2xl border border-[var(--line)] bg-transparent px-3 py-2 text-sm text-[var(--ink-0)]"
                  rows={12}
                  placeholder={
                    notesScope === "project"
                      ? "Write notes for this session/project..."
                      : "Write notes for this board..."
                  }
                  value={scopedNotes ?? ""}
                  ref={notesInputRef}
                  onFocus={() => setNotesView("edit")}
                  onBlur={() => setNotesView("preview")}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return;
                    }
                    event.preventDefault();
                    const target = event.currentTarget;
                    const current = scopedNotes ?? "";
                    const insert = event.shiftKey ? "\n" : "\n\n";
                    const start = target.selectionStart ?? current.length;
                    const end = target.selectionEnd ?? current.length;
                    const next =
                      current.slice(0, start) + insert + current.slice(end);
                    updateScopedNotes(next);
                    const cursor = start + insert.length;
                    requestAnimationFrame(() => {
                      target.selectionStart = cursor;
                      target.selectionEnd = cursor;
                    });
                  }}
                  onChange={(event) => {
                    updateScopedNotes(event.target.value);
                  }}
                />
              ) : (
                <div
                  className="min-h-[12rem] overflow-y-auto rounded-2xl border border-[var(--line)] bg-transparent px-3 py-2 text-sm text-[var(--ink-0)]"
                  onClick={() => {
                    setNotesView("edit");
                    requestAnimationFrame(() => {
                      notesInputRef.current?.focus();
                    });
                  }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                      h1: (props) => (
                        <h1 className="mb-2 text-lg font-semibold" {...props} />
                      ),
                      h2: (props) => (
                        <h2 className="mb-2 text-base font-semibold" {...props} />
                      ),
                      h3: (props) => (
                        <h3 className="mb-2 text-sm font-semibold" {...props} />
                      ),
                      p: (props) => <p className="mb-2" {...props} />,
                      ul: (props) => (
                        <ul className="mb-2 list-disc pl-4" {...props} />
                      ),
                      ol: (props) => (
                        <ol className="mb-2 list-decimal pl-4" {...props} />
                      ),
                      li: (props) => <li className="mb-1" {...props} />,
                    }}
                  >
                    {previewNotes}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {activeTab === "shared" && (
        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
          {!project?.sharedMeta && ownerShares.length === 0 ? (
            <p className="text-sm text-[var(--ink-1)]">
              Share this board to enable comments.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase text-[var(--ink-1)]">
                    Comments
                  </p>
                  {project?.sharedMeta ? (
                    <p className="text-[10px] text-[var(--ink-1)]">
                      Shared by {project.sharedMeta.ownerEmail} ·{" "}
                      {project.sharedMeta.permission}
                    </p>
                  ) : (
                    <p className="text-[10px] text-[var(--ink-1)]">
                      Shared by you · {ownerShares.length} shares
                    </p>
                  )}
                </div>
                <span className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                  {comments.length === 1 ? "1 comment" : `${comments.length} comments`}
                </span>
              </div>
              {!project?.sharedMeta && ownerShares.length > 0 && (
                <div className="mt-2">
                  <select
                    className="h-8 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-[11px] text-[var(--ink-0)]"
                    value={activeShareId ?? ownerShares[0]?.id}
                    onChange={(event) => setActiveShareId(event.target.value)}
                  >
                    {ownerShares.map((share) => (
                      <option
                        key={share.id}
                        value={share.id}
                        className="bg-[var(--panel-2)] text-[var(--ink-0)]"
                      >
                        {share.recipientEmail} · {share.permission}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-3">
                {commentsBusy ? (
                  <p className="text-xs text-[var(--ink-1)]">
                    Loading comments...
                  </p>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-[var(--ink-1)]">
                    No comments yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs"
                      >
                        <p className="text-[var(--ink-0)]">{comment.body}</p>
                        <p className="mt-2 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                          {comment.authorEmail} ·{" "}
                          {new Date(comment.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-2">
                <textarea
                  className="min-h-[72px] w-full rounded-2xl border border-[var(--line)] bg-transparent p-2 text-xs text-[var(--ink-0)]"
                  placeholder={
                    ((project?.sharedMeta?.permission ?? "view") === "comment" ||
                      (!project?.sharedMeta && ownerShares.length > 0) ||
                      authUser?.email?.toLowerCase() ===
                        project?.sharedMeta?.ownerEmail.toLowerCase()) &&
                    can(plan, "board.comment")
                      ? "Write a comment..."
                      : "Commenting is disabled."
                  }
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  disabled={
                    (!can(plan, "board.comment") ||
                      ((project?.sharedMeta?.permission ?? "view") !== "comment" &&
                        !(ownerShares.length > 0 && !project?.sharedMeta) &&
                        authUser?.email?.toLowerCase() !==
                          project?.sharedMeta?.ownerEmail.toLowerCase()))
                  }
                />
                <div className="flex items-center justify-between">
                  {commentStatus ? (
                    <p className="text-xs text-[var(--accent-1)]">
                      {commentStatus}
                    </p>
                  ) : (
                    <span />
                  )}
                  <button
                    className="rounded-full bg-[var(--accent-0)] px-4 py-2 text-xs font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleAddComment}
                    disabled={
                      commentLoading ||
                      !can(plan, "board.comment") ||
                      ((project?.sharedMeta?.permission ?? "view") !== "comment" &&
                        !(ownerShares.length > 0 && !project?.sharedMeta) &&
                        authUser?.email?.toLowerCase() !==
                          project?.sharedMeta?.ownerEmail.toLowerCase())
                    }
                  >
                    {commentLoading ? "Saving..." : "Add comment"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {activeTab === "frames" && (
        board?.mode === "DYNAMIC" && activeFrame ? (
          <div className="rounded-2xl border border-[var(--line)] p-3 text-xs text-[var(--ink-1)]">
            <p className="text-[11px] uppercase text-[var(--ink-1)]">
              Frame details
            </p>
            <div className="mt-2 grid gap-2">
              <label className="space-y-1">
                <span className="text-[11px]">Title</span>
                <input
                  className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent px-2 text-xs text-[var(--ink-0)]"
                  value={activeFrame.name}
                  onChange={(event) =>
                    updateFrameMeta({ name: event.target.value })
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px]">Action</span>
                <select
                  className="h-8 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2 text-xs text-[var(--ink-0)]"
                  value={activeFrame.action ?? ""}
                  onChange={(event) =>
                    updateFrameMeta({ action: event.target.value })
                  }
                >
                  {frameActions.map((action) => (
                    <option
                      key={action || "none"}
                      value={action}
                      className="bg-[var(--panel-2)] text-[var(--ink-0)]"
                    >
                      {action || "Select action"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[11px]">Notes</span>
                <textarea
                  className="min-h-[72px] w-full rounded-lg border border-[var(--line)] bg-transparent p-2 text-xs text-[var(--ink-0)]"
                  value={activeFrame.notes ?? ""}
                  onChange={(event) =>
                    updateFrameMeta({ notes: event.target.value })
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px]">Duration (sec)</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent px-2 text-xs text-[var(--ink-0)]"
                  value={
                    activeFrame.durationMs
                      ? String(activeFrame.durationMs / 1000)
                      : "0"
                  }
                  onChange={(event) => {
                    const nextSeconds = Number(event.target.value);
                    if (Number.isNaN(nextSeconds)) {
                      return;
                    }
                    updateFrameMeta({
                      durationMs: Math.max(0, nextSeconds) * 1000,
                    });
                  }}
                />
                <span className="text-[10px] text-[var(--ink-1)]">
                  Use 0 to keep the default playback speed.
                </span>
              </label>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--ink-1)]">
            Frames are available when the board is in Dynamic mode.
          </p>
        )
      )}
      </div>
      )}
      {showDateTimeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="mb-3 text-sm font-semibold text-[var(--ink-0)]">
              Select date and time
            </p>
            <input
              type="datetime-local"
              className="h-10 w-full rounded-lg border border-[var(--line)] bg-transparent px-2 text-sm text-[var(--ink-0)]"
              value={dateTimeDraft}
              onChange={(event) => setDateTimeDraft(event.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--ink-1)]"
                onClick={() => setShowDateTimeDialog(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full border border-[var(--accent-0)] bg-[var(--accent-0)] px-3 py-1 text-xs text-black"
                onClick={() => {
                  const value = dateTimeDraft || toDateTimeLocalValue();
                  const parsed = new Date(value);
                  const label = Number.isNaN(parsed.getTime())
                    ? value
                    : parsed.toLocaleString();
                  updateScopedTrainingField("dateTime", label);
                  setShowDateTimeDialog(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {showMarkdownHelp && markdownHelpPos && (
        <div
          className="fixed z-50 w-64 -translate-x-1/2 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-3 text-[10px] text-[var(--ink-0)] shadow-xl shadow-black/30"
          style={{ top: markdownHelpPos.top, left: markdownHelpPos.left }}
        >
          <p className="mb-2 text-[11px] uppercase text-[var(--ink-1)]">
            Markdown quick tips
          </p>
          <p className="mb-1">
            <span className="font-semibold">#</span> Heading,{" "}
            <span className="font-semibold">##</span> Subheading
          </p>
          <p className="mb-1">
            <span className="font-semibold">-</span> Bullet list,{" "}
            <span className="font-semibold">1.</span> Numbered list
          </p>
          <p className="mb-1">
            <span className="font-semibold">**bold**</span>,{" "}
            <span className="font-semibold">*italic*</span>
          </p>
          <p className="mb-1">
            <span className="font-semibold">`code`</span> for inline code
          </p>
          <p>
            New lines are respected; leave a blank line for a new paragraph.
          </p>
        </div>
      )}
    </div>
  );
}








