import { describe, expect, it } from "vitest";
import { isUuid, toPersistedTeamPlayerId } from "./teamSquads";

describe("team squad id normalization", () => {
  it("keeps existing uuid player ids unchanged", () => {
    const playerId = "123e4567-e89b-42d3-a456-426614174000";

    expect(isUuid(playerId)).toBe(true);
    expect(toPersistedTeamPlayerId(playerId)).toBe(playerId);
  });

  it("converts non-uuid player ids into uuid values", () => {
    const playerId = "1J5MKIdtuatqaIWHmnRTd";
    const persistedId = toPersistedTeamPlayerId(playerId);

    expect(persistedId).not.toBe(playerId);
    expect(isUuid(persistedId)).toBe(true);
  });

  it("treats non-uuid source ids as invalid for database relation fields", () => {
    expect(isUuid("1J5MKIdtuatqaIWHmnRTd")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});
