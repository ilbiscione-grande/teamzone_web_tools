"use client";

import { useState } from "react";
import type { RefObject } from "react";
import type Konva from "konva";
import type { DrawableObject } from "@/models";
import type { Tool } from "@/state/useEditorStore";
import { clamp } from "@/utils/math";
import { clone } from "@/utils/clone";
import {
  createBall,
  createPlayer,
  createText,
  defaultStyle,
} from "@/board/objects/objectFactory";
import { createId } from "@/utils/id";

type DraftShape = {
  type: "circle" | "rect" | "triangle" | "arrow" | "path";
  start: { x: number; y: number };
  current: { x: number; y: number };
  points?: number[];
  constrain?: boolean;
};

type UseBoardInteractionsProps = {
  boardId: string;
  frameIndex: number;
  objects: DrawableObject[];
  activeTool: Tool;
  playerTokenSize: number;
  playerFill: string;
  readOnly: boolean;
  baseOffsetX: number;
  baseOffsetY: number;
  baseScale: number;
  viewport: { zoom: number; offsetX: number; offsetY: number };
  rotation: number;
  rotationPivot: { x: number; y: number };
  stageRef: RefObject<Konva.Stage | null>;
  setViewport: (viewport: {
    zoom?: number;
    offsetX?: number;
    offsetY?: number;
  }) => void;
  clearSelection: () => void;
  pushHistory: (snapshot: DrawableObject[]) => void;
  addObject: (boardId: string, frameIndex: number, object: DrawableObject) => void;
  disablePanZoom?: boolean;
};

export const useBoardInteractions = ({
  boardId,
  frameIndex,
  objects,
  activeTool,
  playerTokenSize,
  playerFill,
  readOnly,
  baseOffsetX,
  baseOffsetY,
  baseScale,
  viewport,
  rotation,
  rotationPivot,
  stageRef,
  setViewport,
  clearSelection,
  pushHistory,
  addObject,
  disablePanZoom = false,
}: UseBoardInteractionsProps) => {
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const circleSnapTolerance = 0.08;
  const smoothPathPoints = (points: number[]) => {
    if (points.length <= 6) {
      return points;
    }

    const minDistance = 0.45;
    const filtered: number[] = [points[0] ?? 0, points[1] ?? 0];
    let lastX = filtered[0] ?? 0;
    let lastY = filtered[1] ?? 0;

    for (let i = 2; i < points.length; i += 2) {
      const x = points[i] ?? lastX;
      const y = points[i + 1] ?? lastY;
      if (Math.hypot(x - lastX, y - lastY) < minDistance) {
        continue;
      }
      filtered.push(x, y);
      lastX = x;
      lastY = y;
    }

    const endX = points[points.length - 2];
    const endY = points[points.length - 1];
    if (
      typeof endX === "number" &&
      typeof endY === "number" &&
      (filtered[filtered.length - 2] !== endX ||
        filtered[filtered.length - 1] !== endY)
    ) {
      filtered.push(endX, endY);
    }

    if (filtered.length <= 6) {
      return filtered;
    }

    const smoothed: number[] = [filtered[0] ?? 0, filtered[1] ?? 0];
    for (let i = 2; i < filtered.length - 2; i += 2) {
      const px = filtered[i - 2] ?? filtered[i] ?? 0;
      const py = filtered[i - 1] ?? filtered[i + 1] ?? 0;
      const cx = filtered[i] ?? px;
      const cy = filtered[i + 1] ?? py;
      const nx = filtered[i + 2] ?? cx;
      const ny = filtered[i + 3] ?? cy;
      smoothed.push(px * 0.25 + cx * 0.5 + nx * 0.25);
      smoothed.push(py * 0.25 + cy * 0.5 + ny * 0.25);
    }
    smoothed.push(
      filtered[filtered.length - 2] ?? 0,
      filtered[filtered.length - 1] ?? 0
    );
    return smoothed;
  };

  const rotatePoint = (
    point: { x: number; y: number },
    pivot: { x: number; y: number },
    degrees: number
  ) => {
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const dx = point.x - pivot.x;
    const dy = point.y - pivot.y;
    return {
      x: pivot.x + dx * cos - dy * sin,
      y: pivot.y + dx * sin + dy * cos,
    };
  };

  const screenToWorld = (pointer: { x: number; y: number }, zoom: number) => {
    const stagePoint = {
      x: (pointer.x - (baseOffsetX + viewport.offsetX)) / (baseScale * zoom),
      y: (pointer.y - (baseOffsetY + viewport.offsetY)) / (baseScale * zoom),
    };
    if (rotation !== 0) {
      return rotatePoint(stagePoint, rotationPivot, -rotation);
    }
    return stagePoint;
  };

  const stageToWorld = (pointer: { x: number; y: number }) =>
    screenToWorld(pointer, viewport.zoom);

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    if (readOnly || disablePanZoom) {
      return;
    }
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const oldZoom = viewport.zoom;
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }
    const zoomDirection = event.evt.deltaY > 0 ? -1 : 1;
    const zoom = clamp(oldZoom + zoomDirection * 0.1, 0.5, 2.5);
    const mousePointTo = screenToWorld(pointer, oldZoom);
    const newOffsetX = pointer.x - mousePointTo.x * baseScale * zoom - baseOffsetX;
    const newOffsetY = pointer.y - mousePointTo.y * baseScale * zoom - baseOffsetY;
    setViewport({ zoom, offsetX: newOffsetX, offsetY: newOffsetY });
  };

  const isLineTool =
    activeTool === "line" ||
    activeTool === "line_dashed" ||
    activeTool === "arrow" ||
    activeTool === "arrow_dashed";
  const isFreehandTool = activeTool === "freehand";
  const isShapeTool =
    activeTool === "circle" ||
    activeTool === "rect" ||
    activeTool === "triangle" ||
    isLineTool ||
    isFreehandTool;

  const linePreset = {
    head: activeTool === "arrow" || activeTool === "arrow_dashed",
    dashed: activeTool === "line_dashed" || activeTool === "arrow_dashed",
  };

  const handleMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const isStage = event.target === stage || event.target.getParent() === stage;
    if (isStage) {
      clearSelection();
      if (readOnly) {
        return;
      }
      if (!isShapeTool) {
        if (disablePanZoom) {
          return;
        }
        setIsPanning(true);
        return;
      }
    } else {
      return;
    }
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }
    const world = stageToWorld(pointer);

    if (activeTool === "circle") {
      setDraft({
        type: "circle",
        start: world,
        current: world,
        constrain: event.evt.shiftKey,
      });
    }
    if (activeTool === "rect") {
      setDraft({
        type: "rect",
        start: world,
        current: world,
        constrain: event.evt.shiftKey,
      });
    }
    if (activeTool === "triangle") {
      setDraft({
        type: "triangle",
        start: world,
        current: world,
        constrain: event.evt.shiftKey,
      });
    }
    if (isLineTool) {
      setDraft({
        type: "arrow",
        start: world,
        current: world,
        constrain: event.evt.shiftKey,
      });
    }
    if (isFreehandTool) {
      setDraft({
        type: "path",
        start: world,
        current: world,
        points: [0, 0],
        constrain: false,
      });
    }
  };

  const handleMouseMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (!draft) {
      return;
    }
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }
    const world = stageToWorld(pointer);
    if (draft.type === "path") {
      const points = draft.points ?? [0, 0];
      const lastX = points[points.length - 2] ?? 0;
      const lastY = points[points.length - 1] ?? 0;
      const nextX = world.x - draft.start.x;
      const nextY = world.y - draft.start.y;
      if (Math.hypot(nextX - lastX, nextY - lastY) < 0.25) {
        return;
      }
      setDraft({
        ...draft,
        current: world,
        points: [...points, nextX, nextY],
        constrain: false,
      });
      return;
    }
    setDraft({
      ...draft,
      current: world,
      constrain: event.evt.shiftKey,
    });
  };

  const commitDraft = () => {
    if (!draft) {
      return;
    }
    const dragDistance = Math.hypot(
      draft.current.x - draft.start.x,
      draft.current.y - draft.start.y
    );
    if (dragDistance < 0.5) {
      setDraft(null);
      return;
    }
    pushHistory(clone(objects));
    const { start, current } = draft;
    if (draft.type === "circle") {
      const dx = Math.abs(current.x - start.x);
      const dy = Math.abs(current.y - start.y);
      const size = Math.max(dx, dy);
      const radius = Math.max(1, size);
      const ratio = size > 0 ? Math.abs(dx - dy) / size : 0;
      const shouldSnap = draft.constrain || ratio <= circleSnapTolerance;
      const minScale = 0.2;
      const scale = shouldSnap
        ? { x: 1, y: 1 }
        : {
            x: Math.max(minScale, dx / radius),
            y: Math.max(minScale, dy / radius),
          };
      addObject(boardId, frameIndex, {
        id: createId(),
        type: "circle",
        position: start,
        rotation: 0,
        scale,
        style: { ...defaultStyle },
        zIndex: 1,
        locked: false,
        visible: true,
        radius,
      });
    }
    if (draft.type === "rect") {
      const x = Math.min(start.x, current.x);
      const y = Math.min(start.y, current.y);
      let width = Math.abs(current.x - start.x);
      let height = Math.abs(current.y - start.y);
      if (draft.constrain) {
        const size = Math.max(width, height);
        width = size;
        height = size;
      }
      addObject(boardId, frameIndex, {
        id: createId(),
        type: "rect",
        position: { x, y },
        rotation: 0,
        scale: { x: 1, y: 1 },
        style: { ...defaultStyle },
        zIndex: 1,
        locked: false,
        visible: true,
        width,
        height,
        cornerRadius: 0.4,
      });
    }
    if (draft.type === "triangle") {
      const x = Math.min(start.x, current.x);
      const y = Math.min(start.y, current.y);
      const width = Math.abs(current.x - start.x);
      const height = Math.abs(current.y - start.y);
      addObject(boardId, frameIndex, {
        id: createId(),
        type: "triangle",
        position: { x, y },
        rotation: 0,
        scale: { x: 1, y: 1 },
        style: { ...defaultStyle },
        zIndex: 1,
        locked: false,
        visible: true,
        width,
        height,
      });
    }
    if (draft.type === "arrow") {
      addObject(boardId, frameIndex, {
        id: createId(),
        type: "arrow",
        position: start,
        rotation: 0,
        scale: { x: 1, y: 1 },
        style: {
          ...defaultStyle,
          stroke: "#f9bf4a",
          strokeWidth: 0.65,
          outlineStroke: "#111111",
        },
        zIndex: 1,
        locked: false,
        visible: true,
        points: [0, 0, current.x - start.x, current.y - start.y],
        head: linePreset.head,
        dashed: linePreset.dashed,
        curved: false,
      });
    }
    if (draft.type === "path") {
      const points = smoothPathPoints(draft.points ?? []);
      if (points.length >= 4) {
        addObject(boardId, frameIndex, {
          id: createId(),
          type: "path",
          position: start,
          rotation: 0,
          scale: { x: 1, y: 1 },
          style: {
            ...defaultStyle,
            stroke: "#f9bf4a",
            strokeWidth: 0.65,
            dash: [],
            outlineStroke: "#111111",
          },
          zIndex: 1,
          locked: false,
          visible: true,
          points,
        });
      }
    }
    setDraft(null);
  };

  const handleMouseUp = () => {
    if (draft) {
      commitDraft();
    }
    if (isPanning) {
      const stage = stageRef.current;
      if (stage) {
        setViewport({
          offsetX: stage.x() - baseOffsetX,
          offsetY: stage.y() - baseOffsetY,
        });
      }
      setIsPanning(false);
    }
  };

  const handleTouchStart = (event: Konva.KonvaEventObject<TouchEvent>) => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const isStage = event.target === stage || event.target.getParent() === stage;
    if (isStage) {
      clearSelection();
      if (readOnly) {
        return;
      }
      if (!isShapeTool) {
        if (disablePanZoom) {
          return;
        }
        setIsPanning(true);
        return;
      }
    } else {
      return;
    }
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }
    const world = stageToWorld(pointer);
    event.evt.preventDefault();
    if (activeTool === "circle") {
      setDraft({ type: "circle", start: world, current: world, constrain: false });
    }
    if (activeTool === "rect") {
      setDraft({ type: "rect", start: world, current: world, constrain: false });
    }
    if (activeTool === "triangle") {
      setDraft({ type: "triangle", start: world, current: world, constrain: false });
    }
    if (isLineTool) {
      setDraft({ type: "arrow", start: world, current: world, constrain: false });
    }
    if (isFreehandTool) {
      setDraft({
        type: "path",
        start: world,
        current: world,
        points: [0, 0],
        constrain: false,
      });
    }
  };

  const handleTouchMove = (event: Konva.KonvaEventObject<TouchEvent>) => {
    if (!draft && !isPanning) {
      return;
    }
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }
    event.evt.preventDefault();
    if (draft) {
      const world = stageToWorld(pointer);
      if (draft.type === "path") {
        const points = draft.points ?? [0, 0];
        const lastX = points[points.length - 2] ?? 0;
        const lastY = points[points.length - 1] ?? 0;
        const nextX = world.x - draft.start.x;
        const nextY = world.y - draft.start.y;
        if (Math.hypot(nextX - lastX, nextY - lastY) < 0.25) {
          return;
        }
        setDraft({
          ...draft,
          current: world,
          points: [...points, nextX, nextY],
          constrain: false,
        });
        return;
      }
      setDraft({ ...draft, current: world, constrain: false });
      return;
    }
  };

  const handleTouchEnd = () => {
    if (draft) {
      commitDraft();
    }
    if (isPanning) {
      const stage = stageRef.current;
      if (stage) {
        setViewport({
          offsetX: stage.x() - baseOffsetX,
          offsetY: stage.y() - baseOffsetY,
        });
      }
      setIsPanning(false);
    }
  };

  const handleDoubleClick = () => {
    if (readOnly) {
      return;
    }
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }
    const world = stageToWorld(pointer);
    if (activeTool === "player") {
      pushHistory(clone(objects));
      addObject(
        boardId,
        frameIndex,
        createPlayer(world, playerTokenSize, playerFill)
      );
    }
    if (activeTool === "ball") {
      pushHistory(clone(objects));
      addObject(boardId, frameIndex, createBall(world));
    }
    if (activeTool === "cone") {
      pushHistory(clone(objects));
      addObject(boardId, frameIndex, {
        id: createId(),
        type: "cone",
        position: world,
        rotation: 0,
        scale: { x: 1, y: 1 },
        style: { ...defaultStyle, fill: "#f06d4f" },
        zIndex: 1,
        locked: false,
        visible: true,
        width: 6,
        height: 6,
      });
    }
    if (activeTool === "goal") {
      pushHistory(clone(objects));
      addObject(boardId, frameIndex, {
        id: createId(),
        type: "goal",
        position: world,
        rotation: 0,
        scale: { x: 1, y: 1 },
        style: { ...defaultStyle, fill: "rgba(255,255,255,0.05)" },
        zIndex: 1,
        locked: false,
        visible: true,
        width: 10,
        height: 5,
      });
    }
    if (activeTool === "circle") {
      return;
    }
    if (activeTool === "rect") {
      return;
    }
    if (activeTool === "triangle") {
      return;
    }
    if (isLineTool) {
      return;
    }
    if (activeTool === "text") {
      const text = window.prompt("Enter text") ?? "";
      if (text.trim().length === 0) {
        return;
      }
      pushHistory(clone(objects));
      addObject(boardId, frameIndex, createText(world, text));
    }
  };

  const handleTap = (event: Konva.KonvaEventObject<TouchEvent>) => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const isStage = event.target === stage || event.target.getParent() === stage;
    if (isStage) {
      clearSelection();
    }
  };

  const handleClick = () => {};

  return {
    draft,
    isPanning,
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
  };
};
