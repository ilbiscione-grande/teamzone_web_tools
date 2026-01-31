import type Konva from "konva";

let stageRef: Konva.Stage | null = null;

export const setStageRef = (stage: Konva.Stage | null) => {
  stageRef = stage;
};

export const getStageRef = () => stageRef;
