"use client";

import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/state/useProjectStore";
import { serializeProject, deserializeProject } from "@/persistence/serialize";
import { saveProject } from "@/persistence/storage";
import { useEditorStore } from "@/state/useEditorStore";
import type {
  Board,
  BoardMode,
  PitchOverlay,
  PitchView,
  SquadPreset,
} from "@/models";
import FormationMenu from "@/components/FormationMenu";
import { can, getPlanLimits } from "@/utils/plan";
import AdBanner from "@/components/AdBanner";
import { usePlanGate } from "@/hooks/usePlanGate";
import PlanModal from "@/components/PlanModal";
import BetaNoticeModal from "@/components/BetaNoticeModal";
import ShareBoardModal from "@/components/ShareBoardModal";
import CommentsModal from "@/components/CommentsModal";
import { getBoardSquads } from "@/utils/board";
import { createId } from "@/utils/id";
import {
  createSquadPreset,
  deleteSquadPreset,
  fetchSquadPresets,
  updateSquadPreset,
} from "@/persistence/squadPresets";
import { createProjectShareLink } from "@/persistence/projectShareLinks";
import { getPitchViewBounds } from "@/board/pitch/Pitch";
import { getStageRef } from "@/utils/stageRef";

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
  const [manageSide, setManageSide] = useState<"home" | "away">("home");
  const [managePresetId, setManagePresetId] = useState("");
  const [managePresetName, setManagePresetName] = useState("");
  const [managePresetSquad, setManagePresetSquad] = useState<
    SquadPreset["squad"] | null
  >(null);
  const [managePresetStatus, setManagePresetStatus] = useState<string | null>(
    null
  );
  const [shareLinkOpen, setShareLinkOpen] = useState(false);
  const [shareLinkStatus, setShareLinkStatus] = useState<string | null>(null);
  const [shareLinkUrl, setShareLinkUrl] = useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfScope, setPdfScope] = useState<"board" | "project">("board");
  const [pdfSelectedBoardIds, setPdfSelectedBoardIds] = useState<string[]>([]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const manageLogoRef = useRef<HTMLInputElement>(null);
  const [hideBetaBanner, setHideBetaBanner] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [boardActionsOpen, setBoardActionsOpen] = useState(false);
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
    if (!actionsOpen && !boardActionsOpen) {
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
    };
    window.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("mousedown", handleClick);
    };
  }, [actionsOpen, boardActionsOpen]);

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
        const matchPreset = result.presets.find(
          (preset) => preset.id === managePresetId
        );
        if (matchPreset) {
          setManagePresetName(matchPreset.name);
          setManagePresetSquad(matchPreset.squad);
        }
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
  const manageSquad = manageSide === "home" ? boardSquads.home : boardSquads.away;
  const editableSquad = managePresetSquad ?? manageSquad;
  const updateEditableSquad = (
    payload: Partial<SquadPreset["squad"]>
  ) => {
    if (managePresetSquad) {
      setManagePresetSquad({ ...managePresetSquad, ...payload });
      return;
    }
    if (manageSquad) {
      updateSquad(manageSquad.id, payload);
    }
  };
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

  useEffect(() => {
    if (!pdfOpen) {
      return;
    }
    if (pdfScope === "board") {
      setPdfSelectedBoardIds(activeBoard ? [activeBoard.id] : []);
      return;
    }
    setPdfSelectedBoardIds(project.boards.map((board) => board.id));
  }, [pdfOpen, pdfScope, project.boards, activeBoard]);

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
      className={`relative grid items-center gap-3 rounded-3xl border border-[var(--line)] bg-[var(--panel)] px-3 py-3 shadow-2xl shadow-black/40 sm:px-5 sm:py-4 ${
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
      <div className="flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex flex-col">
            <span
              className="display-font hidden text-[10px] uppercase tracking-[0.25em] text-[var(--accent-0)] md:block"
              style={titleWidth ? { width: `${titleWidth}px` } : undefined}
            >
              Teamzone Web Tools
            </span>
            <h1
              ref={titleRef}
              className="display-font text-lg leading-none text-[var(--ink-0)] sm:text-2xl"
            >
              Tactics Board
            </h1>
          </div>
          <div className="flex min-w-0 max-w-[70vw] items-center gap-1 rounded-full border border-[var(--line)] bg-transparent px-2 py-1 sm:max-w-none">
            <input
              className="h-6 min-w-0 bg-transparent text-xs text-[var(--ink-0)] focus:outline-none sm:h-7 sm:text-sm"
              value={project.name}
              onChange={(event) =>
                updateProjectMeta({ name: event.target.value })
              }
            />
            <div className="h-5 w-px bg-[var(--line)]" />
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

        <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--ink-1)]">
          <div
            className="relative flex items-center gap-2 rounded-full border border-[var(--line)] bg-transparent px-2 py-1"
            data-actions-menu
          >
            <select
              className="h-7 max-w-[180px] rounded-full bg-[var(--panel-2)] px-2 text-xs text-[var(--ink-0)] focus:outline-none sm:max-w-none sm:text-sm"
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
              className="rounded-full border border-[var(--line)] p-1 text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
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
              <div className="absolute right-0 top-10 z-30 w-44 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2 text-[11px] text-[var(--ink-0)] shadow-xl shadow-black/30">
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
                <div className="absolute right-0 top-10 z-30 w-44 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2 text-[11px] text-[var(--ink-0)] shadow-xl shadow-black/30">
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
          <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink-0)] shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between p-6 pb-0">
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
              <p className="mt-4 p-6 pt-0 text-xs text-[var(--ink-1)]">
                Squad presets are available for paid plans only.
              </p>
            ) : (
              <div className="mt-4 max-h-[calc(80vh-96px)] space-y-4 overflow-y-auto p-6 pt-0 text-xs text-[var(--ink-1)]" data-scrollable>
                <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                    Edit squad
                  </p>
                  <label className="space-y-1">
                    <span className="text-[11px] uppercase text-[var(--ink-1)]">
                      Preset squad
                    </span>
                    <select
                      className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                      value={managePresetId}
                      onChange={(event) => {
                        const nextId = event.target.value;
                        setManagePresetId(nextId);
                        const preset = squadPresets.find(
                          (item) => item.id === nextId
                        );
                        if (preset) {
                          setManagePresetName(preset.name);
                          setManagePresetSquad(preset.squad);
                        } else {
                          setManagePresetName("");
                          setManagePresetSquad(null);
                        }
                      }}
                    >
                      <option value="">Current squad</option>
                      {squadPresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {managePresetId && managePresetSquad && (
                    <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                      <input
                        className="h-9 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                        value={managePresetName}
                        onChange={(event) =>
                          setManagePresetName(event.target.value)
                        }
                        placeholder="Preset name"
                      />
                      <button
                        className="rounded-full border border-[var(--line)] px-3 py-2 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                        onClick={async () => {
                          if (!managePresetSquad || !managePresetId) {
                            return;
                          }
                          if (!managePresetName.trim()) {
                            setManagePresetStatus("Enter a preset name.");
                            return;
                          }
                          setManagePresetStatus(null);
                          const result = await updateSquadPreset({
                            id: managePresetId,
                            name: managePresetName.trim(),
                            squad: managePresetSquad,
                          });
                          if (!result.ok) {
                            setManagePresetStatus(result.error);
                            return;
                          }
                          setSquadPresets((prev) =>
                            prev.map((item) =>
                              item.id === result.preset.id
                                ? result.preset
                                : item
                            )
                          );
                          setManagePresetStatus("Preset updated.");
                        }}
                      >
                        Save changes
                      </button>
                    </div>
                  )}
                  {managePresetId && managePresetSquad && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-full border border-[var(--line)] px-3 py-2 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                        onClick={() => {
                          if (!boardSquads.home) {
                            return;
                          }
                          updateSquad(boardSquads.home.id, {
                            name: managePresetSquad.name,
                            clubLogo: managePresetSquad.clubLogo,
                            kit: managePresetSquad.kit,
                            players: managePresetSquad.players.map((player) => ({
                              ...player,
                              id: createId(),
                            })),
                          });
                        }}
                        disabled={!boardSquads.home}
                      >
                        Load to Home
                      </button>
                      <button
                        className="rounded-full border border-[var(--line)] px-3 py-2 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                        onClick={() => {
                          if (!boardSquads.away) {
                            return;
                          }
                          updateSquad(boardSquads.away.id, {
                            name: managePresetSquad.name,
                            clubLogo: managePresetSquad.clubLogo,
                            kit: managePresetSquad.kit,
                            players: managePresetSquad.players.map((player) => ({
                              ...player,
                              id: createId(),
                            })),
                          });
                        }}
                        disabled={!boardSquads.away}
                      >
                        Load to Away
                      </button>
                      <button
                        className="rounded-full border border-[var(--line)] px-3 py-2 text-[11px] uppercase tracking-wide hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                        onClick={async () => {
                          if (!window.confirm("Delete this preset?")) {
                            return;
                          }
                          const result = await deleteSquadPreset(managePresetId);
                          if (!result.ok) {
                            setManagePresetStatus(result.error);
                            return;
                          }
                          setSquadPresets((prev) =>
                            prev.filter((item) => item.id !== managePresetId)
                          );
                          setManagePresetId("");
                          setManagePresetName("");
                          setManagePresetSquad(null);
                          setManagePresetStatus("Preset deleted.");
                        }}
                      >
                        Delete preset
                      </button>
                    </div>
                  )}
                  {managePresetStatus ? (
                    <p className="text-xs text-[var(--accent-1)]">
                      {managePresetStatus}
                    </p>
                  ) : null}
                  {editableSquad ? (
                    <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
                      <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                        Squad details
                      </p>
                      <input
                        className="h-9 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                        value={editableSquad.name}
                        onChange={(event) =>
                          updateEditableSquad({ name: event.target.value })
                        }
                        placeholder="Squad name"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <label className="space-y-1">
                          <span className="text-[11px]">Shirt</span>
                          <input
                            type="color"
                            className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent"
                            value={editableSquad.kit.shirt}
                            onChange={(event) =>
                              updateEditableSquad({
                                kit: {
                                  ...editableSquad.kit,
                                  shirt: event.target.value,
                                },
                              })
                            }
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px]">Shorts</span>
                          <input
                            type="color"
                            className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent"
                            value={editableSquad.kit.shorts}
                            onChange={(event) =>
                              updateEditableSquad({
                                kit: {
                                  ...editableSquad.kit,
                                  shorts: event.target.value,
                                },
                              })
                            }
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px]">Socks</span>
                          <input
                            type="color"
                            className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent"
                            value={editableSquad.kit.socks}
                            onChange={(event) =>
                              updateEditableSquad({
                                kit: {
                                  ...editableSquad.kit,
                                  socks: event.target.value,
                                },
                              })
                            }
                          />
                        </label>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                          onClick={() => manageLogoRef.current?.click()}
                        >
                          Upload logo
                        </button>
                        {editableSquad.clubLogo ? (
                          <img
                            src={editableSquad.clubLogo}
                            alt="Club logo"
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-[11px] text-[var(--ink-1)]">
                            None
                          </span>
                        )}
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
                              updateEditableSquad({
                                clubLogo: reader.result,
                              });
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "home", label: "Home squad" },
                      { id: "away", label: "Away squad" },
                    ].map((side) => (
                      <button
                        key={side.id}
                        className={`rounded-2xl border px-3 py-2 text-[11px] uppercase tracking-wide ${
                          manageSide === side.id
                            ? "border-[var(--accent-0)] text-[var(--ink-0)]"
                            : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                        }`}
                        onClick={() =>
                          setManageSide(side.id as "home" | "away")
                        }
                      >
                        {side.label}
                      </button>
                    ))}
                  </div>
                  {(managePresetSquad || manageSquad) ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase text-[var(--ink-1)]">
                          Players
                        </span>
                        <button
                          className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                          onClick={() =>
                            managePresetSquad
                              ? setManagePresetSquad({
                                  ...managePresetSquad,
                                  players: [
                                    ...managePresetSquad.players,
                                    {
                                      id: createId(),
                                      name: "New Player",
                                      positionLabel: "",
                                      number: undefined,
                                      vestColor: undefined,
                                    },
                                  ],
                                })
                              : manageSquad
                              ? addSquadPlayer(manageSquad.id, {
                                  id: createId(),
                                  name: "New Player",
                                  positionLabel: "",
                                  number: undefined,
                                  vestColor: undefined,
                                })
                              : undefined
                          }
                        >
                          Add player
                        </button>
                      </div>
                      <div className="grid grid-cols-[28px_minmax(0,1fr)_50px_44px_20px] items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
                        <span>#</span>
                        <span>Name</span>
                        <span>Pos</span>
                        <span className="text-center">C/S</span>
                        <span />
                      </div>
                      <div className="max-h-56 space-y-2 overflow-auto pr-1" data-scrollable>
                        {(managePresetSquad ?? manageSquad)?.players.map((player) => (
                          <div
                            key={player.id}
                            className="grid grid-cols-[28px_minmax(0,1fr)_50px_44px_20px] items-center gap-2"
                          >
                            <input
                              className="h-7 rounded-md border border-[var(--line)] bg-transparent px-1 text-center text-[11px] text-[var(--ink-0)]"
                              value={player.number ?? ""}
                              onChange={(event) =>
                                managePresetSquad
                                  ? setManagePresetSquad({
                                      ...managePresetSquad,
                                      players: managePresetSquad.players.map(
                                        (item) =>
                                          item.id === player.id
                                            ? {
                                                ...item,
                                                number: event.target.value
                                                  ? Number(event.target.value)
                                                  : undefined,
                                              }
                                            : item
                                      ),
                                    })
                                  : manageSquad
                                  ? updateSquadPlayer(manageSquad.id, player.id, {
                                      number: event.target.value
                                        ? Number(event.target.value)
                                        : undefined,
                                    })
                                  : undefined
                              }
                            />
                            <input
                              className="h-7 w-full rounded-md border border-[var(--line)] bg-transparent px-1 text-[11px] text-[var(--ink-0)]"
                              value={player.name}
                              onChange={(event) =>
                                managePresetSquad
                                  ? setManagePresetSquad({
                                      ...managePresetSquad,
                                      players: managePresetSquad.players.map(
                                        (item) =>
                                          item.id === player.id
                                            ? { ...item, name: event.target.value }
                                            : item
                                      ),
                                    })
                                  : manageSquad
                                  ? updateSquadPlayer(manageSquad.id, player.id, {
                                      name: event.target.value,
                                    })
                                  : undefined
                              }
                            />
                            <select
                              className="h-7 w-full rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-1 text-[10px] text-[var(--ink-0)]"
                              value={player.positionLabel}
                              onChange={(event) =>
                                managePresetSquad
                                  ? setManagePresetSquad({
                                      ...managePresetSquad,
                                      players: managePresetSquad.players.map(
                                        (item) =>
                                          item.id === player.id
                                            ? {
                                                ...item,
                                                positionLabel: event.target.value,
                                              }
                                            : item
                                      ),
                                    })
                                  : manageSquad
                                  ? updateSquadPlayer(manageSquad.id, player.id, {
                                      positionLabel: event.target.value,
                                    })
                                  : undefined
                              }
                            >
                              <option value="" className="bg-[var(--panel-2)] text-[var(--ink-0)]">
                                
                              </option>
                              {[
                                "GK",
                                "RB",
                                "RCB",
                                "CB",
                                "LCB",
                                "LB",
                                "RWB",
                                "LWB",
                                "DM",
                                "CDM",
                                "CM",
                                "AM",
                                "CAM",
                                "RM",
                                "LM",
                                "RW",
                                "LW",
                                "ST",
                                "CF",
                                "SS",
                              ].map((pos) => (
                                <option
                                  key={pos}
                                  value={pos}
                                  className="bg-[var(--panel-2)] text-[var(--ink-0)]"
                                >
                                  {pos}
                                </option>
                              ))}
                            </select>
                            {(() => {
                              const substitutes = editableSquad?.substituteIds ?? [];
                              const isCaptain = editableSquad?.captainId === player.id;
                              const isSub = substitutes.includes(player.id);
                              return (
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    className={`h-4 w-4 rounded-full border text-[9px] uppercase ${
                                      isCaptain
                                        ? "border-[var(--accent-0)] text-[var(--accent-0)]"
                                        : "border-[var(--line)] text-[var(--ink-1)]"
                                    }`}
                                    onClick={() =>
                                      updateEditableSquad({
                                        captainId: isCaptain ? undefined : player.id,
                                      })
                                    }
                                    title="Captain"
                                    aria-label="Captain"
                                  >
                                    C
                                  </button>
                                  <button
                                    className={`h-4 w-4 rounded-full border text-[9px] uppercase ${
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
                                    title="Substitute"
                                    aria-label="Substitute"
                                  >
                                    S
                                  </button>
                                </div>
                              );
                            })()}
                            <button
                              className="rounded-full border border-[var(--line)] p-1 text-[10px] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                              onClick={() => {
                                if (managePresetSquad) {
                                  setManagePresetSquad({
                                    ...managePresetSquad,
                                    players: managePresetSquad.players.filter(
                                      (item) => item.id !== player.id
                                    ),
                                  });
                                  return;
                                }
                                if (manageSquad) {
                                  removeSquadPlayer(manageSquad.id, player.id);
                                }
                              }}
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
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-[var(--ink-1)]">
                      No squad data available.
                    </p>
                  )}
                </div>
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
                onClick={() => setShareLinkOpen(false)}
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
                  const result = await createProjectShareLink(project);
                  if (!result.ok) {
                    setShareLinkStatus(result.error);
                    return;
                  }
                  const url = `${window.location.origin}/share/${result.token}`;
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
                        await navigator.clipboard.writeText(shareLinkUrl);
                      }}
                    >
                      Copy
                    </button>
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
              {activeBoard.pitchView === "FULL" && (
                <div>
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
