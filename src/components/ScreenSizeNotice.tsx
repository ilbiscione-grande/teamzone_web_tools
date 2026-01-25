"use client";

import { useEffect, useState } from "react";

type ScreenSizeNoticeProps = {
  minWidth?: number;
};

export default function ScreenSizeNotice({
  minWidth = 900,
}: ScreenSizeNoticeProps) {
  const [isSmall, setIsSmall] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [remember, setRemember] = useState(false);

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem("tacticsboard:screenNotice");
    if (stored === "dismissed") {
      setDismissed(true);
      setRemember(true);
    }
  }, []);

  useEffect(() => {
    if (!isSmall) {
      return;
    }
    if (remember && dismissed) {
      window.localStorage.setItem("tacticsboard:screenNotice", "dismissed");
    }
  }, [dismissed, isSmall, remember]);

  if (!isSmall || dismissed) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5 text-xs text-[var(--ink-0)] shadow-xl shadow-black/40">
        <p className="display-font text-lg text-[var(--accent-0)]">
          Screen size warning
        </p>
        <p className="mt-2 text-[11px] text-[var(--ink-1)]">
          This site is designed for larger screens. For the best experience,
          use a tablet or desktop.
        </p>
        <label className="mt-3 flex items-center gap-2 text-[11px] text-[var(--ink-1)]">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          Do not remind me about this again
        </label>
        <button
          className="mt-4 w-full rounded-full border border-[var(--line)] px-3 py-2 text-[11px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
          onClick={() => setDismissed(true)}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
