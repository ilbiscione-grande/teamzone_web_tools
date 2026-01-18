"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasDebug = new URLSearchParams(window.location.search).has("ads");
      setDebugEnabled(hasDebug);
    }
  }, []);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      setDebugInfo(
        `adsbygoogle pushed | client=${adsenseClient} | slot=${slotId}`
      );
    } catch {
      // Ignore ad script errors to avoid breaking UI.
      setDebugInfo("adsbygoogle push failed");
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
        {debugEnabled && (
          <div className="mt-2 text-[9px] uppercase tracking-widest text-[var(--accent-1)]">
            Missing env: {adsenseClient ? "" : "client"}{" "}
            {slotId ? "" : "slot"}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/40 p-2 ${
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
        data-adtest={debugEnabled ? "on" : undefined}
      />
      {debugEnabled && (
        <div className="absolute bottom-2 left-2 rounded-full border border-[var(--line)] bg-[var(--panel)]/90 px-2 py-1 text-[9px] uppercase tracking-widest text-[var(--accent-2)]">
          {debugInfo ?? "adsbygoogle not pushed yet"}
        </div>
      )}
    </div>
  );
}
