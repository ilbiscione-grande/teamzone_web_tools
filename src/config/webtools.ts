export type WebtoolsAppStatus = "live" | "building" | "planned";

export type WebtoolsApp = {
  slug: string;
  name: string;
  strapline: string;
  description: string;
  status: WebtoolsAppStatus;
  href?: string;
  accent: string;
  availabilityLabel: string;
};

export const webtoolsApps: WebtoolsApp[] = [
  {
    slug: "tacticsboard",
    name: "Tacticsboard",
    strapline: "Coach, present, and animate football ideas.",
    description:
      "Interactive tactics boards, animations, exports, sharing, squads, and match presentation workflows.",
    status: "live",
    href: "/tacticsboard",
    accent: "#37b879",
    availabilityLabel: "Available now",
  },
  {
    slug: "iup",
    name: "IUP",
    strapline: "Individual development plans for players and teams.",
    description:
      "Goal setting, follow-ups, and structured player development conversations in one shared workflow.",
    status: "building",
    accent: "#f9bf4a",
    availabilityLabel: "In planning",
  },
  {
    slug: "more",
    name: "More tools",
    strapline: "Additional sport workflows will live under the same account.",
    description:
      "Webtools is meant to grow into a shared toolbox where each app keeps its own workflow and pricing.",
    status: "planned",
    accent: "#f06d4f",
    availabilityLabel: "Coming later",
  },
];

export const webtoolsPrinciples = [
  "One login across all Webtools apps through the same Supabase account.",
  "One shared account identity and tier framework across the platform.",
  "Each app can be subscribed to separately so users only pay for the tools they actually use.",
];
