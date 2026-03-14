"use client";

import { useEffect, useState } from "react";
import {
  Arrow,
  Circle,
  Ellipse,
  Group,
  Image as KonvaImage,
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
  JerseyType,
  MannequinToken,
  MovementPath,
  MiniGoal,
  PoleToken,
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

const BALL_SVG_SRC = "/ball.svg";
const GOAL_SVG_SRC = "/goal.svg";
const CONE_BASE_WIDTH = 66.837547;
const CONE_BASE_HEIGHT = 22.4858;
// Derived from the user's cone_low_white.svg (path15), normalized by layer translation.
const CONE_FILL_PATH =
  "m 0.018228,20.81015 25.969013,-20.11664 c 1.90064,-0.87599 14.50962,-0.81086 14.82345,0.0943 l 25.66498,19.99291 c -22.382,1.93602 -44.54509,2.03482 -66.457443,0.0294 z";

function BallSprite({ radius }: { radius: number }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const svgImage = new window.Image();
    svgImage.onload = () => setImage(svgImage);
    svgImage.src = BALL_SVG_SRC;
    return () => {
      svgImage.onload = null;
    };
  }, []);

  if (!image) {
    return (
      <Circle
        radius={radius}
        fill="#ffffff"
        stroke="#111111"
        strokeWidth={Math.max(0.03, radius * 0.05)}
        listening={false}
      />
    );
  }

  return (
    <KonvaImage
      image={image}
      x={-radius}
      y={-radius}
      width={radius * 2}
      height={radius * 2}
    />
  );
}

function GoalSprite({ width, height }: { width: number; height: number }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const svgImage = new window.Image();
    svgImage.onload = () => setImage(svgImage);
    svgImage.src = GOAL_SVG_SRC;
    return () => {
      svgImage.onload = null;
    };
  }, []);

  if (!image) {
    const postWidth = Math.max(0.2, width * 0.08);
    return (
      <Group listening={false}>
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="rgba(255,255,255,0.12)"
          stroke="#ffffff"
          strokeWidth={Math.max(0.08, width * 0.02)}
          cornerRadius={Math.max(0.2, width * 0.04)}
        />
        <Rect x={0} y={0} width={postWidth} height={height} fill="#ffffff" />
        <Rect
          x={width - postWidth}
          y={0}
          width={postWidth}
          height={height}
          fill="#ffffff"
        />
      </Group>
    );
  }

  return <KonvaImage image={image} x={0} y={0} width={width} height={height} />;
}

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
  secondaryKitByPlayerId: Record<string, string | undefined>;
  jerseyTypeByPlayerId: Record<string, string | undefined>;
  vestByPlayerId: Record<string, string | undefined>;
  defaultPlayerFill: string;
  playerTokenSize: number;
  showPlayerName: boolean;
  showPlayerPosition: boolean;
  showPlayerNumber: boolean;
  compactPlayerLabels?: boolean;
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
  secondaryKitByPlayerId,
  jerseyTypeByPlayerId,
  vestByPlayerId,
  defaultPlayerFill,
  playerTokenSize,
  showPlayerName,
  showPlayerPosition,
  showPlayerNumber,
  compactPlayerLabels,
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
  const depthScaleApplies =
    isThreeDView && (object.type === "player" || object.type === "ball");
  const effectiveDepthScale = depthScaleApplies ? depthScale : 1;
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
  const renderPlayerJerseyPattern = (
    radius: number,
    primary: string,
    secondary: string,
    jerseyType: JerseyType
  ) => {
    if (jerseyType === "solid" || primary === secondary) {
      return null;
    }
    const innerRadius = Math.max(0.2, radius - 0.02);
    return (
      <Group
        clipFunc={(ctx) => {
          ctx.beginPath();
          ctx.arc(0, 0, innerRadius, 0, Math.PI * 2, false);
          ctx.closePath();
        }}
      >
        {jerseyType === "split" ? (
          <Rect
            x={0}
            y={-innerRadius}
            width={innerRadius}
            height={innerRadius * 2}
            fill={secondary}
          />
        ) : null}
        {jerseyType === "stripe" ? (
          <Rect
            x={-innerRadius * 0.22}
            y={-innerRadius}
            width={innerRadius * 0.44}
            height={innerRadius * 2}
            fill={secondary}
          />
        ) : null}
        {jerseyType === "sash" ? (
          <Line
            points={[
              -innerRadius * 1.8,
              innerRadius * 1.6,
              innerRadius * 1.8,
              -innerRadius * 1.6,
            ]}
            stroke={secondary}
            strokeWidth={Math.max(1.2, innerRadius * 0.21)}
            lineCap="butt"
            lineJoin="round"
          />
        ) : null}
        {jerseyType === "pinstripe"
          ? [-0.62, -0.31, 0, 0.31, 0.62].map((offset) => (
              <Rect
                key={offset}
                x={innerRadius * offset - innerRadius * 0.035}
                y={-innerRadius}
                width={innerRadius * 0.07}
                height={innerRadius * 2}
                fill={secondary}
                opacity={0.95}
              />
            ))
          : null}
      </Group>
    );
  };

  const commonProps = {
    x: object.position.x,
    y: object.position.y,
    rotation: object.rotation,
    scaleX: object.scale.x * effectiveDepthScale,
    scaleY: object.scale.y * effectiveDepthScale,
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
  const shimmerStrength = Math.max(
    0,
    Math.min(1, Number(object.style.fxShimmerStrength ?? 0))
  );
  const shimmerProgress = Math.max(
    0,
    Math.min(1, Number(object.style.fxShimmerProgress ?? 0))
  );
  const renderShimmerSweepInBox = (
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    if (shimmerStrength <= 0 || width <= 0 || height <= 0) {
      return null;
    }
    const bandWidth = Math.max(0.75, width * 0.24);
    const travel = width + height + bandWidth * 2;
    const shimmerTravelProgress = Math.max(
      0,
      Math.min(1, shimmerProgress * 0.78 + 0.02)
    );
    const sweepX = x - bandWidth + travel * shimmerTravelProgress;
    const sweepY = y - height * 0.18;
    return (
      <Group
        listening={false}
        clipX={x}
        clipY={y}
        clipWidth={width}
        clipHeight={height}
      >
        <Group x={sweepX} y={sweepY} rotation={35}>
          <Rect
            x={0}
            y={0}
            width={bandWidth}
            height={height * 1.8}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: bandWidth, y: 0 }}
            fillLinearGradientColorStops={[
              0,
              "rgba(255,255,255,0)",
              0.34,
              `rgba(255,255,255,${0.26 * shimmerStrength})`,
              0.5,
              `rgba(255,255,255,${0.82 * shimmerStrength})`,
              0.66,
              `rgba(172,240,255,${0.38 * shimmerStrength})`,
              1,
              "rgba(255,255,255,0)",
            ]}
          />
          <Rect
            x={bandWidth * 0.44}
            y={0}
            width={Math.max(0.22, bandWidth * 0.18)}
            height={height * 1.8}
            fill={`rgba(255,255,255,${0.42 * shimmerStrength})`}
          />
        </Group>
      </Group>
    );
  };
  const renderShimmerSweepInCircle = (x: number, y: number, radius: number) => {
    if (shimmerStrength <= 0 || radius <= 0) {
      return null;
    }
    const diameter = radius * 2;
    const bandWidth = Math.max(0.55, diameter * 0.26);
    const travel = diameter + bandWidth * 2;
    const shimmerTravelProgress = Math.max(
      0,
      Math.min(1, shimmerProgress * 0.78 + 0.02)
    );
    const sweepX = x - radius - bandWidth + travel * shimmerTravelProgress;
    const sweepY = y - radius * 1.25;
    return (
      <Group
        listening={false}
        clipFunc={(ctx) => {
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.closePath();
        }}
      >
        <Group x={sweepX} y={sweepY} rotation={35}>
          <Rect
            x={0}
            y={0}
            width={bandWidth}
            height={diameter * 1.8}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: bandWidth, y: 0 }}
            fillLinearGradientColorStops={[
              0,
              "rgba(255,255,255,0)",
              0.36,
              `rgba(255,255,255,${0.24 * shimmerStrength})`,
              0.52,
              `rgba(255,255,255,${0.74 * shimmerStrength})`,
              0.69,
              `rgba(172,240,255,${0.34 * shimmerStrength})`,
              1,
              "rgba(255,255,255,0)",
            ]}
          />
          <Rect
            x={bandWidth * 0.45}
            y={0}
            width={Math.max(0.2, bandWidth * 0.16)}
            height={diameter * 1.8}
            fill={`rgba(255,255,255,${0.38 * shimmerStrength})`}
          />
        </Group>
      </Group>
    );
  };

  const getCenterScaleAnchorOffset = (width: number, height: number) => {
    const sx = Number.isFinite(commonProps.scaleX) ? commonProps.scaleX : 1;
    const sy = Number.isFinite(commonProps.scaleY) ? commonProps.scaleY : 1;
    if (Math.abs(sx - 1) < 1e-6 && Math.abs(sy - 1) < 1e-6) {
      return { x: 0, y: 0 };
    }
    const dx = (width * (1 - sx)) / 2;
    const dy = (height * (1 - sy)) / 2;
    const radians = ((Number.isFinite(object.rotation) ? object.rotation : 0) * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
      x: dx * cos - dy * sin,
      y: dx * sin + dy * cos,
    };
  };

  if (object.type === "player") {
    const player = object as PlayerToken;
    const fillColor = player.squadPlayerId
      ? kitByPlayerId[player.squadPlayerId] ?? player.style.fill
      : player.style.fill === "#f9bf4a"
        ? defaultPlayerFill
        : player.style.fill;
    const secondaryFillColor =
      (player.squadPlayerId
        ? secondaryKitByPlayerId[player.squadPlayerId]
        : undefined) ??
      fillColor;
    const jerseyType = ((player.squadPlayerId
      ? jerseyTypeByPlayerId[player.squadPlayerId]
      : undefined) ?? "solid") as JerseyType;
    const vestColor =
      player.vestColor ??
      (player.squadPlayerId ? vestByPlayerId[player.squadPlayerId] : undefined);
    const squadPlayer = player.squadPlayerId
      ? squadPlayers.find((item) => item.id === player.squadPlayerId)
      : undefined;
    const compactName = (() => {
      const value = squadPlayer?.name?.trim();
      if (!value) {
        return "";
      }
      const parts = value.split(/\s+/).filter(Boolean);
      if (parts.length <= 1) {
        return parts[0]?.slice(0, 14) ?? "";
      }
      const first = parts[0] ?? "";
      const lastInitial = parts[parts.length - 1]?.[0]?.toUpperCase();
      return `${first.slice(0, 12)} ${lastInitial ?? ""}`.trim();
    })();
    const initials = squadPlayer?.name
      ? squadPlayer.name
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase())
          .join("")
          .slice(0, 2)
      : "PL";
    const positionLabel = toPositionAbbreviation(
      player.boardPositionLabel ?? squadPlayer?.positionLabel
    );
    const hasLabel = showPlayerName || showPlayerPosition || showPlayerNumber;
    const circleText = !hasLabel
      ? ""
      : showPlayerNumber && squadPlayer?.number
        ? String(squadPlayer.number)
        : showPlayerPosition && positionLabel
          ? positionLabel
          : initials;
    const circleFontSize = playerTokenSize * 0.76;
    const belowText = !hasLabel
      ? ""
      : showPlayerNumber
        ? [
            showPlayerPosition ? positionLabel : "",
            showPlayerName ? compactName : "",
          ]
            .filter(Boolean)
            .join(" • ")
        : showPlayerPosition
          ? showPlayerName && compactName
            ? compactName
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
    const textStrokeColor = textColor === "#0f1b1a" ? "rgba(255,255,255,0.9)" : "rgba(5,20,16,0.92)";
    const circleTextSize = playerTokenSize * 2;
    const belowTextWidth = compactPlayerLabels ? playerTokenSize * 5.8 : playerTokenSize * 6;
    const belowTextHeight = compactPlayerLabels ? 2.35 : 2.2;
    const belowTextFontSize = compactPlayerLabels ? 1.34 : 1.24;
    const belowTextBgPaddingX = compactPlayerLabels ? 0.34 : 0;
    const belowTextBgHeight = compactPlayerLabels ? belowTextHeight + 0.22 : belowTextHeight;
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
      playerTokenSize + 0.28 + belowTextHeight / 2,
      labelRotation
    );
    const hasAttachedBall = objects.some(
      (item) => item.type === "ball" && item.attachedToId === player.id
    );
    const highlightGlowStrength = Math.max(
      0,
      Math.min(1, Number(player.style.outlineWidth ?? 0))
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
        {highlightGlowStrength > 0 && (
          <>
            <Circle
              radius={playerTokenSize + 1.8 + highlightGlowStrength * 1.4}
              listening={false}
              fillRadialGradientStartPoint={{ x: 0, y: 0 }}
              fillRadialGradientStartRadius={0}
              fillRadialGradientEndPoint={{ x: 0, y: 0 }}
              fillRadialGradientEndRadius={playerTokenSize + 2.2 + highlightGlowStrength * 2.2}
              fillRadialGradientColorStops={[
                0,
                `rgba(249,191,74,${0.45 * highlightGlowStrength})`,
                0.45,
                `rgba(249,191,74,${0.22 * highlightGlowStrength})`,
                1,
                "rgba(249,191,74,0)",
              ]}
            />
            <Circle
              radius={playerTokenSize + 2.8 + highlightGlowStrength * 2.4}
              listening={false}
              fillRadialGradientStartPoint={{ x: 0, y: 0 }}
              fillRadialGradientStartRadius={0}
              fillRadialGradientEndPoint={{ x: 0, y: 0 }}
              fillRadialGradientEndRadius={playerTokenSize + 3.4 + highlightGlowStrength * 3.2}
              fillRadialGradientColorStops={[
                0,
                `rgba(240,109,79,${0.22 * highlightGlowStrength})`,
                0.6,
                `rgba(240,109,79,${0.1 * highlightGlowStrength})`,
                1,
                "rgba(240,109,79,0)",
              ]}
            />
          </>
        )}
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
        {renderPlayerJerseyPattern(
          playerTokenSize,
          fillColor,
          secondaryFillColor,
          jerseyType
        )}
        {renderShimmerSweepInCircle(0, 0, playerTokenSize)}
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
        <Circle
          radius={playerTokenSize}
          fillEnabled={false}
          stroke={player.style.stroke}
          strokeWidth={depthStroke(player.style.strokeWidth)}
          listening={false}
        />
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
              wrap="none"
              fontSize={circleFontSize}
              fill={textColor}
              fontStyle="bold"
              stroke={textStrokeColor}
              strokeWidth={Math.max(0.35, playerTokenSize * 0.06)}
              fillAfterStrokeEnabled
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
            {compactPlayerLabels && (
              <Rect
                x={-(belowTextWidth + belowTextBgPaddingX * 2) / 2}
                y={-belowTextBgHeight / 2}
                width={belowTextWidth + belowTextBgPaddingX * 2}
                height={belowTextBgHeight}
                fill="rgba(5,20,16,0.62)"
                cornerRadius={0.42}
                listening={false}
              />
            )}
            <Text
              text={belowText}
              width={belowTextWidth}
              height={belowTextHeight}
              x={-belowTextWidth / 2}
              y={-belowTextHeight / 2}
              align="center"
              verticalAlign="middle"
              wrap={compactPlayerLabels ? "none" : "word"}
              ellipsis={!!compactPlayerLabels}
              fontSize={belowTextFontSize}
              fontStyle="bold"
              fill={compactPlayerLabels ? "#f4f7f2" : "#f2f1e9"}
              strokeEnabled={false}
              shadowEnabled={!compactPlayerLabels}
              shadowColor="#04140f"
              shadowOpacity={0.35}
              shadowBlur={0.06}
              shadowOffsetY={0.04}
            />
          </Group>
        )}
      </Group>
    );
  }

  if (object.type === "ball") {
    const ball = object as BallToken;
    const ballRadius = Math.max(0.7, playerTokenSize * 0.52);
    // Keep a slight overlap so the ball visually touches the player ring.
    const defaultAttachDistance = playerTokenSize + ballRadius - 0.3;
    const defaultAttachOffset = {
      x: defaultAttachDistance / Math.sqrt(2),
      y: -defaultAttachDistance / Math.sqrt(2),
    };
    const attachedPlayer = ball.attachedToId
      ? objects.find((item) => item.id === ball.attachedToId)
      : null;
    const normalizedOffset = (() => {
      if (!attachedPlayer) {
        return undefined;
      }
      const rawX = ball.offset?.x ?? defaultAttachOffset.x;
      const rawY = ball.offset?.y ?? defaultAttachOffset.y;
      const length = Math.hypot(rawX, rawY) || 1;
      return {
        x: (rawX / length) * defaultAttachDistance,
        y: (rawY / length) * defaultAttachDistance,
      };
    })();
    const position = attachedPlayer && normalizedOffset
      ? {
          x: attachedPlayer.position.x + normalizedOffset.x,
          y: attachedPlayer.position.y + normalizedOffset.y,
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
            radius={Math.max(1, playerTokenSize * 0.8)}
            fill="#ffffff"
            opacity={0.18}
            shadowBlur={18}
            shadowColor="#ffffff"
            shadowOpacity={0.45}
          />
        )}
        <BallSprite radius={ballRadius} />
        {renderShimmerSweepInCircle(0, 0, ballRadius)}
      </Group>
    );
  }

  if (object.type === "circle") {
    const circle = object as ShapeCircle;
    return (
      <Group
        {...commonProps}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
      >
        <Circle
          radius={circle.radius}
          stroke={circle.style.stroke}
          strokeWidth={depthStroke(circle.style.strokeWidth)}
          fill={circle.style.fill}
          dash={circle.style.dash}
        />
        {renderShimmerSweepInCircle(0, 0, circle.radius)}
      </Group>
    );
  }

  if (object.type === "cone") {
    const cone = object as ConeToken;
    const coneScaleAnchorOffset = getCenterScaleAnchorOffset(cone.width, cone.height);
    const lowAlphaWhite = cone.style.fill.match(
      /^rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([0-9.]+)\s*\)$/i
    );
    const lowAlpha = lowAlphaWhite ? Number(lowAlphaWhite[1]) : NaN;
    const coneFill =
      cone.style.fill &&
      cone.style.fill !== "transparent" &&
      !(Number.isFinite(lowAlpha) && lowAlpha <= 0.35)
        ? cone.style.fill
        : "#f06d4f";
    const scaleX = cone.width / CONE_BASE_WIDTH;
    const verticalCompress = 0.5;
    const scaleY = (cone.height / CONE_BASE_HEIGHT) * verticalCompress;
    const coneDrawHeight = CONE_BASE_HEIGHT * scaleY;
    const coneOffsetY = Math.max(0, cone.height - coneDrawHeight);
    const coneStroke =
      depthStroke(Math.max(0.08, cone.style.strokeWidth)) /
      Math.max(scaleX, scaleY, 0.01);
    return (
      <Group
        {...commonProps}
        x={object.position.x + coneScaleAnchorOffset.x}
        y={object.position.y + coneScaleAnchorOffset.y}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
        shadowEnabled={ambientShadowEnabled}
        shadowColor="#000000"
        shadowBlur={ambientShadowBlur}
        shadowOpacity={ambientShadowOpacity}
        shadowOffsetY={ambientShadowOffsetY}
      >
        <Rect
          x={0}
          y={0}
          width={cone.width}
          height={cone.height}
          fill="rgba(0,0,0,0.001)"
          strokeEnabled={false}
        />
        <Group y={coneOffsetY} scaleX={scaleX} scaleY={scaleY} listening={false}>
          <Path
            data={CONE_FILL_PATH}
            fill={coneFill}
            stroke="#111111"
            strokeWidth={coneStroke}
            lineJoin="round"
          />
        </Group>
        {renderShimmerSweepInBox(0, 0, cone.width, cone.height)}
      </Group>
    );
  }

  if (object.type === "goal") {
    const goal = object as MiniGoal;
    const goalScaleAnchorOffset = getCenterScaleAnchorOffset(goal.width, goal.height);
    return (
      <Group
        {...commonProps}
        x={object.position.x + goalScaleAnchorOffset.x}
        y={object.position.y + goalScaleAnchorOffset.y}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
      >
        <GoalSprite width={goal.width} height={goal.height} />
        {renderShimmerSweepInBox(0, 0, goal.width, goal.height)}
      </Group>
    );
  }

  if (object.type === "pole") {
    const pole = object as PoleToken;
    const poleScaleAnchorOffset = getCenterScaleAnchorOffset(pole.width, pole.height);
    const standRadiusX = Math.max(0.35, pole.width * 0.4);
    const standRadiusY = Math.max(0.18, pole.width * 0.2);
    const shaftWidth = Math.max(0.24, pole.width * 0.22);
    const shaftHeight = Math.max(0.6, pole.height - standRadiusY * 2.2);
    const shaftX = pole.width / 2 - shaftWidth / 2;
    const shaftY = Math.max(0, pole.height - shaftHeight - standRadiusY * 1.2);
    return (
      <Group
        {...commonProps}
        x={object.position.x + poleScaleAnchorOffset.x}
        y={object.position.y + poleScaleAnchorOffset.y}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
        shadowEnabled={ambientShadowEnabled}
        shadowColor="#000000"
        shadowBlur={ambientShadowBlur}
        shadowOpacity={ambientShadowOpacity}
        shadowOffsetY={ambientShadowOffsetY}
      >
        <Rect
          x={shaftX}
          y={shaftY}
          width={shaftWidth}
          height={shaftHeight}
          fill={pole.style.fill}
          stroke={pole.style.stroke}
          strokeWidth={depthStroke(Math.max(0.08, pole.style.strokeWidth))}
          cornerRadius={shaftWidth * 0.45}
        />
        <Ellipse
          x={pole.width / 2}
          y={pole.height - standRadiusY}
          radiusX={standRadiusX}
          radiusY={standRadiusY}
          fill={pole.style.fill}
          stroke={pole.style.stroke}
          strokeWidth={depthStroke(Math.max(0.08, pole.style.strokeWidth))}
        />
        {renderShimmerSweepInBox(0, 0, pole.width, pole.height)}
      </Group>
    );
  }

  if (object.type === "mannequin") {
    const mannequin = object as MannequinToken;
    const mannequinScaleAnchorOffset = getCenterScaleAnchorOffset(
      mannequin.width,
      mannequin.height
    );
    const headRadius = Math.max(0.38, mannequin.width * 0.2);
    const headCenterX = mannequin.width / 2;
    const headCenterY = headRadius + 0.16;
    const shoulderY = headCenterY + headRadius - 0.02;
    const torsoBottomY = mannequin.height * 0.56;
    const legTopY = mannequin.height * 0.84;
    const baseY = mannequin.height;
    const shoulderHalf = mannequin.width * 0.42;
    const waistHalf = mannequin.width * 0.24;
    const legHalf = mannequin.width * 0.18;
    const baseHalf = mannequin.width * 0.52;
    const bodyPath = [
      headCenterX - shoulderHalf,
      shoulderY,
      headCenterX + shoulderHalf,
      shoulderY,
      headCenterX + waistHalf,
      torsoBottomY,
      headCenterX + legHalf,
      legTopY,
      headCenterX + baseHalf,
      baseY,
      headCenterX - baseHalf,
      baseY,
      headCenterX - legHalf,
      legTopY,
      headCenterX - waistHalf,
      torsoBottomY,
    ];
    return (
      <Group
        {...commonProps}
        x={object.position.x + mannequinScaleAnchorOffset.x}
        y={object.position.y + mannequinScaleAnchorOffset.y}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
        shadowEnabled={ambientShadowEnabled}
        shadowColor="#000000"
        shadowBlur={ambientShadowBlur}
        shadowOpacity={ambientShadowOpacity}
        shadowOffsetY={ambientShadowOffsetY}
      >
        <Line
          points={bodyPath}
          closed
          fill={mannequin.style.fill}
          stroke={mannequin.style.stroke}
          strokeWidth={depthStroke(Math.max(0.08, mannequin.style.strokeWidth))}
          lineJoin="round"
        />
        <Circle
          x={headCenterX}
          y={headCenterY}
          radius={headRadius}
          fill={mannequin.style.fill}
          stroke={mannequin.style.stroke}
          strokeWidth={depthStroke(Math.max(0.08, mannequin.style.strokeWidth))}
        />
        {renderShimmerSweepInBox(0, 0, mannequin.width, mannequin.height)}
      </Group>
    );
  }

  if (object.type === "rect") {
    const rect = object as ShapeRect;
    const rectScaleAnchorOffset = getCenterScaleAnchorOffset(rect.width, rect.height);
    return (
      <Group
        {...commonProps}
        x={object.position.x + rectScaleAnchorOffset.x}
        y={object.position.y + rectScaleAnchorOffset.y}
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
        <Rect
          width={rect.width}
          height={rect.height}
          cornerRadius={rect.cornerRadius}
          stroke={rect.style.stroke}
          strokeWidth={depthStroke(rect.style.strokeWidth)}
          fill={rect.style.fill}
          dash={rect.style.dash}
        />
        {renderShimmerSweepInBox(0, 0, rect.width, rect.height)}
      </Group>
    );
  }

  if (object.type === "triangle") {
    const triangle = object as ShapeTriangle;
    const triangleScaleAnchorOffset = getCenterScaleAnchorOffset(
      triangle.width,
      triangle.height
    );
    const points = [0, 0, triangle.width, triangle.height / 2, 0, triangle.height];
    return (
      <Group
        {...commonProps}
        x={object.position.x + triangleScaleAnchorOffset.x}
        y={object.position.y + triangleScaleAnchorOffset.y}
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
        <Line
          points={points}
          closed
          stroke={triangle.style.stroke}
          strokeWidth={depthStroke(triangle.style.strokeWidth)}
          fill={triangle.style.fill}
          dash={triangle.style.dash}
        />
        {renderShimmerSweepInBox(0, 0, triangle.width, triangle.height)}
      </Group>
    );
  }

  if (object.type === "arrow") {
    const arrow = object as ArrowLine;
    const drawProgress = Math.max(
      0,
      Math.min(1, Number(arrow.style.fxDrawProgress ?? 1))
    );
    const end = {
      x: arrow.points[2],
      y: arrow.points[3],
    };
    const control = arrow.control ?? { x: end.x / 2, y: end.y / 2 };
    const sampledPoints = (() => {
      if (!arrow.curved) {
        return [
          { x: 0, y: 0 },
          { x: end.x, y: end.y },
        ];
      }
      const cp1 = {
        x: (0 + 2 * control.x) / 3,
        y: (0 + 2 * control.y) / 3,
      };
      const cp2 = {
        x: (end.x + 2 * control.x) / 3,
        y: (end.y + 2 * control.y) / 3,
      };
      const steps = 26;
      const points: Array<{ x: number; y: number }> = [];
      for (let index = 0; index <= steps; index += 1) {
        const t = index / steps;
        const mt = 1 - t;
        const x =
          mt * mt * mt * 0 +
          3 * mt * mt * t * cp1.x +
          3 * mt * t * t * cp2.x +
          t * t * t * end.x;
        const y =
          mt * mt * mt * 0 +
          3 * mt * mt * t * cp1.y +
          3 * mt * t * t * cp2.y +
          t * t * t * end.y;
        points.push({ x, y });
      }
      return points;
    })();
    const partialPoints = (() => {
      if (sampledPoints.length < 2 || drawProgress >= 0.999) {
        return sampledPoints;
      }
      if (drawProgress <= 0.001) {
        return [sampledPoints[0]!, sampledPoints[0]!];
      }
      let total = 0;
      const lengths: number[] = [];
      for (let index = 1; index < sampledPoints.length; index += 1) {
        const from = sampledPoints[index - 1]!;
        const to = sampledPoints[index]!;
        const len = Math.hypot(to.x - from.x, to.y - from.y);
        lengths.push(len);
        total += len;
      }
      const target = total * drawProgress;
      const result = [sampledPoints[0]!];
      let traversed = 0;
      for (let index = 1; index < sampledPoints.length; index += 1) {
        const from = sampledPoints[index - 1]!;
        const to = sampledPoints[index]!;
        const len = lengths[index - 1] ?? 0;
        if (traversed + len >= target) {
          const remaining = Math.max(0, target - traversed);
          const ratio = len > 0 ? remaining / len : 0;
          result.push({
            x: from.x + (to.x - from.x) * ratio,
            y: from.y + (to.y - from.y) * ratio,
          });
          return result;
        }
        result.push(to);
        traversed += len;
      }
      return result;
    })();
    const flatPoints = partialPoints.flatMap((point) => [point.x, point.y]);
    const headSegment =
      partialPoints.length >= 2
        ? [
            partialPoints[partialPoints.length - 2]!,
            partialPoints[partialPoints.length - 1]!,
          ]
        : [partialPoints[0]!, partialPoints[0]!];
    const outlineStroke = arrow.style.outlineStroke;
    const arrowStrokeWidth = depthStroke(arrow.style.strokeWidth);
    const outlineWidth = outlineStroke
      ? getLineOutlineWidth(arrowStrokeWidth)
      : 0;
    const headSize = getArrowHeadSize(arrowStrokeWidth);
    return (
      <Group
        {...commonProps}
        ref={(node) => {
          if (node) {
            registerNode(object.id, node);
          }
        }}
      >
        {outlineStroke && outlineWidth > 0 && (
          <>
            <Line
              points={flatPoints}
              stroke={outlineStroke}
              strokeWidth={arrowStrokeWidth + outlineWidth * 2}
              dash={arrow.dashed ? [1, 1] : []}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
            {arrow.head && drawProgress > 0.001 && (
              <Arrow
                points={[
                  headSegment[0].x,
                  headSegment[0].y,
                  headSegment[1].x,
                  headSegment[1].y,
                ]}
                stroke={outlineStroke}
                strokeWidth={arrowStrokeWidth + outlineWidth * 2}
                fill={outlineStroke}
                pointerLength={headSize.length + outlineWidth * 2}
                pointerWidth={headSize.width + outlineWidth * 2}
                listening={false}
              />
            )}
          </>
        )}
        <Line
          points={flatPoints}
          stroke={arrow.style.stroke}
          strokeWidth={arrowStrokeWidth}
          dash={arrow.dashed ? [1, 1] : []}
          lineCap="round"
          lineJoin="round"
          shadowEnabled={ambientShadowEnabled}
          shadowColor="#000000"
          shadowBlur={ambientShadowBlur}
          shadowOpacity={ambientShadowOpacity}
          shadowOffsetY={ambientShadowOffsetY}
          listening={false}
        />
        {arrow.head && drawProgress > 0.001 && (
          <Arrow
            points={[
              headSegment[0].x,
              headSegment[0].y,
              headSegment[1].x,
              headSegment[1].y,
            ]}
            stroke={arrow.style.stroke}
            strokeWidth={arrowStrokeWidth}
            fill={arrow.style.stroke}
            pointerLength={headSize.length}
            pointerWidth={headSize.width}
            shadowEnabled={ambientShadowEnabled}
            shadowColor="#000000"
            shadowBlur={ambientShadowBlur}
            shadowOpacity={ambientShadowOpacity}
            shadowOffsetY={ambientShadowOffsetY}
            listening={false}
          />
        )}
        <Line
          points={flatPoints}
          stroke="rgba(0,0,0,0.001)"
          strokeWidth={Math.max(0.2, arrowStrokeWidth)}
          hitStrokeWidth={Math.max(1.6, arrowStrokeWidth * 5)}
          lineCap="round"
          lineJoin="round"
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
    const textScaleAnchorOffset = getCenterScaleAnchorOffset(label.width, textHeight);
    return (
      <Group
        {...commonProps}
        x={object.position.x + textScaleAnchorOffset.x}
        y={object.position.y + textScaleAnchorOffset.y}
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
        {renderShimmerSweepInBox(0, 0, label.width, textHeight)}
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

