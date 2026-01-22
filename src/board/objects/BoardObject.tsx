"use client";

import { Arrow, Circle, Group, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import type {
  ArrowLine,
  BallToken,
  ConeToken,
  DrawableObject,
  MovementPath,
  MiniGoal,
  PlayerToken,
  ShapeCircle,
  ShapeRect,
  ShapeTriangle,
  SquadPlayer,
  TextLabel,
} from "@/models";
import type { Tool } from "@/state/useEditorStore";

type BoardObjectProps = {
  object: DrawableObject;
  objects: DrawableObject[];
  activeTool: Tool;
  isSelected: boolean;
  isHighlighted: boolean;
  isLinking: boolean;
  isLinkCandidate: boolean;
  onLinkPlayer: (id: string) => void;
  squadPlayers: SquadPlayer[];
  kitByPlayerId: Record<string, string>;
  defaultPlayerFill: string;
  playerTokenSize: number;
  showPlayerName: boolean;
  showPlayerPosition: boolean;
  showPlayerNumber: boolean;
  labelRotation: number;
  onSelect: (id: string, multi: boolean) => void;
  onDragStart: () => void;
  onDragEnd: (id: string, position: { x: number; y: number }) => void;
  onBallDragStart?: (id: string, position: { x: number; y: number }) => void;
  registerNode: (id: string, node: Konva.Node) => void;
};

export default function BoardObject({
  object,
  objects,
  activeTool,
  isSelected,
  isHighlighted,
  isLinking,
  isLinkCandidate,
  onLinkPlayer,
  squadPlayers,
  kitByPlayerId,
  defaultPlayerFill,
  playerTokenSize,
  showPlayerName,
  showPlayerPosition,
  showPlayerNumber,
  labelRotation,
  onSelect,
  onDragStart,
  onDragEnd,
  onBallDragStart,
  registerNode,
}: BoardObjectProps) {
  if (!object.visible) {
    return null;
  }

  const commonProps = {
    x: object.position.x,
    y: object.position.y,
    rotation: object.rotation,
    scaleX: object.scale.x,
    scaleY: object.scale.y,
    opacity: object.style.opacity,
    draggable: !object.locked,
    onClick: (event: Konva.KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      if (object.type === "player" && isLinking) {
        onLinkPlayer(object.id);
        return;
      }
      onSelect(object.id, event.evt.shiftKey);
    },
    onDragStart,
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
      onDragEnd(object.id, { x: event.target.x(), y: event.target.y() });
    },
  };

  if (object.type === "player") {
    const player = object as PlayerToken;
    const fillColor = player.squadPlayerId
      ? kitByPlayerId[player.squadPlayerId] ?? player.style.fill
      : player.style.fill === "#f9bf4a"
        ? defaultPlayerFill
        : player.style.fill;
    const squadPlayer = player.squadPlayerId
      ? squadPlayers.find((item) => item.id === player.squadPlayerId)
      : undefined;
    const initials = squadPlayer?.name
      ? squadPlayer.name
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase())
          .join("")
          .slice(0, 2)
      : "PL";
    const positionLabel = squadPlayer?.positionLabel
      ? squadPlayer.positionLabel.slice(0, 3).toUpperCase()
      : "";
    const circleText =
      showPlayerNumber && squadPlayer?.number
        ? String(squadPlayer.number)
        : showPlayerPosition && positionLabel
          ? positionLabel
          : initials;
    const circleFontSize = playerTokenSize * 0.9;
    const belowText = showPlayerNumber
      ? [showPlayerPosition ? positionLabel : "", showPlayerName ? squadPlayer?.name : ""]
          .filter(Boolean)
          .join(" • ")
      : showPlayerPosition
        ? showPlayerName && squadPlayer?.name
          ? squadPlayer.name
          : ""
        : "";
    const textColor = (() => {
      const hex = fillColor.startsWith("#") ? fillColor.slice(1) : "";
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return luminance > 0.6 ? "#0f1b1a" : "#f2f1e9";
      }
      return "#0f1b1a";
    })();
    const circleTextSize = playerTokenSize * 2;
    const belowTextWidth = playerTokenSize * 6;
    const belowTextHeight = 2.2;
    const rotateOffset = (x: number, y: number, degrees: number) => {
      const radians = (degrees * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      return {
        x: x * cos - y * sin,
        y: x * sin + y * cos,
      };
    };
    const belowOffset = rotateOffset(
      0,
      playerTokenSize + 0.6 + belowTextHeight / 2,
      labelRotation
    );
    const hasAttachedBall = objects.some(
      (item) => item.type === "ball" && item.attachedToId === player.id
    );
    return (
      <Group
        {...commonProps}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
      >
        {hasAttachedBall && (
          <Circle
            radius={playerTokenSize + 1.6}
            fill="#ffffff"
            opacity={0.18}
            shadowBlur={18}
            shadowColor="#ffffff"
            shadowOpacity={0.45}
          />
        )}
        {isHighlighted && (
          <Circle
            radius={playerTokenSize + 1.6}
            stroke="#f9bf4a"
            strokeWidth={0.35}
          />
        )}
        {isLinkCandidate && (
          <Circle
            radius={playerTokenSize + 2.2}
            stroke="var(--accent-1)"
            strokeWidth={0.3}
            dash={[0.6, 0.6]}
          />
        )}
        {isSelected && (
          <Circle
            radius={playerTokenSize + 1.1}
            stroke="var(--accent-2)"
            strokeWidth={0.35}
          />
        )}
        {player.hasBall && (
          <Circle
            radius={playerTokenSize + 0.8}
            stroke="#f06d4f"
            strokeWidth={0.3}
          />
        )}
        <Circle
          radius={playerTokenSize}
          fill={fillColor}
          stroke={player.style.stroke}
          strokeWidth={player.style.strokeWidth}
        />
        <Group rotation={labelRotation}>
          <Text
            text={circleText}
            width={circleTextSize}
            height={circleTextSize}
            x={-circleTextSize / 2}
            y={-circleTextSize / 2}
            align="center"
            verticalAlign="middle"
            fontSize={circleFontSize}
            fill={textColor}
            fontStyle="bold"
          />
        </Group>
        {belowText && (
          <Group
            rotation={labelRotation}
            x={belowOffset.x}
            y={belowOffset.y}
          >
            <Text
              text={belowText}
              width={belowTextWidth}
              height={belowTextHeight}
              x={-belowTextWidth / 2}
              y={-belowTextHeight / 2}
              align="center"
              verticalAlign="middle"
              fontSize={1.1}
              fill="#f2f1e9"
            />
          </Group>
        )}
      </Group>
    );
  }

  if (object.type === "ball") {
    const ball = object as BallToken;
    const attachedPlayer = ball.attachedToId
      ? objects.find((item) => item.id === ball.attachedToId)
      : null;
    const position = attachedPlayer
      ? {
          x: attachedPlayer.position.x + (ball.offset?.x ?? 1.5),
          y: attachedPlayer.position.y + (ball.offset?.y ?? -1.5),
        }
      : ball.position;
    return (
      <Group
        {...commonProps}
        x={position.x}
        y={position.y}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
        onDragStart={(event) => {
          onDragStart();
          if (ball.attachedToId && onBallDragStart) {
            onBallDragStart(ball.id, { x: event.target.x(), y: event.target.y() });
          }
        }}
      >
        {ball.attachedToId && (
          <Circle
            radius={1.7}
            fill="#ffffff"
            opacity={0.18}
            shadowBlur={18}
            shadowColor="#ffffff"
            shadowOpacity={0.45}
          />
        )}
        <Circle
          radius={1.2}
          fill={ball.style.fill}
          stroke={ball.style.stroke}
          strokeWidth={ball.style.strokeWidth}
        />
      </Group>
    );
  }

  if (object.type === "circle") {
    const circle = object as ShapeCircle;
    return (
      <Circle
        {...commonProps}
        radius={circle.radius}
        stroke={circle.style.stroke}
        strokeWidth={circle.style.strokeWidth}
        fill={circle.style.fill}
        dash={circle.style.dash}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
      />
    );
  }

  if (object.type === "cone") {
    const cone = object as ConeToken;
    const topInset = cone.width * 0.18;
    const peakY = cone.height * 0.18;
    const highlightInset = cone.width * 0.32;
    const highlightPeakY = cone.height * 0.32;
    return (
      <Group
        {...commonProps}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
      >
        <Line
          points={[
            0,
            cone.height,
            cone.width,
            cone.height,
            cone.width - topInset,
            peakY,
            topInset,
            peakY,
          ]}
          closed
          stroke={cone.style.stroke}
          strokeWidth={cone.style.strokeWidth}
          fill={cone.style.fill}
          dash={cone.style.dash}
        />
        <Line
          points={[
            highlightInset,
            cone.height * 0.82,
            cone.width - highlightInset,
            cone.height * 0.82,
            cone.width - highlightInset * 1.1,
            highlightPeakY,
            highlightInset * 1.1,
            highlightPeakY,
          ]}
          closed
          fill="#ffffff"
          opacity={0.18}
          strokeWidth={0}
        />
        <Line
          points={[
            cone.width * 0.2,
            cone.height * 0.7,
            cone.width * 0.8,
            cone.height * 0.7,
          ]}
          stroke="#ffffff"
          opacity={0.35}
          strokeWidth={0.3}
        />
        <Rect
          x={cone.width * 0.08}
          y={cone.height * 0.88}
          width={cone.width * 0.84}
          height={cone.height * 0.1}
          fill="#000000"
          opacity={0.15}
          cornerRadius={cone.height * 0.05}
        />
      </Group>
    );
  }

  if (object.type === "goal") {
    const goal = object as MiniGoal;
    const depth = Math.min(goal.width, goal.height) * 0.35;
    const frameStroke = goal.style.stroke;
    const frameWidth = goal.style.strokeWidth;
    const netStroke = frameStroke;
    const netOpacity = 0.35;
    return (
      <Group
        {...commonProps}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
      >
        <Rect
          x={0}
          y={0}
          width={goal.width}
          height={goal.height}
          stroke={frameStroke}
          strokeWidth={frameWidth}
          fill={goal.style.fill}
          dash={goal.style.dash}
          cornerRadius={goal.height * 0.12}
        />
        <Rect
          x={depth}
          y={-depth * 0.4}
          width={goal.width}
          height={goal.height}
          stroke={frameStroke}
          strokeWidth={frameWidth * 0.8}
          fill="transparent"
          cornerRadius={goal.height * 0.12}
          opacity={0.7}
        />
        <Line
          points={[0, 0, depth, -depth * 0.4]}
          stroke={frameStroke}
          strokeWidth={frameWidth * 0.8}
        />
        <Line
          points={[goal.width, 0, goal.width + depth, -depth * 0.4]}
          stroke={frameStroke}
          strokeWidth={frameWidth * 0.8}
        />
        <Line
          points={[0, goal.height, depth, goal.height - depth * 0.4]}
          stroke={frameStroke}
          strokeWidth={frameWidth * 0.8}
        />
        <Line
          points={[
            goal.width,
            goal.height,
            goal.width + depth,
            goal.height - depth * 0.4,
          ]}
          stroke={frameStroke}
          strokeWidth={frameWidth * 0.8}
        />
        {Array.from({ length: 4 }).map((_, idx) => {
          const x = (goal.width / 4) * (idx + 1);
          return (
            <Line
              key={`goal-net-v-${idx}`}
              points={[x, 0, x + depth, -depth * 0.4]}
              stroke={netStroke}
              strokeWidth={0.3}
              opacity={netOpacity}
            />
          );
        })}
        {Array.from({ length: 3 }).map((_, idx) => {
          const y = (goal.height / 3) * (idx + 1);
          return (
            <Line
              key={`goal-net-h-${idx}`}
              points={[0, y, goal.width + depth, y - depth * 0.4]}
              stroke={netStroke}
              strokeWidth={0.3}
              opacity={netOpacity}
            />
          );
        })}
      </Group>
    );
  }

  if (object.type === "rect") {
    const rect = object as ShapeRect;
    return (
      <Rect
        {...commonProps}
        width={rect.width}
        height={rect.height}
        cornerRadius={rect.cornerRadius}
        stroke={rect.style.stroke}
        strokeWidth={rect.style.strokeWidth}
        fill={rect.style.fill}
        dash={rect.style.dash}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
      />
    );
  }

  if (object.type === "triangle") {
    const triangle = object as ShapeTriangle;
    const points = [0, 0, triangle.width, triangle.height / 2, 0, triangle.height];
    return (
      <Line
        {...commonProps}
        points={points}
        closed
        stroke={triangle.style.stroke}
        strokeWidth={triangle.style.strokeWidth}
        fill={triangle.style.fill}
        dash={triangle.style.dash}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
      />
    );
  }

  if (object.type === "arrow") {
    const arrow = object as ArrowLine;
    const end = {
      x: arrow.points[2],
      y: arrow.points[3],
    };
    const control = arrow.control ?? { x: end.x / 2, y: end.y / 2 };
    const points = arrow.curved
      ? (() => {
          const cp1 = {
            x: (0 + 2 * control.x) / 3,
            y: (0 + 2 * control.y) / 3,
          };
          const cp2 = {
            x: (end.x + 2 * control.x) / 3,
            y: (end.y + 2 * control.y) / 3,
          };
          return [0, 0, cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y];
        })()
      : arrow.points;
    return (
      <Arrow
        {...commonProps}
        points={points}
        bezier={arrow.curved ?? false}
        stroke={arrow.style.stroke}
        strokeWidth={arrow.style.strokeWidth}
        fill={arrow.style.stroke}
        pointerLength={arrow.head ? 2.5 : 0}
        pointerWidth={arrow.head ? 2 : 0}
        dash={arrow.dashed ? [1, 1] : []}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
      />
    );
  }

  if (object.type === "text") {
    const label = object as TextLabel;
    return (
      <Group
        {...commonProps}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
      >
        {label.background && (
          <Rect
            width={label.width}
            height={label.fontSize * 1.4}
            fill="rgba(0,0,0,0.4)"
            cornerRadius={0.5}
          />
        )}
        <Text
          text={label.text}
          fontSize={label.fontSize}
          fontStyle={label.bold ? "bold" : "normal"}
          fill="#f2f1e9"
          width={label.width}
          align={label.align}
        />
      </Group>
    );
  }

  if (object.type === "path") {
    const path = object as MovementPath;
    return (
      <Line
        {...commonProps}
        points={path.points}
        stroke={path.style.stroke}
        strokeWidth={path.style.strokeWidth}
        dash={[1, 1]}
      />
    );
  }

  return null;
}

