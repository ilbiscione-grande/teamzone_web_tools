"use client";

import { useEffect, useState } from "react";
import type { BoardComment, Project } from "@/models";
import { can } from "@/utils/plan";
import { useProjectStore } from "@/state/useProjectStore";
import { addBoardComment, fetchBoardComments } from "@/persistence/shares";

type CommentsModalProps = {
  open: boolean;
  onClose: () => void;
  project: Project;
};

export default function CommentsModal({
  open,
  onClose,
  project,
}: CommentsModalProps) {
  const plan = useProjectStore((state) => state.plan);
  const shareMeta = project.sharedMeta;
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canComment =
    can(plan, "board.comment") && shareMeta?.permission === "comment";

  useEffect(() => {
    if (!open || !shareMeta) {
      setComments([]);
      return;
    }
    fetchBoardComments(shareMeta.shareId).then((result) => {
      if (!result.ok) {
        setStatus(result.error);
        setComments([]);
        return;
      }
      setComments(result.comments);
    });
  }, [open, shareMeta]);

  const onAdd = async () => {
    if (!shareMeta || !commentBody.trim()) {
      return;
    }
    if (!canComment) {
      setStatus("Commenting is disabled for this share.");
      return;
    }
    setLoading(true);
    setStatus(null);
    const result = await addBoardComment({
      shareId: shareMeta.shareId,
      boardId: shareMeta.boardId,
      body: commentBody.trim(),
    });
    if (!result.ok) {
      setStatus(result.error);
      setLoading(false);
      return;
    }
    setComments((prev) => [...prev, result.comment]);
    setCommentBody("");
    setLoading(false);
  };

  if (!open || !shareMeta) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="w-full max-w-xl rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink-0)] shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="display-font text-xl text-[var(--accent-0)]">
              Comments
            </h2>
            <p className="text-xs text-[var(--ink-1)]">
              Shared by {shareMeta.ownerEmail} · {shareMeta.permission} access
            </p>
          </div>
          <button
            className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4 max-h-64 space-y-3 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-4">
          {comments.length === 0 ? (
            <p className="text-xs text-[var(--ink-1)]">
              No comments yet.
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs"
              >
                <p className="text-[var(--ink-0)]">{comment.body}</p>
                <p className="mt-2 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                  {comment.authorEmail} ·{" "}
                  {new Date(comment.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 space-y-2">
          <textarea
            className="h-20 w-full rounded-2xl border border-[var(--line)] bg-transparent px-3 py-2 text-xs text-[var(--ink-0)]"
            placeholder={
              canComment
                ? "Write a comment..."
                : "Commenting is disabled."
            }
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
            disabled={!canComment}
          />
          <div className="flex items-center justify-between">
            {status ? (
              <p className="text-xs text-[var(--accent-1)]">{status}</p>
            ) : (
              <span />
            )}
            <button
              className="rounded-full bg-[var(--accent-0)] px-4 py-2 text-xs font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onAdd}
              disabled={!canComment || loading}
            >
              {loading ? "Saving..." : "Add comment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
