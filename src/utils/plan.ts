import type { Plan } from "@/models";

export type Capability =
  | "project.save"
  | "project.export"
  | "project.import"
  | "video.export"
  | "formation.custom"
  | "squad.export"
  | "squad.import"
  | "board.share"
  | "board.comment";

export const lockedMessage: Record<Capability, string> = {
  "project.save": "Saving is available on paid plans.",
  "project.export": "Export is available on paid plans.",
  "project.import": "Import is available on paid plans.",
  "video.export": "Video export is available on paid plans.",
  "formation.custom": "Custom formations are available on paid plans.",
  "squad.export": "Squad export is available on paid plans.",
  "squad.import": "Squad import is available on paid plans.",
  "board.share": "Board sharing is available on paid plans.",
  "board.comment": "Comments are available on paid plans.",
};

const planCapabilities: Record<Plan, Set<Capability>> = {
  FREE: new Set([]),
  AUTH: new Set(["project.save", "board.share", "board.comment"]),
  PAID: new Set([
    "project.save",
    "project.export",
    "project.import",
    "video.export",
    "formation.custom",
    "squad.export",
    "squad.import",
    "board.share",
    "board.comment",
  ]),
};

export const can = (plan: Plan, capability: Capability) =>
  planCapabilities[plan].has(capability);

export const getPlanLimits = (plan: Plan) => {
  if (plan === "PAID") {
    return { maxProjects: Infinity, maxBoards: Infinity };
  }
  return { maxProjects: 1, maxBoards: 2 };
};
