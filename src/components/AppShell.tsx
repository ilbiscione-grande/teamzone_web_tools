"use client";

import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/state/useProjectStore";
import { useAutosave } from "@/persistence/useAutosave";
import { useOnlineSync } from "@/persistence/useOnlineSync";
import ProjectList from "@/components/ProjectList";
import EditorLayout from "@/components/EditorLayout";

export default function AppShell() {
  const project = useProjectStore((state) => state.project);
  const hydrateIndex = useProjectStore((state) => state.hydrateIndex);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullReady, setPullReady] = useState(false);
  const [pullActive, setPullActive] = useState(false);
  const touchStartRef = useRef<number | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    hydrateIndex();
  }, [hydrateIndex]);

  useAutosave();
  useOnlineSync();

  useEffect(() => {
    const threshold = 80;
    const maxPull = 120;
    const handleTouchStart = (event: TouchEvent) => {
      if (window.scrollY > 0) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-disable-pull]")) {
        return;
      }
      if (target?.closest("[data-scrollable]")) {
        return;
      }
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      touchStartRef.current = touch.clientY;
      setPullActive(true);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!pullActive || touchStartRef.current === null) {
        return;
      }
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      const distance = touch.clientY - touchStartRef.current;
      if (distance <= 0) {
        return;
      }
      event.preventDefault();
      const nextDistance = Math.min(distance, maxPull);
      setPullDistance(nextDistance);
      setPullReady(nextDistance >= threshold);
    };

    const resetPull = () => {
      touchStartRef.current = null;
      setPullActive(false);
      setPullReady(false);
      setPullDistance(0);
    };

    const handleTouchEnd = () => {
      if (pullReady) {
        setPullDistance(threshold);
        window.location.reload();
        return;
      }
      resetPull();
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [pullActive, pullReady]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(display-mode: standalone)");
    const update = () =>
      setIsStandalone(
        media.matches ||
          (window.navigator as { standalone?: boolean }).standalone === true
      );
    update();
    if ("addEventListener" in media) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    const legacyMedia = media as MediaQueryList & {
      addListener?: (listener: () => void) => void;
      removeListener?: (listener: () => void) => void;
    };
    legacyMedia.addListener?.(update);
    return () => legacyMedia.removeListener?.(update);
  }, []);

  return (
    <div className="min-h-screen text-foreground">
      <div className="pointer-events-none fixed left-1/2 top-0 z-50 -translate-x-1/2">
        <div
          className="mt-2 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--ink-1)] shadow-lg shadow-black/30 transition-all"
          style={{
            transform: `translateY(${Math.min(pullDistance, 80)}px)`,
            opacity: pullDistance > 0 ? 1 : 0,
          }}
        >
          {pullReady ? "Release to refresh" : "Pull to refresh"}
        </div>
      </div>
      {isStandalone && (
        <button
          className="fixed right-4 top-4 z-50 rounded-full border border-white/20 bg-black/40 p-2 text-[var(--ink-0)] shadow-lg shadow-black/30 backdrop-blur"
          onClick={() => {
            if (!window.confirm("Close the app?")) {
              return;
            }
            window.close();
          }}
          title="Close app"
          aria-label="Close app"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12" />
            <path d="M18 6l-12 12" />
          </svg>
        </button>
      )}
      {project ? <EditorLayout /> : <ProjectList />}
    </div>
  );
}
