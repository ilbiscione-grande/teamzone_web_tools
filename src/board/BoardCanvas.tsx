"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Stage, Layer, Rect, Arrow, Group, Circle, Line } from "react-konva";
import type { ArrowLine, BallToken, Board, TextLabel } from "@/models";
import Pitch, { getPitchViewBounds } from "@/board/pitch/Pitch";
import { useEditorStore } from "@/state/useEditorStore";
import { useProjectStore } from "@/state/useProjectStore";
import { clone } from "@/utils/clone";
import BoardObject from "@/board/objects/BoardObject";
import { useBoardInteractions } from "@/board/useBoardInteractions";
import { getBoardSquads } from "@/utils/board";

type BoardCanvasProps = {
  board: Board;
  onStageReady?: (stage: Konva.Stage | null) => void;
};

export default function BoardCanvas({ board, onStageReady }: BoardCanvasProps) {
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
  const isSharedReadOnly = project?.isShared ?? false;
  const addObject = useProjectStore((state) => state.addObject);
  const updateObject = useProjectStore((state) => state.updateObject);
  const setFrameObjects = useProjectStore((state) => state.setFrameObjects);

  const frameIndex = board.activeFrameIndex;
  const objects = board.frames[frameIndex]?.objects ?? [];
  const selectedArrows = useMemo(
    () =>
      objects.filter(
        (item) => item.type === "arrow" && selection.includes(item.id)
      ) as ArrowLine[],
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
        };
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
  const viewRotation = useMemo(() => {
    if (board.pitchView === "DEF_HALF") {
      return -90;
    }
    if (board.pitchView === "OFF_HALF") {
      return -90;
    }
    return 0;
  }, [board.pitchView]);
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
  const highlightedPlayers = board.playerHighlights ?? [];
  const playerLinks = board.playerLinks ?? [];
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
    setSelectedLinkId(null);
    if (multi) {
      setSelection(Array.from(new Set([...selection, id])));
    } else {
      setSelection([id]);
    }
  };

  const handleResetView = () => {
    setViewport({ zoom: 1, offsetX: 0, offsetY: 0 });
  };


  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      data-disable-pull
    >
      <button
        className="absolute right-4 top-4 z-10 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1 text-xs text-[var(--ink-0)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
        onClick={handleResetView}
      >
        Reset view
      </button>
      <button
        className="absolute right-4 top-12 z-10 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1 text-xs text-[var(--ink-0)] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
        onClick={() => {
          if (!window.confirm("Clear all objects from this frame?")) {
            return;
          }
          pushHistory(clone(objects));
          setFrameObjects(board.id, frameIndex, []);
        }}
      >
        Clear pitch
      </button>
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
            {playerLinks.map((link) => {
              const points = link.playerIds
                .map((id) => playerPositions.get(id))
                .filter(Boolean) as { x: number; y: number }[];
              if (points.length < 2) {
                return null;
              }
              const isSelectedLink = selectedLinkId === link.id;
              return (
                <Line
                  key={link.id}
                  points={points.flatMap((point) => [point.x, point.y])}
                  stroke={
                    isSelectedLink
                      ? "var(--accent-2)"
                      : "rgba(255,255,255,0.55)"
                  }
                  strokeWidth={isSelectedLink ? 0.5 : 0.3}
                  lineCap="round"
                  lineJoin="round"
                  onClick={(event) => {
                    event.cancelBubble = true;
                    setSelection([]);
                    setSelectedLinkId(link.id);
                  }}
                />
              );
            })}
            {sortedObjects.map((object) => (
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
                          const scaleX = item.scale.x || 1;
                          const scaleY = item.scale.y || 1;
                          const localX = Math.abs(event.target.x() / scaleX);
                          const localY = Math.abs(event.target.y() / scaleY);
                          const size = Math.max(localX, localY);
                          const nextRadius = Math.max(minSize, size);
                          const minScale = 0.2;
                          const constrained = event.evt?.shiftKey;
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
                        updateObject(board.id, frameIndex, item.id, {
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
            {draft && draft.type === "arrow" && (
              <Arrow
                points={[
                  draft.start.x,
                  draft.start.y,
                  draft.current.x,
                  draft.current.y,
                ]}
                stroke="#ffffff"
                strokeWidth={0.6}
                pointerLength={2.5}
                pointerWidth={2}
              />
            )}
            {draft && draft.type !== "arrow" && (
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
