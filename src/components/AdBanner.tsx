"use client";

import { useEffect, useMemo } from "react";
import { useProjectStore } from "@/state/useProjectStore";

type AdBannerProps = {
  variant?: "top" | "side";
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const getSlotId = (variant: AdBannerProps["variant"]) => {
  if (variant === "side") {
    return process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDE;
  }
  return process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP;
};

export default function AdBanner({ variant = "top" }: AdBannerProps) {
  const plan = useProjectStore((state) => state.plan);
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const slotId = useMemo(() => getSlotId(variant), [variant]);
  const isEnabled = plan === "FREE" && !!adsenseClient && !!slotId;

  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // Ignore ad script errors to avoid breaking UI.
    }
  }, [isEnabled, slotId]);

  if (plan !== "FREE") {
    return null;
  }

  if (!adsenseClient || !slotId) {
    return (
      <div
        className={`rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/80 px-4 py-2 text-[10px] uppercase tracking-widest text-[var(--ink-1)] ${
          variant === "side" ? "w-full" : ""
        }`}
      >
        Ad space
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/40 p-2 ${
        variant === "side" ? "w-full" : ""
      }`}
      style={{ height: 200, maxHeight: 200, overflow: "hidden" }}
    >
      <ins
        className="adsbygoogle block"
        style={{ display: "block", height: 200, maxHeight: 200 }}
        data-ad-client={adsenseClient}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
        data-adtest={process.env.NODE_ENV !== "production" ? "on" : undefined}
      />
    </div>
  );
}
