"use client";

import { Arrow, Circle, Ellipse, Group, Line, Path, Rect, Text } from "react-konva";
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
    const frameStroke = goal.style.stroke;
    const goalSvg = {
      minX: 46.661878,
      minY: 76.016933,
      width: 81.046302,
      height: 155.870747,
    };
    const goalScaleX = goal.width / goalSvg.width;
    const goalScaleY = goal.height / goalSvg.height;
    const framePaths = [
      "m 54.774931,83.788776 a 1.1790085,1.1790085 0 0 0 -1.178585,1.179561 v 1.178585 h 2.358145 16.366638 54.035541 V 230.62156 h -64.683749 -5.71843 -2.358145 v 1.17859 a 1.1790085,1.1790085 0 0 0 1.178585,1.17957 h 72.760329 a 1.1790085,1.1790085 0 0 0 1.17956,-1.17957 V 84.968337 a 1.1790085,1.1790085 0 0 0 -1.17956,-1.179561 z",
      "M 54.750447,85.28309 47.787245,76.324867",
      "m 55.163501,231.88768 -7.439669,-8.39435",
      "m 83.852293,222.76405 43.436207,8.6033",
      "M 83.747373,76.402903 127.2885,85.006209",
      "M 47.685747,76.373283 V 224.55863",
      "M 84.632414,76.137712 V 224.32309",
      "M 84.003169,76.016933 46.661878,76.174242",
      "m 84.003169,223.25846 -37.341291,0.15731",
    ];
    const netPaths = [
      "M 52.458925,75.649232 V 223.13597",
      "M 57.450118,75.649232 V 223.13597",
      "M 62.441317,75.649232 V 223.13597",
      "M 67.432511,75.649232 V 223.13597",
      "M 72.42371,75.649232 V 223.13597",
      "M 77.414903,75.649232 V 223.13597",
      "M 91.390254,76.647472 V 224.13422",
      "M 96.381448,77.645712 V 225.13247",
      "M 101.37265,78.643952 V 226.13071",
      "M 106.36384,79.642191 V 227.12896",
      "M 111.35504,80.640431 V 228.1272",
      "M 116.34623,81.638671 V 229.12545",
      "M 121.33743,82.636911 V 230.12369",
      "m 47.865289,80.494721 h 36.406679 l 43.436212,8.708223",
      "m 47.865289,85.485914 h 36.406679 l 43.436212,8.708224",
      "m 47.865289,91.475347 h 36.406679 l 43.436212,8.708223",
      "M 47.865289,97.464781 H 84.271968 L 127.70818,106.173",
      "m 47.865289,103.45422 h 36.406679 l 43.436212,8.70823",
      "m 47.865289,108.44542 h 36.406679 l 43.436212,8.70822",
      "m 47.865289,114.43485 h 36.406679 l 43.436212,8.70822",
      "m 47.865289,120.42428 h 36.406679 l 43.436212,8.70824",
      "m 47.865289,126.41369 h 36.406679 l 43.436212,8.70823",
      "m 47.865289,131.40488 h 36.406679 l 43.436212,8.70823",
      "m 47.865289,137.39432 h 36.406679 l 43.436212,8.70822",
      "m 47.865289,143.38375 h 36.406679 l 43.436212,8.70824",
      "m 47.865289,149.37317 h 36.406679 l 43.436212,8.70822",
      "m 47.865289,154.36436 h 36.406679 l 43.436212,8.70822",
      "m 47.865289,160.35379 h 36.406679 l 43.436212,8.70823",
      "m 47.865289,166.34323 h 36.406679 l 43.436212,8.70824",
      "m 47.865289,172.33264 h 36.406679 l 43.436212,8.70823",
      "m 47.865289,177.32383 h 36.406679 l 43.436212,8.70823",
      "m 47.865289,183.31327 h 36.406679 l 43.436212,8.70822",
      "m 47.865289,189.3027 h 36.406679 l 43.436212,8.70825",
      "m 47.865289,195.29212 h 36.406679 l 43.436212,8.70822",
      "m 47.865289,200.28331 h 36.406679 l 43.436212,8.70822",
      "m 47.865289,206.27274 h 36.406679 l 43.436212,8.70823",
      "m 47.865289,212.26218 h 36.406679 l 43.436212,8.70824",
      "m 47.865289,217.25339 h 36.406679 l 43.436212,8.70822",
    ];
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
          x={-goalSvg.minX}
          y={-goalSvg.minY}
          scaleX={goalScaleX}
          scaleY={goalScaleY}
        >
          {framePaths.map((data, idx) => (
            <Path
              key={`goal-frame-${idx}`}
              data={data}
              fill={idx === 0 ? frameStroke : "transparent"}
              stroke={frameStroke}
              strokeWidth={idx === 0 ? 0 : 2.82965}
              lineJoin="bevel"
            />
          ))}
          {netPaths.map((data, idx) => (
            <Path
              key={`goal-net-${idx}`}
              data={data}
              fill="transparent"
              stroke={frameStroke}
              strokeWidth={0.188644}
              lineJoin="bevel"
            />
          ))}
        </Group>
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

