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
  type: "circle" | "polygon" | "rect" | "triangle" | "arrow" | "path";
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
  selectByMarquee: (ids: string[]) => void;
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
  selectByMarquee,
  disablePanZoom = false,
}: UseBoardInteractionsProps) => {
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const [marquee, setMarquee] = useState<{
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);
  const [marqueeMode, setMarqueeMode] = useState<"select" | "zoom">("select");
  const [isPanning, setIsPanning] = useState(false);
  const circleSnapTolerance = 0.08;
  const polygonCloseTolerance = 1.2;
  const canClosePolygonDraft = (polygonDraft: DraftShape, point: { x: number; y: number }) => {
    if (polygonDraft.type !== "polygon") {
      return false;
    }
    if ((polygonDraft.points?.length ?? 0) < 6) {
      return false;
    }
    return (
      Math.hypot(point.x - polygonDraft.start.x, point.y - polygonDraft.start.y) <=
      polygonCloseTolerance
    );
  };
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

  const animateViewportTo = (
    target: { zoom: number; offsetX: number; offsetY: number },
    durationMs = 320
  ) => {
    const from = {
      zoom: viewport.zoom,
      offsetX: viewport.offsetX,
      offsetY: viewport.offsetY,
    };
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.max(0, Math.min(1, elapsed / durationMs));
      const eased = 1 - Math.pow(1 - t, 3);
      setViewport({
        zoom: from.zoom + (target.zoom - from.zoom) * eased,
        offsetX: from.offsetX + (target.offsetX - from.offsetX) * eased,
        offsetY: from.offsetY + (target.offsetY - from.offsetY) * eased,
      });
      if (t < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  };

  const worldToStagePoint = (point: { x: number; y: number }) => {
    if (rotation === 0) {
      return point;
    }
    return rotatePoint(point, rotationPivot, rotation);
  };

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
  const isPolygonTool = activeTool === "polygon";
  const isShapeTool =
    activeTool === "circle" ||
    isPolygonTool ||
    activeTool === "rect" ||
    activeTool === "triangle" ||
    isLineTool ||
    isFreehandTool;

  const linePreset = {
    head: activeTool === "arrow" || activeTool === "arrow_dashed",
    dashed: activeTool === "line_dashed" || activeTool === "arrow_dashed",
  };
  const defaultPlacedRotation = rotation !== 0 ? 90 : 0;

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
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return;
      }
      const world = stageToWorld(pointer);
      if (!isShapeTool) {
        if (activeTool === "player") {
          setMarqueeMode("select");
          setMarquee({
            start: world,
            current: world,
          });
          return;
        }
        if (activeTool === "zoom") {
          setMarqueeMode("zoom");
          setMarquee({
            start: world,
            current: world,
          });
          return;
        }
        if (disablePanZoom) {
          return;
        }
        setIsPanning(true);
        return;
      }
      if (isPolygonTool) {
        return;
      }
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
      return;
    }

    return;
  };

  const handleMouseMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (marquee) {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return;
      }
      const world = stageToWorld(pointer);
      setMarquee({
        ...marquee,
        current: world,
      });
      return;
    }
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
    if (draft.type === "polygon") {
      setDraft({
        ...draft,
        current: world,
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

  const commitPolygonDraft = (polygonDraft: DraftShape) => {
    const points = polygonDraft.points ?? [];
    if (points.length < 6) {
      setDraft(null);
      return;
    }
    pushHistory(clone(objects));
    addObject(boardId, frameIndex, {
      id: createId(),
      type: "polygon",
      position: polygonDraft.start,
      rotation: 0,
      scale: { x: 1, y: 1 },
      style: { ...defaultStyle },
      zIndex: 1,
      locked: false,
      visible: true,
      points,
    });
    setDraft(null);
  };

  const commitDraft = () => {
    if (!draft) {
      return;
    }
    if (draft.type === "polygon") {
      commitPolygonDraft(draft);
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
        rotation: defaultPlacedRotation,
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
        rotation: defaultPlacedRotation,
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
        rotation: defaultPlacedRotation,
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
          strokeWidth: 0.35,
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
            strokeWidth: 0.35,
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
    const completeMarquee = () => {
      if (!marquee) {
        return false;
      }
      const minX = Math.min(marquee.start.x, marquee.current.x);
      const maxX = Math.max(marquee.start.x, marquee.current.x);
      const minY = Math.min(marquee.start.y, marquee.current.y);
      const maxY = Math.max(marquee.start.y, marquee.current.y);
      const width = maxX - minX;
      const height = maxY - minY;
      const isDragSelection = width > 0.8 || height > 0.8;
      if (!isDragSelection && marqueeMode === "zoom") {
        animateViewportTo(
          {
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
          },
          280
        );
      }
      if (isDragSelection && marqueeMode === "select") {
        const selectedIds = objects
          .filter((item) => item.type === "player")
          .filter(
            (item) =>
              item.position.x >= minX &&
              item.position.x <= maxX &&
              item.position.y >= minY &&
              item.position.y <= maxY
          )
          .map((item) => item.id);
        selectByMarquee(selectedIds);
      }
      if (isDragSelection && marqueeMode === "zoom") {
        const stage = stageRef.current;
        const stageWidth = stage?.width() ?? 0;
        const stageHeight = stage?.height() ?? 0;
        if (stageWidth > 0 && stageHeight > 0) {
          const targetZoom = clamp(
            Math.min(
              stageWidth / Math.max(0.001, width * baseScale),
              stageHeight / Math.max(0.001, height * baseScale)
            ) * 0.92,
            0.5,
            2.5
          );
          const center = {
            x: minX + width / 2,
            y: minY + height / 2,
          };
          const centerStage = worldToStagePoint(center);
          const targetOffsetX =
            stageWidth / 2 - centerStage.x * baseScale * targetZoom - baseOffsetX;
          const targetOffsetY =
            stageHeight / 2 - centerStage.y * baseScale * targetZoom - baseOffsetY;
          animateViewportTo(
            {
              zoom: targetZoom,
              offsetX: targetOffsetX,
              offsetY: targetOffsetY,
            },
            320
          );
        }
      }
      setMarquee(null);
      setMarqueeMode("select");
      return true;
    };
    if (completeMarquee()) {
      return;
    }
    if (draft && draft.type !== "polygon") {
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
        if (activeTool === "zoom") {
          const pointer = stage.getPointerPosition();
          if (!pointer) {
            return;
          }
          const world = stageToWorld(pointer);
          setMarqueeMode("zoom");
          setMarquee({
            start: world,
            current: world,
          });
          return;
        }
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
    if (isPolygonTool) {
      return;
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
    if (!draft && !isPanning && !marquee) {
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
    if (marquee) {
      const world = stageToWorld(pointer);
      setMarquee({
        ...marquee,
        current: world,
      });
      return;
    }
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
      if (draft.type === "polygon") {
        setDraft({ ...draft, current: world, constrain: false });
        return;
      }
      setDraft({ ...draft, current: world, constrain: false });
      return;
    }
  };

  const handleTouchEnd = () => {
    if (marquee) {
      const minX = Math.min(marquee.start.x, marquee.current.x);
      const maxX = Math.max(marquee.start.x, marquee.current.x);
      const minY = Math.min(marquee.start.y, marquee.current.y);
      const maxY = Math.max(marquee.start.y, marquee.current.y);
      const width = maxX - minX;
      const height = maxY - minY;
      const isDragSelection = width > 0.8 || height > 0.8;
      if (!isDragSelection && marqueeMode === "zoom") {
        animateViewportTo(
          {
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
          },
          280
        );
      }
      if (isDragSelection && marqueeMode === "zoom") {
        const stage = stageRef.current;
        const stageWidth = stage?.width() ?? 0;
        const stageHeight = stage?.height() ?? 0;
        if (stageWidth > 0 && stageHeight > 0) {
          const targetZoom = clamp(
            Math.min(
              stageWidth / Math.max(0.001, width * baseScale),
              stageHeight / Math.max(0.001, height * baseScale)
            ) * 0.92,
            0.5,
            2.5
          );
          const center = {
            x: minX + width / 2,
            y: minY + height / 2,
          };
          const centerStage = worldToStagePoint(center);
          const targetOffsetX =
            stageWidth / 2 - centerStage.x * baseScale * targetZoom - baseOffsetX;
          const targetOffsetY =
            stageHeight / 2 - centerStage.y * baseScale * targetZoom - baseOffsetY;
          animateViewportTo(
            {
              zoom: targetZoom,
              offsetX: targetOffsetX,
              offsetY: targetOffsetY,
            },
            320
          );
        }
      }
      if (isDragSelection && marqueeMode === "select") {
        const selectedIds = objects
          .filter((item) => item.type === "player")
          .filter(
            (item) =>
              item.position.x >= minX &&
              item.position.x <= maxX &&
              item.position.y >= minY &&
              item.position.y <= maxY
          )
          .map((item) => item.id);
        selectByMarquee(selectedIds);
      }
      setMarquee(null);
      setMarqueeMode("select");
      return;
    }
    if (draft && draft.type !== "polygon") {
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
    if (draft?.type === "polygon") {
      if ((draft.points?.length ?? 0) >= 6) {
        commitPolygonDraft(draft);
      }
      return;
    }
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
        rotation: defaultPlacedRotation,
        scale: { x: 1, y: 1 },
        style: { ...defaultStyle, fill: "#f06d4f", stroke: "#111111" },
        zIndex: 1,
        locked: false,
        visible: true,
        width: 3,
        height: 3,
      });
    }
    if (activeTool === "pole") {
      pushHistory(clone(objects));
      addObject(boardId, frameIndex, {
        id: createId(),
        type: "pole",
        position: world,
        rotation: defaultPlacedRotation,
        scale: { x: 1, y: 1 },
        style: { ...defaultStyle, fill: "#f2f1e9", stroke: "#111111" },
        zIndex: 1,
        locked: false,
        visible: true,
        width: 2.4,
        height: 8,
      });
    }
    if (activeTool === "mannequin") {
      pushHistory(clone(objects));
      addObject(boardId, frameIndex, {
        id: createId(),
        type: "mannequin",
        position: world,
        rotation: defaultPlacedRotation,
        scale: { x: 1, y: 1 },
        style: { ...defaultStyle, fill: "rgba(230,236,240,0.88)", stroke: "#111111" },
        zIndex: 1,
        locked: false,
        visible: true,
        width: 4.8,
        height: 10,
      });
    }
    if (activeTool === "goal") {
      pushHistory(clone(objects));
      addObject(boardId, frameIndex, {
        id: createId(),
        type: "goal",
        position: world,
        rotation: defaultPlacedRotation,
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
      addObject(boardId, frameIndex, {
        ...createText(world, text),
        rotation: defaultPlacedRotation,
      });
    }
  };

  const handleTap = (event: Konva.KonvaEventObject<TouchEvent>) => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    if (readOnly || activeTool !== "polygon") {
      const isStage = event.target === stage || event.target.getParent() === stage;
      if (isStage) {
        clearSelection();
      }
      return;
    }
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }
    const world = stageToWorld(pointer);
    if (!draft || draft.type !== "polygon") {
      setDraft({
        type: "polygon",
        start: world,
        current: world,
        points: [0, 0],
        constrain: false,
      });
      return;
    }
    const relativeX = world.x - draft.start.x;
    const relativeY = world.y - draft.start.y;
    if (canClosePolygonDraft(draft, world)) {
      commitPolygonDraft(draft);
      return;
    }
    const points = draft.points ?? [0, 0];
    const lastX = points[points.length - 2] ?? 0;
    const lastY = points[points.length - 1] ?? 0;
    if (Math.hypot(relativeX - lastX, relativeY - lastY) < 0.35) {
      return;
    }
    setDraft({
      ...draft,
      current: world,
      points: [...points, relativeX, relativeY],
    });
  };

  const handleClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (readOnly || activeTool !== "polygon") {
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
    if (!draft || draft.type !== "polygon") {
      setDraft({
        type: "polygon",
        start: world,
        current: world,
        points: [0, 0],
        constrain: false,
      });
      return;
    }
    const relativeX = world.x - draft.start.x;
    const relativeY = world.y - draft.start.y;
    if (canClosePolygonDraft(draft, world)) {
      commitPolygonDraft(draft);
      return;
    }
    const points = draft.points ?? [0, 0];
    const lastX = points[points.length - 2] ?? 0;
    const lastY = points[points.length - 1] ?? 0;
    if (Math.hypot(relativeX - lastX, relativeY - lastY) < 0.35) {
      return;
    }
    setDraft({
      ...draft,
      current: world,
      points: [...points, relativeX, relativeY],
    });
  };

  return {
    draft,
    marquee,
    marqueeMode,
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
