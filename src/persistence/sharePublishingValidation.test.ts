import { describe, expect, it } from "vitest";
import {
  validateBoardSharePayload,
  validatePublicBoardPayload,
  validatePublicProjectPayload,
} from "./sharePublishingValidation";
import { createDefaultProject } from "@/state/projectHelpers";

describe("sharePublishingValidation", () => {
  it("rejects invalid recipient email for board shares", () => {
    const project = createDefaultProject("Share Project");
    const board = project.boards[0]!;

    const result = validateBoardSharePayload({
      project,
      board,
      recipientEmail: "not-an-email",
    });

    expect(result).toEqual({
      ok: false,
      error: "Enter a valid recipient email.",
    });
  });

  it("normalizes public board payload fields", () => {
    const project = createDefaultProject("Public Board Project");
    const board = project.boards[0]!;

    const result = validatePublicBoardPayload({
      project,
      board,
      title: "  My Board  ",
      description: "  Description  ",
      category: "  Pressing  ",
      tags: [" Pressing ", "pressing", " Counter "],
      formation: " 4-3-3 ",
      thumbnail: "data:image/png;base64,abc",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        title: "My Board",
        description: "Description",
        category: "Pressing",
        tags: ["Pressing", "Counter"],
        formation: "4-3-3",
        thumbnail: "data:image/png;base64,abc",
      },
    });
  });

  it("rejects public projects without boards", () => {
    const project = createDefaultProject("Public Project");
    project.boards = [];

    const result = validatePublicProjectPayload({
      project,
      title: "Published Project",
      description: "",
      category: "",
      tags: [],
    });

    expect(result).toEqual({
      ok: false,
      error: "Select at least one board to publish.",
    });
  });
});
