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
  type: "circle" | "rect" | "triangle" | "arrow";
  start: { x: number; y: number };
  current: { x: number; y: number };
};

type UseBoardInteractionsProps = {
  boardId: string;
  frameIndex: number;
  objects: DrawableObject[];
  activeTool: Tool;
  playerTokenSize: number;
  playerFill: string;
  baseOffsetX: number;
  baseOffsetY: number;
  baseScale: number;
  viewport: { zoom: number; offsetX: number; offsetY: number };
  rotation: number;
  rotationPivot: { x: number; y: number };
  stageRef: RefObject<Konva.Stage>;
  setViewport: (viewport: {
    zoom?: number;
    offsetX?: number;
    offsetY?: number;
  }) => void;
  clearSelection: () => void;
  pushHistory: (snapshot: DrawableObject[]) => void;
  addObject: (boardId: string, frameIndex: number, object: DrawableObject) => void;
};

export const useBoardInteractions = ({
  boardId,
  frameIndex,
  objects,
  activeTool,
  playerTokenSize,
  playerFill,
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
}: UseBoardInteractionsProps) => {
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const [isPanning, setIsPanning] = useState(false);

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
  const isShapeTool =
    activeTool === "circle" ||
    activeTool === "rect" ||
    activeTool === "triangle" ||
    isLineTool;

  const linePreset = {
    head: activeTool === "arrow" || activeTool === "arrow_dashed",
    dashed: activeTool === "line_dashed" || activeTool === "arrow_dashed",
  };

  const handleMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    const isStage = event.target === event.target.getStage();
    if (isStage) {
      clearSelection();
      if (!isShapeTool) {
        setIsPanning(true);
        return;
      }
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

    if (activeTool === "circle") {
      setDraft({ type: "circle", start: world, current: world });
    }
    if (activeTool === "rect") {
      setDraft({ type: "rect", start: world, current: world });
    }
    if (activeTool === "triangle") {
      setDraft({ type: "triangle", start: world, current: world });
    }
    if (isLineTool) {
      setDraft({ type: "arrow", start: world, current: world });
    }
  };

  const handleMouseMove = () => {
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
    setDraft({ ...draft, current: stageToWorld(pointer) });
  };

  const commitDraft = () => {
    if (!draft) {
      return;
    }
    pushHistory(clone(objects));
    const { start, current } = draft;
    if (draft.type === "circle") {
      const radius = Math.max(1, Math.hypot(current.x - start.x, current.y - start.y));
      addObject(boardId, frameIndex, {
        id: createId(),
        type: "circle",
        position: start,
        rotation: 0,
        scale: { x: 1, y: 1 },
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
      const width = Math.abs(current.x - start.x);
      const height = Math.abs(current.y - start.y);
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
        style: { ...defaultStyle, strokeWidth: 0.6 },
        zIndex: 1,
        locked: false,
        visible: true,
        points: [0, 0, current.x - start.x, current.y - start.y],
        head: linePreset.head,
        dashed: linePreset.dashed,
      });
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

  const handleDoubleClick = () => {
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
      pushHistory(clone(objects));
      addObject(boardId, frameIndex, {
        id: createId(),
        type: "circle",
        position: world,
        rotation: 0,
        scale: { x: 1, y: 1 },
        style: { ...defaultStyle },
        zIndex: 1,
        locked: false,
        visible: true,
        radius: 4,
      });
    }
    if (activeTool === "rect") {
      pushHistory(clone(objects));
      addObject(boardId, frameIndex, {
        id: createId(),
        type: "rect",
        position: world,
        rotation: 0,
        scale: { x: 1, y: 1 },
        style: { ...defaultStyle },
        zIndex: 1,
        locked: false,
        visible: true,
        width: 8,
        height: 5,
        cornerRadius: 0.4,
      });
    }
    if (activeTool === "triangle") {
      pushHistory(clone(objects));
      addObject(boardId, frameIndex, {
        id: createId(),
        type: "triangle",
        position: world,
        rotation: 0,
        scale: { x: 1, y: 1 },
        style: { ...defaultStyle },
        zIndex: 1,
        locked: false,
        visible: true,
        width: 8,
        height: 6,
      });
    }
    if (isLineTool) {
      pushHistory(clone(objects));
      addObject(boardId, frameIndex, {
        id: createId(),
        type: "arrow",
        position: world,
        rotation: 0,
        scale: { x: 1, y: 1 },
        style: { ...defaultStyle, strokeWidth: 0.6 },
        zIndex: 1,
        locked: false,
        visible: true,
        points: [0, 0, 8, -4],
        head: linePreset.head,
        dashed: linePreset.dashed,
      });
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

  const handleClick = () => {};

  return {
    draft,
    isPanning,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    handleClick,
  };
};
