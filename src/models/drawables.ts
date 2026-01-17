export type Point = {
  x: number;
  y: number;
};

export type Style = {
  stroke: string;
  fill: string;
  strokeWidth: number;
  dash: number[];
  opacity: number;
};

export type BaseDrawable = {
  id: string;
  type:
    | "player"
    | "ball"
    | "cone"
    | "goal"
    | "circle"
    | "rect"
    | "triangle"
    | "arrow"
    | "text"
    | "path";
  position: Point;
  rotation: number;
  scale: Point;
  style: Style;
  zIndex: number;
  locked: boolean;
  visible: boolean;
};

export type PlayerToken = BaseDrawable & {
  type: "player";
  squadPlayerId?: string;
  hasBall?: boolean;
  showName: boolean;
  showPosition: boolean;
  showNumber: boolean;
  tokenSize: number;
};

export type BallToken = BaseDrawable & {
  type: "ball";
  attachedToId?: string;
  offset?: Point;
};

export type ConeToken = BaseDrawable & {
  type: "cone";
  width: number;
  height: number;
};

export type MiniGoal = BaseDrawable & {
  type: "goal";
  width: number;
  height: number;
};

export type ShapeCircle = BaseDrawable & {
  type: "circle";
  radius: number;
};

export type ShapeRect = BaseDrawable & {
  type: "rect";
  width: number;
  height: number;
  cornerRadius: number;
};

export type ShapeTriangle = BaseDrawable & {
  type: "triangle";
  width: number;
  height: number;
};

export type ArrowLine = BaseDrawable & {
  type: "arrow";
  points: number[];
  head: boolean;
  dashed: boolean;
};

export type TextLabel = BaseDrawable & {
  type: "text";
  text: string;
  fontSize: number;
  bold: boolean;
  background: boolean;
  align: "left" | "center" | "right";
  width: number;
};

export type MovementPath = BaseDrawable & {
  type: "path";
  points: number[];
  linkedToId?: string;
};

export type DrawableObject =
  | PlayerToken
  | BallToken
  | ConeToken
  | MiniGoal
  | ShapeCircle
  | ShapeRect
  | ShapeTriangle
  | ArrowLine
  | TextLabel
  | MovementPath;
