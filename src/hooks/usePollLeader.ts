"use client";

import { useEffect, useMemo, useState } from "react";

type Lease = {
  owner: string;
  expiresAt: number;
};

const TAB_ID_KEY = "tacticsboard:tabId";

const getTabId = () => {
  if (typeof window === "undefined") {
    return "server";
  }
  const existing = window.sessionStorage.getItem(TAB_ID_KEY);
  if (existing) {
    return existing;
  }
  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.sessionStorage.setItem(TAB_ID_KEY, next);
  return next;
};

const readLease = (key: string): Lease | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Lease;
    if (
      !parsed ||
      typeof parsed.owner !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeLease = (key: string, lease: Lease) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(lease));
};

export const usePollLeader = (
  scope: string,
  enabled: boolean,
  options?: { ttlMs?: number; heartbeatMs?: number }
) => {
  const ttlMs = options?.ttlMs ?? 45_000;
  const heartbeatMs = options?.heartbeatMs ?? 15_000;
  const [isLeader, setIsLeader] = useState(false);
  const tabId = useMemo(() => getTabId(), []);
  const leaseKey = `tacticsboard:pollLeader:${scope}`;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const evaluate = () => {
      if (!enabled || document.visibilityState !== "visible") {
        setIsLeader(false);
        return;
      }
      const now = Date.now();
      const lease = readLease(leaseKey);
      const leaseExpired = !lease || lease.expiresAt <= now;
      const mine = lease?.owner === tabId;
      if (mine || leaseExpired) {
        writeLease(leaseKey, {
          owner: tabId,
          expiresAt: now + ttlMs,
        });
        setIsLeader(true);
        return;
      }
      setIsLeader(false);
    };

    const maybeRelease = () => {
      const lease = readLease(leaseKey);
      if (lease?.owner === tabId) {
        writeLease(leaseKey, {
          owner: tabId,
          expiresAt: Date.now() - 1,
        });
      }
      setIsLeader(false);
    };

    evaluate();
    const interval = window.setInterval(evaluate, heartbeatMs);
    const onStorage = (event: StorageEvent) => {
      if (event.key === leaseKey) {
        evaluate();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        evaluate();
      } else {
        maybeRelease();
      }
    };
    const onBeforeUnload = () => {
      maybeRelease();
    };

    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      maybeRelease();
    };
  }, [enabled, heartbeatMs, leaseKey, tabId, ttlMs]);

  return isLeader;
};

