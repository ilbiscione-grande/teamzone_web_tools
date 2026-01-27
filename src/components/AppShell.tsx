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
      {project ? <EditorLayout /> : <ProjectList />}
    </div>
  );
}
