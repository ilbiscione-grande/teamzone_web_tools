"use client";

import { useProjectStore } from "@/state/useProjectStore";
import { can, lockedMessage, type Capability } from "@/utils/plan";

export const usePlanGate = (capability: Capability) => {
  const plan = useProjectStore((state) => state.plan);
  const allowed = can(plan, capability);
  return {
    allowed,
    message: allowed ? "" : lockedMessage[capability],
  };
};
