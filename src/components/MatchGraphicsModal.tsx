"use client";

import { useEffect, useMemo, useState } from "react";
import type { Board, PlayerToken, Project, Squad, SquadPlayer } from "@/models";
import { can } from "@/utils/plan";
import { getBoardSquads } from "@/utils/board";
import { useProjectStore } from "@/state/useProjectStore";
import { useEditorStore } from "@/state/useEditorStore";
import { getStageRef } from "@/utils/stageRef";
import { getPitchViewBounds } from "@/board/pitch/Pitch";
import { withTemporaryBoardCaptureState } from "@/utils/temporaryBoardCapture";

type MatchGraphicsModalProps = {
  open: boolean;
  onClose: () => void;
  project: Project;
  board: Board;
};

type ExportSide = "home" | "away";
type GraphicTheme = "ember" | "royal" | "clean";
type GraphicFormat = "poster" | "square";
type LineupLayout = "panel" | "pitch";
type GraphicTemplate = "matchday" | "starting-xi" | "match-squad";
type GraphicPreset = "club-default" | "royal-night" | "editorial-light";

type PresentPlayer = {
  player: SquadPlayer;
  token: PlayerToken;
};

type GraphicsTextConfig = {
  fixtureLine: string;
  matchSquadTitle: string;
  lineupTitle: string;
  competitionLine: string;
  footerLine: string;
  theme: GraphicTheme;
  format: GraphicFormat;
  lineupLayout: LineupLayout;
  opponent: string;
  matchTime: string;
  venue: string;
  showBenchOnPitch: boolean;
  heroImageUrl?: string;
};

const TEXT_LIMITS = {
  fixtureLine: 48,
  competitionLine: 32,
  opponent: 24,
  matchTime: 20,
  venue: 24,
  matchSquadTitle: 18,
  lineupTitle: 18,
  footerLine: 32,
} as const;

const clampText = (value: string, max: number) => value.slice(0, max).trimStart();

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image."));
    image.src = src;
  });

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "graphic";

const downloadDataUrl = (dataUrl: string, filename: string) => {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
};

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
      return;
    }
    current = next;
  });
  if (current) {
    lines.push(current);
  }
  return lines;
};

const fillWrappedText = (params: {
  ctx: CanvasRenderingContext2D;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  lineHeight: number;
  maxLines?: number;
}) => {
  const { ctx, text, x, y, maxWidth, lineHeight, maxLines } = params;
  const lines = wrapText(ctx, text, maxWidth);
  const limited = typeof maxLines === "number" ? lines.slice(0, maxLines) : lines;
  limited.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  return limited.length;
};

const drawSoftHexPattern = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stroke: string
) => {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 2;
  const size = 28;
  const hexHeight = Math.sqrt(3) * size;
  for (let row = -1; row < height / hexHeight + 2; row += 1) {
    for (let col = -1; col < width / (size * 1.5) + 2; col += 1) {
      const offsetX = col * size * 1.5 + (row % 2 === 0 ? 0 : size * 0.75);
      const offsetY = row * hexHeight * 0.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI / 3) * i + Math.PI / 6;
        const x = offsetX + size * Math.cos(angle);
        const y = offsetY + size * Math.sin(angle);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
};

const drawLogo = async (
  ctx: CanvasRenderingContext2D,
  logoUrl: string | undefined,
  x: number,
  y: number,
  size: number
) => {
  if (!logoUrl) {
    return;
  }
  try {
    const image = await loadImage(logoUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, x, y, size, size);
    ctx.restore();
  } catch {
    // Ignore logo load errors for export.
  }
};

const drawRoundedImage = async (params: {
  ctx: CanvasRenderingContext2D;
  imageUrl?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
}) => {
  const { ctx, imageUrl, x, y, width, height, radius = Math.min(width, height) / 2 } =
    params;
  if (!imageUrl) {
    return false;
  }
  try {
    const image = await loadImage(imageUrl);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, x, y, width, height);
    ctx.restore();
    return true;
  } catch {
    return false;
  }
};

const drawPlayerPhotoBadge = async (params: {
  ctx: CanvasRenderingContext2D;
  imageUrl?: string;
  x: number;
  y: number;
  size: number;
  accent: string;
}) => {
  const { ctx, imageUrl, x, y, size, accent } = params;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const loaded = await drawRoundedImage({
    ctx,
    imageUrl,
    x,
    y,
    width: size,
    height: size,
    radius: size / 2,
  });
  if (!loaded) {
    ctx.save();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};

const getThemePalette = (
  squad: Squad,
  theme: GraphicTheme
) => {
  const shirt = squad.kit.shirt || "#12343b";
  const secondary = squad.kit.shirtSecondary || "#f5d06a";
  if (theme === "royal") {
    return {
      base: "#07182a",
      accent: secondary,
      strong: shirt,
      surface: "#0d2d4a",
      text: "#f4f1e7",
      muted: "rgba(244,241,231,0.72)",
    };
  }
  if (theme === "clean") {
    return {
      base: "#f4efe7",
      accent: shirt,
      strong: secondary,
      surface: "#ffffff",
      text: "#1b1a17",
      muted: "rgba(27,26,23,0.68)",
    };
  }
  return {
    base: "#120d11",
    accent: secondary,
    strong: shirt,
    surface: "#2d1520",
    text: "#f6f1e8",
    muted: "rgba(246,241,232,0.74)",
  };
};

const getGraphicSize = (format: GraphicFormat) =>
  format === "square"
    ? { width: 1080, height: 1080 }
    : { width: 1080, height: 1350 };

const getBoardCaptureBounds = (board: Board) => {
  const pitchBounds = getPitchViewBounds(board.pitchView);
  const viewRotation =
    board.pitchView === "DEF_HALF" || board.pitchView === "OFF_HALF" ? -90 : 0;
  return viewRotation === 0
    ? pitchBounds
    : {
        x: pitchBounds.x + pitchBounds.width / 2 - pitchBounds.height / 2,
        y: pitchBounds.y + pitchBounds.height / 2 - pitchBounds.width / 2,
        width: pitchBounds.height,
        height: pitchBounds.width,
      };
};

const formatMetaLine = (parts: string[]) => parts.filter(Boolean).join("  •  ");

const captureBoardImage = async (board: Board, setActiveFrameIndex: (boardId: string, index: number) => void) => {
  const stage = getStageRef();
  if (!stage) {
    return null;
  }
  const editorState = useEditorStore.getState();
  return withTemporaryBoardCaptureState({
    board,
    editorState,
    setActiveFrameIndex,
    run: async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const effectiveBounds = getBoardCaptureBounds(board);
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
        ctx.drawImage(layerCanvas, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
      });
      return canvas.toDataURL("image/png");
    },
  });
};

const renderMatchSquadGraphic = async (params: {
  project: Project;
  board: Board;
  squad: Squad;
  starters: PresentPlayer[];
  substitutes: PresentPlayer[];
  text: GraphicsTextConfig;
}) => {
  const { project, board, squad, starters, substitutes, text } = params;
  const { width, height } = getGraphicSize(text.format);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create export canvas.");
  }

  const palette = getThemePalette(squad, text.theme);
  const dark = palette.base;

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, dark);
  gradient.addColorStop(0.48, palette.strong);
  gradient.addColorStop(1, palette.surface);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawSoftHexPattern(
    ctx,
    width,
    height,
    text.theme === "clean" ? "#000000" : "#ffffff"
  );

  ctx.fillStyle = text.theme === "clean" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.moveTo(width * 0.61, 0);
  ctx.lineTo(width, 0);
  ctx.lineTo(width, height);
  ctx.lineTo(width * 0.46, height);
  ctx.closePath();
  ctx.fill();

  const leftPad = 72;
  const topPad = 66;
  const headerWidth = text.format === "square" ? 560 : 590;
  const heroBlockWidth = text.format === "square" ? 300 : 340;
  const heroX = width - heroBlockWidth - 62;
  ctx.fillStyle = palette.accent;
  ctx.fillRect(leftPad, topPad, 220, 10);
  ctx.fillStyle = palette.text;
  ctx.font = text.format === "square" ? "900 92px Arial" : "900 106px Arial";
  const titleLineCount = fillWrappedText({
    ctx,
    text: text.matchSquadTitle.toUpperCase(),
    x: leftPad,
    y: topPad + 110,
    maxWidth: headerWidth,
    lineHeight: text.format === "square" ? 82 : 94,
    maxLines: 2,
  });
  const competitionY = topPad + 110 + titleLineCount * (text.format === "square" ? 82 : 94) - 6;

  ctx.fillStyle = palette.muted;
  ctx.font = "700 22px Arial";
  ctx.fillText(text.competitionLine.toUpperCase(), leftPad + 4, competitionY);
  ctx.font = "500 24px Arial";
  const fixtureLineCount = fillWrappedText({
    ctx,
    text: text.fixtureLine || `${project.name} • ${board.name}`,
    x: leftPad + 4,
    y: competitionY + 38,
    maxWidth: headerWidth,
    lineHeight: 30,
    maxLines: 3,
  });
  let metaTop = competitionY + 38 + fixtureLineCount * 30 + 16;
  const metaLine = formatMetaLine([text.opponent, text.matchTime, text.venue]);
  if (metaLine) {
    ctx.fillStyle = palette.text;
    ctx.font = "600 20px Arial";
    const metaLineCount = fillWrappedText({
      ctx,
      text: metaLine,
      x: leftPad + 4,
      y: metaTop,
      maxWidth: headerWidth,
      lineHeight: 24,
      maxLines: 2,
    });
    metaTop += metaLineCount * 24 + 10;
  }

  ctx.fillStyle = text.theme === "clean" ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.roundRect(heroX, topPad, heroBlockWidth, text.format === "square" ? 310 : 360, 30);
  ctx.fill();

  await drawLogo(ctx, squad.clubLogo, heroX + 24, topPad + 24, text.format === "square" ? 140 : 160);
  const photoPlayers = [...starters, ...substitutes].filter(
    (entry, index, list) =>
      !!entry.player.photoUrl &&
      list.findIndex((candidate) => candidate.player.id === entry.player.id) === index
  );
  if (photoPlayers.length > 0) {
    const photoCount = text.format === "square" ? Math.min(2, photoPlayers.length) : Math.min(2, photoPlayers.length);
    for (let index = 0; index < photoCount; index += 1) {
      await drawPlayerPhotoBadge({
        ctx,
        imageUrl: photoPlayers[index]?.player.photoUrl,
        x: heroX + heroBlockWidth - (text.format === "square" ? 122 : 142) - index * (text.format === "square" ? 118 : 126),
        y: text.format === "square" ? topPad + 140 : topPad + 176,
        size: text.format === "square" ? 110 : 128,
        accent: palette.accent,
      });
    }
  }
  ctx.fillStyle = palette.text;
  ctx.font = "700 18px Arial";
  ctx.fillText((squad.name || board.name).toUpperCase(), heroX + 24, topPad + (text.format === "square" ? 196 : 218));
  ctx.fillStyle = palette.muted;
  ctx.font = "600 14px Arial";
  ctx.fillText(`${starters.length + substitutes.length} players selected`, heroX + 24, topPad + (text.format === "square" ? 224 : 246));

  const startersBlock = starters.map((entry) => {
    const prefix = entry.player.number ? `${entry.player.number} ` : "";
    return `${prefix}${entry.player.name}`.toUpperCase();
  });
  const subsBlock = substitutes.map((entry) => {
    const prefix = entry.player.number ? `${entry.player.number} ` : "";
    return `${prefix}${entry.player.name}`.toUpperCase();
  });

  ctx.fillStyle = text.theme === "clean" ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.1)";
  const listTop = Math.max(text.format === "square" ? 430 : 500, metaTop + 28);
  const listHeight = Math.max(320, height - listTop - 170);
  ctx.beginPath();
  ctx.roundRect(62, listTop, width - 124, listHeight, 34);
  ctx.fill();

  ctx.fillStyle = palette.text;
  ctx.font = "700 18px Arial";
  ctx.fillText("SELECTED MATCHDAY SQUAD", 84, listTop + 48);

  const numberX = 86;
  const nameX = 152;
  const listWidth = width - 124;
  const startersColumnWidth = text.format === "square" ? listWidth - 84 : Math.min(580, listWidth - 84);
  const subsX = text.format === "square" ? 82 : 82 + startersColumnWidth + 34;
  const subsWidth = text.format === "square" ? listWidth - 64 : listWidth - startersColumnWidth - 68;
  ctx.font = "700 34px Arial";
  let y = listTop + 104;
  startersBlock.forEach((line, index) => {
    ctx.fillStyle = palette.accent;
    ctx.fillText(`${String(index + 1).padStart(2, "0")}`, numberX, y);
    ctx.fillStyle = palette.text;
    fillWrappedText({
      ctx,
      text: line,
      x: nameX,
      y,
      maxWidth: startersColumnWidth - 70,
      lineHeight: 28,
      maxLines: 2,
    });
    y += 48;
  });

  if (subsBlock.length > 0) {
    ctx.fillStyle = palette.accent;
    ctx.font = "800 30px Arial";
    const subsTitleY = text.format === "square" ? y + 18 : listTop + 104;
    ctx.fillText("SUBS", subsX, subsTitleY);
    let subsY = subsTitleY + 42;
    ctx.fillStyle = palette.text;
    ctx.font = "600 24px Arial";
    subsBlock.forEach((line) => {
      const usedLines = fillWrappedText({
        ctx,
        text: line,
        x: subsX,
        y: subsY,
        maxWidth: subsWidth,
        lineHeight: 24,
        maxLines: 2,
      });
      subsY += usedLines * 24 + 12;
    });
  }

  ctx.fillStyle = text.theme === "clean" ? "rgba(27,26,23,0.18)" : "rgba(255,255,255,0.12)";
  ctx.fillRect(72, height - 160, width - 144, 2);
  ctx.fillStyle = palette.muted;
  ctx.font = "600 24px Arial";
  ctx.fillText(text.footerLine || "Generated in TacticsBoard", 72, height - 110);

  return canvas.toDataURL("image/png");
};

const renderStartingXiGraphic = async (params: {
  project: Project;
  board: Board;
  squad: Squad;
  starters: PresentPlayer[];
  substitutes: PresentPlayer[];
  boardImage: string | null;
  text: GraphicsTextConfig;
}) => {
  const { project, board, squad, starters, substitutes, boardImage, text } = params;
  const { width, height } = getGraphicSize(text.format);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create export canvas.");
  }

  const palette = getThemePalette(squad, text.theme);
  const cardInset = 56;
  const titleX = 70;
  const titleMaxWidth = text.format === "square" ? 540 : 600;

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette.strong);
  gradient.addColorStop(1, palette.base);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = text.theme === "clean" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)";
  for (let i = -100; i < width + 100; i += 140) {
    ctx.beginPath();
    ctx.arc(i, 100, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(i + 60, height - 120, 64, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = palette.accent;
  ctx.fillRect(titleX, 54, 220, 10);
  ctx.fillStyle = palette.text;
  ctx.font = text.format === "square" ? "900 84px Arial" : "900 100px Arial";
  const titleLineCount = fillWrappedText({
    ctx,
    text: text.lineupTitle.toUpperCase(),
    x: titleX,
    y: 148,
    maxWidth: titleMaxWidth,
    lineHeight: text.format === "square" ? 76 : 92,
    maxLines: 2,
  });
  const competitionY = 148 + titleLineCount * (text.format === "square" ? 76 : 92) - 6;
  ctx.fillStyle = palette.muted;
  ctx.font = "700 24px Arial";
  ctx.fillText(text.competitionLine.toUpperCase(), titleX + 4, competitionY);
  ctx.font = "500 24px Arial";
  const fixtureLineCount = fillWrappedText({
    ctx,
    text: text.fixtureLine || `${project.name} • ${board.name}`,
    x: titleX + 4,
    y: competitionY + 36,
    maxWidth: titleMaxWidth + 20,
    lineHeight: 28,
    maxLines: 3,
  });
  let metaTop = competitionY + 36 + fixtureLineCount * 28 + 18;
  const metaLine = formatMetaLine([text.opponent, text.matchTime, text.venue]);
  if (metaLine) {
    ctx.fillStyle = palette.text;
    ctx.font = "600 20px Arial";
    const metaLineCount = fillWrappedText({
      ctx,
      text: metaLine,
      x: titleX + 4,
      y: metaTop,
      maxWidth: titleMaxWidth + 20,
      lineHeight: 24,
      maxLines: 2,
    });
    metaTop += metaLineCount * 24 + 18;
  }

  await drawLogo(
    ctx,
    squad.clubLogo,
    width - (text.format === "square" ? 184 : 240),
    56,
    text.format === "square" ? 128 : 170
  );

  const boardTop = Math.max(text.format === "square" ? 360 : 320, metaTop + 14);
  const boardBottomInset = text.lineupLayout === "pitch" || substitutes.length === 0 ? 72 : 160;
  const boardFrame = {
    x: cardInset,
    y: boardTop,
    width: width - cardInset * 2,
    height: Math.max(420, height - boardTop - boardBottomInset),
  };

  ctx.save();
  ctx.fillStyle = text.theme === "clean" ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.24)";
  ctx.beginPath();
  ctx.roundRect(boardFrame.x, boardFrame.y, boardFrame.width, boardFrame.height, 34);
  ctx.fill();
  ctx.restore();

  if (boardImage && text.lineupLayout === "pitch") {
    try {
      const image = await loadImage(boardImage);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(boardFrame.x + 16, boardFrame.y + 16, boardFrame.width - 32, boardFrame.height - 32, 28);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(image, boardFrame.x + 16, boardFrame.y + 16, boardFrame.width - 32, boardFrame.height - 32);
      ctx.restore();
    } catch {
      // Ignore and fall back to panel only.
    }
  }

  const photoHero = text.heroImageUrl;
  if (photoHero && text.format === "poster") {
    await drawRoundedImage({
      ctx,
      imageUrl: photoHero,
      x: width - 292,
      y: height - 468,
      width: 220,
      height: 300,
      radius: 26,
    });
  }

  if (text.lineupLayout === "panel") {
    const listPane = {
      x: boardFrame.x + 16,
      y: boardFrame.y + 16,
      width: text.format === "square" ? 330 : 360,
      height: boardFrame.height - 32,
    };
    const pitchPane = {
      x: listPane.x + listPane.width + 16,
      y: boardFrame.y + 16,
      width: boardFrame.width - listPane.width - 48,
      height: boardFrame.height - 32,
    };

    ctx.fillStyle = text.theme === "clean" ? "rgba(27,26,23,0.18)" : "rgba(8,21,23,0.48)";
    ctx.beginPath();
    ctx.roundRect(listPane.x, listPane.y, listPane.width, listPane.height, 24);
    ctx.fill();

    if (boardImage) {
      try {
        const image = await loadImage(boardImage);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(pitchPane.x, pitchPane.y, pitchPane.width, pitchPane.height, 24);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(image, pitchPane.x, pitchPane.y, pitchPane.width, pitchPane.height);
        ctx.restore();
      } catch {
        // Ignore and keep panel background only.
      }
    }

    ctx.fillStyle = palette.text;
    ctx.font = "700 32px Arial";
    let y = listPane.y + 62;
    starters.forEach((entry, index) => {
      const number = entry.player.number ? `${entry.player.number}` : `${index + 1}`;
      ctx.fillStyle = palette.accent;
      ctx.fillText(number.padStart(2, "0"), listPane.x + 26, y);
      ctx.fillStyle = palette.text;
      fillWrappedText({
        ctx,
        text: entry.player.name.toUpperCase(),
        x: listPane.x + 84,
        y,
        maxWidth: listPane.width - 106,
        lineHeight: 28,
        maxLines: 2,
      });
      y += 54;
    });
  } else {
    const bounds = getBoardCaptureBounds(board);
    const imageX = boardFrame.x + 16;
    const imageY = boardFrame.y + 16;
    const imageW = boardFrame.width - 32;
    const imageH = boardFrame.height - 32;
    const drawPitchLabels = (
      entries: PresentPlayer[],
      options: {
        cardWidth: number;
        yOffset: number;
        fill: string;
        textColor: string;
        numberColor: string;
      }
    ) => {
      ctx.textAlign = "center";
      entries.forEach((entry, index) => {
        const relativeX = (entry.token.position.x - bounds.x) / Math.max(bounds.width, 1);
        const relativeY = (entry.token.position.y - bounds.y) / Math.max(bounds.height, 1);
        const x = imageX + Math.min(Math.max(relativeX, 0), 1) * imageW;
        const y = imageY + Math.min(Math.max(relativeY, 0), 1) * imageH + options.yOffset;
        const label = `${entry.player.number ? `${entry.player.number} ` : ""}${entry.player.name}`.toUpperCase();
        ctx.fillStyle = options.fill;
        ctx.beginPath();
        ctx.roundRect(x - options.cardWidth / 2, y + 20, options.cardWidth, 34, 16);
        ctx.fill();
        ctx.fillStyle = options.numberColor;
        ctx.font = "800 14px Arial";
        ctx.fillText(
          `${entry.player.number ? `${entry.player.number}` : String(index + 1).padStart(2, "0")}`,
          x,
          y + 7
        );
        ctx.fillStyle = options.textColor;
        ctx.font = "700 16px Arial";
        ctx.textAlign = "left";
        fillWrappedText({
          ctx,
          text: label,
          x: x - options.cardWidth / 2 + 10,
          y: y + 43,
          maxWidth: options.cardWidth - 20,
          lineHeight: 16,
          maxLines: 1,
        });
        ctx.textAlign = "center";
      });
      ctx.textAlign = "left";
    };

    drawPitchLabels(starters, {
      cardWidth: 180,
      yOffset: 0,
      fill: "rgba(0,0,0,0.42)",
      textColor: "#ffffff",
      numberColor: palette.accent,
    });
    if (text.showBenchOnPitch && substitutes.length > 0) {
      drawPitchLabels(substitutes, {
        cardWidth: 164,
        yOffset: 58,
        fill: "rgba(8,21,23,0.78)",
        textColor: "#f4f1e7",
        numberColor: palette.accent,
      });
    }
  }

  if (substitutes.length > 0 && (text.lineupLayout === "panel" || !text.showBenchOnPitch)) {
    let y = text.format === "square" ? height - 118 : 1138;
    ctx.fillStyle = palette.accent;
    ctx.font = "800 28px Arial";
    ctx.fillText("BENCH", 74, y);
    y += 36;
    ctx.fillStyle = palette.text;
    ctx.font = "600 22px Arial";
    const benchLine = substitutes
      .map((entry) =>
        `${entry.player.number ? `${entry.player.number} ` : ""}${entry.player.name}`
      )
      .join("   ")
      .toUpperCase();
    const maxWidth = 930;
    const words = benchLine.split(/\s+/);
    let row = "";
    words.forEach((word, index) => {
      const next = row ? `${row} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth) {
        ctx.fillText(row, 74, y);
        y += 30;
        row = word;
      } else {
        row = next;
      }
      if (index === words.length - 1 && row) {
        ctx.fillText(row, 74, y);
      }
    });
  }

  return canvas.toDataURL("image/png");
};

export default function MatchGraphicsModal({
  open,
  onClose,
  project,
  board,
}: MatchGraphicsModalProps) {
  const plan = useProjectStore((state) => state.plan);
  const setActiveFrameIndex = useProjectStore((state) => state.setActiveFrameIndex);
  const [side, setSide] = useState<ExportSide>("home");
  const [template, setTemplate] = useState<GraphicTemplate>("matchday");
  const [preset, setPreset] = useState<GraphicPreset>("club-default");
  const [includeLineup, setIncludeLineup] = useState(true);
  const [exportBothFormats, setExportBothFormats] = useState(false);
  const [theme, setTheme] = useState<GraphicTheme>("ember");
  const [format, setFormat] = useState<GraphicFormat>("poster");
  const [lineupLayout, setLineupLayout] = useState<LineupLayout>("panel");
  const [showBenchOnPitch, setShowBenchOnPitch] = useState(false);
  const [fixtureLine, setFixtureLine] = useState(`${project.name} • ${board.name}`);
  const [competitionLine, setCompetitionLine] = useState(project.name);
  const [opponent, setOpponent] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [venue, setVenue] = useState("");
  const [matchSquadTitle, setMatchSquadTitle] = useState("Match Squad");
  const [lineupTitle, setLineupTitle] = useState("Starting XI");
  const [footerLine, setFooterLine] = useState("Generated in TacticsBoard");
  const [heroPlayerId, setHeroPlayerId] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [matchPreviewUrl, setMatchPreviewUrl] = useState<string | null>(null);
  const [lineupPreviewUrl, setLineupPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const boardSquads = useMemo(() => getBoardSquads(project, board), [project, board]);
  const availableSides = [
    boardSquads.home ? "home" : null,
    boardSquads.away ? "away" : null,
  ].filter(Boolean) as ExportSide[];
  const selectedSquad = side === "home" ? boardSquads.home : boardSquads.away;

  useEffect(() => {
    if (availableSides.length === 0) {
      return;
    }
    if (!availableSides.includes(side)) {
      setSide(availableSides[0]);
    }
  }, [availableSides, side]);

  useEffect(() => {
    if (template === "matchday") {
      setTheme("ember");
      setFormat("poster");
      setLineupLayout("panel");
      setMatchSquadTitle("Match Squad");
      setLineupTitle("Starting XI");
      return;
    }
    if (template === "starting-xi") {
      setTheme("royal");
      setFormat("poster");
      setLineupLayout("pitch");
      setIncludeLineup(true);
      setMatchSquadTitle("Match Squad");
      setLineupTitle("Starting XI");
      return;
    }
    setTheme("clean");
    setFormat("square");
    setLineupLayout("panel");
    setMatchSquadTitle("Match Squad");
    setLineupTitle("Line Up");
  }, [template]);

  useEffect(() => {
    if (preset === "club-default") {
      return;
    }
    if (preset === "royal-night") {
      setTheme("royal");
      return;
    }
    setTheme("clean");
  }, [preset]);

  const present = useMemo(() => {
    if (!selectedSquad) {
      return { starters: [] as PresentPlayer[], substitutes: [] as PresentPlayer[] };
    }
    const playerIds = new Set(selectedSquad.players.map((player) => player.id));
    const tokens = (board.frames[board.activeFrameIndex]?.objects ?? [])
      .filter((item): item is PlayerToken => item.type === "player")
      .filter((item) => item.squadPlayerId && playerIds.has(item.squadPlayerId));
    const tokenByPlayerId = new Map<string, PlayerToken>();
    tokens.forEach((token) => {
      if (token.squadPlayerId && !tokenByPlayerId.has(token.squadPlayerId)) {
        tokenByPlayerId.set(token.squadPlayerId, token);
      }
    });
    const presentPlayers = selectedSquad.players
      .filter((player) => tokenByPlayerId.has(player.id))
      .map((player) => ({
        player,
        token: tokenByPlayerId.get(player.id)!,
      }));
    const substituteIds = new Set(selectedSquad.substituteIds ?? []);
    const starters = presentPlayers
      .filter((entry) => !substituteIds.has(entry.player.id))
      .sort((a, b) => a.token.position.y - b.token.position.y || a.token.position.x - b.token.position.x);
    const substitutes = presentPlayers.filter((entry) => substituteIds.has(entry.player.id));
    return { starters, substitutes };
  }, [board, selectedSquad]);

  const allPresentPlayers = useMemo(
    () => [...present.starters, ...present.substitutes],
    [present.starters, present.substitutes]
  );
  const heroCandidates = useMemo(
    () => allPresentPlayers.filter((entry) => !!entry.player.photoUrl),
    [allPresentPlayers]
  );

  useEffect(() => {
    if (heroCandidates.length === 0) {
      if (heroPlayerId) {
        setHeroPlayerId("");
      }
      return;
    }
    if (!heroCandidates.some((entry) => entry.player.id === heroPlayerId)) {
      setHeroPlayerId(heroCandidates[0]?.player.id ?? "");
    }
  }, [heroCandidates, heroPlayerId]);

  const heroImageUrl =
    heroCandidates.find((entry) => entry.player.id === heroPlayerId)?.player.photoUrl ??
    heroCandidates[0]?.player.photoUrl;

  const buildTextConfig = (exportFormat: GraphicFormat): GraphicsTextConfig => ({
    fixtureLine: clampText(fixtureLine, TEXT_LIMITS.fixtureLine),
    matchSquadTitle: clampText(matchSquadTitle, TEXT_LIMITS.matchSquadTitle),
    lineupTitle: clampText(lineupTitle, TEXT_LIMITS.lineupTitle),
    competitionLine: clampText(competitionLine, TEXT_LIMITS.competitionLine),
    footerLine: clampText(footerLine, TEXT_LIMITS.footerLine),
    theme,
    format: exportFormat,
    lineupLayout,
    opponent: clampText(opponent, TEXT_LIMITS.opponent),
    matchTime: clampText(matchTime, TEXT_LIMITS.matchTime),
    venue: clampText(venue, TEXT_LIMITS.venue),
    showBenchOnPitch,
    heroImageUrl,
  });

  useEffect(() => {
    if (!open || !selectedSquad || allPresentPlayers.length === 0) {
      setMatchPreviewUrl(null);
      setLineupPreviewUrl(null);
      setPreviewBusy(false);
      return;
    }
    let cancelled = false;
    setPreviewBusy(true);
    void (async () => {
      try {
        const textConfig = buildTextConfig(format);
        const matchPreview = await renderMatchSquadGraphic({
          project,
          board,
          squad: selectedSquad,
          starters: present.starters,
          substitutes: present.substitutes,
          text: textConfig,
        });
        if (cancelled) {
          return;
        }
        setMatchPreviewUrl(matchPreview);
        if (includeLineup && present.starters.length > 0) {
          const boardImage = await captureBoardImage(board, setActiveFrameIndex);
          if (cancelled) {
            return;
          }
          const lineupPreview = await renderStartingXiGraphic({
            project,
            board,
            squad: selectedSquad,
            starters: present.starters,
            substitutes: present.substitutes,
            boardImage,
            text: textConfig,
          });
          if (!cancelled) {
            setLineupPreviewUrl(lineupPreview);
          }
        } else if (!cancelled) {
          setLineupPreviewUrl(null);
        }
      } catch {
        if (!cancelled) {
          setMatchPreviewUrl(null);
          setLineupPreviewUrl(null);
        }
      } finally {
        if (!cancelled) {
          setPreviewBusy(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    selectedSquad,
    allPresentPlayers.length,
    includeLineup,
    present.starters,
    present.substitutes,
    project,
    board,
    format,
    fixtureLine,
    matchSquadTitle,
    lineupTitle,
    competitionLine,
    footerLine,
    theme,
    lineupLayout,
    opponent,
    matchTime,
    venue,
    showBenchOnPitch,
    heroImageUrl,
    setActiveFrameIndex,
  ]);

  const onDownload = async () => {
    if (!selectedSquad) {
      setStatus("Choose a side with a linked squad first.");
      return;
    }
    if (allPresentPlayers.length === 0) {
      setStatus("No linked squad players from this side are currently placed on the board.");
      return;
    }
    if (!can(plan, "squad.export")) {
      setStatus("Squad export is available on paid plans.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const safeBase = `${slugify(project.name)}-${slugify(board.name)}-${side}`;
      const formats = exportBothFormats
        ? (["poster", "square"] as const)
        : ([format] as const);
      const boardImage =
        includeLineup && present.starters.length > 0
          ? await captureBoardImage(board, setActiveFrameIndex)
          : null;

      for (const exportFormat of formats) {
        const textConfig = buildTextConfig(exportFormat);
        const squadImage = await renderMatchSquadGraphic({
          project,
          board,
          squad: selectedSquad,
          starters: present.starters,
          substitutes: present.substitutes,
          text: textConfig,
        });
        downloadDataUrl(squadImage, `${safeBase}-${exportFormat}-match-squad.png`);

        if (includeLineup && present.starters.length > 0) {
          const lineupImage = await renderStartingXiGraphic({
            project,
            board,
            squad: selectedSquad,
            starters: present.starters,
            substitutes: present.substitutes,
            boardImage,
            text: textConfig,
          });
          downloadDataUrl(lineupImage, `${safeBase}-${exportFormat}-starting-xi.png`);
        }
      }

      setStatus(
        exportBothFormats
          ? includeLineup
            ? "Poster and square graphics exported."
            : "Poster and square match squad graphics exported."
          : includeLineup
            ? "Match squad and lineup exported."
            : "Match squad exported."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[560] flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="display-font text-2xl text-[var(--accent-0)]">
              Match Graphics Export
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-1)]">
              Create a match squad graphic from players currently placed on this board,
              and optionally export a Starting XI poster using the current board layout.
            </p>
          </div>
          <button
            className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/40 p-4">
            <p className="text-[11px] uppercase tracking-widest text-[var(--accent-0)]">
              Export Setup
            </p>
            <div className="mt-4 grid gap-3">
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                  Template
                </span>
                <select
                  className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--ink-0)]"
                  value={template}
                  onChange={(event) => setTemplate(event.target.value as GraphicTemplate)}
                >
                  <option value="matchday">Matchday</option>
                  <option value="starting-xi">Starting XI</option>
                  <option value="match-squad">Match Squad</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                  Style preset
                </span>
                <select
                  className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--ink-0)]"
                  value={preset}
                  onChange={(event) => setPreset(event.target.value as GraphicPreset)}
                >
                  <option value="club-default">Club default</option>
                  <option value="royal-night">Royal night</option>
                  <option value="editorial-light">Editorial light</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                  Side
                </span>
                <select
                  className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--ink-0)]"
                  value={side}
                  onChange={(event) => setSide(event.target.value as ExportSide)}
                >
                  {availableSides.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry === "home" ? "Home squad" : "Away squad"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--ink-0)]">
                <input
                  type="checkbox"
                  checked={includeLineup}
                  onChange={(event) => setIncludeLineup(event.target.checked)}
                />
                <span>Also export Starting XI from the current board layout</span>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--ink-0)]">
                <input
                  type="checkbox"
                  checked={exportBothFormats}
                  onChange={(event) => setExportBothFormats(event.target.checked)}
                />
                <span>Export both poster and square in one click</span>
              </label>
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                  Poster style
                </span>
                <select
                  className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--ink-0)]"
                  value={theme}
                  onChange={(event) => setTheme(event.target.value as GraphicTheme)}
                >
                  <option value="ember">Ember</option>
                  <option value="royal">Royal</option>
                  <option value="clean">Clean</option>
                </select>
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                    Format
                  </span>
                  <select
                    className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--ink-0)]"
                    value={format}
                    onChange={(event) => setFormat(event.target.value as GraphicFormat)}
                  >
                    <option value="poster">Portrait poster</option>
                    <option value="square">Square social</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                    Starting XI layout
                  </span>
                  <select
                    className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--ink-0)]"
                    value={lineupLayout}
                    onChange={(event) => setLineupLayout(event.target.value as LineupLayout)}
                    disabled={!includeLineup}
                  >
                    <option value="panel">Side panel list</option>
                    <option value="pitch">Names on pitch</option>
                  </select>
                  <p className="px-1 text-[11px] text-[var(--ink-1)]">
                    `Side panel list` keeps names in a separate column. `Names on pitch` removes the big list and labels the formation directly on the board.
                  </p>
                </label>
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--ink-0)]">
                <input
                  type="checkbox"
                  checked={showBenchOnPitch}
                  onChange={(event) => setShowBenchOnPitch(event.target.checked)}
                  disabled={!includeLineup || lineupLayout !== "pitch"}
                />
                <span>Also place bench players on pitch layout</span>
              </label>
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                  Hero player image
                </span>
                <select
                  className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--ink-0)]"
                  value={heroPlayerId}
                  onChange={(event) => setHeroPlayerId(event.target.value)}
                  disabled={heroCandidates.length === 0}
                >
                  {heroCandidates.length === 0 ? (
                    <option value="">No player photos available</option>
                  ) : null}
                  {heroCandidates.map((entry) => (
                    <option key={entry.player.id} value={entry.player.id}>
                      {entry.player.number ? `${entry.player.number} ` : ""}
                      {entry.player.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/40 p-4">
            <p className="text-[11px] uppercase tracking-widest text-[var(--accent-0)]">
              Poster Text
            </p>
            <div className="mt-4 grid gap-3">
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                  Fixture line
                </span>
                <input
                  className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 text-sm text-[var(--ink-0)]"
                  value={fixtureLine}
                  maxLength={TEXT_LIMITS.fixtureLine}
                  onChange={(event) => setFixtureLine(clampText(event.target.value, TEXT_LIMITS.fixtureLine))}
                />
                <p className="px-1 text-[11px] text-[var(--ink-1)]">
                  {fixtureLine.length}/{TEXT_LIMITS.fixtureLine}
                </p>
              </label>
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                  Competition / top line
                </span>
                <input
                  className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 text-sm text-[var(--ink-0)]"
                  value={competitionLine}
                  maxLength={TEXT_LIMITS.competitionLine}
                  onChange={(event) =>
                    setCompetitionLine(clampText(event.target.value, TEXT_LIMITS.competitionLine))
                  }
                />
                <p className="px-1 text-[11px] text-[var(--ink-1)]">
                  {competitionLine.length}/{TEXT_LIMITS.competitionLine}
                </p>
              </label>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                    Opponent
                  </span>
                  <input
                    className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 text-sm text-[var(--ink-0)]"
                    value={opponent}
                    maxLength={TEXT_LIMITS.opponent}
                    onChange={(event) => setOpponent(clampText(event.target.value, TEXT_LIMITS.opponent))}
                  />
                  <p className="px-1 text-[11px] text-[var(--ink-1)]">
                    {opponent.length}/{TEXT_LIMITS.opponent}
                  </p>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                    Match time
                  </span>
                  <input
                    className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 text-sm text-[var(--ink-0)]"
                    value={matchTime}
                    maxLength={TEXT_LIMITS.matchTime}
                    onChange={(event) => setMatchTime(clampText(event.target.value, TEXT_LIMITS.matchTime))}
                  />
                  <p className="px-1 text-[11px] text-[var(--ink-1)]">
                    {matchTime.length}/{TEXT_LIMITS.matchTime}
                  </p>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                    Arena / venue
                  </span>
                  <input
                    className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 text-sm text-[var(--ink-0)]"
                    value={venue}
                    maxLength={TEXT_LIMITS.venue}
                    onChange={(event) => setVenue(clampText(event.target.value, TEXT_LIMITS.venue))}
                  />
                  <p className="px-1 text-[11px] text-[var(--ink-1)]">
                    {venue.length}/{TEXT_LIMITS.venue}
                  </p>
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                    Match squad title
                  </span>
                  <input
                    className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 text-sm text-[var(--ink-0)]"
                    value={matchSquadTitle}
                    maxLength={TEXT_LIMITS.matchSquadTitle}
                    onChange={(event) =>
                      setMatchSquadTitle(clampText(event.target.value, TEXT_LIMITS.matchSquadTitle))
                    }
                  />
                  <p className="px-1 text-[11px] text-[var(--ink-1)]">
                    {matchSquadTitle.length}/{TEXT_LIMITS.matchSquadTitle}
                  </p>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                    Starting XI title
                  </span>
                  <input
                    className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 text-sm text-[var(--ink-0)]"
                    value={lineupTitle}
                    maxLength={TEXT_LIMITS.lineupTitle}
                    onChange={(event) =>
                      setLineupTitle(clampText(event.target.value, TEXT_LIMITS.lineupTitle))
                    }
                  />
                  <p className="px-1 text-[11px] text-[var(--ink-1)]">
                    {lineupTitle.length}/{TEXT_LIMITS.lineupTitle}
                  </p>
                </label>
              </div>
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                  Footer
                </span>
                <input
                  className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 text-sm text-[var(--ink-0)]"
                  value={footerLine}
                  maxLength={TEXT_LIMITS.footerLine}
                  onChange={(event) => setFooterLine(clampText(event.target.value, TEXT_LIMITS.footerLine))}
                />
                <p className="px-1 text-[11px] text-[var(--ink-1)]">
                  {footerLine.length}/{TEXT_LIMITS.footerLine}
                </p>
              </label>
            </div>
          </section>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/30 p-4">
            <p className="text-[11px] uppercase tracking-widest text-[var(--accent-0)]">
              Current Board Selection
            </p>
            <div className="mt-4 grid gap-3 text-sm text-[var(--ink-0)] sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                  Starters
                </div>
                <strong className="mt-2 block text-2xl">{present.starters.length}</strong>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                  Subs
                </div>
                <strong className="mt-2 block text-2xl">{present.substitutes.length}</strong>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
                <div className="text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                  Total used
                </div>
                <strong className="mt-2 block text-2xl">
                  {present.starters.length + present.substitutes.length}
                </strong>
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[12px] text-[var(--ink-1)]">
              Only linked squad players that are actually placed on the active board are included.
            </div>
          </div>
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/30 p-4">
            <p className="text-[11px] uppercase tracking-widest text-[var(--accent-0)]">
              Poster Output
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
                <p className="text-[11px] uppercase tracking-wide text-[var(--accent-0)]">
                  Match Squad
                </p>
                <p className="mt-2 text-sm text-[var(--ink-1)]">
                  Strong title card with logo, squad list and bench section.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
                <p className="text-[11px] uppercase tracking-wide text-[var(--accent-0)]">
                  Starting XI
                </p>
                <p className="mt-2 text-sm text-[var(--ink-1)]">
                  Uses the current board capture as the visual base, with either a side list or names placed directly on the pitch.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-widest text-[var(--accent-0)]">
              Live Preview
            </p>
            <p className="text-[11px] text-[var(--ink-1)]">
              {previewBusy ? "Rendering preview..." : "Preview uses the current export settings"}
            </p>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="mb-3 text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                Match Squad
              </p>
              {matchPreviewUrl ? (
                <img
                  src={matchPreviewUrl}
                  alt="Match squad preview"
                  className="w-full rounded-2xl border border-[var(--line)]"
                />
              ) : (
                <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-[var(--line)] text-sm text-[var(--ink-1)]">
                  No preview available yet
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="mb-3 text-[11px] uppercase tracking-wide text-[var(--ink-1)]">
                Starting XI
              </p>
              {lineupPreviewUrl ? (
                <img
                  src={lineupPreviewUrl}
                  alt="Starting XI preview"
                  className="w-full rounded-2xl border border-[var(--line)]"
                />
              ) : (
                <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-[var(--line)] text-sm text-[var(--ink-1)]">
                  Enable Starting XI and place starters on the board to preview it
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          {status ? (
            <p className="text-sm text-[var(--accent-1)]">{status}</p>
          ) : (
            <span />
          )}
          <button
            className="rounded-full bg-[var(--accent-0)] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onDownload}
            disabled={busy || !selectedSquad}
          >
            {busy ? "Rendering..." : includeLineup ? "Download graphics" : "Download match squad"}
          </button>
        </div>
      </div>
    </div>
  );
}
