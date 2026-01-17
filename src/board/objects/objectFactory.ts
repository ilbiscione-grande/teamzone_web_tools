import type { BallToken, PlayerToken, TextLabel } from "@/models";
import { createId } from "@/utils/id";

export const defaultStyle = {
  stroke: "#ffffff",
  fill: "rgba(255,255,255,0.1)",
  strokeWidth: 0.4,
  dash: [],
  opacity: 1,
};

export const createPlayer = (
  position: { x: number; y: number },
  tokenSize: number,
  fill?: string
): PlayerToken => ({
  id: createId(),
  type: "player",
  position,
  rotation: 0,
  scale: { x: 1, y: 1 },
  style: { ...defaultStyle, fill: fill ?? "#f9bf4a", stroke: "#111111" },
  zIndex: 1,
  locked: false,
  visible: true,
  showName: true,
  showPosition: false,
  showNumber: false,
  tokenSize,
});

export const createBall = (position: { x: number; y: number }): BallToken => ({
  id: createId(),
  type: "ball",
  position,
  rotation: 0,
  scale: { x: 1, y: 1 },
  style: { ...defaultStyle, fill: "#ffffff", stroke: "#111111" },
  zIndex: 2,
  locked: false,
  visible: true,
});

export const createText = (
  position: { x: number; y: number },
  text: string
): TextLabel => ({
  id: createId(),
  type: "text",
  position,
  rotation: 0,
  scale: { x: 1, y: 1 },
  style: { ...defaultStyle, fill: "transparent", stroke: "transparent" },
  zIndex: 3,
  locked: false,
  visible: true,
  text,
  fontSize: 2,
  bold: false,
  background: true,
  align: "left",
  width: 12,
});
