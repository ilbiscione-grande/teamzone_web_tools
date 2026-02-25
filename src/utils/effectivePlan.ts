export type ProfilePlanSnapshot = {
  plan?: string | null;
  manual_paid_override?: boolean | null;
};

export const hasEffectivePaidAccess = (profile: ProfilePlanSnapshot | null | undefined) => {
  if (!profile) {
    return false;
  }
  const normalizedPlan = String(profile.plan ?? "").trim().toUpperCase();
  return normalizedPlan === "PAID" || profile.manual_paid_override === true;
};
