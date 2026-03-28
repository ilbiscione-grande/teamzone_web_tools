import type { Project } from "@/models";
import { SCHEMA_VERSION } from "@/models";

export type ValidationResult =
  | { ok: true; project: Project }
  | { ok: false; error: string };

export const serializeProject = (project: Project) =>
  JSON.stringify(project, null, 2);

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const isString = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

const isPoint = (value: unknown) =>
  isObject(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);

const isStyle = (value: unknown) =>
  isObject(value) &&
  isString(value.stroke) &&
  isString(value.fill) &&
  isFiniteNumber(value.strokeWidth) &&
  Array.isArray(value.dash) &&
  value.dash.every(isFiniteNumber) &&
  isFiniteNumber(value.opacity);

const isDrawable = (value: unknown): boolean => {
  if (!isObject(value)) {
    return false;
  }
  if (
    !isString(value.id) ||
    !isString(value.type) ||
    !isPoint(value.position) ||
    !isFiniteNumber(value.rotation) ||
    !isPoint(value.scale) ||
    !isStyle(value.style) ||
    !isFiniteNumber(value.zIndex) ||
    !isBoolean(value.locked) ||
    !isBoolean(value.visible)
  ) {
    return false;
  }

  switch (value.type) {
    case "player":
      return (
        isBoolean(value.showName) &&
        isBoolean(value.showPosition) &&
        isBoolean(value.showNumber) &&
        isFiniteNumber(value.tokenSize) &&
        (value.moveControl === undefined || isPoint(value.moveControl))
      );
    case "ball":
      return value.offset === undefined || isPoint(value.offset);
    case "cone":
    case "pole":
    case "mannequin":
    case "goal":
      return isFiniteNumber(value.width) && isFiniteNumber(value.height);
    case "circle":
      return isFiniteNumber(value.radius);
    case "polygon":
      return Array.isArray(value.points) && value.points.every(isFiniteNumber);
    case "rect":
      return (
        isFiniteNumber(value.width) &&
        isFiniteNumber(value.height) &&
        isFiniteNumber(value.cornerRadius)
      );
    case "triangle":
      return isFiniteNumber(value.width) && isFiniteNumber(value.height);
    case "arrow":
      return (
        Array.isArray(value.points) &&
        value.points.every(isFiniteNumber) &&
        isBoolean(value.head) &&
        isBoolean(value.dashed) &&
        (value.control === undefined || isPoint(value.control))
      );
    case "text":
      return (
        isString(value.text) &&
        isFiniteNumber(value.fontSize) &&
        isBoolean(value.bold) &&
        isBoolean(value.background) &&
        (value.align === "left" ||
          value.align === "center" ||
          value.align === "right") &&
        isFiniteNumber(value.width) &&
        (value.height === undefined || isFiniteNumber(value.height))
      );
    case "path":
      return Array.isArray(value.points) && value.points.every(isFiniteNumber);
    default:
      return false;
  }
};

const isSquadPlayer = (value: unknown) =>
  isObject(value) &&
  isString(value.id) &&
  (value.teamMemberId === undefined || isString(value.teamMemberId)) &&
  isString(value.name) &&
  isString(value.positionLabel) &&
  (value.guest === undefined || isBoolean(value.guest)) &&
  (value.active === undefined || isBoolean(value.active)) &&
  (value.number === undefined || isFiniteNumber(value.number));

const isSquad = (value: unknown) =>
  isObject(value) &&
  isString(value.id) &&
  isString(value.name) &&
  isObject(value.kit) &&
  isString(value.kit.shirt) &&
  isString(value.kit.shorts) &&
  isString(value.kit.socks) &&
  Array.isArray(value.players) &&
  value.players.every(isSquadPlayer) &&
  (value.substituteIds === undefined || isStringArray(value.substituteIds));

const isTeamContext = (value: unknown) =>
  isObject(value) &&
  (value.homeTeamId === undefined || isString(value.homeTeamId)) &&
  (value.awayTeamId === undefined || isString(value.awayTeamId));

const isPlayerLink = (value: unknown) =>
  isObject(value) &&
  isString(value.id) &&
  isStringArray(value.playerIds) &&
  (value.style === undefined || isStyle(value.style));

const isBoardFrame = (value: unknown) =>
  isObject(value) &&
  isString(value.id) &&
  isString(value.name) &&
  Array.isArray(value.objects) &&
  value.objects.every(isDrawable) &&
  (value.durationMs === undefined || isFiniteNumber(value.durationMs)) &&
  (value.playerHighlights === undefined || isStringArray(value.playerHighlights)) &&
  (value.playerLinks === undefined ||
    (Array.isArray(value.playerLinks) && value.playerLinks.every(isPlayerLink)));

const isBoardSquadOverride = (value: unknown) =>
  isObject(value) &&
  (value.hiddenPlayerIds === undefined || isStringArray(value.hiddenPlayerIds)) &&
  (value.guestPlayers === undefined ||
    (Array.isArray(value.guestPlayers) && value.guestPlayers.every(isSquadPlayer))) &&
  (value.numberOverrides === undefined ||
    (isObject(value.numberOverrides) &&
      Object.values(value.numberOverrides).every(
        (entry) => entry === undefined || isFiniteNumber(entry)
      ))) &&
  (value.positionOverrides === undefined ||
    (isObject(value.positionOverrides) &&
      Object.values(value.positionOverrides).every(isString)));

const isBoard = (value: unknown) =>
  isObject(value) &&
  isString(value.id) &&
  isString(value.name) &&
  (value.mode === "STATIC" || value.mode === "DYNAMIC") &&
  (value.pitchView === "FULL" ||
    value.pitchView === "DEF_HALF" ||
    value.pitchView === "OFF_HALF" ||
    value.pitchView === "GREEN_EMPTY") &&
  (value.pitchOverlay === "NONE" ||
    value.pitchOverlay === "CORRIDORS" ||
    value.pitchOverlay === "THIRDS" ||
    value.pitchOverlay === "ZONES_18") &&
  isBoolean(value.pitchOverlayText) &&
  isString(value.notes) &&
  isObject(value.playerLabel) &&
  isBoolean(value.playerLabel.showName) &&
  isBoolean(value.playerLabel.showPosition) &&
  isBoolean(value.playerLabel.showNumber) &&
  (value.squadOverrides === undefined ||
    (isObject(value.squadOverrides) &&
      Object.values(value.squadOverrides).every(isBoardSquadOverride))) &&
  Array.isArray(value.playerHighlights) &&
  value.playerHighlights.every(isString) &&
  Array.isArray(value.playerLinks) &&
  value.playerLinks.every(isPlayerLink) &&
  Array.isArray(value.layers) &&
  value.layers.every(isDrawable) &&
  Array.isArray(value.frames) &&
  value.frames.every(isBoardFrame) &&
  isFiniteNumber(value.activeFrameIndex);

const isProject = (value: unknown): value is Project => {
  if (!isObject(value)) {
    return false;
  }
  const candidate = value as Project;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.schemaVersion === "number" &&
    typeof candidate.sessionNotes === "string" &&
    (candidate.teamContext === undefined || isTeamContext(candidate.teamContext)) &&
    isObject(candidate.settings) &&
    Array.isArray(candidate.boards) &&
    candidate.boards.every(isBoard) &&
    Array.isArray(candidate.squads) &&
    candidate.squads.every(isSquad)
  );
};

export const deserializeProject = (raw: string): ValidationResult => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isProject(parsed)) {
      return { ok: false, error: "Invalid project structure." };
    }
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      return {
        ok: false,
        error: `Schema version mismatch (expected ${SCHEMA_VERSION}).`,
      };
    }
    return { ok: true, project: parsed };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid JSON.",
    };
  }
};
