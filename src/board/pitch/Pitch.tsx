import { Group, Rect, Line, Circle, Arc, Text } from "react-konva";
import type { PitchOverlay, PitchView } from "@/models";

const PITCH_LENGTH = 105;
const PITCH_WIDTH = 68;
const CENTER_CIRCLE = 9.15;
const PENALTY_AREA_LENGTH = 16.5;
const PENALTY_AREA_WIDTH = 40.32;
const PENALTY_SPOT_DISTANCE = 11;
const GOAL_AREA_LENGTH = 5.5;
const GOAL_AREA_WIDTH = 18.32;
const GOAL_DEPTH = 2.5;
const GOAL_WIDTH = 7.32;
const CORNER_RADIUS = 1;
const PITCH_MARGIN_Y = 2.5;

const lineColor = "rgba(255,255,255,0.6)";
const penaltyArcTheta = Math.acos(
  (PENALTY_AREA_LENGTH - PENALTY_SPOT_DISTANCE) / CENTER_CIRCLE
);
const penaltyArcAngle = (penaltyArcTheta * 2 * 180) / Math.PI;
const penaltyArcStartLeft = -penaltyArcAngle / 2;
const penaltyArcStartRight = 180 - penaltyArcAngle / 2;

const getViewBounds = (view: PitchView) => {
  if (view === "DEF_HALF") {
    return {
      x: -GOAL_DEPTH,
      y: -PITCH_MARGIN_Y,
      width: PITCH_LENGTH / 2 + GOAL_DEPTH,
      height: PITCH_WIDTH + PITCH_MARGIN_Y * 2,
    };
  }
  if (view === "OFF_HALF") {
    return {
      x: PITCH_LENGTH / 2,
      y: -PITCH_MARGIN_Y,
      width: PITCH_LENGTH / 2 + GOAL_DEPTH,
      height: PITCH_WIDTH + PITCH_MARGIN_Y * 2,
    };
  }
  return {
    x: -GOAL_DEPTH,
    y: -PITCH_MARGIN_Y,
    width: PITCH_LENGTH + GOAL_DEPTH * 2,
    height: PITCH_WIDTH + PITCH_MARGIN_Y * 2,
  };
};

type PitchProps = {
  view: PitchView;
  overlay: PitchOverlay;
  overlayText: boolean;
};

export const getPitchViewBounds = getViewBounds;

export default function Pitch({ view, overlay, overlayText }: PitchProps) {
  const bounds = getViewBounds(view);
  const pitchLeft = view === "OFF_HALF" ? PITCH_LENGTH / 2 : 0;
  const pitchRight = view === "DEF_HALF" ? PITCH_LENGTH / 2 : PITCH_LENGTH;
  const pitchTop = 0;
  const pitchBottom = PITCH_WIDTH;

  if (view === "GREEN_EMPTY") {
    return (
      <Group>
        <Rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          fill="#1f5f3f"
        />
      </Group>
    );
  }

  const leftX = pitchLeft;
  const rightX = pitchRight;

  const showLeft = view !== "OFF_HALF";
  const showRight = view !== "DEF_HALF";

  const overlayDash = [1, 1];
  const overlayColor = "rgba(255,255,255,0.35)";
  const overlayTextColor = "rgba(255,255,255,0.12)";
  const overlayDashOffset = overlayDash[0] / 2;
  const netColor = "rgba(255,255,255,0.25)";
  const netDash = [0.6, 0.6];

  const renderGoal = (x: number, direction: "left" | "right") => {
    const y = (PITCH_WIDTH - GOAL_WIDTH) / 2;
    const depth = GOAL_DEPTH;
    const inset = depth * 0.15;
    const netX = direction === "left" ? x + inset : x + depth - inset;
    return (
      <Group>
        <Rect
          x={x}
          y={y}
          width={depth}
          height={GOAL_WIDTH}
          stroke={lineColor}
          strokeWidth={0.2}
        />
        <Line
          points={[
            direction === "left" ? x + depth : x,
            y,
            direction === "left" ? x + depth : x,
            y + GOAL_WIDTH,
          ]}
          stroke={lineColor}
          strokeWidth={0.2}
        />
        {[0.25, 0.5, 0.75].map((t) => (
          <Line
            key={`goal-net-${direction}-${t}`}
            points={[netX, y + GOAL_WIDTH * t, x + depth / 2, y + GOAL_WIDTH * t]}
            stroke={netColor}
            strokeWidth={0.15}
            dash={netDash}
          />
        ))}
        {[0.25, 0.5, 0.75].map((t) => (
          <Line
            key={`goal-net-vert-${direction}-${t}`}
            points={[
              x + depth * t,
              y + inset,
              x + depth * t,
              y + GOAL_WIDTH - inset,
            ]}
            stroke={netColor}
            strokeWidth={0.15}
            dash={netDash}
          />
        ))}
      </Group>
    );
  };

  return (
    <Group>
      <Rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        fill="#1f5f3f"
      />
      <Rect
        x={pitchLeft}
        y={pitchTop}
        width={pitchRight - pitchLeft}
        height={PITCH_WIDTH}
        stroke={lineColor}
        strokeWidth={0.2}
      />
      {view === "FULL" && (
        <>
          <Line
            points={[PITCH_LENGTH / 2, 0, PITCH_LENGTH / 2, PITCH_WIDTH]}
            stroke={lineColor}
            strokeWidth={0.2}
          />
          <Circle
            x={PITCH_LENGTH / 2}
            y={PITCH_WIDTH / 2}
            radius={CENTER_CIRCLE}
            stroke={lineColor}
            strokeWidth={0.2}
          />
        </>
      )}
      {view === "DEF_HALF" && (
        <Arc
          x={PITCH_LENGTH / 2}
          y={PITCH_WIDTH / 2}
          innerRadius={CENTER_CIRCLE}
          outerRadius={CENTER_CIRCLE}
          angle={180}
          rotation={90}
          stroke={lineColor}
          strokeWidth={0.2}
        />
      )}
      {view === "OFF_HALF" && (
        <Arc
          x={PITCH_LENGTH / 2}
          y={PITCH_WIDTH / 2}
          innerRadius={CENTER_CIRCLE}
          outerRadius={CENTER_CIRCLE}
          angle={180}
          rotation={-90}
          stroke={lineColor}
          strokeWidth={0.2}
        />
      )}

      {showLeft && (
        <>
          {renderGoal(leftX - GOAL_DEPTH, "left")}
          <Rect
            x={leftX}
            y={(PITCH_WIDTH - PENALTY_AREA_WIDTH) / 2}
            width={PENALTY_AREA_LENGTH}
            height={PENALTY_AREA_WIDTH}
            stroke={lineColor}
            strokeWidth={0.2}
          />
          <Rect
            x={leftX}
            y={(PITCH_WIDTH - GOAL_AREA_WIDTH) / 2}
            width={GOAL_AREA_LENGTH}
            height={GOAL_AREA_WIDTH}
            stroke={lineColor}
            strokeWidth={0.2}
          />
          <Circle
            x={leftX + PENALTY_SPOT_DISTANCE}
            y={PITCH_WIDTH / 2}
            radius={0.35}
            fill={lineColor}
          />
          <Arc
            x={leftX + PENALTY_SPOT_DISTANCE}
            y={PITCH_WIDTH / 2}
            innerRadius={CENTER_CIRCLE}
            outerRadius={CENTER_CIRCLE}
            angle={penaltyArcAngle}
            rotation={penaltyArcStartLeft}
            stroke={lineColor}
            strokeWidth={0.2}
          />
        </>
      )}

      {showRight && (
        <>
          {renderGoal(rightX, "right")}
          <Rect
            x={rightX - PENALTY_AREA_LENGTH}
            y={(PITCH_WIDTH - PENALTY_AREA_WIDTH) / 2}
            width={PENALTY_AREA_LENGTH}
            height={PENALTY_AREA_WIDTH}
            stroke={lineColor}
            strokeWidth={0.2}
          />
          <Rect
            x={rightX - GOAL_AREA_LENGTH}
            y={(PITCH_WIDTH - GOAL_AREA_WIDTH) / 2}
            width={GOAL_AREA_LENGTH}
            height={GOAL_AREA_WIDTH}
            stroke={lineColor}
            strokeWidth={0.2}
          />
          <Circle
            x={rightX - PENALTY_SPOT_DISTANCE}
            y={PITCH_WIDTH / 2}
            radius={0.35}
            fill={lineColor}
          />
          <Arc
            x={rightX - PENALTY_SPOT_DISTANCE}
            y={PITCH_WIDTH / 2}
            innerRadius={CENTER_CIRCLE}
            outerRadius={CENTER_CIRCLE}
            angle={penaltyArcAngle}
            rotation={penaltyArcStartRight}
            stroke={lineColor}
            strokeWidth={0.2}
          />
        </>
      )}

      {showLeft && pitchLeft === 0 && (
        <>
          <Arc
            x={leftX}
            y={0}
            innerRadius={CORNER_RADIUS}
            outerRadius={CORNER_RADIUS}
            angle={90}
            rotation={0}
            stroke={lineColor}
            strokeWidth={0.2}
          />
          <Arc
            x={leftX}
            y={PITCH_WIDTH}
            innerRadius={CORNER_RADIUS}
            outerRadius={CORNER_RADIUS}
            angle={90}
            rotation={270}
            stroke={lineColor}
            strokeWidth={0.2}
          />
        </>
      )}
      {showRight && pitchRight === PITCH_LENGTH && (
        <>
          <Arc
            x={rightX}
            y={0}
            innerRadius={CORNER_RADIUS}
            outerRadius={CORNER_RADIUS}
            angle={90}
            rotation={90}
            stroke={lineColor}
            strokeWidth={0.2}
          />
          <Arc
            x={rightX}
            y={PITCH_WIDTH}
            innerRadius={CORNER_RADIUS}
            outerRadius={CORNER_RADIUS}
            angle={90}
            rotation={180}
            stroke={lineColor}
            strokeWidth={0.2}
          />
        </>
      )}

      {overlay === "CORRIDORS" &&
        (() => {
          const centralHeight = CENTER_CIRCLE * 2;
          const topStart = pitchTop;
          const bottomEnd = pitchBottom;
          const centerY = pitchTop + PITCH_WIDTH / 2;
          const centralTop = centerY - centralHeight / 2;
          const centralBottom = centerY + centralHeight / 2;
          const penaltyTop = (PITCH_WIDTH - PENALTY_AREA_WIDTH) / 2;
          const penaltyBottom = penaltyTop + PENALTY_AREA_WIDTH;
          const firstLine = Math.max(topStart, penaltyTop);
          const secondLine = Math.max(firstLine, centralTop);
          const thirdLine = Math.min(bottomEnd, centralBottom);
          const fourthLine = Math.min(bottomEnd, penaltyBottom);
          const lineYs = [firstLine, secondLine, thirdLine, fourthLine];
          const corridorBands = [
            { label: "Outer Channel", y: topStart, height: firstLine - topStart },
            { label: "Half Space", y: firstLine, height: secondLine - firstLine },
            { label: "Central Channel", y: secondLine, height: thirdLine - secondLine },
            { label: "Half Space", y: thirdLine, height: fourthLine - thirdLine },
            { label: "Outer Channel", y: fourthLine, height: bottomEnd - fourthLine },
          ];
          const overlayStart = Math.max(
            bounds.x,
            showLeft ? leftX + PENALTY_AREA_LENGTH : leftX
          );
          const overlayEnd = Math.min(
            bounds.x + bounds.width,
            showRight ? rightX - PENALTY_AREA_LENGTH : rightX
          );
          if (overlayEnd <= overlayStart) {
            return null;
          }
          return (
            <>
              {lineYs.map((y, index) => (
                <Line
                  key={`corridor-${index}`}
                  points={[overlayStart, y, overlayEnd, y]}
                  stroke={overlayColor}
                  strokeWidth={0.2}
                  dash={overlayDash}
                  dashOffset={overlayDashOffset}
                  lineCap="square"
                />
              ))}
              {overlayText &&
                corridorBands.map((band, index) => (
                  <Text
                    key={`corridor-label-${band.label}-${index}`}
                    x={overlayStart}
                    y={band.y + band.height / 2 - 1.6}
                    width={overlayEnd - overlayStart}
                    align="center"
                    fontSize={4.5}
                    fontStyle="bold"
                    fill={overlayTextColor}
                    text={band.label}
                  />
                ))}
            </>
          );
        })()}

      {overlay === "THIRDS" && (
        <>
          {[1, 2].map((index) => {
            const x = (PITCH_LENGTH / 3) * index;
            if (x < bounds.x || x > bounds.x + bounds.width) {
              return null;
            }
            return (
              <Line
                key={`third-${index}`}
                points={[x, pitchTop, x, pitchBottom]}
                stroke={overlayColor}
                strokeWidth={0.2}
                dash={overlayDash}
                dashOffset={overlayDashOffset}
                lineCap="square"
              />
            );
          })}
          {overlayText && (
            <>
              {["Defensive", "Middle", "Attacking"].map((label, index) => {
                const zoneWidth = PITCH_LENGTH / 3;
                const zoneStart = zoneWidth * index;
                const zoneCenter = zoneStart + zoneWidth / 2;
                if (zoneCenter < bounds.x || zoneCenter > bounds.x + bounds.width) {
                  return null;
                }
                return (
                  <Text
                    key={`third-label-${label}`}
                    x={zoneCenter}
                    y={pitchTop + PITCH_WIDTH / 2}
                    offsetX={zoneWidth / 2}
                    offsetY={3}
                    align="center"
                    width={zoneWidth}
                    fontSize={6}
                    fontStyle="bold"
                    fill={overlayTextColor}
                    text={label}
                    rotation={90}
                  />
                );
              })}
            </>
          )}
        </>
      )}

      {overlay === "ZONES_18" && (
        <>
          {Array.from({ length: 5 }).map((_, index) => {
            const x = (PITCH_LENGTH / 6) * (index + 1);
            if (x < bounds.x || x > bounds.x + bounds.width) {
              return null;
            }
            return (
              <Line
                key={`zones-col-${index}`}
                points={[x, pitchTop, x, pitchBottom]}
                stroke={overlayColor}
                strokeWidth={0.2}
                dash={overlayDash}
                dashOffset={overlayDashOffset}
                lineCap="square"
              />
            );
          })}
          {Array.from({ length: 2 }).map((_, index) => {
            const y = pitchTop + (PITCH_WIDTH / 3) * (index + 1);
            return (
              <Line
                key={`zones-row-${index}`}
                points={[bounds.x, y, bounds.x + bounds.width, y]}
                stroke={overlayColor}
                strokeWidth={0.2}
                dash={overlayDash}
                dashOffset={overlayDashOffset}
                lineCap="square"
              />
            );
          })}
          {overlayText &&
            Array.from({ length: 6 }).map((_, col) =>
              Array.from({ length: 3 }).map((_, row) => {
                const cellWidth = PITCH_LENGTH / 6;
                const cellHeight = PITCH_WIDTH / 3;
                const number = col * 3 + row + 1;
                const centerX = bounds.x + col * cellWidth + cellWidth / 2;
                if (centerX < bounds.x || centerX > bounds.x + bounds.width) {
                  return null;
                }
                return (
                  <Text
                    key={`zone-label-${number}`}
                    x={centerX}
                    y={pitchTop + row * cellHeight + cellHeight / 2}
                    width={cellWidth}
                    height={cellHeight}
                    align="center"
                    verticalAlign="middle"
                    fontSize={6}
                    fontStyle="bold"
                    fill={overlayTextColor}
                    text={String(number)}
                    rotation={90}
                    offsetX={cellWidth / 2}
                    offsetY={cellHeight / 2}
                  />
                );
              })
            )}
        </>
      )}
    </Group>
  );
}
