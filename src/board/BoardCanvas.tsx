"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Stage, Layer, Rect, Arrow, Group, Circle, Line } from "react-konva";
import type {
  ArrowLine,
  BallToken,
  Board,
  DrawableObject,
  PlayerToken,
  ShapeCircle,
  ShapeRect,
  ShapeTriangle,
  TextLabel,
} from "@/models";
import Pitch, { getPitchViewBounds } from "@/board/pitch/Pitch";
import { useEditorStore } from "@/state/useEditorStore";
import { useProjectStore } from "@/state/useProjectStore";
import { clone } from "@/utils/clone";
import BoardObject from "@/board/objects/BoardObject";
import { useBoardInteractions } from "@/board/useBoardInteractions";
import { getBoardSquads } from "@/utils/board";

const getLineOutlineWidth = (strokeWidth: number) =>
  Math.max(0.15, strokeWidth * 0.6);

const getArrowHeadSize = (strokeWidth: number) => {
  const base = Math.max(0.35, strokeWidth);
  return {
    length: Math.max(1.8, base * 4.2),
    width: Math.max(1.4, base * 3.2),
  };
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
  const [size, setSize] = useState({ width: 800, height: 500 });

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
  const selectedLinkId = useEditorStore((state) => state.selectedLinkId);

  const project = useProjectStore((state) => state.project);
  const isSharedReadOnly = readOnly || (project?.isShared ?? false);
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
  const renderObjects = useMemo(() => {
    if (board.mode !== "DYNAMIC") {
      return objects;
    }
    const lastIndex = board.frames.length - 1;
    const baseIndex = Math.min(Math.floor(playheadFrame), lastIndex);
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
      return objects;
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
              blended.position = {
                x:
                  basePlayer.position.x +
                  (nextPlayer.position.x - basePlayer.position.x) * t +
                  (baseOffset.x + (nextOffset.x - baseOffset.x) * t),
                y:
                  basePlayer.position.y +
                  (nextPlayer.position.y - basePlayer.position.y) * t +
                  (baseOffset.y + (nextOffset.y - baseOffset.y) * t),
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
        merged.push(blended);
      } else {
        merged.push(item);
      }
    });
    nextObjects.forEach((item) => {
      if (!baseObjects.find((current) => current.id === item.id)) {
        merged.push(item);
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
  ]);
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
  const isPortraitFull =
    readOnly &&
    board.pitchView === "FULL" &&
    (forcePortrait || size.height > size.width);
  const viewRotation = useMemo(() => {
    let rotation = 0;
    if (board.pitchView === "DEF_HALF") {
      rotation = -90;
    } else if (board.pitchView === "OFF_HALF") {
      rotation = -90;
    } else if (isPortraitFull) {
      rotation = 90;
    }
    if (isPortraitFull && board.pitchRotation === 180) {
      rotation += 180;
    }
    return rotation;
  }, [board.pitchRotation, board.pitchView, isPortraitFull]);
  const labelRotation = viewRotation === 0 ? 0 : -viewRotation;
  const rotationPivot = useMemo(
    () => ({
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    }),
    [bounds]
  );
  const boardSquads = useMemo(
    () => getBoardSquads(project, board),
    [project, board]
  );
  const squadPlayers = useMemo(
    () => boardSquads.all.flatMap((squad) => squad.players),
    [boardSquads]
  );
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
  const effectiveWidth = viewRotation !== 0 ? bounds.height : bounds.width;
  const effectiveHeight = viewRotation !== 0 ? bounds.width : bounds.height;
  const baseScale = Math.min(
    size.width / effectiveWidth,
    size.height / effectiveHeight
  );
  const stageScale = baseScale * viewport.zoom;
  const baseOffsetX =
    size.width / 2 - (bounds.x + bounds.width / 2) * baseScale;
  const baseOffsetY =
    size.height / 2 - (bounds.y + bounds.height / 2) * baseScale;

  const {
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
  } = useBoardInteractions({
    boardId: board.id,
    frameIndex,
    objects,
    activeTool,
    playerTokenSize,
    playerFill: defaultPlayerFill,
    readOnly: isSharedReadOnly,
    baseOffsetX,
    baseOffsetY,
    baseScale,
    viewport,
    rotation: viewRotation,
    rotationPivot,
    stageRef,
    setViewport,
    clearSelection: () => {
      setSelection([]);
      setSelectedLinkId(null);
    },
    pushHistory,
    addObject,
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
    const snapRadius = playerTokenSize + 3;
    if (closestId && closestDist <= snapRadius) {
      const player = players.find((item) => item.id === closestId);
      if (!player) {
        return;
      }
      const dx = position.x - player.position.x;
      const dy = position.y - player.position.y;
      const len = Math.hypot(dx, dy) || 1;
      const offsetLen = playerTokenSize + 1.2;
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
    if (isSharedReadOnly) {
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

  const getDeleteAnchor = (item: DrawableObject) => {
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
    if (item.type === "player" || item.type === "ball") {
      return {
        x: item.position.x + playerTokenSize,
        y: item.position.y - playerTokenSize,
      };
    }
    if (
      item.type === "rect" ||
      item.type === "triangle" ||
      item.type === "goal" ||
      item.type === "cone"
    ) {
      return {
        x: item.position.x + item.width,
        y: item.position.y - 1.5,
      };
    }
    if (item.type === "text") {
      return {
        x: item.position.x + item.width,
        y: item.position.y - 1.5,
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
      {!readOnly && (
        <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
          <button
            className="rounded-full border border-[var(--line)] bg-[var(--panel-2)] p-2 text-[var(--ink-0)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={handleResetView}
            title="Reset view"
            aria-label="Reset view"
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
        </button>
          <button
            className="rounded-full border border-[var(--line)] bg-[var(--panel-2)] p-2 text-[var(--ink-0)] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
            onClick={() => {
              if (!window.confirm("Clear all objects from this frame?")) {
                return;
              }
              pushHistory(clone(objects));
              setFrameObjects(board.id, frameIndex, []);
            }}
            title="Clear pitch"
            aria-label="Clear pitch"
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
        </button>
          <button
            className="rounded-full border border-[var(--line)] bg-[var(--panel-2)] p-2 text-[var(--ink-0)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={onToggleMaximize}
            title={isMaximized ? "Exit full screen" : "Full screen"}
            aria-label="Toggle full screen"
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
        </button>
          {isMaximized && (
            <button
              className="rounded-full border border-[var(--line)] bg-[var(--panel-2)] p-2 text-[var(--ink-0)] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
              onClick={onToggleMaximize}
              title="Close full screen"
              aria-label="Close full screen"
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
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            </button>
          )}
        </div>
      )}
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={baseOffsetX + viewport.offsetX}
        y={baseOffsetY + viewport.offsetY}
        draggable={isPanning}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDblClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTap={handleTap}
        onClick={handleClick}
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
                kitByPlayerId={kitByPlayerId}
                vestByPlayerId={vestByPlayerId}
                defaultPlayerFill={defaultPlayerFill}
                playerTokenSize={playerTokenSize}
                showPlayerName={board.playerLabel?.showName ?? true}
                showPlayerPosition={board.playerLabel?.showPosition ?? false}
                showPlayerNumber={board.playerLabel?.showNumber ?? false}
                labelRotation={labelRotation}
                readOnly={isSharedReadOnly}
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
              const outlineWidth = getLineOutlineWidth(strokeWidth);
              const outlineStroke = style.outlineStroke;
              return (
                <Group key={link.id}>
                  {outlineStroke && outlineWidth > 0 && (
                    <Line
                      points={points.flatMap((point) => [point.x, point.y])}
                      stroke={outlineStroke}
                      strokeWidth={strokeWidth + outlineWidth * 2}
                      lineCap="round"
                      lineJoin="round"
                      listening={false}
                    />
                  )}
                  <Line
                    points={points.flatMap((point) => [point.x, point.y])}
                    stroke={style.stroke}
                    strokeWidth={strokeWidth}
                    opacity={style.opacity}
                    lineCap="round"
                    lineJoin="round"
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
                kitByPlayerId={kitByPlayerId}
                vestByPlayerId={vestByPlayerId}
                defaultPlayerFill={defaultPlayerFill}
                playerTokenSize={playerTokenSize}
                showPlayerName={board.playerLabel?.showName ?? true}
                showPlayerPosition={board.playerLabel?.showPosition ?? false}
                showPlayerNumber={board.playerLabel?.showNumber ?? false}
                labelRotation={labelRotation}
                readOnly={isSharedReadOnly}
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
              const end = {
                x: arrow.position.x + (arrow as { points: number[] }).points[2],
                y: arrow.position.y + (arrow as { points: number[] }).points[3],
              };
              const control = arrow.curved
                ? arrow.control ?? {
                    x: (arrow as { points: number[] }).points[2] / 2,
                    y: (arrow as { points: number[] }).points[3] / 2,
                  }
                : null;
              const controlWorld = control
                ? (() => {
                    const cp1 = { x: (2 * control.x) / 3, y: (2 * control.y) / 3 };
                    const cp2 = {
                      x: (end.x + 2 * control.x) / 3,
                      y: (end.y + 2 * control.y) / 3,
                    };
                    const mid = {
                      x: (3 * cp1.x + 3 * cp2.x + end.x) / 8,
                      y: (3 * cp1.y + 3 * cp2.y + end.y) / 8,
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
                    radius={0.7}
                    fill="#ffffff"
                    stroke="#0f1b1a"
                    strokeWidth={0.15}
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
                    radius={0.7}
                    fill="#ffffff"
                    stroke="#0f1b1a"
                    strokeWidth={0.15}
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
                      radius={0.7}
                      fill="#ffffff"
                      stroke="#0f1b1a"
                      strokeWidth={0.15}
                      draggable={!locked}
                      onDragStart={() => pushHistory(clone(objects))}
                      onDragMove={(event) => {
                        const localMid = {
                          x: event.target.x() - start.x,
                          y: event.target.y() - start.y,
                        };
                        const next = {
                          x: 2 * localMid.x - end.x / 2,
                          y: 2 * localMid.y - end.y / 2,
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
                      radius={0.7}
                      fill="#ffffff"
                      stroke="#0f1b1a"
                      strokeWidth={0.15}
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
                        points={[0, 0, 0, -radius - 2]}
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth={0.2}
                        dash={[0.6, 0.6]}
                        listening={false}
                      />
                      <Circle
                        x={0}
                        y={-radius - 2}
                        radius={0.7}
                        fill="#ffffff"
                        stroke="#0f1b1a"
                        strokeWidth={0.15}
                        draggable={!item.locked}
                        onMouseDown={(event) => {
                          event.cancelBubble = true;
                        }}
                        onDragStart={() => pushHistory(clone(objects))}
                        onDragMove={(event) => {
                          const localX = event.target.x() / item.scale.x;
                          const localY = event.target.y() / item.scale.y;
                          const angle =
                            (Math.atan2(localY, localX) * 180) / Math.PI - 90;
                          updateObject(board.id, frameIndex, item.id, {
                            rotation: angle,
                          });
                          event.target.position({
                            x: 0,
                            y: (-radius - 2) * item.scale.y,
                          });
                        }}
                        onDragEnd={(event) => {
                          event.target.position({
                            x: 0,
                            y: (-radius - 2) * item.scale.y,
                          });
                        }}
                      />
                      <Circle
                        x={radius}
                        y={radius}
                        radius={0.7}
                        fill="#ffffff"
                        stroke="#0f1b1a"
                        strokeWidth={0.15}
                        draggable={!item.locked}
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
                          const localPoint = parent
                            .getAbsoluteTransform()
                            .copy()
                            .invert()
                            .point(pointer);
                          let localX = Math.abs(localPoint.x);
                          let localY = Math.abs(localPoint.y);
                          const constrained = event.evt?.shiftKey;
                          if (constrained) {
                            const snapSize = Math.max(localX, localY);
                            localX = snapSize;
                            localY = snapSize;
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
                          event.target.position({ x: localX, y: localY });
                        }}
                        onDragEnd={(event) => {
                          const stage = event.target.getStage();
                          const parent = event.target.getParent();
                          const pointer = stage?.getPointerPosition();
                          if (!pointer || !parent) {
                            return;
                          }
                          const localPoint = parent
                            .getAbsoluteTransform()
                            .copy()
                            .invert()
                            .point(pointer);
                          const localX = Math.abs(localPoint.x);
                          const localY = Math.abs(localPoint.y);
                          const size = Math.max(localX, localY);
                          const ratio = size > 0 ? Math.abs(localX - localY) / size : 0;
                          if (ratio <= 0.08) {
                            const snapSize = Math.max(minSize, size);
                            updateObject(board.id, frameIndex, item.id, {
                              radius: snapSize,
                              scale: { x: 1, y: 1 },
                            });
                            event.target.position({ x: snapSize, y: snapSize });
                            return;
                          }
                          event.target.position({ x: localX, y: localY });
                        }}
                      />
                    </Group>
                  );
                }
                const width = "width" in item ? item.width : 0;
                const height = "height" in item ? item.height ?? 0 : 0;
                const scaleX = item.scale.x || 1;
                const scaleY = item.scale.y || 1;
                const handleOffset = Math.max(width, height) * 0.6 + 1.5;
                const rotateHandle = { x: width / 2, y: -handleOffset };
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
                      radius={0.7}
                      fill="#ffffff"
                      stroke="#0f1b1a"
                      strokeWidth={0.15}
                      draggable={!item.locked}
                      onMouseDown={(event) => {
                        event.cancelBubble = true;
                      }}
                      onDragStart={() => pushHistory(clone(objects))}
                      onDragMove={(event) => {
                        const localX = event.target.x() / scaleX;
                        const localY = event.target.y() / scaleY;
                        const angle =
                          (Math.atan2(localY - center.y, localX - center.x) *
                            180) /
                            Math.PI +
                          90;
                        updateObject(board.id, frameIndex, item.id, {
                          rotation: angle,
                        });
                        event.target.position({
                          x: rotateHandle.x * scaleX,
                          y: rotateHandle.y * scaleY,
                        });
                      }}
                      onDragEnd={(event) => {
                        event.target.position({
                          x: rotateHandle.x * scaleX,
                          y: rotateHandle.y * scaleY,
                        });
                      }}
                    />
                    <Rect
                      x={width - 0.8}
                      y={height - 0.8}
                      width={1.6}
                      height={1.6}
                      fill="#ffffff"
                      stroke="#0f1b1a"
                      strokeWidth={0.15}
                      cornerRadius={0.2}
                      draggable={!item.locked}
                      onMouseDown={(event) => {
                        event.cancelBubble = true;
                      }}
                      onDragStart={() => pushHistory(clone(objects))}
                      onDragMove={(event) => {
                        const localX = Math.max(
                          minSize,
                          event.target.x() / scaleX
                        );
                        const localY = Math.max(
                          minSize,
                          event.target.y() / scaleY
                        );
                        const constrained = event.evt?.shiftKey;
                        const size = Math.max(localX, localY);
                        updateObject(board.id, frameIndex, item.id, {
                          width: constrained ? size : localX,
                          height: constrained ? size : localY,
                        });
                        if (constrained) {
                          event.target.position({
                            x: size * scaleX,
                            y: size * scaleY,
                          });
                        }
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
                const handleOffset = Math.max(width, height) * 0.6 + 1.5;
                const rotateHandle = { x: width / 2, y: -handleOffset };
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
                      radius={0.7}
                      fill="#ffffff"
                      stroke="#0f1b1a"
                      strokeWidth={0.15}
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
                        const angle =
                          (Math.atan2(
                            pointer.y - centerPoint.y,
                            pointer.x - centerPoint.x
                          ) *
                            180) /
                            Math.PI +
                          90;
                        updateObject(board.id, frameIndex, label.id, {
                          rotation: angle,
                        });
                      }}
                      onDragEnd={(event) => {
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
                      x={width - 0.8}
                      y={height - 0.8}
                      width={1.6}
                      height={1.6}
                      fill="#ffffff"
                      stroke="#0f1b1a"
                      strokeWidth={0.15}
                      cornerRadius={0.2}
                      draggable={!label.locked}
                      onMouseDown={(event) => {
                        event.cancelBubble = true;
                      }}
                      onDragStart={() => pushHistory(clone(objects))}
                      onDragMove={(event) => {
                        const localX = Math.max(
                          minSize,
                          event.target.x() / scaleX
                        );
                        const localY = Math.max(
                          minSize,
                          event.target.y() / scaleY
                        );
                        updateObject(board.id, frameIndex, label.id, {
                          width: localX,
                          height: localY,
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
                  (item.type === "cone" || item.type === "goal")
              )
              .map((item) => {
                const width = "width" in item ? item.width : 0;
                const height = "height" in item ? item.height ?? 0 : 0;
                const scaleX = item.scale.x || 1;
                const scaleY = item.scale.y || 1;
                const handleOffset = Math.max(width, height) * 0.6 + 1.5;
                const rotateHandle = { x: width / 2, y: -handleOffset };
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
                      radius={0.7}
                      fill="#ffffff"
                      stroke="#0f1b1a"
                      strokeWidth={0.15}
                      draggable={!item.locked}
                      onMouseDown={(event) => {
                        event.cancelBubble = true;
                      }}
                      onDragStart={() => pushHistory(clone(objects))}
                      onDragMove={(event) => {
                        const localX = event.target.x() / scaleX;
                        const localY = event.target.y() / scaleY;
                        const angle =
                          (Math.atan2(localY - center.y, localX - center.x) *
                            180) /
                            Math.PI +
                          90;
                        updateObject(board.id, frameIndex, item.id, {
                          rotation: angle,
                        });
                        event.target.position({
                          x: rotateHandle.x * scaleX,
                          y: rotateHandle.y * scaleY,
                        });
                      }}
                      onDragEnd={(event) => {
                        event.target.position({
                          x: rotateHandle.x * scaleX,
                          y: rotateHandle.y * scaleY,
                        });
                      }}
                    />
                    <Rect
                      x={width - 0.8}
                      y={height - 0.8}
                      width={1.6}
                      height={1.6}
                      fill="#ffffff"
                      stroke="#0f1b1a"
                      strokeWidth={0.15}
                      cornerRadius={0.2}
                      draggable={!item.locked}
                      onMouseDown={(event) => {
                        event.cancelBubble = true;
                      }}
                      onDragStart={() => pushHistory(clone(objects))}
                      onDragMove={(event) => {
                        const localX = Math.max(
                          minSize,
                          event.target.x() / scaleX
                        );
                        const localY = Math.max(
                          minSize,
                          event.target.y() / scaleY
                        );
                        updateObject(board.id, frameIndex, item.id, {
                          width: localX,
                          height: localY,
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
              if (!selectedItem) {
                return null;
              }
              const anchor = getDeleteAnchor(selectedItem);
              return (
                <Group
                  key={`${selectedItem.id}-delete`}
                  x={anchor.x + 1.4}
                  y={anchor.y - 1.4}
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
                  <Rect
                    x={-0.55}
                    y={-0.15}
                    width={1.1}
                    height={0.9}
                    stroke="#ffffff"
                    strokeWidth={0.12}
                  />
                  <Line
                    points={[-0.75, -0.45, 0.75, -0.45]}
                    stroke="#ffffff"
                    strokeWidth={0.12}
                  />
                  <Line
                    points={[-0.35, -0.15, -0.35, 0.65]}
                    stroke="#ffffff"
                    strokeWidth={0.1}
                  />
                  <Line
                    points={[0, -0.15, 0, 0.65]}
                    stroke="#ffffff"
                    strokeWidth={0.1}
                  />
                  <Line
                    points={[0.35, -0.15, 0.35, 0.65]}
                    stroke="#ffffff"
                    strokeWidth={0.1}
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
                      pushHistory(clone(objects));
                      removeObject(board.id, frameIndex, selectedItem.id);
                      setSelection([]);
                      setSelectedLinkId(null);
                    }}
                    onTap={(event) => {
                      event.cancelBubble = true;
                      pushHistory(clone(objects));
                      removeObject(board.id, frameIndex, selectedItem.id);
                      setSelection([]);
                      setSelectedLinkId(null);
                    }}
                  />
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
              if (points.length === 0) {
                return null;
              }
              const anchor = points[points.length - 1]!;
              return (
                <Group
                  key={`${link.id}-delete`}
                  x={anchor.x + 1.4}
                  y={anchor.y - 1.4}
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
                  <Rect
                    x={-0.55}
                    y={-0.15}
                    width={1.1}
                    height={0.9}
                    stroke="#ffffff"
                    strokeWidth={0.12}
                  />
                  <Line
                    points={[-0.75, -0.45, 0.75, -0.45]}
                    stroke="#ffffff"
                    strokeWidth={0.12}
                  />
                  <Line
                    points={[-0.35, -0.15, -0.35, 0.65]}
                    stroke="#ffffff"
                    strokeWidth={0.1}
                  />
                  <Line
                    points={[0, -0.15, 0, 0.65]}
                    stroke="#ffffff"
                    strokeWidth={0.1}
                  />
                  <Line
                    points={[0.35, -0.15, 0.35, 0.65]}
                    stroke="#ffffff"
                    strokeWidth={0.1}
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
            {draft && draft.type !== "arrow" && draft.type !== "path" && (
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
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
