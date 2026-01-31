"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Board,
  BoardSharePermission,
  Project,
  PublicBoard,
} from "@/models";
import { can } from "@/utils/plan";
import { useProjectStore } from "@/state/useProjectStore";
import {
  createBoardShare,
  fetchBoardSharesForOwner,
  revokeBoardShare,
} from "@/persistence/shares";
import {
  fetchPublicBoardForOwner,
  fetchPublicBoards,
  publishPublicBoard,
  reportPublicBoard,
  unpublishPublicBoard,
} from "@/persistence/publicLibrary";
import { getPitchViewBounds } from "@/board/pitch/Pitch";
import { useEditorStore } from "@/state/useEditorStore";

type ShareBoardModalProps = {
  open: boolean;
  onClose: () => void;
  project: Project;
  board: Board;
};

export default function ShareBoardModal({
  open,
  onClose,
  project,
  board,
}: ShareBoardModalProps) {
  const plan = useProjectStore((state) => state.plan);
  const authUser = useProjectStore((state) => state.authUser);
  const stage = useEditorStore((state) => state.stage);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [permission, setPermission] = useState<BoardSharePermission>("comment");
  const [status, setStatus] = useState<string | null>(null);
  const [shares, setShares] = useState<
    { id: string; recipientEmail: string; permission: BoardSharePermission }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [loadingShares, setLoadingShares] = useState(false);
  const [publicTitle, setPublicTitle] = useState(board.name);
  const [publicDescription, setPublicDescription] = useState("");
  const [publicTags, setPublicTags] = useState("");
  const [publicFormation, setPublicFormation] = useState("");
  const [publicBoard, setPublicBoard] = useState<PublicBoard | null>(null);
  const [publicBoards, setPublicBoards] = useState<PublicBoard[]>([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicListLoading, setPublicListLoading] = useState(false);

  const canShare = can(plan, "board.share");
  const canPublish = can(plan, "board.share");
  const addBoardFromSnapshot = useProjectStore(
    (state) => state.addBoardFromSnapshot
  );
  const setActiveFrameIndex = useProjectStore(
    (state) => state.setActiveFrameIndex
  );

  const captureThumbnail = async () => {
    if (!stage) {
      return null;
    }
    const editorState = useEditorStore.getState();
    const previousFrameIndex = board.activeFrameIndex;
    const previousPlayhead = editorState.playheadFrame;
    const previousViewport = editorState.viewport;
    const wasPlaying = editorState.isPlaying;
    editorState.setPlaying(false);

    const shouldResetFrame = board.mode === "DYNAMIC";
    if (shouldResetFrame) {
      if (previousFrameIndex !== 0) {
        setActiveFrameIndex(board.id, 0);
      }
      if (previousPlayhead !== 0) {
        editorState.setPlayheadFrame(0);
      }
    }
    editorState.setViewport({ zoom: 1, offsetX: 0, offsetY: 0 });

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const pitchBounds = getPitchViewBounds(board.pitchView);
    const viewRotation =
      board.pitchView === "DEF_HALF" || board.pitchView === "OFF_HALF" ? -90 : 0;
    const effectiveBounds =
      viewRotation === 0
        ? pitchBounds
        : {
            x: pitchBounds.x + pitchBounds.width / 2 - pitchBounds.height / 2,
            y: pitchBounds.y + pitchBounds.height / 2 - pitchBounds.width / 2,
            width: pitchBounds.height,
            height: pitchBounds.width,
          };
    const pixelRatio = window.devicePixelRatio ?? 1;
    const stageScale = stage.scaleX();
    const stageOffsetX = stage.x();
    const stageOffsetY = stage.y();
    const srcX = (effectiveBounds.x * stageScale + stageOffsetX) * pixelRatio;
    const srcY = (effectiveBounds.y * stageScale + stageOffsetY) * pixelRatio;
    const srcW = effectiveBounds.width * stageScale * pixelRatio;
    const srcH = effectiveBounds.height * stageScale * pixelRatio;
    const targetW = Math.max(1, Math.round(srcW));
    const targetH = Math.max(1, Math.round(srcH));
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.fillStyle = "#1f5f3f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    stage.getLayers().forEach((layer) => {
      const layerCanvas = (layer.getCanvas() as any)?._canvas as
        | HTMLCanvasElement
        | undefined;
      if (!layerCanvas) {
        return;
      }
      ctx.drawImage(
        layerCanvas,
        srcX,
        srcY,
        srcW,
        srcH,
        0,
        0,
        canvas.width,
        canvas.height
      );
    });
    const dataUrl = canvas.toDataURL("image/png");

    editorState.setViewport(previousViewport);
    if (shouldResetFrame) {
      if (previousFrameIndex !== 0) {
        setActiveFrameIndex(board.id, previousFrameIndex);
      }
      if (previousPlayhead !== 0) {
        editorState.setPlayheadFrame(previousPlayhead);
      }
    }
    if (wasPlaying) {
      editorState.setPlaying(true);
    }

    return dataUrl;
  };

  useEffect(() => {
    if (!open || !authUser || !canShare) {
      setShares([]);
      return;
    }
    setLoadingShares(true);
    fetchBoardSharesForOwner(board.id)
      .then((result) => {
        if (!result.ok) {
          setStatus(result.error);
          setShares([]);
          return;
        }
        setShares(
          result.shares.map((share) => ({
            id: share.id,
            recipientEmail: share.recipientEmail,
            permission: share.permission,
          }))
        );
      })
      .finally(() => setLoadingShares(false));
  }, [open, board.id, authUser, canShare]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setPublicListLoading(true);
    fetchPublicBoards()
      .then((result) => {
        if (!result.ok) {
          return;
        }
        setPublicBoards(result.boards);
      })
      .finally(() => setPublicListLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open || !authUser) {
      setPublicBoard(null);
      return;
    }
    setPublicLoading(true);
    fetchPublicBoardForOwner(board.id)
      .then((result) => {
        if (!result.ok) {
          setPublicBoard(null);
          return;
        }
        setPublicBoard(result.board);
        if (result.board) {
          setPublicTitle(result.board.title || board.name);
          setPublicDescription(result.board.description || "");
          setPublicTags((result.board.tags || []).join(", "));
          setPublicFormation(result.board.formation ?? "");
        }
      })
      .finally(() => setPublicLoading(false));
  }, [open, board.id, authUser, board.name]);

  const onShare = async () => {
    if (!canShare) {
      setStatus("Sharing is only available on paid plans.");
      return;
    }
    if (!recipientEmail.trim()) {
      setStatus("Enter a recipient email.");
      return;
    }
    setLoading(true);
    setStatus(null);
    const result = await createBoardShare({
      project,
      board,
      recipientEmail,
      permission,
    });
    if (!result.ok) {
      setStatus(result.error);
      setLoading(false);
      return;
    }
    setShares((prev) => [
      {
        id: result.share.id,
        recipientEmail: result.share.recipientEmail,
        permission: result.share.permission,
      },
      ...prev,
    ]);
    setRecipientEmail("");
    setPermission("comment");
    setStatus("Share sent.");
    setLoading(false);
  };

  const onRevoke = async (shareId: string) => {
    if (!window.confirm("Revoke access for this share?")) {
      return;
    }
    const result = await revokeBoardShare(shareId);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setShares((prev) => prev.filter((item) => item.id !== shareId));
  };

  const onPublish = async () => {
    if (!authUser) {
      setStatus("Please sign in to publish.");
      return;
    }
    if (!canPublish) {
      setStatus("Publishing is available on paid plans only.");
      return;
    }
    if (!publicTitle.trim()) {
      setStatus("Enter a title for the library.");
      return;
    }
    setPublicLoading(true);
    setStatus(null);
    const tags = publicTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const thumbnail = await captureThumbnail();
    if (!thumbnail) {
      setStatus("Unable to capture thumbnail.");
      setPublicLoading(false);
      return;
    }
    const result = await publishPublicBoard({
      project,
      board,
      title: publicTitle.trim(),
      description: publicDescription.trim(),
      tags,
      formation: publicFormation.trim() || undefined,
      thumbnail,
    });
    if (!result.ok) {
      setStatus(result.error);
      setPublicLoading(false);
      return;
    }
    setPublicBoard(result.board);
    setPublicBoards((prev) => {
      const next = prev.filter((entry) => entry.id !== result.board.id);
      return [result.board, ...next];
    });
    setStatus("Board published to public library.");
    setPublicLoading(false);
  };

  const onUnpublish = async () => {
    if (!publicBoard) {
      return;
    }
    if (!window.confirm("Remove this board from the public library?")) {
      return;
    }
    const result = await unpublishPublicBoard(publicBoard.id);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setPublicBoard(null);
    setPublicBoards((prev) => prev.filter((entry) => entry.id !== publicBoard.id));
    setStatus("Board removed from public library.");
  };

  const onReport = async (boardId: string) => {
    if (!authUser) {
      setStatus("Please sign in to report.");
      return;
    }
    const reason = window.prompt("Why are you reporting this board?") ?? "";
    if (!reason.trim()) {
      return;
    }
    const result = await reportPublicBoard({ boardId, reason: reason.trim() });
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setStatus("Report submitted.");
  };

  const onImport = (entry: PublicBoard) => {
    addBoardFromSnapshot(entry.boardData, entry.boardName);
    setStatus(`Imported "${entry.boardName}".`);
  };

  const shareSummary = useMemo(
    () => (shares.length === 1 ? "1 share" : `${shares.length} shares`),
    [shares.length]
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="w-full max-w-xl rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink-0)] shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="display-font text-xl text-[var(--accent-0)]">
              Share board
            </h2>
            <p className="text-xs text-[var(--ink-1)]">
              Share “{board.name}” with another paid user.
            </p>
          </div>
          <button
            className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {!canShare ? (
          <p className="mt-4 text-sm text-[var(--accent-1)]">
            Sharing is available on paid plans only.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1.4fr_0.7fr_auto]">
              <input
                className="h-10 rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                placeholder="Recipient email"
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
              />
              <select
                className="h-10 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                value={permission}
                onChange={(event) =>
                  setPermission(event.target.value as BoardSharePermission)
                }
              >
                <option value="comment">Comment</option>
                <option value="view">View only</option>
              </select>
              <button
                className="h-10 rounded-full bg-[var(--accent-0)] px-5 text-xs font-semibold text-black transition hover:brightness-110"
                onClick={onShare}
                disabled={loading}
              >
                {loading ? "Sending..." : "Send"}
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
              <span>Active shares</span>
              <span>{shareSummary}</span>
            </div>
            <div className="max-h-48 space-y-2 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-3">
              {loadingShares ? (
                <p className="text-xs text-[var(--ink-1)]">Loading shares...</p>
              ) : shares.length === 0 ? (
                <p className="text-xs text-[var(--ink-1)]">
                  No shares yet.
                </p>
              ) : (
                shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="text-[var(--ink-0)]">
                        {share.recipientEmail}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                        {share.permission}
                      </p>
                    </div>
                    <button
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                      onClick={() => onRevoke(share.id)}
                    >
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </div>
            {status ? (
              <p className="text-xs text-[var(--accent-1)]">{status}</p>
            ) : null}
          </div>
        )}

        <div className="mt-6 space-y-4 border-t border-[var(--line)] pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm text-[var(--accent-0)]">
                Public library
              </h3>
              <p className="text-xs text-[var(--ink-1)]">
                Publish a board so others can import it into their project.
              </p>
            </div>
            {publicBoard && (
              <span className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                {publicBoard.status}
              </span>
            )}
          </div>
          {publicBoard?.thumbnail && (
            <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/60">
              <img
                src={publicBoard.thumbnail}
                alt={`${publicBoard.title || publicBoard.boardName} thumbnail`}
                className="h-32 w-full object-cover"
              />
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-[1.4fr_0.6fr]">
            <div className="space-y-2">
              <input
                className="h-9 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                placeholder="Title"
                value={publicTitle}
                onChange={(event) => setPublicTitle(event.target.value)}
                disabled={!canPublish}
              />
              <textarea
                className="min-h-[72px] w-full rounded-2xl border border-[var(--line)] bg-transparent p-2 text-xs text-[var(--ink-0)]"
                placeholder="Description"
                value={publicDescription}
                onChange={(event) => setPublicDescription(event.target.value)}
                disabled={!canPublish}
              />
              <input
                className="h-9 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                placeholder="Tags (comma separated)"
                value={publicTags}
                onChange={(event) => setPublicTags(event.target.value)}
                disabled={!canPublish}
              />
              <input
                className="h-9 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                placeholder="Formation"
                value={publicFormation}
                onChange={(event) => setPublicFormation(event.target.value)}
                disabled={!canPublish}
              />
            </div>
            <div className="space-y-2">
              <button
                className="w-full rounded-full border border-[var(--line)] px-4 py-2 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onPublish}
                disabled={!canPublish || publicLoading}
              >
                {publicBoard ? "Update listing" : "Publish board"}
              </button>
              <button
                className="w-full rounded-full border border-[var(--line)] px-4 py-2 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onUnpublish}
                disabled={!publicBoard || publicLoading}
              >
                Remove listing
              </button>
              {!canPublish && (
                <p className="text-[11px] text-[var(--accent-1)]">
                  Publishing is available on paid plans.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
              <span>Browse public boards</span>
              <span>{publicBoards.length}</span>
            </div>
            <div className="max-h-56 space-y-2 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-3">
              {publicListLoading ? (
                <p className="text-xs text-[var(--ink-1)]">Loading library...</p>
              ) : publicBoards.length === 0 ? (
                <p className="text-xs text-[var(--ink-1)]">
                  No public boards yet.
                </p>
              ) : (
                publicBoards
                  .filter((entry) => {
                    if (entry.status === "unverified") {
                      return entry.ownerId === authUser?.id;
                    }
                    return true;
                  })
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-[var(--ink-0)]">
                            {entry.title || entry.boardName}
                          </p>
                          <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                            {entry.status} • {entry.ownerEmail}
                          </p>
                          {entry.thumbnail && (
                            <img
                              src={entry.thumbnail}
                              alt={`${entry.title || entry.boardName} thumbnail`}
                              className="mt-2 h-20 w-full rounded-xl border border-[var(--line)] object-cover"
                            />
                          )}
                          {entry.formation && (
                            <p className="text-[11px] text-[var(--ink-1)]">
                              Formation: {entry.formation}
                            </p>
                          )}
                          {entry.tags?.length ? (
                            <p className="text-[11px] text-[var(--ink-1)]">
                              {entry.tags.join(", ")}
                            </p>
                          ) : null}
                          {entry.description ? (
                            <p className="mt-1 text-[11px] text-[var(--ink-1)]">
                              {entry.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <button
                            className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                            onClick={() => onImport(entry)}
                          >
                            Import
                          </button>
                          <button
                            className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                            onClick={() => onReport(entry.id)}
                          >
                            Report
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
