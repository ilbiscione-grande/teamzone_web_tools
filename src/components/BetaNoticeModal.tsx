"use client";

import { useMemo, useState } from "react";
import { useProjectStore } from "@/state/useProjectStore";
import { getActiveBoard } from "@/utils/board";
import { submitBugReport } from "@/persistence/bugReports";

type BetaNoticeModalProps = {
  open: boolean;
  onClose: () => void;
  context: "console" | "board";
};

export default function BetaNoticeModal({
  open,
  onClose,
  context,
}: BetaNoticeModalProps) {
  const plan = useProjectStore((state) => state.plan);
  const authUser = useProjectStore((state) => state.authUser);
  const project = useProjectStore((state) => state.project);
  const board = getActiveBoard(project);
  const [reportBody, setReportBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const description =
    "This beta release is still under active development. You may encounter bugs, unfinished features, or unexpected behavior. Please report issues so we can fix them quickly.";

  const reportPayload = useMemo(() => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const ua = typeof window !== "undefined" ? window.navigator.userAgent : "";
    return [
      "Teamzone Web Tools · Beta bug report",
      "",
      `Context: ${context}`,
      `Plan: ${plan}`,
      `User: ${authUser?.email ?? "anonymous"}`,
      `Project: ${project?.name ?? "n/a"}`,
      `Board: ${board?.name ?? "n/a"}`,
      `URL: ${url}`,
      `User agent: ${ua}`,
      "",
      "Report:",
      reportBody.trim() || "(describe the issue here)",
    ].join("\n");
  }, [authUser?.email, board?.name, context, plan, project?.name, reportBody]);

  if (!open) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportPayload);
      setStatus("Copied report to clipboard.");
    } catch {
      setStatus("Unable to copy report.");
    }
  };

  const handleSend = async () => {
    setSubmitting(true);
    setStatus(null);
    const result = await submitBugReport({
      context,
      plan,
      userEmail: authUser?.email ?? null,
      projectName: project?.name ?? null,
      boardName: board?.name ?? null,
      url: typeof window !== "undefined" ? window.location.href : null,
      userAgent:
        typeof window !== "undefined" ? window.navigator.userAgent : null,
      body: reportBody.trim() || "(empty report)",
    });
    if (!result.ok) {
      setStatus(result.error);
      setSubmitting(false);
      return;
    }
    setStatus("Report sent. Thank you!");
    setReportBody("");
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-2xl rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--accent-2)]">
              Beta notice
            </p>
            <h2 className="display-font text-2xl text-[var(--ink-0)]">
              This app is in beta
            </h2>
          </div>
          <button
            className="rounded-full border border-[var(--line)] px-4 py-2 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="mt-3 text-sm text-[var(--ink-1)]">{description}</p>
        <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-4">
          <p className="text-[11px] uppercase text-[var(--ink-1)]">
            Report a bug
          </p>
          <textarea
            className="mt-3 h-32 w-full rounded-2xl border border-[var(--line)] bg-transparent p-3 text-xs text-[var(--ink-0)] placeholder:text-[var(--ink-1)]"
            placeholder="Describe what happened, what you expected, and how to reproduce it."
            value={reportBody}
            onChange={(event) => setReportBody(event.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-full border border-[var(--line)] px-4 py-2 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              onClick={handleCopy}
            >
              Copy report
            </button>
            <button
              className="rounded-full bg-[var(--accent-0)] px-4 py-2 text-xs font-semibold text-black hover:brightness-110"
              onClick={handleSend}
              disabled={submitting}
              title="Send report"
            >
              {submitting ? "Sending..." : "Send report"}
            </button>
            {status && (
              <span className="text-[11px] text-[var(--ink-1)]">{status}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
