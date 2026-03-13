import { describe, expect, it } from "vitest";
import { resolveBoardShareAccess } from "./shareAccess";

describe("resolveBoardShareAccess", () => {
  it("allows the owner to view and comment", () => {
    expect(
      resolveBoardShareAccess({
        ownerId: "owner-1",
        recipientEmail: "viewer@example.com",
        permission: "view",
        currentUserId: "owner-1",
        currentUserEmail: "owner@example.com",
      })
    ).toEqual({
      canView: true,
      canComment: true,
      isOwner: true,
    });
  });

  it("allows the recipient to comment only when permission is comment", () => {
    expect(
      resolveBoardShareAccess({
        ownerId: "owner-1",
        recipientEmail: "viewer@example.com",
        permission: "comment",
        currentUserId: "viewer-1",
        currentUserEmail: "viewer@example.com",
      })
    ).toEqual({
      canView: true,
      canComment: true,
      isOwner: false,
    });
  });

  it("blocks commenting for view-only recipients", () => {
    expect(
      resolveBoardShareAccess({
        ownerId: "owner-1",
        recipientEmail: "viewer@example.com",
        permission: "view",
        currentUserId: "viewer-1",
        currentUserEmail: "viewer@example.com",
      })
    ).toEqual({
      canView: true,
      canComment: false,
      isOwner: false,
    });
  });

  it("blocks unrelated users", () => {
    expect(
      resolveBoardShareAccess({
        ownerId: "owner-1",
        recipientEmail: "viewer@example.com",
        permission: "comment",
        currentUserId: "other-1",
        currentUserEmail: "other@example.com",
      })
    ).toEqual({
      canView: false,
      canComment: false,
      isOwner: false,
    });
  });
});
