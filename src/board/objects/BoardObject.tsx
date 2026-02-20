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

const getLineOutlineWidth = (strokeWidth: number) =>
  Math.max(0.15, strokeWidth * 0.6);

const getArrowHeadSize = (strokeWidth: number) => {
  const base = Math.max(0.35, strokeWidth);
  return {
    length: Math.max(1.8, base * 4.2),
    width: Math.max(1.4, base * 3.2),
  };
};

const toPositionAbbreviation = (value?: string) => {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  const parenMatch = trimmed.match(/\(([A-Za-z0-9/]+)\)\s*$/);
  if (parenMatch?.[1]) {
    return parenMatch[1].toUpperCase();
  }
  const compact = trimmed.toUpperCase();
  const known = new Set([
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
  ]);
  if (known.has(compact)) {
    return compact;
  }
  return compact.slice(0, 3);
};

const regularPolygonPoints = (sides: number, radius: number, rotationDeg = -90) => {
  const points: number[] = [];
  const rotationRad = (rotationDeg * Math.PI) / 180;
  for (let index = 0; index < sides; index += 1) {
    const angle = rotationRad + (index * Math.PI * 2) / sides;
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  return points;
};

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
  isThreeDView?: boolean;
  threeDStrength?: number;
  threeDDepthRange?: { minY: number; maxY: number };
  readOnly?: boolean;
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
  isThreeDView,
  threeDStrength,
  threeDDepthRange,
  readOnly,
  onSelect,
  onDragStart,
  onDragEnd,
  onBallDragStart,
  registerNode,
}: BoardObjectProps) {
  if (!object.visible) {
    return null;
  }

  const depthScale = (() => {
    if (!isThreeDView || !threeDDepthRange) {
      return 1;
    }
    const range = Math.max(0.001, threeDDepthRange.maxY - threeDDepthRange.minY);
    const t = Math.max(
      0,
      Math.min(1, (object.position.y - threeDDepthRange.minY) / range)
    );
    const strength = Math.max(0, Math.min(1, (threeDStrength ?? 55) / 100));
    // Top of pitch appears farther away.
    const minScale = 1 - strength * 0.32;
    return minScale + (1 - minScale) * t;
  })();
  const depthT = (() => {
    if (!isThreeDView || !threeDDepthRange) {
      return 1;
    }
    const range = Math.max(0.001, threeDDepthRange.maxY - threeDDepthRange.minY);
    return Math.max(
      0,
      Math.min(1, (object.position.y - threeDDepthRange.minY) / range)
    );
  })();
  const depthStrokeFactor =
    isThreeDView && threeDDepthRange ? 0.72 + 0.28 * depthScale : 1;
  const depthStroke = (value: number) =>
    Math.max(0.05, value * depthStrokeFactor);
  const textForeshorten =
    isThreeDView && threeDDepthRange
      ? 0.9 + 0.1 * depthScale
      : 1;
  const ambientShadowEnabled = !!isThreeDView;
  const depthEase = depthT * depthT;
  const ambientShadowBlur = 0.14 + 1.05 * depthEase;
  const ambientShadowOpacity = 0.04 + 0.2 * depthEase;
  const ambientShadowOffsetY = 0.03 + 0.32 * depthEase;

  const commonProps = {
    x: object.position.x,
    y: object.position.y,
    rotation: object.rotation,
    scaleX: object.scale.x * depthScale,
    scaleY: object.scale.y * depthScale,
    opacity: object.style.opacity,
    draggable: !object.locked && !readOnly,
    onClick: (event: Konva.KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      if (object.type === "player" && isLinking) {
        onLinkPlayer(object.id);
        return;
      }
      onSelect(object.id, event.evt.shiftKey);
    },
    onTap: (event: Konva.KonvaEventObject<TouchEvent>) => {
      event.cancelBubble = true;
      if (object.type === "player" && isLinking) {
        onLinkPlayer(object.id);
        return;
      }
      onSelect(object.id, false);
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
    const positionLabel = toPositionAbbreviation(squadPlayer?.positionLabel);
    const hasLabel = showPlayerName || showPlayerPosition || showPlayerNumber;
    const circleText = !hasLabel
      ? ""
      : showPlayerNumber && squadPlayer?.number
        ? String(squadPlayer.number)
        : showPlayerPosition && positionLabel
          ? positionLabel
          : initials;
    const circleFontSize = playerTokenSize * 0.9;
    const belowText = !hasLabel
      ? ""
      : showPlayerNumber
        ? [
            showPlayerPosition ? positionLabel : "",
            showPlayerName ? squadPlayer?.name : "",
          ]
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
          <>
            <Circle
              radius={playerTokenSize + 1.6}
              stroke="#111111"
              strokeWidth={depthStroke(0.85)}
              dash={[1, 1]}
            />
            <Circle
              radius={playerTokenSize + 1.6}
              stroke="#ffffff"
              strokeWidth={depthStroke(0.5)}
              dash={[1, 1]}
            />
          </>
        )}
        {isLinkCandidate && (
          <Circle
            radius={playerTokenSize + 2.2}
            stroke="var(--accent-1)"
            strokeWidth={depthStroke(0.3)}
            dash={[0.6, 0.6]}
          />
        )}
        {isSelected && (
          <Circle
            radius={playerTokenSize + 1.1}
            stroke="var(--accent-2)"
            strokeWidth={depthStroke(0.35)}
          />
        )}
        {player.hasBall && (
          <Circle
            radius={playerTokenSize + 0.8}
            stroke="#f06d4f"
            strokeWidth={depthStroke(0.3)}
          />
        )}
        <Circle
          radius={playerTokenSize}
          fill={fillColor}
          stroke={player.style.stroke}
          strokeWidth={depthStroke(player.style.strokeWidth)}
          shadowEnabled={!!isThreeDView}
          shadowColor="#000000"
          shadowOpacity={isThreeDView ? 0.28 : 0}
          shadowBlur={isThreeDView ? 0.8 : 0}
          shadowOffsetY={isThreeDView ? 0.35 : 0}
        />
        {isThreeDView && (
          <>
            <Circle
              x={-playerTokenSize * 0.28}
              y={-playerTokenSize * 0.3}
              radius={playerTokenSize * 0.55}
              fill="#ffffff"
              opacity={0.18}
              listening={false}
            />
            <Circle
              x={playerTokenSize * 0.24}
              y={playerTokenSize * 0.28}
              radius={playerTokenSize * 0.7}
              fill="#000000"
              opacity={0.09}
              listening={false}
            />
          </>
        )}
        {vestColor && (
          <Group>
            <Rect
              x={-playerTokenSize * 0.9}
              y={-playerTokenSize * 0.36}
              width={playerTokenSize * 1.8}
              height={playerTokenSize * 0.72}
              fill={vestColor}
              opacity={0.9}
              cornerRadius={playerTokenSize * 0.08}
            />
            <Rect
              x={-playerTokenSize * 0.36}
              y={-playerTokenSize * 0.9}
              width={playerTokenSize * 0.72}
              height={playerTokenSize * 1.8}
              fill={vestColor}
              opacity={0.9}
              cornerRadius={playerTokenSize * 0.08}
            />
          </Group>
        )}
        {hasLabel && (
          <Group rotation={labelRotation} scaleY={textForeshorten}>
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
        )}
        {belowText && (
          <Group
            rotation={labelRotation}
            x={belowOffset.x}
            y={belowOffset.y}
            scaleY={textForeshorten}
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
    const ballRadius = Math.max(0.8, playerTokenSize * 0.6);
    const borderWidth = Math.max(0.08, depthStroke(ball.style.strokeWidth));
    const centerPentagonRadius = ballRadius * 0.31;
    const ringPentagonRadius = ballRadius * 0.245;
    const ringDistance = ballRadius * 0.62;
    const seamWidth = Math.max(0.05, ballRadius * 0.1);
    const centerPentagon = regularPolygonPoints(5, centerPentagonRadius);
    const ringPentagon = regularPolygonPoints(5, ringPentagonRadius);
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
            radius={Math.max(1, playerTokenSize * 0.8)}
            fill="#ffffff"
            opacity={0.18}
            shadowBlur={18}
            shadowColor="#ffffff"
            shadowOpacity={0.45}
          />
        )}
        <Circle
          radius={ballRadius}
          fill="#ffffff"
          stroke="#111111"
          strokeWidth={borderWidth}
        />
        <Group
          clipFunc={(ctx) => {
            ctx.beginPath();
            ctx.arc(0, 0, ballRadius - borderWidth * 0.45, 0, Math.PI * 2);
            ctx.closePath();
          }}
        >
          <Line points={centerPentagon} closed fill="#111111" strokeEnabled={false} />
          {[0, 1, 2, 3, 4].map((index) => {
            const angle = -Math.PI / 2 + (index * Math.PI * 2) / 5;
            return (
              <Line
                key={`ball-panel-${index}`}
                x={Math.cos(angle) * ringDistance}
                y={Math.sin(angle) * ringDistance}
                points={ringPentagon}
                closed
                fill="#111111"
                strokeEnabled={false}
              />
            );
          })}
          {[0, 1, 2, 3, 4].map((index) => {
            const angle = -Math.PI / 2 + (index * Math.PI * 2) / 5;
            return (
              <Line
                key={`ball-seam-${index}`}
                points={[
                  Math.cos(angle) * centerPentagonRadius,
                  Math.sin(angle) * centerPentagonRadius,
                  Math.cos(angle) * (ballRadius * 0.92),
                  Math.sin(angle) * (ballRadius * 0.92),
                ]}
                stroke="#111111"
                strokeWidth={seamWidth}
                lineCap="round"
                listening={false}
              />
            );
          })}
          {[0, 1, 2, 3, 4].map((index) => {
            const startAngle = -72 + index * 72;
            return (
              <Arc
                key={`ball-arc-${index}`}
                innerRadius={ballRadius * 0.82}
                outerRadius={ballRadius * 0.97}
                angle={28}
                rotation={startAngle}
                fill="#111111"
                listening={false}
              />
            );
          })}
        </Group>
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
        strokeWidth={depthStroke(circle.style.strokeWidth)}
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
            strokeWidth={depthStroke(cone.style.strokeWidth)}
            lineJoin="bevel"
          />
          <Ellipse
            x={coneSvg.topX}
            y={coneSvg.topY}
            radiusX={coneSvg.topRx}
            radiusY={coneSvg.topRy}
            fill="rgba(0,0,0,0.35)"
            stroke={cone.style.stroke}
            strokeWidth={depthStroke(cone.style.strokeWidth)}
          />
          <Ellipse
            x={coneSvg.topX}
            y={coneSvg.topY}
            radiusX={coneSvg.topRx}
            radiusY={coneSvg.topRy}
            fill="transparent"
            stroke={cone.style.stroke}
            strokeWidth={depthStroke(cone.style.strokeWidth)}
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
            strokeWidth={depthStroke(goal.style.strokeWidth)}
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
        strokeWidth={depthStroke(rect.style.strokeWidth)}
        fill={rect.style.fill}
        dash={rect.style.dash}
        shadowEnabled={ambientShadowEnabled}
        shadowColor="#000000"
        shadowBlur={ambientShadowBlur}
        shadowOpacity={ambientShadowOpacity}
        shadowOffsetY={ambientShadowOffsetY}
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
        strokeWidth={depthStroke(triangle.style.strokeWidth)}
        fill={triangle.style.fill}
        dash={triangle.style.dash}
        shadowEnabled={ambientShadowEnabled}
        shadowColor="#000000"
        shadowBlur={ambientShadowBlur}
        shadowOpacity={ambientShadowOpacity}
        shadowOffsetY={ambientShadowOffsetY}
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
    const outlineStroke = arrow.style.outlineStroke;
    const arrowStrokeWidth = depthStroke(arrow.style.strokeWidth);
    const outlineWidth = outlineStroke
      ? getLineOutlineWidth(arrowStrokeWidth)
      : 0;
    const headSize = getArrowHeadSize(arrowStrokeWidth);
    return (
      <Group>
        {outlineStroke && outlineWidth > 0 && (
          <Arrow
            {...commonProps}
            points={points}
            bezier={arrow.curved ?? false}
            stroke={outlineStroke}
            strokeWidth={arrowStrokeWidth + outlineWidth * 2}
            fill={outlineStroke}
            pointerLength={arrow.head ? headSize.length + outlineWidth * 2 : 0}
            pointerWidth={arrow.head ? headSize.width + outlineWidth * 2 : 0}
            dash={arrow.dashed ? [1, 1] : []}
            listening={false}
          />
        )}
        <Arrow
          {...commonProps}
          points={points}
          bezier={arrow.curved ?? false}
          stroke={arrow.style.stroke}
          strokeWidth={arrowStrokeWidth}
          fill={arrow.style.stroke}
          pointerLength={arrow.head ? headSize.length : 0}
          pointerWidth={arrow.head ? headSize.width : 0}
          dash={arrow.dashed ? [1, 1] : []}
          shadowEnabled={ambientShadowEnabled}
          shadowColor="#000000"
          shadowBlur={ambientShadowBlur}
          shadowOpacity={ambientShadowOpacity}
          shadowOffsetY={ambientShadowOffsetY}
          ref={(node) => {
            if (node) {
              registerNode(object.id, node);
            }
          }}
        />
      </Group>
    );
  }

  if (object.type === "text") {
    const label = object as TextLabel;
    const lineHeight = label.fontSize * 1.4;
    const lineCount = label.text.split("\n").length;
    const textHeight = label.height ?? lineHeight * lineCount;
    const padding = Math.max(0.4, label.fontSize * 0.25);
    return (
      <Group
        {...commonProps}
        scaleY={commonProps.scaleY * textForeshorten}
        shadowEnabled={ambientShadowEnabled}
        shadowColor="#000000"
        shadowBlur={ambientShadowBlur}
        shadowOpacity={ambientShadowOpacity}
        shadowOffsetY={ambientShadowOffsetY}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
      >
        {label.background && (
          <Rect
            x={-padding}
            y={-padding}
            width={label.width + padding * 2}
            height={textHeight + padding * 2}
            fill="rgba(0,0,0,0.55)"
            cornerRadius={0.8}
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
    const outlineStroke = path.style.outlineStroke;
    const pathStrokeWidth = depthStroke(path.style.strokeWidth);
    const outlineWidth = outlineStroke
      ? getLineOutlineWidth(pathStrokeWidth)
      : 0;
    return (
      <Group>
        {outlineStroke && outlineWidth > 0 && (
          <Line
            {...commonProps}
            points={path.points}
            stroke={outlineStroke}
            strokeWidth={pathStrokeWidth + outlineWidth * 2}
            dash={path.style.dash}
            tension={0.45}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        )}
        <Line
          {...commonProps}
          points={path.points}
          stroke={path.style.stroke}
          strokeWidth={pathStrokeWidth}
          dash={path.style.dash}
          tension={0.45}
          lineCap="round"
          lineJoin="round"
          shadowEnabled={ambientShadowEnabled}
          shadowColor="#000000"
          shadowBlur={ambientShadowBlur}
          shadowOpacity={ambientShadowOpacity}
          shadowOffsetY={ambientShadowOffsetY}
          ref={(node) => {
            if (node) {
              registerNode(object.id, node);
            }
          }}
        />
      </Group>
    );
  }

  return null;
}

