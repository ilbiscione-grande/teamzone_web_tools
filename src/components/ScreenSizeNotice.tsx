"use client";

import { useEffect, useState } from "react";

type ScreenSizeNoticeProps = {
  minWidth?: number;
};

export default function ScreenSizeNotice({
  minWidth = 900,
}: ScreenSizeNoticeProps) {
  const [isSmall, setIsSmall] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const query = window.matchMedia(`(max-width: ${minWidth}px)`);
    const update = () => setIsSmall(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [minWidth]);

  if (!isSmall) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-xs text-[var(--ink-0)] shadow-xl shadow-black/40">
      This site is designed for larger screens. For the best experience, use a
      tablet or desktop.
    </div>
  );
}
