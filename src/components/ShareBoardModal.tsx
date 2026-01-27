"use client";

import { useEffect, useMemo, useState } from "react";
import type { Board, BoardSharePermission, Project } from "@/models";
import { can } from "@/utils/plan";
import { useProjectStore } from "@/state/useProjectStore";
import {
  createBoardShare,
  fetchBoardSharesForOwner,
  revokeBoardShare,
} from "@/persistence/shares";

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
  const [recipientEmail, setRecipientEmail] = useState("");
  const [permission, setPermission] = useState<BoardSharePermission>("comment");
  const [status, setStatus] = useState<string | null>(null);
  const [shares, setShares] = useState<
    { id: string; recipientEmail: string; permission: BoardSharePermission }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [loadingShares, setLoadingShares] = useState(false);

  const canShare = can(plan, "board.share");

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
      </div>
    </div>
  );
}
