import type { Plan } from "@/models";

export const TACTICSBOARD_APP_SLUG = "tacticsboard";

export type ProfilePlanSnapshot = {
  plan?: string | null;
  manual_paid_override?: boolean | null;
  beta_user?: boolean | null;
  is_admin?: boolean | null;
  stripe_customer_id?: string | null;
};

export type AppEntitlementSnapshot = {
  app_slug?: string | null;
  tier?: string | null;
  status?: string | null;
  manual_access_override?: boolean | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  current_period_end?: string | null;
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
]);

export const hasLegacyPaidAccess = (
  profile: ProfilePlanSnapshot | null | undefined
) => {
  if (!profile) {
    return false;
  }
  const normalizedPlan = String(profile.plan ?? "").trim().toUpperCase();
  return normalizedPlan === "PAID" || profile.manual_paid_override === true;
};

export const hasPaidEntitlement = (
  entitlement: AppEntitlementSnapshot | null | undefined
) => {
  if (!entitlement) {
    return false;
  }
  const normalizedTier = String(entitlement.tier ?? "").trim().toUpperCase();
  const normalizedStatus = String(entitlement.status ?? "")
    .trim()
    .toLowerCase();
  return (
    entitlement.manual_access_override === true ||
    (normalizedTier === "PAID" &&
      ACTIVE_SUBSCRIPTION_STATUSES.has(normalizedStatus))
  );
};

export const resolveTacticsboardPlan = (params: {
  profile?: ProfilePlanSnapshot | null;
  entitlement?: AppEntitlementSnapshot | null;
}): Plan => {
  if (hasPaidEntitlement(params.entitlement) || hasLegacyPaidAccess(params.profile)) {
    return "PAID";
  }
  return "AUTH";
};

export const getStripePriceIdForApp = (appSlug: string) => {
  if (appSlug === TACTICSBOARD_APP_SLUG) {
    return (
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_TACTICSBOARD ??
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ID ??
      ""
    );
  }
  return "";
};

export const getStripeSuccessPathForApp = (appSlug: string) => {
  if (appSlug === TACTICSBOARD_APP_SLUG) {
    return "/tacticsboard";
  }
  return "/";
};

export const inferAppSlugFromPriceId = (priceId: string | null | undefined) => {
  if (!priceId) {
    return null;
  }
  if (priceId === getStripePriceIdForApp(TACTICSBOARD_APP_SLUG)) {
    return TACTICSBOARD_APP_SLUG;
  }
  return null;
};
