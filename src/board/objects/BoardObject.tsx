"use client";

import {
  Arc,
  Arrow,
  Circle,
  Ellipse,
  Group,
  Line,
  Path,
  Rect,
  Text,
} from "react-konva";
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
  vestByPlayerId: Record<string, string | undefined>;
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
  vestByPlayerId,
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
    const vestColor =
      player.vestColor ??
      (player.squadPlayerId ? vestByPlayerId[player.squadPlayerId] : undefined);
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
        {vestColor && (
          <Rect
            x={-playerTokenSize * 0.9}
            y={-playerTokenSize * 0.28}
            width={playerTokenSize * 1.8}
            height={playerTokenSize * 0.56}
            fill={vestColor}
            opacity={0.9}
            cornerRadius={playerTokenSize * 0.08}
          />
        )}
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
    const coneSvg = {
      minX: 98.789669,
      minY: 119.02408,
      width: 92.668551,
      height: 28.69632,
      translateX: -39.86834,
      translateY: 17.022282,
      topX: 145.20242,
      topY: 119.21153,
      topRx: 10.01506,
      topRy: 1.3770708,
      bodyPath:
        "m 98.789669,138.10972 36.436181,-19.08564 c 0.008,2.05813 19.56615,1.87074 20.02546,0.0724 l 36.20691,19.04769 c -0.0397,9.57623 -92.698888,8.42303 -92.668551,-0.033 z",
    };
    const coneScaleX = cone.width / coneSvg.width;
    const coneScaleY = cone.height / coneSvg.height;
    return (
      <Group
        {...commonProps}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
      >
        <Group
          x={-coneSvg.minX + coneSvg.translateX}
          y={-coneSvg.minY + coneSvg.translateY}
          scaleX={coneScaleX}
          scaleY={coneScaleY}
        >
          <Path
            data={coneSvg.bodyPath}
            fill={cone.style.fill}
            stroke={cone.style.stroke}
            strokeWidth={cone.style.strokeWidth}
            lineJoin="bevel"
          />
          <Ellipse
            x={coneSvg.topX}
            y={coneSvg.topY}
            radiusX={coneSvg.topRx}
            radiusY={coneSvg.topRy}
            fill="rgba(0,0,0,0.35)"
            stroke={cone.style.stroke}
            strokeWidth={cone.style.strokeWidth}
          />
          <Ellipse
            x={coneSvg.topX}
            y={coneSvg.topY}
            radiusX={coneSvg.topRx}
            radiusY={coneSvg.topRy}
            fill="transparent"
            stroke={cone.style.stroke}
            strokeWidth={cone.style.strokeWidth}
          />
        </Group>
      </Group>
    );
  }

  if (object.type === "goal") {
    const goal = object as MiniGoal;
    const goalSvg = {
      minX: 105.03958,
      minY: 34.66042,
      width: 48.14002,
      height: 79.96958,
      path:
        "m 105.03958,34.66042 v 2.05414 56.8389 l 6.09162,15.82488 10e-4,-5.2e-4 v 5.2e-4 h 28.45046 2.05414 V 109.2476 108.33137 51.75343 49.4006 49.306 l -22.62343,-14.64562 -0.0134,0.0207 v -0.0207 h -12.14495 z m 2.60605,2.05414 h 9.3002 V 49.4006 h -4.41626 z m 11.35434,0.38447 19.00246,12.30157 h -19.00246 z m -12.14499,2.61534 4.39715,11.42308 0.0305,-0.0119 v 0.0119 h 5.66323 v 40.36188 h -10.09086 z m 12.14499,11.42308 h 20.58272 v 55.73303 L 118.99997,92.22951 Z M 106.9852,93.55346 h 10.33167 l 19.80603,14.08803 h -24.71477 z",
    };
    const goalScaleX = goal.width / goalSvg.width;
    const goalScaleY = goal.height / goalSvg.height;
    const stretchY = 1.15;
    const scaledWidth = goalSvg.width * goalScaleX;
    const scaledHeight = goalSvg.height * goalScaleY * stretchY;
    const offsetX = (goal.width - scaledWidth) / 2;
    const offsetY = (goal.height - scaledHeight) / 2;
    const postWidth = Math.max(0.2, goal.width * 0.08);
    return (
      <Group
        {...commonProps}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
      >
        <Group
          x={-goalSvg.minX * goalScaleX + offsetX}
          y={-goalSvg.minY * goalScaleY + offsetY}
          scaleX={goalScaleX}
          scaleY={goalScaleY * stretchY}
        >
          <Path
            data={goalSvg.path}
            fill={goal.style.fill}
            stroke={goal.style.stroke}
            strokeWidth={goal.style.strokeWidth}
            lineJoin="bevel"
          />
        </Group>
        <Rect
          x={0}
          y={0}
          width={postWidth}
          height={goal.height}
          fill="#ffffff"
          strokeWidth={0}
        />
        <Rect
          x={goal.width - postWidth}
          y={0}
          width={postWidth}
          height={goal.height}
          fill="#ffffff"
          strokeWidth={0}
        />
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
    const lineHeight = label.fontSize * 1.4;
    const lineCount = label.text.split("\n").length;
    const textHeight = label.height ?? lineHeight * lineCount;
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
            height={textHeight}
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
          height={textHeight}
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

