"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Stage, Layer, Rect, Arrow, Group, Circle, Line, Text } from "react-konva";
import type {
  ArrowLine,
  BallToken,
  Board,
  ConeToken,
  DrawableObject,
  MannequinToken,
  MiniGoal,
  MovementPath,
  PoleToken,
  PlayerToken,
  ShapeCircle,
  ShapePolygon,
  ShapeRect,
  ShapeTriangle,
  TextLabel,
} from "@/models";
import Pitch, { getPitchViewBounds } from "@/board/pitch/Pitch";
import { useEditorStore } from "@/state/useEditorStore";
import { useProjectStore } from "@/state/useProjectStore";
import { clone } from "@/utils/clone";
import { createId } from "@/utils/id";
import BoardObject from "@/board/objects/BoardObject";
import { useBoardInteractions } from "@/board/useBoardInteractions";
import {
  getBoardSquads,
  getPlayerTokenLinkKey,
  resolvePlayerTokenSquadPlayer,
} from "@/utils/board";

const getLineOutlineWidth = (strokeWidth: number) =>
  Math.max(0.15, strokeWidth * 0.6);

const getArrowHeadSize = (strokeWidth: number) => {
  const base = Math.max(0.35, strokeWidth);
  return {
    length: Math.max(1.8, base * 4.2),
    width: Math.max(1.4, base * 3.2),
  };
};

const ROTATION_SNAP_STEPS = 16;
const ROTATION_SNAP_DEGREES = 360 / ROTATION_SNAP_STEPS;
const snapRotationAngle = (angle: number) =>
  Math.round(angle / ROTATION_SNAP_DEGREES) * ROTATION_SNAP_DEGREES;
const ROTATION_SNAP_HYSTERESIS_DEGREES = 4;
const SIZE_SNAP_STEP = 0.5;
const snapSizeValue = (value: number, min: number) =>
  Math.max(min, Math.round(value / SIZE_SNAP_STEP) * SIZE_SNAP_STEP);
const getProportionalDimensions = (
  targetWidth: number,
  targetHeight: number,
  baseWidth: number,
  baseHeight: number
) => {
  const safeBaseWidth = Math.max(0.001, baseWidth);
  const safeBaseHeight = Math.max(0.001, baseHeight);
  const scale = Math.max(
    targetWidth / safeBaseWidth,
    targetHeight / safeBaseHeight
  );
  return {
    width: safeBaseWidth * scale,
    height: safeBaseHeight * scale,
  };
};
const getPolygonBounds = (points: number[]) => {
  if (points.length < 2) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      width: 0,
      height: 0,
    };
  }
  let minX = points[0] ?? 0;
  let maxX = minX;
  let minY = points[1] ?? 0;
  let maxY = minY;
  for (let index = 2; index < points.length; index += 2) {
    const x = points[index] ?? 0;
    const y = points[index + 1] ?? 0;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
};
const scalePolygonPoints = (
  points: number[],
  nextWidth: number,
  nextHeight: number
) => {
  const bounds = getPolygonBounds(points);
  const baseWidth = Math.max(0.001, bounds.width);
  const baseHeight = Math.max(0.001, bounds.height);
  const scaleX = nextWidth / baseWidth;
  const scaleY = nextHeight / baseHeight;
  return points.map((value, index) =>
    index % 2 === 0
      ? bounds.minX + (value - bounds.minX) * scaleX
      : bounds.minY + (value - bounds.minY) * scaleY
  );
};
const rotateVector = (vector: { x: number; y: number }, angle: number) => {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
  };
};
const rotatePointAround = (
  point: { x: number; y: number },
  pivot: { x: number; y: number },
  angle: number
) => {
  if (angle === 0) {
    return point;
  }
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  };
};
const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const getCenterAnchoredPositionForRotation = (params: {
  position: { x: number; y: number };
  center: { x: number; y: number };
  scale: { x: number; y: number };
  fromAngle: number;
  toAngle: number;
}) => {
  const { position, center, scale, fromAngle, toAngle } = params;
  const localCenter = {
    x: center.x * scale.x,
    y: center.y * scale.y,
  };
  const fromVector = rotateVector(localCenter, fromAngle);
  const toVector = rotateVector(localCenter, toAngle);
  const centerWorld = {
    x: position.x + fromVector.x,
    y: position.y + fromVector.y,
  };
  return {
    x: centerWorld.x - toVector.x,
    y: centerWorld.y - toVector.y,
  };
};

const getRawRotationAngleFromPointer = (
  event: Konva.KonvaEventObject<DragEvent>,
  center: { x: number; y: number }
) => {
  const stage = event.target.getStage();
  const parent = event.target.getParent();
  const pointer = stage?.getPointerPosition();
  if (!pointer || !parent) {
    return null;
  }
  const centerPoint = parent.getAbsoluteTransform().point(center);
  return (
    (Math.atan2(pointer.y - centerPoint.y, pointer.x - centerPoint.x) * 180) /
      Math.PI +
    90
  );
};

type BoardCanvasProps = {
  board: Board;
  onStageReady?: (stage: Konva.Stage | null) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  readOnly?: boolean;
  forcePortrait?: boolean;
};

export default function BoardCanvas({
  board,
  onStageReady,
  isMaximized,
  onToggleMaximize,
  readOnly,
  forcePortrait,
}: BoardCanvasProps) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const shapeRefs = useRef<Record<string, Konva.Node>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsMenuRef = useRef<HTMLDivElement | null>(null);
  const rotationSnapStateRef = useRef<Record<string, number>>({});
  const wasPlayingRef = useRef(false);
  const [size, setSize] = useState({ width: 800, height: 500 });
  const [controlsMenuOpen, setControlsMenuOpen] = useState(false);
  const [objectActionMenuId, setObjectActionMenuId] = useState<string | null>(
    null
  );
  const [objectListOpen, setObjectListOpen] = useState(false);
  const [objectListSearch, setObjectListSearch] = useState("");
  const [objectListFilter, setObjectListFilter] = useState<
    "all" | DrawableObject["type"]
  >("all");
  const [objectListStatus, setObjectListStatus] = useState<string | null>(null);
  const [holdZoomAtTimelineEnd, setHoldZoomAtTimelineEnd] = useState(false);

  const activeTool = useEditorStore((state) => state.activeTool);
  const playerTokenSize = useEditorStore((state) => state.playerTokenSize);
  const playerSide = useEditorStore((state) => state.playerSide);
  const selection = useEditorStore((state) => state.selection);
  const setSelection = useEditorStore((state) => state.setSelection);
  const setSelectedLinkId = useEditorStore(
    (state) => state.setSelectedLinkId
  );
  const isHighlighting = useEditorStore((state) => state.isHighlighting);
  const viewport = useEditorStore((state) => state.viewport);
  const setViewport = useEditorStore((state) => state.setViewport);
  const pushHistory = useEditorStore((state) => state.pushHistory);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const playheadFrame = useEditorStore((state) => state.playheadFrame);
  const attachBallToPlayer = useEditorStore(
    (state) => state.attachBallToPlayer
  );
  const loopPlayback = useEditorStore((state) => state.loopPlayback);
  const isLinkingPlayers = useEditorStore((state) => state.isLinkingPlayers);
  const linkingPlayerIds = useEditorStore(
    (state) => state.linkingPlayerIds
  );
  const addLinkingPlayer = useEditorStore((state) => state.addLinkingPlayer);
  const setLinkingPlayers = useEditorStore((state) => state.setLinkingPlayers);
  const clearLinkingPlayers = useEditorStore(
    (state) => state.clearLinkingPlayers
  );
  const selectedLinkId = useEditorStore((state) => state.selectedLinkId);

  const project = useProjectStore((state) => state.project);
  const isSharedReadOnly = readOnly || (project?.isShared ?? false);
  const useCompactPlayerLabels =
    isSharedReadOnly && (!!forcePortrait || size.width <= 700);
  const isMobileViewport = !!forcePortrait || size.width <= 900;
  const mobileObjectScale = isMobileViewport ? 1.65 : 1;
  const mobileActionScale = isMobileViewport ? 1.9 : 1;
  const mobileTransformScale = isMobileViewport ? 1.6 : 1;
  const transformHandleRadius = 0.7 * mobileTransformScale;
  const transformHandleSize = 1.6 * mobileTransformScale;
  const transformHandleHalf = transformHandleSize / 2;
  const transformHandleHitStrokeWidth = isMobileViewport ? 1.8 : 1;
  const effectivePlayerTokenSize = playerTokenSize * mobileObjectScale;
  const isThreeDView = board.threeDView ?? false;
  const rawThreeDStrength =
    typeof board.threeDStrength === "number" && Number.isFinite(board.threeDStrength)
      ? board.threeDStrength
      : 55;
  const threeDStrength = Math.max(0, Math.min(100, rawThreeDStrength));
  const isCanvasReadOnly = isSharedReadOnly || isThreeDView;
  const addObject = useProjectStore((state) => state.addObject);
  const updateObject = useProjectStore((state) => state.updateObject);
  const removeObject = useProjectStore((state) => state.removeObject);
  const updateBoard = useProjectStore((state) => state.updateBoard);
  const setFrameObjects = useProjectStore((state) => state.setFrameObjects);

  const frameIndex = board.activeFrameIndex;
  const activeFrame = board.frames[frameIndex];
  const objects = board.frames[frameIndex]?.objects ?? [];
  const selectedArrows = useMemo(
    () =>
      objects.filter(
        (item) => item.type === "arrow" && selection.includes(item.id)
      ) as ArrowLine[],
    [objects, selection]
  );
  const selectedPlayers = useMemo(
    () =>
      objects.filter(
        (item) => item.type === "player" && selection.includes(item.id)
      ) as PlayerToken[],
    [objects, selection]
  );
  useEffect(() => {
    const lastIndex = Math.max(0, board.frames.length - 1);
    const atTimelineEnd =
      board.mode === "DYNAMIC" &&
      board.frames.length > 1 &&
      Math.floor(playheadFrame) >= lastIndex;
    if (isPlaying) {
      setHoldZoomAtTimelineEnd(false);
    } else if (wasPlayingRef.current && !loopPlayback && atTimelineEnd) {
      setHoldZoomAtTimelineEnd(true);
    } else if (!atTimelineEnd) {
      setHoldZoomAtTimelineEnd(false);
    }
    wasPlayingRef.current = isPlaying;
  }, [board.mode, board.frames.length, isPlaying, loopPlayback, playheadFrame]);

  const applyPlaybackEffect = useCallback((
    object: DrawableObject,
    progress: number,
    effectOverride?: DrawableObject["animation"]
  ): DrawableObject => {
    const effect = effectOverride ?? object.animation ?? "none";
    if (effect === "none") {
      return object;
    }
    const next = {
      ...object,
      style: { ...object.style },
      scale: { ...object.scale },
    } as DrawableObject;
    next.style.fxLightningStrength = 0;
    next.style.fxShimmerStrength = 0;
    next.style.fxShimmerProgress = 0;

    if (effect === "fadeIn") {
      next.style.opacity = object.style.opacity * progress;
      return next;
    }
    if (effect === "fadeOut") {
      next.style.opacity = object.style.opacity * (1 - progress);
      return next;
    }
    if (effect === "pop") {
      const factor =
        progress < 0.5
          ? 0.7 + (progress / 0.5) * 0.65
          : 1.35 - ((progress - 0.5) / 0.5) * 0.35;
      next.scale.x = object.scale.x * factor;
      next.scale.y = object.scale.y * factor;
      return next;
    }
    if (effect === "pulse") {
      const wave = Math.sin(progress * Math.PI * 4);
      const factor = 1 + wave * 0.12;
      next.scale.x = object.scale.x * factor;
      next.scale.y = object.scale.y * factor;
      return next;
    }
    if (effect === "lightning") {
      const flashAt = (center: number, width: number) => {
        const dist = Math.abs(progress - center);
        if (dist >= width) {
          return 0;
        }
        return 1 - dist / width;
      };
      // Three quick, sharp flashes to read as a clear lightning blink.
      const flashStrength = Math.min(
        1,
        Math.max(
          flashAt(0.16, 0.1),
          flashAt(0.34, 0.085),
          flashAt(0.56, 0.09)
        )
      );
      const punch = 1 + flashStrength * 0.06;
      next.scale.x = object.scale.x * punch;
      next.scale.y = object.scale.y * punch;
      next.style.fxLightningStrength = flashStrength;
      return next;
    }
    if (effect === "lightPulse") {
      // Single slower pulse using the same light channel as lightning.
      const bell = Math.sin(progress * Math.PI);
      const pulseStrength = Math.max(0, Math.min(1, bell * 0.9));
      const punch = 1 + pulseStrength * 0.04;
      next.scale.x = object.scale.x * punch;
      next.scale.y = object.scale.y * punch;
      next.style.fxLightningStrength = pulseStrength;
      return next;
    }
    if (effect === "shimmer") {
      const envelope = Math.pow(Math.sin(progress * Math.PI), 0.9);
      const shimmerStrength = Math.max(0, Math.min(1, envelope));
      next.style.fxShimmerStrength = shimmerStrength;
      next.style.fxShimmerProgress = progress;
      return next;
    }

    return next;
  }, []);
  const normalizeAngle = useCallback((angle: number) => {
    let normalized = angle % 360;
    if (normalized < 0) {
      normalized += 360;
    }
    return normalized;
  }, []);
  const shortestAngleDiff = useCallback((from: number, to: number) => {
    const a = normalizeAngle(from);
    const b = normalizeAngle(to);
    let diff = b - a;
    if (diff > 180) {
      diff -= 360;
    } else if (diff < -180) {
      diff += 360;
    }
    return diff;
  }, [normalizeAngle]);
  const clearRotationSnapState = useCallback((key: string) => {
    delete rotationSnapStateRef.current[key];
  }, []);
  const getStableSnappedRotation = useCallback(
    (rawAngle: number, key: string) => {
      const normalized = normalizeAngle(rawAngle);
      const nearest =
        Math.round(normalized / ROTATION_SNAP_DEGREES) * ROTATION_SNAP_DEGREES;
      const last = rotationSnapStateRef.current[key];
      if (!Number.isFinite(last)) {
        rotationSnapStateRef.current[key] = nearest;
        return nearest;
      }
      const distanceToLast = Math.abs(shortestAngleDiff(last, normalized));
      const holdBoundary =
        ROTATION_SNAP_DEGREES / 2 + ROTATION_SNAP_HYSTERESIS_DEGREES;
      if (distanceToLast <= holdBoundary) {
        return last;
      }
      rotationSnapStateRef.current[key] = nearest;
      return nearest;
    },
    [normalizeAngle, shortestAngleDiff]
  );
  const applyHighlightEffect = useCallback((
    object: DrawableObject,
    amount: number
  ): DrawableObject => {
    const strength = Math.max(0, Math.min(1, amount));
    if (strength <= 0) {
      return object;
    }
    const next = {
      ...object,
      style: { ...object.style },
    } as DrawableObject;
    // Runtime-only highlight channel used by renderer to draw non-interactive glow.
    next.style.outlineStroke = "#f9bf4a";
    next.style.outlineWidth = strength;
    return next;
  }, []);
  const applyArrowDrawProgress = useCallback((
    object: DrawableObject,
    amount: number
  ): DrawableObject => {
    if (object.type !== "arrow") {
      return object;
    }
    const progress = Math.max(0, Math.min(1, amount));
    return {
      ...object,
      style: {
        ...object.style,
        fxDrawProgress: progress,
      },
    } as DrawableObject;
  }, []);
  const getLightningAura = useCallback(
    (object: DrawableObject) => {
      const strength = Math.max(
        0,
        Math.min(1, Number(object.style.fxLightningStrength ?? 0))
      );
      if (strength <= 0) {
        return null;
      }
      if (object.type === "player") {
        return {
          id: object.id,
          x: object.position.x,
          y: object.position.y,
          radius: effectivePlayerTokenSize + 2.4,
          strength,
        };
      }
      if (object.type === "ball") {
        return {
          id: object.id,
          x: object.position.x,
          y: object.position.y,
          radius: Math.max(0.9, effectivePlayerTokenSize * 0.52 + 1.5),
          strength,
        };
      }
      if (object.type === "circle") {
        const circle = object as ShapeCircle;
        return {
          id: object.id,
          x: object.position.x,
          y: object.position.y,
          radius: Math.max(1.2, circle.radius + 1.2),
          strength,
        };
      }
      if (object.type === "rect") {
        const rect = object as ShapeRect;
        return {
          id: object.id,
          x: object.position.x + rect.width / 2,
          y: object.position.y + rect.height / 2,
          radius: Math.max(1.4, Math.hypot(rect.width, rect.height) * 0.56),
          strength,
        };
      }
      if (object.type === "polygon") {
        const polygon = object as ShapePolygon;
        if (polygon.points.length < 2) {
          return null;
        }
        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = 0; i < polygon.points.length; i += 2) {
          xs.push(polygon.points[i] ?? 0);
          ys.push(polygon.points[i + 1] ?? 0);
        }
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
        return {
          id: object.id,
          x: object.position.x + minX + width / 2,
          y: object.position.y + minY + height / 2,
          radius: Math.max(1.4, Math.hypot(width, height) * 0.56),
          strength,
        };
      }
      if (object.type === "triangle") {
        const tri = object as ShapeTriangle;
        return {
          id: object.id,
          x: object.position.x + tri.width / 2,
          y: object.position.y + tri.height / 2,
          radius: Math.max(1.4, Math.hypot(tri.width, tri.height) * 0.58),
          strength,
        };
      }
      if (object.type === "cone") {
        const cone = object as ConeToken;
        return {
          id: object.id,
          x: object.position.x + cone.width / 2,
          y: object.position.y + cone.height / 2,
          radius: Math.max(1.4, Math.hypot(cone.width, cone.height) * 0.56),
          strength,
        };
      }
      if (object.type === "goal") {
        const goal = object as MiniGoal;
        return {
          id: object.id,
          x: object.position.x + goal.width / 2,
          y: object.position.y + goal.height / 2,
          radius: Math.max(1.4, Math.hypot(goal.width, goal.height) * 0.56),
          strength,
        };
      }
      if (object.type === "pole") {
        const pole = object as PoleToken;
        return {
          id: object.id,
          x: object.position.x + pole.width / 2,
          y: object.position.y + pole.height / 2,
          radius: Math.max(1.1, Math.hypot(pole.width, pole.height) * 0.52),
          strength,
        };
      }
      if (object.type === "mannequin") {
        const mannequin = object as MannequinToken;
        return {
          id: object.id,
          x: object.position.x + mannequin.width / 2,
          y: object.position.y + mannequin.height / 2,
          radius: Math.max(1.3, Math.hypot(mannequin.width, mannequin.height) * 0.54),
          strength,
        };
      }
      if (object.type === "text") {
        const text = object as TextLabel;
        const textHeight =
          text.height ??
          Math.max(2, text.text.split("\n").length * text.fontSize * 1.4);
        return {
          id: object.id,
          x: object.position.x + text.width / 2,
          y: object.position.y + textHeight / 2,
          radius: Math.max(1.2, Math.hypot(text.width, textHeight) * 0.52),
          strength,
        };
      }
      if (object.type === "arrow") {
        const arrow = object as ArrowLine;
        const xs = [0, arrow.points[2]];
        const ys = [0, arrow.points[3]];
        if (arrow.control) {
          xs.push(arrow.control.x);
          ys.push(arrow.control.y);
        }
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
        return {
          id: object.id,
          x: object.position.x + minX + width / 2,
          y: object.position.y + minY + height / 2,
          radius: Math.max(1.2, Math.hypot(width, height) * 0.55),
          strength,
        };
      }
      if (object.type === "path") {
        const path = object as MovementPath;
        if (path.points.length < 2) {
          return null;
        }
        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = 0; i < path.points.length; i += 2) {
          xs.push(path.points[i]);
          ys.push(path.points[i + 1]);
        }
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
        return {
          id: object.id,
          x: object.position.x + minX + width / 2,
          y: object.position.y + minY + height / 2,
          radius: Math.max(1.2, Math.hypot(width, height) * 0.55),
          strength,
        };
      }
      return null;
    },
    [effectivePlayerTokenSize]
  );
  const renderObjects = useMemo(() => {
    if (board.mode !== "DYNAMIC") {
      return objects;
    }
    const lastIndex = board.frames.length - 1;
    const baseIndex = Math.min(Math.floor(playheadFrame), lastIndex);
    if (!loopPlayback && baseIndex === lastIndex) {
      // End of timeline should render final frame state, not restart transition effects.
      return (board.frames[lastIndex]?.objects ?? objects).map((item) =>
        applyArrowDrawProgress(
          applyHighlightEffect(item, item.animation === "highlight" ? 1 : 0),
          1
        )
      );
    }
    const nextIndex = loopPlayback
      ? (baseIndex + 1) % board.frames.length
      : Math.min(baseIndex + 1, lastIndex);
    const baseObjects = board.frames[baseIndex]?.objects ?? [];
    const nextObjects = board.frames[nextIndex]?.objects ?? [];
    const t =
      !loopPlayback && baseIndex === lastIndex
        ? 0
        : Math.max(0, Math.min(1, playheadFrame - baseIndex));
    if (!isPlaying && t === 0 && baseIndex === frameIndex) {
      return objects.map((item) =>
        applyHighlightEffect(item, item.animation === "highlight" ? 1 : 0)
      );
    }
    const nextMap = new Map(nextObjects.map((item) => [item.id, item]));
    const baseMap = new Map(baseObjects.map((item) => [item.id, item]));
    const merged: typeof objects = [];
    baseObjects.forEach((item) => {
      const next = nextMap.get(item.id);
      if (next) {
        const blended = {
          ...item,
          position: {
            x: item.position.x + (next.position.x - item.position.x) * t,
            y: item.position.y + (next.position.y - item.position.y) * t,
          },
          rotation: item.rotation + (next.rotation - item.rotation) * t,
          scale: {
            x: item.scale.x + (next.scale.x - item.scale.x) * t,
            y: item.scale.y + (next.scale.y - item.scale.y) * t,
          },
        };
        if (item.type === "player" && next.type === "player") {
          const playerBlend = blended as PlayerToken;
          if (item.moveControl) {
            const control = item.moveControl;
            const inv = 1 - t;
            playerBlend.position = {
              x:
                inv * inv * item.position.x +
                2 * inv * t * control.x +
                t * t * next.position.x,
              y:
                inv * inv * item.position.y +
                2 * inv * t * control.y +
                t * t * next.position.y,
            };
          }
        }
        if (item.type === "circle" && next.type === "circle") {
          const circleBlend = blended as ShapeCircle;
          circleBlend.radius = item.radius + (next.radius - item.radius) * t;
        }
        if (item.type === "rect" && next.type === "rect") {
          const rectBlend = blended as ShapeRect;
          rectBlend.width = item.width + (next.width - item.width) * t;
          rectBlend.height = item.height + (next.height - item.height) * t;
          rectBlend.cornerRadius =
            item.cornerRadius + (next.cornerRadius - item.cornerRadius) * t;
        }
        if (item.type === "triangle" && next.type === "triangle") {
          const triBlend = blended as ShapeTriangle;
          triBlend.width = item.width + (next.width - item.width) * t;
          triBlend.height = item.height + (next.height - item.height) * t;
        }
        if (item.type === "arrow" && next.type === "arrow") {
          const arrowBlend = blended as ArrowLine;
          if (item.points.length === next.points.length) {
            arrowBlend.points = item.points.map(
              (value, index) => value + (next.points[index] - value) * t
            );
          }
          if (item.control && next.control) {
            arrowBlend.control = {
              x: item.control.x + (next.control.x - item.control.x) * t,
              y: item.control.y + (next.control.y - item.control.y) * t,
            };
          }
          arrowBlend.curved = item.curved || next.curved;
        }
        if (item.type === "ball") {
          const blendedBall = blended as BallToken;
          const baseAttach = item.attachedToId;
          const nextAttach =
            next.type === "ball" ? next.attachedToId : undefined;
          const attachId =
            baseAttach && nextAttach && baseAttach === nextAttach
              ? baseAttach
              : undefined;
          if (!attachId) {
            blendedBall.attachedToId = undefined;
            blendedBall.offset = undefined;
          }
          if (attachId) {
            const basePlayer = baseMap.get(attachId);
            const nextPlayer = nextMap.get(attachId) ?? basePlayer;
            if (basePlayer && nextPlayer) {
              const baseOffset = item.offset ?? { x: 1.5, y: -1.5 };
              const nextOffset =
                next.type === "ball" && next.offset
                  ? next.offset
                  : baseOffset;
              const blendedOffset = {
                x: baseOffset.x + (nextOffset.x - baseOffset.x) * t,
                y: baseOffset.y + (nextOffset.y - baseOffset.y) * t,
              };
              blendedBall.attachedToId = attachId;
              blendedBall.offset = blendedOffset;
              blended.position = {
                x:
                  basePlayer.position.x +
                  (nextPlayer.position.x - basePlayer.position.x) * t +
                  blendedOffset.x,
                y:
                  basePlayer.position.y +
                  (nextPlayer.position.y - basePlayer.position.y) * t +
                  blendedOffset.y,
              };
            }
          } else {
            const basePos = { ...item.position };
            const nextPos = { ...next.position };
            if (baseAttach) {
              const basePlayer = baseMap.get(baseAttach);
              const baseOffset = item.offset ?? { x: 1.5, y: -1.5 };
              if (basePlayer) {
                basePos.x = basePlayer.position.x + baseOffset.x;
                basePos.y = basePlayer.position.y + baseOffset.y;
              }
            }
            if (nextAttach && next.type === "ball") {
              const nextPlayer = nextMap.get(nextAttach);
              const nextOffset = next.offset ?? { x: 1.5, y: -1.5 };
              if (nextPlayer) {
                nextPos.x = nextPlayer.position.x + nextOffset.x;
                nextPos.y = nextPlayer.position.y + nextOffset.y;
              }
            }
            blended.position = {
              x: basePos.x + (nextPos.x - basePos.x) * t,
              y: basePos.y + (nextPos.y - basePos.y) * t,
            };
          }
        }
        // Transition effect ownership:
        // - fadeIn: target frame only
        // - fadeOut: source frame only
        // - draw/pop/pulse/lightning/lightPulse/shimmer: target frame (preview while entering)
        const transitionEffect = (() => {
          if (item.animation === "fadeOut") {
            return "fadeOut" as const;
          }
          if (next.animation === "fadeIn") {
            return "fadeIn" as const;
          }
          if (
            next.animation === "draw" ||
            next.animation === "pop" ||
            next.animation === "pulse" ||
            next.animation === "lightning" ||
            next.animation === "lightPulse" ||
            next.animation === "shimmer"
          ) {
            return next.animation;
          }
          return "none" as const;
        })();
        const highlightAmount =
          item.animation === "highlight" && next.animation === "highlight"
            ? 1
            : item.animation === "highlight"
              ? 1 - t
              : next.animation === "highlight"
                ? t
                : 0;
        merged.push(
          applyArrowDrawProgress(
            applyHighlightEffect(
              applyPlaybackEffect(blended, t, transitionEffect),
              highlightAmount
            ),
            transitionEffect === "draw" ? t : 1
          )
        );
      } else {
        const highlightAmount = item.animation === "highlight" ? 1 - t : 0;
        merged.push(
          applyArrowDrawProgress(
            applyHighlightEffect(applyPlaybackEffect(item, t), highlightAmount),
            1
          )
        );
      }
    });
    nextObjects.forEach((item) => {
      if (!baseObjects.find((current) => current.id === item.id)) {
        const entryEffect =
          item.animation === "fadeIn" ||
          item.animation === "draw" ||
          item.animation === "pop" ||
          item.animation === "pulse" ||
          item.animation === "lightning" ||
          item.animation === "lightPulse" ||
          item.animation === "shimmer"
            ? item.animation
            : "none";
        const highlightAmount = item.animation === "highlight" ? t : 0;
        merged.push(
          applyArrowDrawProgress(
            applyHighlightEffect(
              applyPlaybackEffect(item, t, entryEffect),
              highlightAmount
            ),
            entryEffect === "draw" ? t : 1
          )
        );
      }
    });
    return merged;
  }, [
    board.mode,
    board.frames,
    frameIndex,
    isPlaying,
    loopPlayback,
    objects,
    playheadFrame,
    applyPlaybackEffect,
    applyHighlightEffect,
    applyArrowDrawProgress,
  ]);
  const lightningAuras = useMemo(
    () => renderObjects.map((item) => getLightningAura(item)).filter(Boolean),
    [getLightningAura, renderObjects]
  );
  const sortedObjects = useMemo(() => {
    const getPriority = (type: string) => {
      if (type === "ball") {
        return 3;
      }
      if (type === "player") {
        return 2;
      }
      return 1;
    };
    return [...renderObjects].sort((a, b) => {
      const priorityDiff = getPriority(a.type) - getPriority(b.type);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return a.zIndex - b.zIndex;
    });
  }, [renderObjects]);
  const nonPlayerObjects = useMemo(
    () => sortedObjects.filter((item) => item.type !== "player" && item.type !== "ball"),
    [sortedObjects]
  );
  const playerObjects = useMemo(
    () => sortedObjects.filter((item) => item.type === "player" || item.type === "ball"),
    [sortedObjects]
  );

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const measure = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height }
      );
    };
    // Run a couple of frames later as well to catch mobile URL-bar/layout shifts.
    const raf1 = requestAnimationFrame(measure);
    const raf2 = requestAnimationFrame(measure);
    const timeout = window.setTimeout(measure, 120);
    measure();
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(timeout);
    };
  }, [board.id, board.pitchView, forcePortrait, isMaximized, readOnly]);

  useEffect(() => {
    if (onStageReady) {
      onStageReady(stageRef.current);
      return () => onStageReady(null);
    }
    return;
  }, [onStageReady]);


  const bounds = useMemo(
    () => getPitchViewBounds(board.pitchView),
    [board.pitchView]
  );
  const isForcedPortrait = !!forcePortrait;
  const isPortraitFull =
    board.pitchView === "FULL" &&
    (isForcedPortrait || (readOnly && size.height > size.width));
  const lockedViewport =
    isThreeDView ? { zoom: 1, offsetX: 0, offsetY: 0 } : viewport;
  const setViewportSafe = forcePortrait
    ? (_value: Partial<typeof viewport>) => {}
    : setViewport;
  const viewRotation = useMemo(() => {
    let rotation = 0;
    if (isForcedPortrait) {
      rotation = -90;
    } else if (board.pitchView === "DEF_HALF" || board.pitchView === "OFF_HALF") {
      rotation = -90;
    } else if (isPortraitFull) {
      // Keep home side toward the bottom on full-pitch portrait views.
      rotation = -90;
    }
    if (rotation !== 0 && board.pitchRotation === 180) {
      rotation += 180;
    }
    return rotation;
  }, [board.pitchRotation, board.pitchView, isForcedPortrait, isPortraitFull]);
  const labelRotation = viewRotation === 0 ? 0 : -viewRotation;
  const rotationPivot = useMemo(
    () => ({
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    }),
    [bounds]
  );
  const rotatedBounds = useMemo(() => {
    if (viewRotation === 0) {
      return {
        minX: bounds.x,
        maxX: bounds.x + bounds.width,
        minY: bounds.y,
        maxY: bounds.y + bounds.height,
      };
    }
    const rad = (viewRotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotate = (x: number, y: number) => {
      const dx = x - rotationPivot.x;
      const dy = y - rotationPivot.y;
      return {
        x: rotationPivot.x + dx * cos - dy * sin,
        y: rotationPivot.y + dx * sin + dy * cos,
      };
    };
    const p1 = rotate(bounds.x, bounds.y);
    const p2 = rotate(bounds.x + bounds.width, bounds.y);
    const p3 = rotate(bounds.x + bounds.width, bounds.y + bounds.height);
    const p4 = rotate(bounds.x, bounds.y + bounds.height);
    const xs = [p1.x, p2.x, p3.x, p4.x];
    const ys = [p1.y, p2.y, p3.y, p4.y];
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }, [bounds, rotationPivot.x, rotationPivot.y, viewRotation]);
  const boardSquads = useMemo(
    () => getBoardSquads(project, board),
    [project, board]
  );
  const squadPlayers = useMemo(
    () => boardSquads.all.flatMap((squad) => squad.players),
    [boardSquads]
  );
  const squadPlayerById = useMemo(() => {
    const map = new Map<string, (typeof squadPlayers)[number]>();
    squadPlayers.forEach((player) => {
      map.set(player.id, player);
      if (player.teamMemberId) {
        map.set(player.teamMemberId, player);
      }
    });
    return map;
  }, [squadPlayers]);
  const resolvedSquadPlayerByTokenId = useMemo(() => {
    const map = new Map<string, (typeof squadPlayers)[number]>();
    objects.forEach((item) => {
      if (item.type !== "player") {
        return;
      }
      const resolved = resolvePlayerTokenSquadPlayer(item, boardSquads);
      if (resolved) {
        map.set(item.id, resolved);
      }
    });
    return map;
  }, [boardSquads, objects, squadPlayers]);
  const kitByPlayerId = useMemo(() => {
    const map: Record<string, string> = {};
    boardSquads.all.forEach((squad) => {
      squad.players.forEach((player) => {
        map[player.id] = squad.kit.shirt;
      });
    });
    return map;
  }, [boardSquads]);
  const vestByPlayerId = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    boardSquads.all.forEach((squad) => {
      squad.players.forEach((player) => {
        map[player.id] = player.vestColor || undefined;
      });
    });
    return map;
  }, [boardSquads]);
  const secondaryKitByPlayerId = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    boardSquads.all.forEach((squad) => {
      squad.players.forEach((player) => {
        map[player.id] = squad.kit.shirtSecondary ?? squad.kit.shirt;
      });
    });
    return map;
  }, [boardSquads]);
  const jerseyTypeByPlayerId = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    boardSquads.all.forEach((squad) => {
      squad.players.forEach((player) => {
        map[player.id] = squad.kit.jerseyType ?? "solid";
      });
    });
    return map;
  }, [boardSquads]);
  const defaultPlayerFill =
    (playerSide === "away" ? boardSquads.away : boardSquads.home)?.kit.shirt ??
    (playerSide === "away"
      ? project?.settings?.awayKit.shirt
      : project?.settings?.homeKit.shirt) ??
    "#f9bf4a";
  const highlightedPlayers =
    activeFrame?.playerHighlights ?? board.playerHighlights ?? [];
  const playerLinks = activeFrame?.playerLinks ?? board.playerLinks ?? [];

  useEffect(() => {
    if (!isThreeDView) {
      return;
    }
    // 3D mode locks pan/zoom. Ensure the board is centered when opening a board
    // that was left in 3D, otherwise an old viewport offset can show an empty pitch.
    setViewport({ zoom: 1, offsetX: 0, offsetY: 0 });
  }, [board.id, isThreeDView, setViewport]);

  useEffect(() => {
    if (!activeFrame) {
      return;
    }
    const needsHighlights =
      activeFrame.playerHighlights === undefined &&
      (board.playerHighlights ?? []).length > 0;
    const needsLinks =
      activeFrame.playerLinks === undefined &&
      (board.playerLinks ?? []).length > 0;
    if (!needsHighlights && !needsLinks) {
      return;
    }
    const nextFrames = board.frames.map((frame, index) =>
      index === frameIndex
        ? {
            ...frame,
            playerHighlights:
              frame.playerHighlights ?? board.playerHighlights ?? [],
            playerLinks: frame.playerLinks ?? board.playerLinks ?? [],
          }
        : frame
    );
    useProjectStore.getState().updateBoard(board.id, {
      frames: nextFrames,
      playerHighlights: [],
      playerLinks: [],
    });
  }, [activeFrame, board, frameIndex]);
  const playerPositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    renderObjects.forEach((item) => {
      if (item.type === "player") {
        map.set(item.id, item.position);
      }
    });
    return map;
  }, [renderObjects]);
  const finishLinkingPlayers = useCallback(() => {
    if (!isLinkingPlayers) {
      return;
    }
    if (linkingPlayerIds.length >= 2) {
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
  }, [
    activeFrame?.playerLinks,
    board,
    clearLinkingPlayers,
    frameIndex,
    isLinkingPlayers,
    linkingPlayerIds,
    setLinkingPlayers,
    updateBoard,
  ]);
  const latestLinkingPlayerPosition = useMemo(() => {
    if (!isLinkingPlayers || linkingPlayerIds.length < 2) {
      return null;
    }
    const latestId = linkingPlayerIds[linkingPlayerIds.length - 1];
    if (!latestId) {
      return null;
    }
    return playerPositions.get(latestId) ?? null;
  }, [isLinkingPlayers, linkingPlayerIds, playerPositions]);
  const getThreeDDepthFactor = (y: number) => {
    if (!isThreeDView) {
      return 1;
    }
    const range = Math.max(0.001, bounds.height);
    const t = Math.max(0, Math.min(1, (y - bounds.y) / range));
    const strength = Math.max(0, Math.min(1, threeDStrength / 100));
    const minFactor = 1 - strength * 0.28;
    return minFactor + (1 - minFactor) * t;
  };
  const effectiveWidth = Math.max(1, rotatedBounds.maxX - rotatedBounds.minX);
  const effectiveHeight = Math.max(1, rotatedBounds.maxY - rotatedBounds.minY);
  const baseScale = Math.min(
    size.width / effectiveWidth,
    size.height / effectiveHeight
  );
  const threeDNormalized = threeDStrength / 100;
  const threeDScaleFactor = 1 - threeDNormalized * 0.3;
  const centeringStageScale = baseScale * lockedViewport.zoom;
  const centeringEffectiveScale =
    centeringStageScale * (isThreeDView ? threeDScaleFactor : 1);
  const centeringScale = isThreeDView ? centeringEffectiveScale : baseScale;
  const baseOffsetX = forcePortrait
    ? -rotatedBounds.minX * centeringScale
    : (size.width - effectiveWidth * centeringScale) / 2 -
      rotatedBounds.minX * centeringScale;
  const threeDOffsetX = 0;
  const baseOffsetY =
    (size.height - effectiveHeight * centeringScale) / 2 -
    rotatedBounds.minY * centeringScale;
  const displayViewport = useMemo(() => {
    const lastIndex = Math.max(0, board.frames.length - 1);
    const isStoppedAtTimelineEnd = holdZoomAtTimelineEnd;
    if (
      board.mode !== "DYNAMIC" ||
      (!isPlaying && !isStoppedAtTimelineEnd) ||
      board.frames.length === 0
    ) {
      return lockedViewport;
    }
    const ZOOM_EFFECT_LEVEL = 1.8;
    const fallback = { zoom: 1, offsetX: 0, offsetY: 0 };
    const getFocusPoint = (
      item: DrawableObject,
      frameObjects: DrawableObject[]
    ) => {
      if (item.type === "ball") {
        const attachedId = item.attachedToId;
        if (attachedId) {
          const player = frameObjects.find(
            (entry) => entry.id === attachedId && entry.type === "player"
          );
          if (player) {
            const offset = item.offset ?? { x: 1.5, y: -1.5 };
            return {
              x: player.position.x + offset.x,
              y: player.position.y + offset.y,
            };
          }
        }
      }
      if (item.type === "arrow" || item.type === "path") {
        const points = item.points ?? [];
        if (points.length < 2) {
          return item.position;
        }
        let minX = item.position.x + points[0]!;
        let maxX = minX;
        let minY = item.position.y + points[1]!;
        let maxY = minY;
        for (let index = 2; index < points.length; index += 2) {
          const x = item.position.x + (points[index] ?? 0);
          const y = item.position.y + (points[index + 1] ?? 0);
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
        return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
      }
      if (item.type === "polygon") {
        const points = item.points ?? [];
        if (points.length < 2) {
          return item.position;
        }
        let minX = item.position.x + points[0]!;
        let maxX = minX;
        let minY = item.position.y + points[1]!;
        let maxY = minY;
        for (let index = 2; index < points.length; index += 2) {
          const x = item.position.x + (points[index] ?? 0);
          const y = item.position.y + (points[index + 1] ?? 0);
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
        return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
      }
      if (item.type === "circle") {
        return item.position;
      }
      if (
        item.type === "rect" ||
        item.type === "triangle" ||
        item.type === "goal" ||
        item.type === "cone" ||
        item.type === "pole" ||
        item.type === "mannequin" ||
        item.type === "text"
      ) {
        const height = item.type === "text" ? item.height ?? 1.2 : item.height;
        return {
          x: item.position.x + item.width / 2,
          y: item.position.y + height / 2,
        };
      }
      return item.position;
    };
    const toViewportForObject = (
      item: DrawableObject,
      frameObjects: DrawableObject[]
    ) => {
      const focusPoint = getFocusPoint(item, frameObjects);
      const displayedPoint =
        viewRotation === 0
          ? focusPoint
          : rotatePointAround(focusPoint, rotationPivot, viewRotation);
      const effectiveZoomScale =
        baseScale *
        ZOOM_EFFECT_LEVEL *
        (isThreeDView ? threeDScaleFactor : 1);
      return {
        zoom: ZOOM_EFFECT_LEVEL,
        offsetX:
          size.width / 2 -
          displayedPoint.x * effectiveZoomScale -
          baseOffsetX,
        offsetY:
          size.height / 2 -
          displayedPoint.y * effectiveZoomScale -
          baseOffsetY,
      };
    };
    const findZoomObject = (items: DrawableObject[]) =>
      items.find((item) => item.animation === "zoom");
    const baseIndex = Math.min(Math.floor(playheadFrame), lastIndex);
    const baseObjects = board.frames[baseIndex]?.objects ?? [];
    const baseZoomObject = findZoomObject(baseObjects);
    if (!loopPlayback && baseIndex === lastIndex) {
      return baseZoomObject
        ? toViewportForObject(baseZoomObject, baseObjects)
        : fallback;
    }
    const nextIndex = loopPlayback
      ? (baseIndex + 1) % board.frames.length
      : Math.min(baseIndex + 1, lastIndex);
    const nextObjects = board.frames[nextIndex]?.objects ?? [];
    const nextZoomObject = findZoomObject(nextObjects);
    const tRaw = Math.max(0, Math.min(1, playheadFrame - baseIndex));
    const t = tRaw * tRaw * (3 - 2 * tRaw);
    const from = baseZoomObject
      ? toViewportForObject(baseZoomObject, baseObjects)
      : fallback;
    const to = nextZoomObject
      ? toViewportForObject(nextZoomObject, nextObjects)
      : fallback;
    return {
      zoom: from.zoom + (to.zoom - from.zoom) * t,
      offsetX: from.offsetX + (to.offsetX - from.offsetX) * t,
      offsetY: from.offsetY + (to.offsetY - from.offsetY) * t,
    };
  }, [
    baseOffsetX,
    baseOffsetY,
    baseScale,
    board.frames,
    board.mode,
    isPlaying,
    isThreeDView,
    holdZoomAtTimelineEnd,
    lockedViewport,
    loopPlayback,
    playheadFrame,
    rotationPivot,
    size.height,
    size.width,
    threeDScaleFactor,
    viewRotation,
  ]);
  const stageScale = baseScale * displayViewport.zoom;
  const effectiveStageScale = stageScale * (isThreeDView ? threeDScaleFactor : 1);

  const {
    draft,
    marquee,
    marqueeMode,
    isPanning,
    cancelDraft,
    undoDraftStep,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTap,
    handleClick,
  } = useBoardInteractions({
    boardId: board.id,
    frameIndex,
    objects,
    activeTool,
    playerTokenSize: effectivePlayerTokenSize,
    playerFill: defaultPlayerFill,
    readOnly: isCanvasReadOnly,
    baseOffsetX,
    baseOffsetY,
    baseScale,
    viewport: displayViewport,
    rotation: viewRotation,
    rotationPivot,
    stageRef,
    setViewport: setViewportSafe,
    clearSelection: () => {
      setSelection([]);
      setSelectedLinkId(null);
    },
    pushHistory,
    addObject,
    selectByMarquee: (ids) => setSelection(ids),
    disablePanZoom: !!forcePortrait || isThreeDView,
  });

  const updatePosition = (id: string, position: { x: number; y: number }) => {
    const target = objects.find((item) => item.id === id);
    if (!target || target.type !== "ball") {
      updateObject(board.id, frameIndex, id, { position });
      return;
    }
    if (!attachBallToPlayer) {
      updateObject(board.id, frameIndex, id, {
        position,
        attachedToId: undefined,
        offset: undefined,
      });
      return;
    }

    const players = objects.filter((item) => item.type === "player");
    let closestId: string | null = null;
    let closestDist = Infinity;
    players.forEach((player) => {
      const dx = position.x - player.position.x;
      const dy = position.y - player.position.y;
      const dist = Math.hypot(dx, dy);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = player.id;
      }
    });
    const snapRadius = effectivePlayerTokenSize + 3;
    if (closestId && closestDist <= snapRadius) {
      const player = players.find((item) => item.id === closestId);
      if (!player) {
        return;
      }
      const dx = position.x - player.position.x;
      const dy = position.y - player.position.y;
      const len = Math.hypot(dx, dy) || 1;
      const ballRadius = Math.max(0.7, effectivePlayerTokenSize * 0.52);
      const offsetLen = effectivePlayerTokenSize + ballRadius - 0.3;
      const offset = {
        x: (dx / len) * offsetLen,
        y: (dy / len) * offsetLen,
      };
      updateObject(board.id, frameIndex, id, {
        attachedToId: player.id,
        offset,
        position: {
          x: player.position.x + offset.x,
          y: player.position.y + offset.y,
        },
      });
      return;
    }

    updateObject(board.id, frameIndex, id, {
      position,
      attachedToId: undefined,
      offset: undefined,
    });
  };


  const handleSelect = (id: string, multi: boolean) => {
    if (isCanvasReadOnly) {
      return;
    }
    setSelectedLinkId(null);
    const target = objects.find((item) => item.id === id);
    if (isHighlighting && target?.type === "player") {
      const current =
        activeFrame?.playerHighlights ?? board.playerHighlights ?? [];
      const next = current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id];
      const nextFrames = board.frames.map((frame, index) =>
        index === frameIndex ? { ...frame, playerHighlights: next } : frame
      );
      useProjectStore.getState().updateBoard(board.id, {
        frames: nextFrames,
      });
      return;
    }
    if (multi) {
      setSelection(Array.from(new Set([...selection, id])));
    } else {
      setSelection([id]);
    }
  };

  const handleResetView = () => {
    setViewport({ zoom: 1, offsetX: 0, offsetY: 0 });
  };

  const handleClearPitch = () => {
    if (!window.confirm("Clear all objects from this frame?")) {
      return;
    }
    pushHistory(clone(objects));
    setFrameObjects(board.id, frameIndex, []);
    setControlsMenuOpen(false);
  };

  useEffect(() => {
    if (!controlsMenuOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!controlsMenuRef.current) {
        return;
      }
      if (!controlsMenuRef.current.contains(event.target as Node)) {
        setControlsMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [controlsMenuOpen]);
  useEffect(() => {
    setObjectActionMenuId(null);
    setObjectListOpen(false);
    setObjectListSearch("");
    setObjectListFilter("all");
    setObjectListStatus(null);
  }, [board.id, frameIndex, selection]);

  const getObjectFocusPoint = useCallback((item: DrawableObject) => {
    if (item.type === "arrow" || item.type === "path") {
      const points = item.points ?? [];
      if (points.length < 2) {
        return item.position;
      }
      let minX = item.position.x + points[0]!;
      let maxX = minX;
      let minY = item.position.y + points[1]!;
      let maxY = minY;
      for (let index = 2; index < points.length; index += 2) {
        const x = item.position.x + (points[index] ?? 0);
        const y = item.position.y + (points[index + 1] ?? 0);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    }
    if (item.type === "polygon") {
      const points = item.points ?? [];
      if (points.length < 2) {
        return item.position;
      }
      let minX = item.position.x + points[0]!;
      let maxX = minX;
      let minY = item.position.y + points[1]!;
      let maxY = minY;
      for (let index = 2; index < points.length; index += 2) {
        const x = item.position.x + (points[index] ?? 0);
        const y = item.position.y + (points[index + 1] ?? 0);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    }
    if (item.type === "circle") {
      return item.position;
    }
    if (
      item.type === "rect" ||
      item.type === "triangle" ||
      item.type === "goal" ||
      item.type === "cone" ||
      item.type === "pole" ||
      item.type === "mannequin" ||
      item.type === "text"
    ) {
      const height = item.type === "text" ? item.height ?? 1.2 : item.height;
      return {
        x: item.position.x + item.width / 2,
        y: item.position.y + height / 2,
      };
    }
    return item.position;
  }, []);

  const focusObject = useCallback(
    (item: DrawableObject) => {
      setSelection([item.id]);
      setSelectedLinkId(null);
      setObjectActionMenuId(null);
      if (forcePortrait || isThreeDView || isCanvasReadOnly) {
        return;
      }
      const zoom = displayViewport.zoom;
      const focusPoint = getObjectFocusPoint(item);
      const displayedPoint =
        viewRotation === 0
          ? focusPoint
          : rotatePointAround(focusPoint, rotationPivot, viewRotation);
      const nextOffsetX =
        size.width / 2 - displayedPoint.x * baseScale * zoom - baseOffsetX;
      const nextOffsetY =
        size.height / 2 - displayedPoint.y * baseScale * zoom - baseOffsetY;
      setViewportSafe({ offsetX: nextOffsetX, offsetY: nextOffsetY });
    },
    [
      baseOffsetX,
      baseOffsetY,
      baseScale,
      forcePortrait,
      getObjectFocusPoint,
      isCanvasReadOnly,
      isThreeDView,
      rotationPivot,
      setSelectedLinkId,
      setSelection,
      setViewportSafe,
      size.height,
      size.width,
      viewRotation,
      displayViewport.zoom,
    ]
  );

  const objectListEntries = useMemo(() => {
    const typeLabel: Record<DrawableObject["type"], string> = {
      player: "Player",
      ball: "Ball",
      cone: "Cone",
      pole: "Pole",
      mannequin: "Mannequin",
      goal: "Mini goal",
      circle: "Circle",
      polygon: "Polygon",
      rect: "Rectangle",
      triangle: "Triangle",
      arrow: "Line",
      text: "Text",
      path: "Path",
    };
    return objects
      .map((item, index) => {
        let fallbackName = "";
        if (item.type === "player") {
          const squadPlayer = resolvedSquadPlayerByTokenId.get(item.id) ?? null;
          fallbackName = squadPlayer?.name?.trim() || `#${index + 1}`;
        } else if (item.type === "text") {
          fallbackName = item.text.trim().slice(0, 36) || `#${index + 1}`;
        } else {
          fallbackName = `#${index + 1}`;
        }
        const displayName = (item.name?.trim() || fallbackName).trim();
        const type = item.type;
        const typeName = typeLabel[type];
        return {
          id: item.id,
          type,
          item,
          fallbackName,
          displayName,
          label: `${typeName} ${displayName}`,
          searchText: `${typeName} ${displayName}`.toLowerCase(),
        };
      })
      .sort((a, b) => {
        const za = a.item.zIndex ?? 0;
        const zb = b.item.zIndex ?? 0;
        if (za !== zb) {
          return za - zb;
        }
        return a.label.localeCompare(b.label);
      });
  }, [objects, resolvedSquadPlayerByTokenId]);

  const renderObjectTypeIcon = (item: DrawableObject) => {
    const stroke = item.style.stroke || "#111111";
    const fill = item.style.fill || "#ffffff";
    const commonSvgClass = "h-4 w-4";
    if (item.type === "ball") {
      return (
        <img
          src="/ball.svg"
          alt=""
          aria-hidden
          className={commonSvgClass}
          draggable={false}
        />
      );
    }
    if (item.type === "goal") {
      return (
        <img
          src="/goal.svg"
          alt=""
          aria-hidden
          className={commonSvgClass}
          draggable={false}
        />
      );
    }
    if (item.type === "player") {
      const playerKey =
        resolvedSquadPlayerByTokenId.get(item.id)?.id ?? getPlayerTokenLinkKey(item);
      const playerFill = playerKey
        ? kitByPlayerId[playerKey] ?? item.style.fill
        : item.style.fill === "#f9bf4a"
          ? defaultPlayerFill
          : item.style.fill;
      return (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className={commonSvgClass}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="8" fill={playerFill || fill} />
        </svg>
      );
    }
    if (item.type === "cone") {
      return (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className={commonSvgClass}
          fill="none"
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 18.5 9 7.8h6L21.5 18.5z" fill={fill} />
          <ellipse cx="12" cy="8.1" rx="3.2" ry="1.2" fill={fill} />
        </svg>
      );
    }
    if (item.type === "pole") {
      return (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className={commonSvgClass}
          fill="none"
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ellipse cx="12" cy="19" rx="5.8" ry="2.8" fill={fill} />
          <rect x="10.9" y="4" width="2.2" height="13" rx="1.1" fill={fill} />
        </svg>
      );
    }
    if (item.type === "mannequin") {
      return (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className={commonSvgClass}
          fill="none"
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="5.5" r="2.8" fill={fill} />
          <path d="M7.2 10c0-1.5 1-2.8 2.5-2.8h4.6c1.5 0 2.5 1.3 2.5 2.8l-1.8 4.8V19H9v-4.2z" fill={fill} />
          <path d="M7.2 20h9.6" />
        </svg>
      );
    }
    if (item.type === "circle") {
      return (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className={commonSvgClass}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="8" fill={fill} />
        </svg>
      );
    }
    if (item.type === "polygon") {
      return (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className={commonSvgClass}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 9 11 4l8 4-2 10H8L4 12z" fill={fill} />
        </svg>
      );
    }
    if (item.type === "rect") {
      return (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className={commonSvgClass}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
        >
          <rect x="4" y="6" width="16" height="12" rx="1.8" fill={fill} />
        </svg>
      );
    }
    if (item.type === "triangle") {
      return (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className={commonSvgClass}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5 20 19H4z" fill={fill} />
        </svg>
      );
    }
    if (item.type === "arrow" || item.type === "path") {
      return (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className={commonSvgClass}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 16c4-8 8-8 14-8" />
          {item.type === "arrow" ? <path d="M14 6l4 2-2 4" /> : null}
        </svg>
      );
    }
    if (item.type === "text") {
      return (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className={commonSvgClass}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 6h14M12 6v12M8 18h8" />
        </svg>
      );
    }
    return null;
  };

  const filteredObjectListEntries = useMemo(() => {
    const query = objectListSearch.trim().toLowerCase();
    return objectListEntries.filter((entry) => {
      if (objectListFilter !== "all" && entry.type !== objectListFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return entry.searchText.includes(query);
    });
  }, [objectListEntries, objectListFilter, objectListSearch]);

  const renameObjectFromList = useCallback(
    (item: DrawableObject, currentName: string) => {
      const input = window.prompt("Object name", currentName) ?? "";
      const nextName = input.trim();
      if (!nextName) {
        setObjectListStatus("Name cannot be empty.");
        return;
      }
      const normalized = nextName.toLocaleLowerCase();
      const duplicate = objects.some(
        (entry) =>
          entry.id !== item.id &&
          (entry.name?.trim() || "").toLocaleLowerCase() === normalized
      );
      if (duplicate) {
        setObjectListStatus("Name already exists. Use a unique object name.");
        return;
      }
      updateObject(board.id, frameIndex, item.id, { name: nextName });
      setObjectListStatus(`Renamed to "${nextName}".`);
    },
    [board.id, frameIndex, objects, updateObject]
  );

  const getObjectActionAnchor = (item: DrawableObject) => {
    const fallback = { x: item.position.x, y: item.position.y };
    if (item.type === "arrow" || item.type === "path") {
      const points = item.points ?? [];
      let maxX = item.position.x;
      let minY = item.position.y;
      for (let i = 0; i < points.length; i += 2) {
        const x = item.position.x + points[i]!;
        const y = item.position.y + points[i + 1]!;
        if (x > maxX) {
          maxX = x;
        }
        if (y < minY) {
          minY = y;
        }
      }
      return { x: maxX, y: minY };
    }
    if (item.type === "circle") {
      return {
        x: item.position.x + item.radius,
        y: item.position.y - item.radius,
      };
    }
    if (item.type === "polygon") {
      const points = item.points ?? [];
      if (points.length < 2) {
        return item.position;
      }
      let minX = item.position.x + points[0]!;
      let maxX = minX;
      let minY = item.position.y + points[1]!;
      for (let index = 2; index < points.length; index += 2) {
        const x = item.position.x + (points[index] ?? 0);
        const y = item.position.y + (points[index + 1] ?? 0);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
      }
      return { x: maxX, y: minY };
    }
    if (item.type === "player" || item.type === "ball") {
      return {
        x: item.position.x + effectivePlayerTokenSize,
        y: item.position.y - effectivePlayerTokenSize,
      };
    }
    if (
      item.type === "rect" ||
      item.type === "triangle" ||
      item.type === "goal" ||
      item.type === "cone" ||
      item.type === "pole" ||
      item.type === "mannequin"
    ) {
      return {
        x: item.position.x + item.width,
        y: item.position.y,
      };
    }
    if (item.type === "text") {
      return {
        x: item.position.x + item.width,
        y: item.position.y,
      };
    }
    return fallback;
  };


  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      data-disable-pull
    >
      {isThreeDView && (
        <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full border border-[var(--line)] bg-[var(--panel)]/75 px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--accent-0)]">
          3D preview (edit in 2D)
        </div>
      )}
      {!readOnly && !isMaximized && (
        <div ref={controlsMenuRef} className="absolute right-4 top-4 z-10">
          <button
            className="rounded-full border border-[var(--line)] bg-[var(--panel-2)] p-2 text-[var(--ink-0)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={() => setControlsMenuOpen((prev) => !prev)}
            title={controlsMenuOpen ? "Close pitch menu" : "Open pitch menu"}
            aria-label={controlsMenuOpen ? "Close pitch menu" : "Open pitch menu"}
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
          {controlsMenuOpen && (
            <div className="absolute right-0 top-12 flex w-44 flex-col gap-1 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/95 p-2 shadow-xl shadow-black/40">
              <button
                className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-left text-xs text-[var(--ink-0)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                onClick={() => {
                  handleResetView();
                  setControlsMenuOpen(false);
                }}
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
                  <path d="M20 6v6h-6" />
                  <path d="M4 18v-6h6" />
                  <path d="M20 12a8 8 0 0 0-14-5" />
                  <path d="M4 12a8 8 0 0 0 14 5" />
                </svg>
                <span>Reset view</span>
              </button>
              <button
                className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-left text-xs text-[var(--ink-0)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                onClick={() => {
                  setObjectListOpen(true);
                  setControlsMenuOpen(false);
                }}
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
                  <path d="M8 6h12M8 12h12M8 18h12" />
                  <circle cx="4" cy="6" r="1.25" />
                  <circle cx="4" cy="12" r="1.25" />
                  <circle cx="4" cy="18" r="1.25" />
                </svg>
                <span>Object list ({objects.length})</span>
              </button>
              <button
                className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-left text-xs text-[var(--ink-0)] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                onClick={handleClearPitch}
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
                <span>Clear pitch</span>
              </button>
              <button
                className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-left text-xs text-[var(--ink-0)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                onClick={() => {
                  onToggleMaximize?.();
                  setControlsMenuOpen(false);
                }}
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
                  <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />
                </svg>
                <span>Full screen</span>
              </button>
              <button
                className={`flex items-center gap-2 rounded-xl border bg-[var(--panel-2)] px-3 py-2 text-left text-xs ${
                  isThreeDView
                    ? "border-[var(--accent-0)] text-[var(--accent-0)]"
                    : "border-[var(--line)] text-[var(--ink-0)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                }`}
                onClick={() => {
                  updateBoard(board.id, { threeDView: !isThreeDView });
                }}
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
                  <path d="M3 7l9-4 9 4-9 4-9-4z" />
                  <path d="M3 17l9 4 9-4" />
                  <path d="M3 12l9 4 9-4" />
                </svg>
                <span>{isThreeDView ? "3D view: on" : "3D view: off"}</span>
              </button>
              {isThreeDView ? (
                <label className="flex flex-col gap-1 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-xs text-[var(--ink-1)]">
                  <span className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em]">
                    <span>3D strength</span>
                    <span>{threeDStrength}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={threeDStrength}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      updateBoard(board.id, { threeDStrength: next });
                    }}
                  />
                </label>
              ) : null}
            </div>
          )}
        </div>
      )}
      {draft ? (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)]/95 px-2 py-2 shadow-lg shadow-black/25 backdrop-blur">
            {draft.type === "polygon" ? (
              <button
                className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[11px] font-medium text-[var(--ink-0)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                onClick={undoDraftStep}
              >
                Undo point
              </button>
            ) : null}
            <button
              className="rounded-full border border-[var(--accent-1)] px-3 py-1.5 text-[11px] font-medium text-[var(--accent-1)] hover:bg-[var(--accent-1)] hover:text-black"
              onClick={cancelDraft}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {objectListOpen ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 shadow-xl shadow-black/40">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-[var(--accent-0)]">
                  Current Frame Objects
                </p>
                <p className="text-[11px] text-[var(--ink-1)]">
                  Select an object to focus and highlight it on the pitch.
                </p>
              </div>
              <button
                className="rounded-full border border-[var(--line)] px-2 py-1 text-[11px] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                onClick={() => {
                  setObjectListOpen(false);
                  setObjectListSearch("");
                  setObjectListFilter("all");
                  setObjectListStatus(null);
                }}
              >
                Close
              </button>
            </div>
            <div className="mb-2 grid grid-cols-[minmax(0,1fr)_120px] gap-2">
              <input
                className="h-8 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                placeholder="Search objects"
                value={objectListSearch}
                onChange={(event) => setObjectListSearch(event.target.value)}
              />
              <select
                className="h-8 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                value={objectListFilter}
                onChange={(event) =>
                  setObjectListFilter(
                    event.target.value as "all" | DrawableObject["type"]
                  )
                }
              >
                <option value="all">All types</option>
                <option value="player">Player</option>
                <option value="ball">Ball</option>
                <option value="cone">Cone</option>
                <option value="pole">Pole</option>
                <option value="mannequin">Mannequin</option>
                <option value="goal">Mini goal</option>
                <option value="circle">Circle</option>
                <option value="polygon">Polygon</option>
                <option value="rect">Rectangle</option>
                <option value="triangle">Triangle</option>
                <option value="arrow">Line/Arrow</option>
                <option value="text">Text</option>
                <option value="path">Path</option>
              </select>
            </div>
            {objectListStatus ? (
              <p className="mb-2 text-[11px] text-[var(--accent-1)]">
                {objectListStatus}
              </p>
            ) : null}
            <div className="max-h-[55vh] space-y-1 overflow-y-auto pr-1" data-scrollable>
              {filteredObjectListEntries.length === 0 ? (
                <p className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-xs text-[var(--ink-1)]">
                  No matching objects.
                </p>
              ) : (
                filteredObjectListEntries.map((entry) => {
                  const isActive = selection.includes(entry.id);
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-2 rounded-xl border px-2 py-2 transition ${
                        isActive
                          ? "border-[var(--accent-0)] bg-[var(--panel-2)]"
                          : "border-[var(--line)] bg-[var(--panel)]"
                      }`}
                    >
                      <button
                        className={`min-w-0 flex-1 rounded-lg px-2 py-1 text-left text-xs ${
                          isActive
                            ? "text-[var(--ink-0)]"
                            : "text-[var(--ink-1)] hover:text-[var(--ink-0)]"
                        }`}
                        onClick={() => {
                          focusObject(entry.item);
                          setObjectListOpen(false);
                        }}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span className="text-[var(--accent-0)]">
                            {renderObjectTypeIcon(entry.item)}
                          </span>
                          <span className="truncate">{entry.displayName}</span>
                        </span>
                      </button>
                      <button
                        className="rounded-full border border-[var(--line)] px-2 py-1 text-[10px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                        onClick={() =>
                          renameObjectFromList(entry.item, entry.displayName)
                        }
                      >
                        Rename
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
      <div
        className="h-full w-full"
        style={
          isThreeDView
            ? {
                transform: `perspective(1200px) rotateX(${12 + threeDNormalized * 22}deg) translateX(0%) translateY(${0.5 + threeDNormalized * 2}%) scale(${1 - threeDNormalized * 0.14})`,
                transformOrigin: "50% 0%",
              }
            : undefined
        }
      >
        <Stage
          key={`${board.id}:${board.pitchView}:${forcePortrait ? "portrait" : "default"}:${isThreeDView ? "3d" : "2d"}`}
          ref={stageRef}
          width={size.width}
          height={size.height}
          scaleX={effectiveStageScale}
          scaleY={effectiveStageScale}
          x={baseOffsetX + threeDOffsetX + displayViewport.offsetX}
          y={baseOffsetY + displayViewport.offsetY}
          draggable={
            isPanning &&
            !forcePortrait &&
            !isCanvasReadOnly &&
            !isThreeDView
          }
          onWheel={isCanvasReadOnly ? undefined : handleWheel}
          onMouseDown={isCanvasReadOnly ? undefined : handleMouseDown}
          onMouseMove={isCanvasReadOnly ? undefined : handleMouseMove}
          onMouseUp={isCanvasReadOnly ? undefined : handleMouseUp}
          onDblClick={isCanvasReadOnly ? undefined : handleDoubleClick}
          onTouchStart={isCanvasReadOnly ? undefined : handleTouchStart}
          onTouchMove={isCanvasReadOnly ? undefined : handleTouchMove}
          onTouchEnd={isCanvasReadOnly ? undefined : handleTouchEnd}
          onTap={isCanvasReadOnly ? undefined : handleTap}
          onClick={isCanvasReadOnly ? undefined : handleClick}
        >
        <Layer>
          <Group
            rotation={viewRotation}
            offsetX={rotationPivot.x}
            offsetY={rotationPivot.y}
            x={rotationPivot.x}
            y={rotationPivot.y}
          >
            <Pitch
              view={board.pitchView}
              overlay={board.pitchOverlay}
              overlayText={board.pitchOverlayText ?? false}
            />
            {isThreeDView ? (
              <Rect
                x={bounds.x}
                y={bounds.y}
                width={bounds.width}
                height={bounds.height}
                listening={false}
                fillLinearGradientStartPoint={{ x: 0, y: bounds.y }}
                fillLinearGradientEndPoint={{ x: 0, y: bounds.y + bounds.height }}
                fillLinearGradientColorStops={[
                  0,
                  "rgba(8,16,18,0.26)",
                  0.35,
                  "rgba(6,14,16,0.16)",
                  0.65,
                  "rgba(255,255,255,0.03)",
                  1,
                  "rgba(255,255,255,0.08)",
                ]}
              />
            ) : null}
            {lightningAuras.map((aura) => {
              if (!aura) {
                return null;
              }
              const radius = aura.radius;
              const outerRadius = radius * (1.22 + aura.strength * 0.22);
              const spikeIn = outerRadius * 1.02;
              const spikeOut = outerRadius * 1.24;
              return (
                <Group key={`lightning-${aura.id}`} listening={false}>
                  <Circle
                    x={aura.x}
                    y={aura.y}
                    radius={outerRadius}
                    fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                    fillRadialGradientStartRadius={0}
                    fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                    fillRadialGradientEndRadius={outerRadius}
                    fillRadialGradientColorStops={[
                      0,
                      `rgba(255,255,255,${0.16 * aura.strength})`,
                      0.42,
                      `rgba(150,236,255,${0.22 * aura.strength})`,
                      1,
                      "rgba(150,236,255,0)",
                    ]}
                  />
                  <Line
                    points={[aura.x - spikeIn, aura.y, aura.x - spikeOut, aura.y]}
                    stroke="#bdeeff"
                    strokeWidth={0.12 + aura.strength * 0.1}
                    opacity={0.55 + aura.strength * 0.4}
                    lineCap="round"
                  />
                  <Line
                    points={[aura.x + spikeIn, aura.y, aura.x + spikeOut, aura.y]}
                    stroke="#bdeeff"
                    strokeWidth={0.12 + aura.strength * 0.1}
                    opacity={0.55 + aura.strength * 0.4}
                    lineCap="round"
                  />
                  <Line
                    points={[aura.x, aura.y - spikeIn, aura.x, aura.y - spikeOut]}
                    stroke="#bdeeff"
                    strokeWidth={0.12 + aura.strength * 0.1}
                    opacity={0.55 + aura.strength * 0.4}
                    lineCap="round"
                  />
                  <Line
                    points={[aura.x, aura.y + spikeIn, aura.x, aura.y + spikeOut]}
                    stroke="#bdeeff"
                    strokeWidth={0.12 + aura.strength * 0.1}
                    opacity={0.55 + aura.strength * 0.4}
                    lineCap="round"
                  />
                </Group>
              );
            })}
            {nonPlayerObjects.map((object) => (
              <BoardObject
                key={object.id}
                object={object}
                objects={renderObjects}
                activeTool={activeTool}
                isSelected={selection.includes(object.id)}
                isHighlighted={highlightedPlayers.includes(object.id)}
                isLinking={isLinkingPlayers}
                isLinkCandidate={linkingPlayerIds.includes(object.id)}
                onLinkPlayer={(id) => addLinkingPlayer(id)}
                squadPlayers={squadPlayers}
                resolvedSquadPlayerByTokenId={resolvedSquadPlayerByTokenId}
                kitByPlayerId={kitByPlayerId}
                secondaryKitByPlayerId={secondaryKitByPlayerId}
                jerseyTypeByPlayerId={jerseyTypeByPlayerId}
                vestByPlayerId={vestByPlayerId}
                defaultPlayerFill={defaultPlayerFill}
                playerTokenSize={effectivePlayerTokenSize}
                showPlayerName={board.playerLabel?.showName ?? true}
                showPlayerPosition={board.playerLabel?.showPosition ?? false}
                showPlayerNumber={board.playerLabel?.showNumber ?? false}
                compactPlayerLabels={useCompactPlayerLabels}
                labelRotation={labelRotation}
                isThreeDView={isThreeDView}
                threeDStrength={threeDStrength}
                threeDDepthRange={{
                  minY: bounds.y,
                  maxY: bounds.y + bounds.height,
                }}
                readOnly={isCanvasReadOnly}
                onSelect={handleSelect}
                onDragStart={() => pushHistory(clone(objects))}
                onDragEnd={updatePosition}
                onBallDragStart={(id, position) =>
                  updateObject(board.id, frameIndex, id, {
                    attachedToId: undefined,
                    offset: undefined,
                    position,
                  })
                }
                registerNode={(id, node) => {
                  shapeRefs.current[id] = node;
                }}
              />
            ))}
            {playerLinks.map((link) => {
              const points = link.playerIds
                .map((id) => playerPositions.get(id))
                .filter(Boolean) as { x: number; y: number }[];
              if (points.length < 2) {
                return null;
              }
              const isSelectedLink = selectedLinkId === link.id;
              const style = link.style ?? {
                stroke: "#f9bf4a",
                strokeWidth: 0.65,
                fill: "transparent",
                dash: [],
                opacity: 1,
                outlineStroke: "#111111",
              };
              const strokeWidth = style.strokeWidth + (isSelectedLink ? 0.1 : 0);
              const avgY =
                points.reduce((sum, point) => sum + point.y, 0) / points.length;
              const depthFactor = getThreeDDepthFactor(avgY);
              const depthStrokeWidth = Math.max(0.05, strokeWidth * depthFactor);
              const lineHitStrokeWidth = Math.max(
                depthStrokeWidth,
                isMobileViewport ? 4.2 : 2.2
              );
              const outlineWidth = getLineOutlineWidth(depthStrokeWidth);
              const outlineStroke = style.outlineStroke;
              const depthRange = Math.max(0.001, bounds.height);
              const depthT = Math.max(0, Math.min(1, (avgY - bounds.y) / depthRange));
              const depthEase = depthT * depthT;
              const linkShadowBlur = 0.14 + 1.05 * depthEase;
              const linkShadowOpacity = 0.04 + 0.2 * depthEase;
              const linkShadowOffsetY = 0.03 + 0.32 * depthEase;
              return (
                <Group key={link.id}>
                  {outlineStroke && outlineWidth > 0 && (
                    <Line
                      points={points.flatMap((point) => [point.x, point.y])}
                      stroke={outlineStroke}
                      strokeWidth={depthStrokeWidth + outlineWidth * 2}
                      lineCap="round"
                      lineJoin="round"
                      listening={false}
                    />
                  )}
                  <Line
                    points={points.flatMap((point) => [point.x, point.y])}
                    stroke={style.stroke}
                    strokeWidth={depthStrokeWidth}
                    hitStrokeWidth={lineHitStrokeWidth}
                    opacity={style.opacity}
                    lineCap="round"
                    lineJoin="round"
                    shadowEnabled={isThreeDView}
                    shadowColor="#000000"
                    shadowBlur={isThreeDView ? linkShadowBlur : 0}
                    shadowOpacity={isThreeDView ? linkShadowOpacity : 0}
                    shadowOffsetY={isThreeDView ? linkShadowOffsetY : 0}
                    onClick={(event) => {
                      event.cancelBubble = true;
                      setSelection([]);
                      setSelectedLinkId(link.id);
                    }}
                    onTap={(event) => {
                      event.cancelBubble = true;
                      setSelection([]);
                      setSelectedLinkId(link.id);
                    }}
                  />
                </Group>
              );
            })}
            {playerObjects.map((object) => (
              <BoardObject
                key={object.id}
                object={object}
                objects={renderObjects}
                activeTool={activeTool}
                isSelected={selection.includes(object.id)}
                isHighlighted={highlightedPlayers.includes(object.id)}
                isLinking={isLinkingPlayers}
                isLinkCandidate={linkingPlayerIds.includes(object.id)}
                onLinkPlayer={(id) => addLinkingPlayer(id)}
                squadPlayers={squadPlayers}
                resolvedSquadPlayerByTokenId={resolvedSquadPlayerByTokenId}
                kitByPlayerId={kitByPlayerId}
                secondaryKitByPlayerId={secondaryKitByPlayerId}
                jerseyTypeByPlayerId={jerseyTypeByPlayerId}
                vestByPlayerId={vestByPlayerId}
                defaultPlayerFill={defaultPlayerFill}
                playerTokenSize={effectivePlayerTokenSize}
                showPlayerName={board.playerLabel?.showName ?? true}
                showPlayerPosition={board.playerLabel?.showPosition ?? false}
                showPlayerNumber={board.playerLabel?.showNumber ?? false}
                compactPlayerLabels={useCompactPlayerLabels}
                labelRotation={labelRotation}
                isThreeDView={isThreeDView}
                threeDStrength={threeDStrength}
                threeDDepthRange={{
                  minY: bounds.y,
                  maxY: bounds.y + bounds.height,
                }}
                readOnly={isCanvasReadOnly}
                onSelect={handleSelect}
                onDragStart={() => pushHistory(clone(objects))}
                onDragEnd={updatePosition}
                onBallDragStart={(id, position) =>
                  updateObject(board.id, frameIndex, id, {
                    attachedToId: undefined,
                    offset: undefined,
                    position,
                  })
                }
                registerNode={(id, node) => {
                  shapeRefs.current[id] = node;
                }}
              />
            ))}
            {selectedArrows.map((arrow) => {
              const start = arrow.position;
              const endLocal = {
                x: (arrow as { points: number[] }).points[2],
                y: (arrow as { points: number[] }).points[3],
              };
              const end = {
                x: arrow.position.x + endLocal.x,
                y: arrow.position.y + endLocal.y,
              };
              const control = arrow.curved
                ? arrow.control ?? {
                    x: endLocal.x / 2,
                    y: endLocal.y / 2,
                  }
                : null;
              const controlWorld = control
                ? (() => {
                    const cp1 = { x: (2 * control.x) / 3, y: (2 * control.y) / 3 };
                    const cp2 = {
                      x: (endLocal.x + 2 * control.x) / 3,
                      y: (endLocal.y + 2 * control.y) / 3,
                    };
                    const mid = {
                      x: (3 * cp1.x + 3 * cp2.x + endLocal.x) / 8,
                      y: (3 * cp1.y + 3 * cp2.y + endLocal.y) / 8,
                    };
                    return {
                      x: arrow.position.x + mid.x,
                      y: arrow.position.y + mid.y,
                    };
                  })()
                : null;
              const locked = arrow.locked;
              return (
                <Group key={`${arrow.id}-handles`}>
                  <Circle
                    x={start.x}
                    y={start.y}
                    radius={transformHandleRadius}
                    fill="#ffffff"
                    stroke="#0f1b1a"
                    strokeWidth={0.15}
                    hitStrokeWidth={transformHandleHitStrokeWidth}
                    draggable={!locked}
                    onDragStart={() => pushHistory(clone(objects))}
                    onDragEnd={(event) => {
                      const newStart = {
                        x: event.target.x(),
                        y: event.target.y(),
                      };
                      const newPoints = [
                        0,
                        0,
                        end.x - newStart.x,
                        end.y - newStart.y,
                      ];
                      const nextControl =
                        arrow.curved && arrow.control
                          ? {
                              x: arrow.position.x + arrow.control.x - newStart.x,
                              y: arrow.position.y + arrow.control.y - newStart.y,
                            }
                          : undefined;
                      updateObject(board.id, frameIndex, arrow.id, {
                        position: newStart,
                        points: newPoints,
                        control: nextControl,
                      });
                    }}
                  />
                  <Circle
                    x={end.x}
                    y={end.y}
                    radius={transformHandleRadius}
                    fill="#ffffff"
                    stroke="#0f1b1a"
                    strokeWidth={0.15}
                    hitStrokeWidth={transformHandleHitStrokeWidth}
                    draggable={!locked}
                    onDragStart={() => pushHistory(clone(objects))}
                    onDragEnd={(event) => {
                      const newEnd = {
                        x: event.target.x(),
                        y: event.target.y(),
                      };
                      const newPoints = [
                        0,
                        0,
                        newEnd.x - start.x,
                        newEnd.y - start.y,
                      ];
                      updateObject(board.id, frameIndex, arrow.id, {
                        points: newPoints,
                      });
                    }}
                  />
                  {controlWorld && (
                    <Circle
                      x={controlWorld.x}
                      y={controlWorld.y}
                      radius={transformHandleRadius}
                      fill="#ffffff"
                      stroke="#0f1b1a"
                      strokeWidth={0.15}
                      hitStrokeWidth={transformHandleHitStrokeWidth}
                      draggable={!locked}
                      onDragStart={() => pushHistory(clone(objects))}
                      onDragMove={(event) => {
                        const localMid = {
                          x: event.target.x() - start.x,
                          y: event.target.y() - start.y,
                        };
                        const next = {
                          x: 2 * localMid.x - endLocal.x / 2,
                          y: 2 * localMid.y - endLocal.y / 2,
                        };
                        updateObject(board.id, frameIndex, arrow.id, {
                          control: next,
                          curved: true,
                        });
                      }}
                    />
                  )}
                </Group>
              );
            })}
            {board.mode === "DYNAMIC" &&
              !isPlaying &&
              frameIndex < board.frames.length - 1 &&
              selectedPlayers.map((player) => {
                const nextFrame = board.frames[frameIndex + 1];
                const nextPlayer = nextFrame?.objects.find(
                  (item) => item.id === player.id && item.type === "player"
                ) as PlayerToken | undefined;
                if (!nextPlayer) {
                  return null;
                }
                const start = player.position;
                const end = nextPlayer.position;
                const hasMovement =
                  Math.hypot(end.x - start.x, end.y - start.y) > 0.01;
                const control = player.moveControl ?? {
                  x: (start.x + end.x) / 2,
                  y: (start.y + end.y) / 2,
                };
                if (!hasMovement && !player.moveControl) {
                  return null;
                }
                return (
                  <Group key={`${player.id}-move-control`}>
                    <Line
                      points={[start.x, start.y, control.x, control.y, end.x, end.y]}
                      stroke="rgba(255,255,255,0.25)"
                      strokeWidth={0.2}
                      dash={[0.6, 0.6]}
                      listening={false}
                    />
                    <Circle
                      x={control.x}
                      y={control.y}
                      radius={transformHandleRadius}
                      fill="#ffffff"
                      stroke="#0f1b1a"
                      strokeWidth={0.15}
                      hitStrokeWidth={transformHandleHitStrokeWidth}
                      draggable={!player.locked}
                      onMouseDown={(event) => {
                        event.cancelBubble = true;
                      }}
                      onDragStart={() => pushHistory(clone(objects))}
                      onDragMove={(event) => {
                        updateObject(board.id, frameIndex, player.id, {
                          moveControl: {
                            x: event.target.x(),
                            y: event.target.y(),
                          },
                        });
                      }}
                      onDragEnd={(event) => {
                        updateObject(board.id, frameIndex, player.id, {
                          moveControl: {
                            x: event.target.x(),
                            y: event.target.y(),
                          },
                        });
                      }}
                    />
                  </Group>
                );
              })}
            {sortedObjects
              .filter(
                (item) =>
                  selection.includes(item.id) &&
                  (item.type === "circle" ||
                    item.type === "polygon" ||
                    item.type === "rect" ||
                    item.type === "triangle")
              )
              .map((item) => {
                const minSize = 1;
                if (item.type === "circle") {
                  const radius = item.radius;
                  return (
                    <Group
                      key={`${item.id}-shape-handles`}
                      x={item.position.x}
                      y={item.position.y}
                      rotation={item.rotation}
                      scaleX={item.scale.x}
                      scaleY={item.scale.y}
                    >
                      <Line
                        points={[0, 0, -radius, -radius]}
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth={0.2}
                        dash={[0.6, 0.6]}
                        listening={false}
                      />
                      <Circle
                        x={-radius}
                        y={-radius}
                        radius={transformHandleRadius}
                        fill="#ffffff"
                        stroke="#0f1b1a"
                        strokeWidth={0.15}
                        hitStrokeWidth={transformHandleHitStrokeWidth}
                        draggable={!item.locked}
                        onMouseDown={(event) => {
                          event.cancelBubble = true;
                        }}
                        onDragStart={() => pushHistory(clone(objects))}
                        onDragMove={(event) => {
                          const rawAngle =
                            getRawRotationAngleFromPointer(event, {
                              x: 0,
                              y: 0,
                            }) ?? item.rotation;
                          const snapKey = `${item.id}:rotate`;
                          const angle = event.evt?.altKey
                            ? rawAngle
                            : getStableSnappedRotation(rawAngle, snapKey);
                          if (event.evt?.altKey) {
                            clearRotationSnapState(snapKey);
                          }
                          updateObject(board.id, frameIndex, item.id, {
                            rotation: angle,
                          });
                        }}
                        onDragEnd={(event) => {
                          clearRotationSnapState(`${item.id}:rotate`);
                          event.target.position({
                            x: -radius * item.scale.x,
                            y: -radius * item.scale.y,
                          });
                        }}
                      />
                      <Circle
                        x={radius}
                        y={radius}
                        radius={transformHandleRadius}
                        fill="#ffffff"
                        stroke="#0f1b1a"
                        strokeWidth={0.15}
                        hitStrokeWidth={transformHandleHitStrokeWidth}
                        draggable={!item.locked}
                        onMouseDown={(event) => {
                          event.cancelBubble = true;
                        }}
                        onDragStart={() => pushHistory(clone(objects))}
                        onDragMove={(event) => {
                          let localX = Math.max(
                            minSize,
                            Math.abs(event.target.x())
                          );
                          let localY = Math.max(
                            minSize,
                            Math.abs(event.target.y())
                          );
                          const constrained = event.evt?.shiftKey;
                          const allowFreeSize = !!event.evt?.altKey;
                          if (constrained) {
                            const snapSize = Math.max(localX, localY);
                            const nextSize = allowFreeSize
                              ? snapSize
                              : snapSizeValue(snapSize, minSize);
                            localX = nextSize;
                            localY = nextSize;
                          } else if (!allowFreeSize) {
                            localX = snapSizeValue(localX, minSize);
                            localY = snapSizeValue(localY, minSize);
                          }
                          const nextSize = Math.max(localX, localY);
                          const nextRadius = Math.max(minSize, nextSize);
                          const minScale = 0.2;
                          const nextScale = constrained
                            ? { x: 1, y: 1 }
                            : {
                                x: Math.max(minScale, localX / nextRadius),
                                y: Math.max(minScale, localY / nextRadius),
                              };
                          updateObject(board.id, frameIndex, item.id, {
                            radius: nextRadius,
                            scale: nextScale,
                          });
                          event.target.position({
                            x: localX,
                            y: localY,
                          });
                        }}
                        onDragEnd={(event) => {
                          const allowFreeSize = !!event.evt?.altKey;
                          const localX = allowFreeSize
                            ? Math.max(minSize, Math.abs(event.target.x()))
                            : snapSizeValue(
                                Math.max(minSize, Math.abs(event.target.x())),
                                minSize
                              );
                          const localY = allowFreeSize
                            ? Math.max(minSize, Math.abs(event.target.y()))
                            : snapSizeValue(
                                Math.max(minSize, Math.abs(event.target.y())),
                                minSize
                              );
                          const constrained = !!event.evt?.shiftKey;
                          const nextSize = Math.max(localX, localY);
                          const nextRadius = Math.max(minSize, nextSize);
                          const minScale = 0.2;
                          const nextScale = constrained
                            ? { x: 1, y: 1 }
                            : {
                                x: Math.max(minScale, localX / nextRadius),
                                y: Math.max(minScale, localY / nextRadius),
                              };
                          updateObject(board.id, frameIndex, item.id, {
                            radius: nextRadius,
                            scale: nextScale,
                          });
                          event.target.position({
                            x: localX,
                            y: localY,
                          });
                        }}
                      />
                    </Group>
                  );
                }
                if (item.type === "polygon") {
                  const bounds = getPolygonBounds(item.points);
                  const width = Math.max(minSize, bounds.width);
                  const height = Math.max(minSize, bounds.height);
                  const scaleX = item.scale.x || 1;
                  const scaleY = item.scale.y || 1;
                  const rotateHandle = {
                    x: bounds.minX - transformHandleHalf,
                    y: bounds.minY - transformHandleHalf,
                  };
                  const center = {
                    x: bounds.minX + width / 2,
                    y: bounds.minY + height / 2,
                  };
                  return (
                    <Group
                      key={`${item.id}-shape-handles`}
                      x={item.position.x}
                      y={item.position.y}
                      rotation={item.rotation}
                      scaleX={scaleX}
                      scaleY={scaleY}
                    >
                      <Line
                        points={[
                          center.x,
                          center.y,
                          rotateHandle.x,
                          rotateHandle.y,
                        ]}
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth={0.2}
                        dash={[0.6, 0.6]}
                        listening={false}
                      />
                      <Circle
                        x={rotateHandle.x}
                        y={rotateHandle.y}
                        radius={transformHandleRadius}
                        fill="#ffffff"
                        stroke="#0f1b1a"
                        strokeWidth={0.15}
                        hitStrokeWidth={transformHandleHitStrokeWidth}
                        draggable={!item.locked}
                        onMouseDown={(event) => {
                          event.cancelBubble = true;
                        }}
                        onDragStart={() => pushHistory(clone(objects))}
                        onDragMove={(event) => {
                          const rawAngle =
                            getRawRotationAngleFromPointer(event, center) ??
                            item.rotation;
                          const snapKey = `${item.id}:rotate`;
                          const angle = event.evt?.altKey
                            ? rawAngle
                            : getStableSnappedRotation(rawAngle, snapKey);
                          if (event.evt?.altKey) {
                            clearRotationSnapState(snapKey);
                          }
                          const nextPosition = getCenterAnchoredPositionForRotation({
                            position: item.position,
                            center,
                            scale: { x: scaleX, y: scaleY },
                            fromAngle: item.rotation,
                            toAngle: angle,
                          });
                          updateObject(board.id, frameIndex, item.id, {
                            rotation: angle,
                            position: nextPosition,
                          });
                        }}
                        onDragEnd={() => {
                          clearRotationSnapState(`${item.id}:rotate`);
                        }}
                      />
                      <Rect
                        x={bounds.maxX - transformHandleHalf}
                        y={bounds.maxY - transformHandleHalf}
                        width={transformHandleSize}
                        height={transformHandleSize}
                        fill="#ffffff"
                        stroke="#0f1b1a"
                        strokeWidth={0.15}
                        cornerRadius={0.2 * mobileTransformScale}
                        hitStrokeWidth={transformHandleHitStrokeWidth}
                        draggable={!item.locked}
                        onMouseDown={(event) => {
                          event.cancelBubble = true;
                        }}
                        onDragStart={() => pushHistory(clone(objects))}
                        onDragMove={(event) => {
                          const allowFreeSize = !!event.evt?.altKey;
                          const baseX = Math.max(
                            minSize,
                            (event.target.x() - bounds.minX) / scaleX
                          );
                          const baseY = Math.max(
                            minSize,
                            (event.target.y() - bounds.minY) / scaleY
                          );
                          const constrained = event.evt?.shiftKey;
                          let nextWidth = allowFreeSize
                            ? baseX
                            : snapSizeValue(baseX, minSize);
                          let nextHeight = allowFreeSize
                            ? baseY
                            : snapSizeValue(baseY, minSize);
                          if (constrained) {
                            const proportional = getProportionalDimensions(
                              nextWidth,
                              nextHeight,
                              width,
                              height
                            );
                            nextWidth = allowFreeSize
                              ? proportional.width
                              : snapSizeValue(proportional.width, minSize);
                            nextHeight = allowFreeSize
                              ? proportional.height
                              : snapSizeValue(proportional.height, minSize);
                          }
                          updateObject(board.id, frameIndex, item.id, {
                            points: scalePolygonPoints(
                              item.points,
                              nextWidth,
                              nextHeight
                            ),
                          });
                          event.target.position({
                            x: bounds.minX + nextWidth,
                            y: bounds.minY + nextHeight,
                          });
                        }}
                      />
                    </Group>
                  );
                }
                const width = "width" in item ? item.width : 0;
                const height = "height" in item ? item.height ?? 0 : 0;
                const scaleX = item.scale.x || 1;
                const scaleY = item.scale.y || 1;
                const rotateHandle = {
                  x: -transformHandleHalf,
                  y: -transformHandleHalf,
                };
                const center = { x: width / 2, y: height / 2 };
                return (
                  <Group
                    key={`${item.id}-shape-handles`}
                    x={item.position.x}
                    y={item.position.y}
                    rotation={item.rotation}
                    scaleX={scaleX}
                    scaleY={scaleY}
                  >
                    <Line
                      points={[
                        center.x,
                        center.y,
                        rotateHandle.x,
                        rotateHandle.y,
                      ]}
                      stroke="rgba(255,255,255,0.5)"
                      strokeWidth={0.2}
                      dash={[0.6, 0.6]}
                      listening={false}
                    />
                    <Circle
                      x={rotateHandle.x}
                      y={rotateHandle.y}
                      radius={transformHandleRadius}
                      fill="#ffffff"
                      stroke="#0f1b1a"
                      strokeWidth={0.15}
                      hitStrokeWidth={transformHandleHitStrokeWidth}
                      draggable={!item.locked}
                      onMouseDown={(event) => {
                        event.cancelBubble = true;
                      }}
                      onDragStart={() => pushHistory(clone(objects))}
                      onDragMove={(event) => {
                        const rawAngle =
                          getRawRotationAngleFromPointer(event, center) ??
                          item.rotation;
                        const snapKey = `${item.id}:rotate`;
                        const angle = event.evt?.altKey
                          ? rawAngle
                          : getStableSnappedRotation(rawAngle, snapKey);
                        if (event.evt?.altKey) {
                          clearRotationSnapState(snapKey);
                        }
                        const nextPosition = getCenterAnchoredPositionForRotation({
                          position: item.position,
                          center,
                          scale: { x: scaleX, y: scaleY },
                          fromAngle: item.rotation,
                          toAngle: angle,
                        });
                        updateObject(board.id, frameIndex, item.id, {
                          rotation: angle,
                          position: nextPosition,
                        });
                      }}
                      onDragEnd={(event) => {
                        clearRotationSnapState(`${item.id}:rotate`);
                        event.target.position({
                          x: rotateHandle.x * scaleX,
                          y: rotateHandle.y * scaleY,
                        });
                      }}
                    />
                    <Rect
                      x={width - transformHandleHalf}
                      y={height - transformHandleHalf}
                      width={transformHandleSize}
                      height={transformHandleSize}
                      fill="#ffffff"
                      stroke="#0f1b1a"
                      strokeWidth={0.15}
                      cornerRadius={0.2 * mobileTransformScale}
                      hitStrokeWidth={transformHandleHitStrokeWidth}
                      draggable={!item.locked}
                      onMouseDown={(event) => {
                        event.cancelBubble = true;
                      }}
                      onDragStart={() => pushHistory(clone(objects))}
                      onDragMove={(event) => {
                        const allowFreeSize = !!event.evt?.altKey;
                        const baseX = Math.max(
                          minSize,
                          event.target.x() / scaleX
                        );
                        const baseY = Math.max(
                          minSize,
                          event.target.y() / scaleY
                        );
                        const constrained = event.evt?.shiftKey;
                        const localX = allowFreeSize
                          ? baseX
                          : snapSizeValue(baseX, minSize);
                        const localY = allowFreeSize
                          ? baseY
                          : snapSizeValue(baseY, minSize);
                        let nextWidth = localX;
                        let nextHeight = localY;
                        if (constrained) {
                          const baseWidth = Math.max(minSize, width);
                          const baseHeight = Math.max(minSize, height);
                          const proportional = getProportionalDimensions(
                            localX,
                            localY,
                            baseWidth,
                            baseHeight
                          );
                          if (allowFreeSize) {
                            nextWidth = proportional.width;
                            nextHeight = proportional.height;
                          } else {
                            const dominantBase = Math.max(baseWidth, baseHeight);
                            const dominantNext = Math.max(
                              proportional.width,
                              proportional.height
                            );
                            const snappedDominant = snapSizeValue(
                              dominantNext,
                              dominantBase
                            );
                            const factor = snappedDominant / dominantBase;
                            nextWidth = baseWidth * factor;
                            nextHeight = baseHeight * factor;
                          }
                        }
                        updateObject(board.id, frameIndex, item.id, {
                          width: nextWidth,
                          height: nextHeight,
                        });
                        event.target.position({
                          x: nextWidth * scaleX,
                          y: nextHeight * scaleY,
                        });
                      }}
                    />
                  </Group>
                );
              })}
            {sortedObjects
              .filter(
                (item) => selection.includes(item.id) && item.type === "text"
              )
              .map((item) => {
                const label = item as TextLabel;
                const minSize = 2;
                const width = label.width;
                const height =
                  label.height ??
                  (label.text.split("\n").length || 1) * label.fontSize * 1.4;
                const scaleX = label.scale.x || 1;
                const scaleY = label.scale.y || 1;
                const rotateHandle = {
                  x: -transformHandleHalf,
                  y: -transformHandleHalf,
                };
                const center = { x: width / 2, y: height / 2 };
                return (
                  <Group
                    key={`${label.id}-text-handles`}
                    x={label.position.x}
                    y={label.position.y}
                    rotation={label.rotation}
                    scaleX={scaleX}
                    scaleY={scaleY}
                  >
                    <Line
                      points={[
                        center.x,
                        center.y,
                        rotateHandle.x,
                        rotateHandle.y,
                      ]}
                      stroke="rgba(255,255,255,0.5)"
                      strokeWidth={0.2}
                      dash={[0.6, 0.6]}
                      listening={false}
                    />
                    <Circle
                      x={rotateHandle.x}
                      y={rotateHandle.y}
                      radius={transformHandleRadius}
                      fill="#ffffff"
                      stroke="#0f1b1a"
                      strokeWidth={0.15}
                      hitStrokeWidth={transformHandleHitStrokeWidth}
                      draggable={!label.locked}
                      onMouseDown={(event) => {
                        event.cancelBubble = true;
                      }}
                      onDragStart={() => pushHistory(clone(objects))}
                      onDragMove={(event) => {
                        const stage = event.target.getStage();
                        const parent = event.target.getParent();
                        const pointer = stage?.getPointerPosition();
                        if (!pointer || !parent) {
                          return;
                        }
                        const centerPoint = parent
                          .getAbsoluteTransform()
                          .point(center);
                        const rawAngle =
                          (Math.atan2(
                            pointer.y - centerPoint.y,
                            pointer.x - centerPoint.x
                          ) *
                            180) /
                            Math.PI +
                          90;
                        const snapKey = `${label.id}:rotate`;
                        const angle = event.evt?.altKey
                          ? rawAngle
                          : getStableSnappedRotation(rawAngle, snapKey);
                        if (event.evt?.altKey) {
                          clearRotationSnapState(snapKey);
                        }
                        const nextPosition = getCenterAnchoredPositionForRotation({
                          position: label.position,
                          center,
                          scale: { x: scaleX, y: scaleY },
                          fromAngle: label.rotation,
                          toAngle: angle,
                        });
                        updateObject(board.id, frameIndex, label.id, {
                          rotation: angle,
                          position: nextPosition,
                        });
                      }}
                      onDragEnd={(event) => {
                        clearRotationSnapState(`${label.id}:rotate`);
                        event.target.position({
                          x: rotateHandle.x * scaleX,
                          y: rotateHandle.y * scaleY,
                        });
                      }}
                    />
                    <Rect
                      width={width}
                      height={height}
                      stroke="rgba(255,255,255,0.6)"
                      strokeWidth={0.2}
                      dash={[0.8, 0.6]}
                      listening={false}
                    />
                    <Rect
                      x={width - transformHandleHalf}
                      y={height - transformHandleHalf}
                      width={transformHandleSize}
                      height={transformHandleSize}
                      fill="#ffffff"
                      stroke="#0f1b1a"
                      strokeWidth={0.15}
                      cornerRadius={0.2 * mobileTransformScale}
                      hitStrokeWidth={transformHandleHitStrokeWidth}
                      draggable={!label.locked}
                      onMouseDown={(event) => {
                        event.cancelBubble = true;
                      }}
                      onDragStart={() => pushHistory(clone(objects))}
                      onDragMove={(event) => {
                        const allowFreeSize = !!event.evt?.altKey;
                        const baseX = Math.max(
                          minSize,
                          event.target.x() / scaleX
                        );
                        const baseY = Math.max(
                          minSize,
                          event.target.y() / scaleY
                        );
                        const localX = allowFreeSize
                          ? baseX
                          : snapSizeValue(baseX, minSize);
                        const localY = allowFreeSize
                          ? baseY
                          : snapSizeValue(baseY, minSize);
                        const constrained = !!event.evt?.shiftKey;
                        let nextWidth = localX;
                        let nextHeight = localY;
                        if (constrained) {
                          const baseWidth = Math.max(minSize, width);
                          const baseHeight = Math.max(minSize, height);
                          const proportional = getProportionalDimensions(
                            localX,
                            localY,
                            baseWidth,
                            baseHeight
                          );
                          if (allowFreeSize) {
                            nextWidth = proportional.width;
                            nextHeight = proportional.height;
                          } else {
                            const dominantBase = Math.max(baseWidth, baseHeight);
                            const dominantNext = Math.max(
                              proportional.width,
                              proportional.height
                            );
                            const snappedDominant = snapSizeValue(
                              dominantNext,
                              dominantBase
                            );
                            const factor = snappedDominant / dominantBase;
                            nextWidth = baseWidth * factor;
                            nextHeight = baseHeight * factor;
                          }
                        }
                        updateObject(board.id, frameIndex, label.id, {
                          width: nextWidth,
                          height: nextHeight,
                        });
                        event.target.position({
                          x: nextWidth * scaleX,
                          y: nextHeight * scaleY,
                        });
                      }}
                    />
                  </Group>
                );
              })}
            {sortedObjects
              .filter(
                (item) =>
                  selection.includes(item.id) &&
                  (
                    item.type === "cone" ||
                    item.type === "goal" ||
                    item.type === "pole" ||
                    item.type === "mannequin"
                  )
              )
              .map((item) => {
                const width = "width" in item ? item.width : 0;
                const height = "height" in item ? item.height ?? 0 : 0;
                const scaleX = item.scale.x || 1;
                const scaleY = item.scale.y || 1;
                const rotateHandle = {
                  x: -transformHandleHalf,
                  y: -transformHandleHalf,
                };
                const center = { x: width / 2, y: height / 2 };
                const minSize = 2;
                return (
                  <Group
                    key={`${item.id}-handles`}
                    x={item.position.x}
                    y={item.position.y}
                    rotation={item.rotation}
                    scaleX={scaleX}
                    scaleY={scaleY}
                  >
                    <Line
                      points={[
                        center.x,
                        center.y,
                        rotateHandle.x,
                        rotateHandle.y,
                      ]}
                      stroke="rgba(255,255,255,0.5)"
                      strokeWidth={0.2}
                      dash={[0.6, 0.6]}
                      listening={false}
                    />
                    <Circle
                      x={rotateHandle.x}
                      y={rotateHandle.y}
                      radius={transformHandleRadius}
                      fill="#ffffff"
                      stroke="#0f1b1a"
                      strokeWidth={0.15}
                      hitStrokeWidth={transformHandleHitStrokeWidth}
                      draggable={!item.locked}
                      onMouseDown={(event) => {
                        event.cancelBubble = true;
                      }}
                      onDragStart={() => pushHistory(clone(objects))}
                      onDragMove={(event) => {
                        const rawAngle =
                          getRawRotationAngleFromPointer(event, center) ??
                          item.rotation;
                        const snapKey = `${item.id}:rotate`;
                        const angle = event.evt?.altKey
                          ? rawAngle
                          : getStableSnappedRotation(rawAngle, snapKey);
                        if (event.evt?.altKey) {
                          clearRotationSnapState(snapKey);
                        }
                        const nextPosition = getCenterAnchoredPositionForRotation({
                          position: item.position,
                          center,
                          scale: { x: scaleX, y: scaleY },
                          fromAngle: item.rotation,
                          toAngle: angle,
                        });
                        updateObject(board.id, frameIndex, item.id, {
                          rotation: angle,
                          position: nextPosition,
                        });
                      }}
                      onDragEnd={(event) => {
                        clearRotationSnapState(`${item.id}:rotate`);
                        event.target.position({
                          x: rotateHandle.x * scaleX,
                          y: rotateHandle.y * scaleY,
                        });
                      }}
                    />
                    <Rect
                      x={width - transformHandleHalf}
                      y={height - transformHandleHalf}
                      width={transformHandleSize}
                      height={transformHandleSize}
                      fill="#ffffff"
                      stroke="#0f1b1a"
                      strokeWidth={0.15}
                      cornerRadius={0.2 * mobileTransformScale}
                      hitStrokeWidth={transformHandleHitStrokeWidth}
                      draggable={!item.locked}
                      onMouseDown={(event) => {
                        event.cancelBubble = true;
                      }}
                      onDragStart={() => pushHistory(clone(objects))}
                      onDragMove={(event) => {
                        const allowFreeSize = !!event.evt?.altKey;
                        const baseX = Math.max(
                          minSize,
                          event.target.x() / scaleX
                        );
                        const baseY = Math.max(
                          minSize,
                          event.target.y() / scaleY
                        );
                        const localX = allowFreeSize
                          ? baseX
                          : snapSizeValue(baseX, minSize);
                        const localY = allowFreeSize
                          ? baseY
                          : snapSizeValue(baseY, minSize);
                        const constrained = !!event.evt?.shiftKey;
                        let nextWidth = localX;
                        let nextHeight = localY;
                        if (constrained) {
                          const baseWidth = Math.max(minSize, width);
                          const baseHeight = Math.max(minSize, height);
                          const proportional = getProportionalDimensions(
                            localX,
                            localY,
                            baseWidth,
                            baseHeight
                          );
                          if (allowFreeSize) {
                            nextWidth = proportional.width;
                            nextHeight = proportional.height;
                          } else {
                            const dominantBase = Math.max(baseWidth, baseHeight);
                            const dominantNext = Math.max(
                              proportional.width,
                              proportional.height
                            );
                            const snappedDominant = snapSizeValue(
                              dominantNext,
                              dominantBase
                            );
                            const factor = snappedDominant / dominantBase;
                            nextWidth = baseWidth * factor;
                            nextHeight = baseHeight * factor;
                          }
                        }
                        updateObject(board.id, frameIndex, item.id, {
                          width: nextWidth,
                          height: nextHeight,
                        });
                        event.target.position({
                          x: nextWidth * scaleX,
                          y: nextHeight * scaleY,
                        });
                      }}
                    />
                  </Group>
                );
              })}
            {selection.length > 0 && !isSharedReadOnly && (() => {
              const selectedItem = objects.find(
                (item) => item.id === selection[0]
              );
              const selectedItems = objects.filter((item) =>
                selection.includes(item.id)
              );
              if (!selectedItem) {
                return null;
              }
              const shouldLock = !selectedItems.every((item) => item.locked);
              const anchor = getObjectActionAnchor(selectedItem);
              const isObjectMenuOpen = objectActionMenuId === selectedItem.id;
              const actionAnchorOffsetX = 1.4;
              const actionAnchorOffsetY = -1.4;
              const menuWidth = 9.9;
              const menuHeight = 5.3;
              const menuSpacingX = 1.6;
              const menuSpacingYUp = -1.3;
              const menuSpacingYDown = 1.6;
              const anchorDisplay = rotatePointAround(
                anchor,
                rotationPivot,
                viewRotation
              );
              const viewportPadding = 0.6;
              const viewportMinX =
                rotatedBounds.minX + viewportPadding;
              const viewportMaxX =
                rotatedBounds.maxX - viewportPadding;
              const viewportMinY =
                rotatedBounds.minY + viewportPadding;
              const viewportMaxY =
                rotatedBounds.maxY - viewportPadding;
              const roomRight =
                viewportMaxX - (anchorDisplay.x + actionAnchorOffsetX);
              const roomLeft =
                anchorDisplay.x + actionAnchorOffsetX - viewportMinX;
              const roomAbove =
                anchorDisplay.y + actionAnchorOffsetY - viewportMinY;
              const roomBelow =
                viewportMaxY - (anchorDisplay.y + actionAnchorOffsetY);
              const preferLeft = roomRight < menuWidth && roomLeft > roomRight;
              const preferDown = roomAbove < menuHeight && roomBelow > roomAbove;
              const initialMenuOffsetX = preferLeft
                ? -(menuWidth + menuSpacingX)
                : menuSpacingX;
              const initialMenuOffsetY = preferDown
                ? menuSpacingYDown
                : menuSpacingYUp;
              const targetMenuX =
                anchorDisplay.x + actionAnchorOffsetX + initialMenuOffsetX;
              const targetMenuY =
                anchorDisplay.y + actionAnchorOffsetY + initialMenuOffsetY;
              const clampedMenuX = clampValue(
                targetMenuX,
                viewportMinX,
                viewportMaxX - menuWidth
              );
              const clampedMenuY = clampValue(
                targetMenuY,
                viewportMinY,
                viewportMaxY - menuHeight
              );
              const menuOffsetX =
                clampedMenuX - (anchorDisplay.x + actionAnchorOffsetX);
              const menuOffsetY =
                clampedMenuY - (anchorDisplay.y + actionAnchorOffsetY);
              return (
                <Group
                  key={`${selectedItem.id}-actions`}
                  x={anchor.x + actionAnchorOffsetX}
                  y={anchor.y + actionAnchorOffsetY}
                  rotation={labelRotation}
                  scaleX={mobileActionScale}
                  scaleY={mobileActionScale}
                >
                  <Rect
                    x={-1.3}
                    y={-1.3}
                    width={2.6}
                    height={2.6}
                    cornerRadius={0.5}
                    fill="#0f1b1a"
                    opacity={0.85}
                    stroke="#ffffff"
                    strokeWidth={0.12}
                  />
                  <Circle x={0} y={-0.48} radius={0.14} fill="#ffffff" />
                  <Circle x={0} y={0} radius={0.14} fill="#ffffff" />
                  <Circle x={0} y={0.48} radius={0.14} fill="#ffffff" />
                  <Rect
                    x={-1.3}
                    y={-1.3}
                    width={2.6}
                    height={2.6}
                    cornerRadius={0.5}
                    opacity={0}
                    onClick={(event) => {
                      event.cancelBubble = true;
                      setObjectActionMenuId((prev) =>
                        prev === selectedItem.id ? null : selectedItem.id
                      );
                    }}
                    onTap={(event) => {
                      event.cancelBubble = true;
                      setObjectActionMenuId((prev) =>
                        prev === selectedItem.id ? null : selectedItem.id
                      );
                    }}
                  />
                  {isObjectMenuOpen && (
                    <Group x={menuOffsetX} y={menuOffsetY}>
                      <Rect
                        x={0}
                        y={0}
                        width={9.9}
                        height={5.3}
                        cornerRadius={0.7}
                        fill="#0f1b1a"
                        opacity={0.92}
                        stroke="#ffffff"
                        strokeWidth={0.1}
                      />
                      <Rect
                        x={0.35}
                        y={0.35}
                        width={9.2}
                        height={2.1}
                        cornerRadius={0.45}
                        fill="rgba(20,35,32,0.9)"
                        stroke="#ffffff"
                        strokeWidth={0.08}
                      />
                      <Text
                        x={0.9}
                        y={0.92}
                        text={shouldLock ? "Lock" : "Unlock"}
                        fontSize={0.88}
                        fill="#ffffff"
                      />
                      <Rect
                        x={0.35}
                        y={2.8}
                        width={9.2}
                        height={2.1}
                        cornerRadius={0.45}
                        fill="rgba(48,17,17,0.9)"
                        stroke="#ffffff"
                        strokeWidth={0.08}
                      />
                      <Text
                        x={0.9}
                        y={3.37}
                        text="Delete"
                        fontSize={0.88}
                        fill="#ffffff"
                      />
                      <Rect
                        x={0.35}
                        y={0.35}
                        width={9.2}
                        height={2.1}
                        cornerRadius={0.45}
                        opacity={0}
                        onClick={(event) => {
                          event.cancelBubble = true;
                          pushHistory(clone(objects));
                          selectedItems.forEach((item) => {
                            updateObject(board.id, frameIndex, item.id, {
                              locked: shouldLock,
                            });
                          });
                          setObjectActionMenuId(null);
                        }}
                        onTap={(event) => {
                          event.cancelBubble = true;
                          pushHistory(clone(objects));
                          selectedItems.forEach((item) => {
                            updateObject(board.id, frameIndex, item.id, {
                              locked: shouldLock,
                            });
                          });
                          setObjectActionMenuId(null);
                        }}
                      />
                      <Rect
                        x={0.35}
                        y={2.8}
                        width={9.2}
                        height={2.1}
                        cornerRadius={0.45}
                        opacity={0}
                        onClick={(event) => {
                          event.cancelBubble = true;
                          pushHistory(clone(objects));
                          removeObject(board.id, frameIndex, selectedItem.id);
                          setSelection([]);
                          setSelectedLinkId(null);
                          setObjectActionMenuId(null);
                        }}
                        onTap={(event) => {
                          event.cancelBubble = true;
                          pushHistory(clone(objects));
                          removeObject(board.id, frameIndex, selectedItem.id);
                          setSelection([]);
                          setSelectedLinkId(null);
                          setObjectActionMenuId(null);
                        }}
                      />
                    </Group>
                  )}
                </Group>
              );
            })()}
            {selectedLinkId && !isSharedReadOnly && (() => {
              const link = playerLinks.find((entry) => entry.id === selectedLinkId);
              if (!link) {
                return null;
              }
              const points = link.playerIds
                .map((id) => playerPositions.get(id))
                .filter(Boolean) as { x: number; y: number }[];
              if (points.length < 2) {
                return null;
              }
              const segmentCenters: { x: number; y: number }[] = [];
              for (let index = 0; index < points.length - 1; index += 1) {
                const from = points[index];
                const to = points[index + 1];
                if (!from || !to) {
                  continue;
                }
                segmentCenters.push({
                  x: (from.x + to.x) / 2,
                  y: (from.y + to.y) / 2,
                });
              }
              if (segmentCenters.length === 0) {
                return null;
              }
              const centerIndex = Math.floor((segmentCenters.length - 1) / 2);
              const anchor = segmentCenters[centerIndex]!;
              return (
                <Group
                  key={`${link.id}-delete`}
                  x={anchor.x}
                  y={anchor.y}
                  rotation={labelRotation}
                  scaleX={mobileActionScale}
                  scaleY={mobileActionScale}
                >
                  <Rect
                    x={-1.3}
                    y={-1.3}
                    width={2.6}
                    height={2.6}
                    cornerRadius={0.5}
                    fill="#0f1b1a"
                    opacity={0.85}
                    stroke="#ffffff"
                    strokeWidth={0.12}
                  />
                  <Circle
                    x={-0.28}
                    y={0}
                    radius={0.42}
                    stroke="#ffffff"
                    strokeWidth={0.11}
                  />
                  <Circle
                    x={0.46}
                    y={0}
                    radius={0.42}
                    stroke="#ffffff"
                    strokeWidth={0.11}
                  />
                  <Line
                    points={[-0.02, -0.24, 0.2, -0.04]}
                    stroke="#ffffff"
                    strokeWidth={0.11}
                    lineCap="round"
                  />
                  <Line
                    points={[-0.02, 0.24, 0.2, 0.04]}
                    stroke="#ffffff"
                    strokeWidth={0.11}
                    lineCap="round"
                  />
                  <Line
                    points={[-0.86, 0.62, 0.9, -0.66]}
                    stroke="#ffffff"
                    strokeWidth={0.11}
                    lineCap="round"
                  />
                  <Rect
                    x={-1.3}
                    y={-1.3}
                    width={2.6}
                    height={2.6}
                    cornerRadius={0.5}
                    opacity={0}
                    onClick={(event) => {
                      event.cancelBubble = true;
                      const nextLinks = (activeFrame?.playerLinks ?? []).filter(
                        (entry) => entry.id !== link.id
                      );
                      const nextFrames = board.frames.map((frame, index) =>
                        index === frameIndex
                          ? { ...frame, playerLinks: nextLinks }
                          : frame
                      );
                      updateBoard(board.id, { frames: nextFrames });
                      setSelectedLinkId(null);
                    }}
                    onTap={(event) => {
                      event.cancelBubble = true;
                      const nextLinks = (activeFrame?.playerLinks ?? []).filter(
                        (entry) => entry.id !== link.id
                      );
                      const nextFrames = board.frames.map((frame, index) =>
                        index === frameIndex
                          ? { ...frame, playerLinks: nextLinks }
                          : frame
                      );
                      updateBoard(board.id, { frames: nextFrames });
                      setSelectedLinkId(null);
                    }}
                  />
                </Group>
              );
            })()}
            {latestLinkingPlayerPosition && !isSharedReadOnly && (
              <Group
                x={latestLinkingPlayerPosition.x + 2.4}
                y={latestLinkingPlayerPosition.y - 2.4}
                rotation={labelRotation}
                scaleX={mobileActionScale}
                scaleY={mobileActionScale}
              >
                <Rect
                  x={0}
                  y={0}
                  width={7.6}
                  height={2.4}
                  cornerRadius={1.1}
                  fill="rgba(9,26,21,0.92)"
                  stroke="#f9bf4a"
                  strokeWidth={0.14}
                  shadowColor="#000000"
                  shadowBlur={0.35}
                  shadowOpacity={0.32}
                  shadowOffsetY={0.1}
                />
                <Circle
                  x={3.25}
                  y={1.2}
                  radius={0.55}
                  stroke="#f9bf4a"
                  strokeWidth={0.12}
                  listening={false}
                />
                <Circle
                  x={4.35}
                  y={1.2}
                  radius={0.55}
                  stroke="#f9bf4a"
                  strokeWidth={0.12}
                  listening={false}
                />
                <Line
                  points={[3.72, 0.92, 3.88, 1.08]}
                  stroke="#f9bf4a"
                  strokeWidth={0.12}
                  lineCap="round"
                  listening={false}
                />
                <Line
                  points={[3.72, 1.48, 3.88, 1.32]}
                  stroke="#f9bf4a"
                  strokeWidth={0.12}
                  lineCap="round"
                  listening={false}
                />
                <Rect
                  x={0}
                  y={0}
                  width={7.6}
                  height={2.4}
                  cornerRadius={1.1}
                  opacity={0}
                  onClick={(event) => {
                    event.cancelBubble = true;
                    finishLinkingPlayers();
                  }}
                  onTap={(event) => {
                    event.cancelBubble = true;
                    finishLinkingPlayers();
                  }}
                />
              </Group>
            )}
            {draft && draft.type === "arrow" && (
              <Arrow
                points={[
                  draft.start.x,
                  draft.start.y,
                  draft.current.x,
                  draft.current.y,
                ]}
                stroke="#ffffff"
                strokeWidth={0.65}
                pointerLength={getArrowHeadSize(0.65).length}
                pointerWidth={getArrowHeadSize(0.65).width}
              />
            )}
            {draft && draft.type === "path" && (
              <Line
                points={(draft.points ?? []).flatMap((value, index) =>
                  index % 2 === 0
                    ? [value + draft.start.x]
                    : [value + draft.start.y]
                )}
                stroke="#f9bf4a"
                strokeWidth={0.65}
                tension={0.45}
                lineCap="round"
                lineJoin="round"
              />
            )}
            {draft && draft.type === "polygon" && (
              <>
                {(() => {
                  const draftPoints = draft.points ?? [];
                  const vertexPoints = draftPoints.reduce<
                    { x: number; y: number; key: string; isStart: boolean }[]
                  >((result, value, index) => {
                    if (index % 2 !== 0) {
                      return result;
                    }
                    result.push({
                      x: draft.start.x + value,
                      y: draft.start.y + (draftPoints[index + 1] ?? 0),
                      key: `${value}:${draftPoints[index + 1] ?? 0}:${index}`,
                      isStart: index === 0,
                    });
                    return result;
                  }, []);
                  const canClose =
                    draftPoints.length >= 6 &&
                    Math.hypot(
                      draft.current.x - draft.start.x,
                      draft.current.y - draft.start.y
                    ) <= 1.2;
                  return (
                    <>
                      <Line
                        points={[
                          ...(draftPoints.flatMap((value, index) =>
                            index % 2 === 0
                              ? [value + draft.start.x]
                              : [value + draft.start.y]
                          )),
                          draft.current.x,
                          draft.current.y,
                        ]}
                        closed
                        fill="rgba(255,255,255,0.12)"
                        stroke="#ffffff"
                        strokeWidth={0.42}
                        lineJoin="round"
                      />
                      <Circle
                        x={draft.start.x}
                        y={draft.start.y}
                        radius={canClose ? 0.62 : 0.45}
                        fill={canClose ? "#f9bf4a" : "#ffffff"}
                        stroke="#111111"
                        strokeWidth={0.12}
                      />
                      {canClose ? (
                        <Circle
                          x={draft.start.x}
                          y={draft.start.y}
                          radius={0.95}
                          stroke="#f9bf4a"
                          strokeWidth={0.16}
                          dash={[0.22, 0.18]}
                        />
                      ) : null}
                      {vertexPoints.map((point) => (
                        <Circle
                          key={point.key}
                          x={point.x}
                          y={point.y}
                          radius={point.isStart ? 0.38 : 0.28}
                          fill={point.isStart ? "#f9bf4a" : "#ffffff"}
                          stroke="#111111"
                          strokeWidth={0.1}
                        />
                      ))}
                    </>
                  );
                })()}
              </>
            )}
            {draft &&
              draft.type !== "arrow" &&
              draft.type !== "path" &&
              draft.type !== "polygon" && (
              <Rect
                x={Math.min(draft.start.x, draft.current.x)}
                y={Math.min(draft.start.y, draft.current.y)}
                width={Math.abs(draft.current.x - draft.start.x)}
                height={Math.abs(draft.current.y - draft.start.y)}
                stroke="#ffffff"
                dash={[1, 1]}
                strokeWidth={0.3}
              />
            )}
            {marquee && (
              <Rect
                x={Math.min(marquee.start.x, marquee.current.x)}
                y={Math.min(marquee.start.y, marquee.current.y)}
                width={Math.abs(marquee.current.x - marquee.start.x)}
                height={Math.abs(marquee.current.y - marquee.start.y)}
                stroke={marqueeMode === "zoom" ? "#7dd3fc" : "#f9bf4a"}
                dash={[1, 1]}
                strokeWidth={0.3}
                fill={
                  marqueeMode === "zoom"
                    ? "rgba(125,211,252,0.12)"
                    : "rgba(249,191,74,0.08)"
                }
              />
            )}
          </Group>
        </Layer>
        </Stage>
      </div>
    </div>
  );
}
