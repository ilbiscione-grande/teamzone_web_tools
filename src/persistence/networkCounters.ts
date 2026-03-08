"use client";

export type NetworkCounterEntry = {
  calls: number;
  ok: number;
  error: number;
};

type NetworkCounterMap = Record<string, NetworkCounterEntry>;

const counters: NetworkCounterMap = {};

export const recordNetworkCall = (key: string, ok: boolean) => {
  const entry = counters[key] ?? { calls: 0, ok: 0, error: 0 };
  entry.calls += 1;
  if (ok) {
    entry.ok += 1;
  } else {
    entry.error += 1;
  }
  counters[key] = entry;
};

export const consumeNetworkCounters = (): NetworkCounterMap => {
  const snapshot: NetworkCounterMap = {};
  for (const [key, value] of Object.entries(counters)) {
    snapshot[key] = { ...value };
    delete counters[key];
  }
  return snapshot;
};

export const resetNetworkCounters = () => {
  for (const key of Object.keys(counters)) {
    delete counters[key];
  }
};

