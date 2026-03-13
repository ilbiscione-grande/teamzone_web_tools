import { describe, expect, it } from "vitest";
import type { Squad } from "@/models";
import {
  loadDefaultTeamSquads,
  saveDefaultTeamSquad,
} from "./defaultTeamSquads";

const createStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
};

const createSquad = (id: string, name: string): Squad => ({
  id,
  name,
  kit: {
    shirt: "#111111",
    shorts: "#222222",
    socks: "#333333",
  },
  players: [
    {
      id: `${id}-player-1`,
      name: "Player One",
      positionLabel: "CM",
      number: 8,
    },
  ],
});

describe("defaultTeamSquads", () => {
  it("stores separate defaults for home and away per user", () => {
    Object.defineProperty(globalThis, "window", {
      value: { localStorage: createStorage() },
      configurable: true,
    });

    saveDefaultTeamSquad("home", createSquad("home", "Home"), "user-1");
    saveDefaultTeamSquad("away", createSquad("away", "Away"), "user-1");

    expect(loadDefaultTeamSquads("user-1")).toMatchObject({
      home: { name: "Home" },
      away: { name: "Away" },
    });
    expect(loadDefaultTeamSquads("user-2")).toEqual({});
  });

  it("returns cloned squad data", () => {
    Object.defineProperty(globalThis, "window", {
      value: { localStorage: createStorage() },
      configurable: true,
    });

    saveDefaultTeamSquad("home", createSquad("home", "Home"), "user-1");
    const loaded = loadDefaultTeamSquads("user-1");
    loaded.home?.players.push({
      id: "new-player",
      name: "Mutated",
      positionLabel: "ST",
    });

    expect(loadDefaultTeamSquads("user-1").home?.players).toHaveLength(1);
  });
});
