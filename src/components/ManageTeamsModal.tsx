"use client";

import type { ReactNode } from "react";

type ManageTeamsModalProps = {
  open: boolean;
  manageSide: "home" | "away";
  currentHomeTeamName?: string | null;
  currentAwayTeamName?: string | null;
  topControls?: ReactNode;
  onManageSideChange: (side: "home" | "away") => void;
  onApplyToHome: () => void;
  onApplyToAway: () => void;
  onClose: () => void;
  children: ReactNode;
};

export default function ManageTeamsModal({
  open,
  manageSide,
  currentHomeTeamName,
  currentAwayTeamName,
  topControls,
  onManageSideChange,
  onApplyToHome,
  onApplyToAway,
  onClose,
  children,
}: ManageTeamsModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--panel)] text-[var(--ink-0)] shadow-2xl shadow-black/40">
        <div className="sticky top-0 z-10 border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_94%,transparent)] px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="min-w-0">
                <h2 className="display-font text-xl text-[var(--accent-0)]">
                  Team manager
                </h2>
                <p className="text-xs text-[var(--ink-1)]">
                  Edit one side at a time. Team roster changes follow the linked team, while match board changes stay on this board only.
                </p>
              </div>
              <p className="text-xs text-[var(--ink-1)]">
                Home:{" "}
                <span className="text-[var(--ink-0)]">
                  {currentHomeTeamName ?? "None"}
                </span>
                {"  "}•{"  "}Away:{" "}
                <span className="text-[var(--ink-0)]">
                  {currentAwayTeamName ?? "None"}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="inline-flex w-fit rounded-full border border-[var(--line)] bg-[var(--panel)]/60 p-1 text-[11px] uppercase tracking-wide">
                {[
                  { id: "home", label: "Home" },
                  { id: "away", label: "Away" },
                ].map((side) => (
                  <button
                    key={side.id}
                    className={`rounded-full px-4 py-2 ${
                      manageSide === side.id
                        ? "bg-[var(--accent-0)] text-black"
                        : "text-[var(--ink-1)]"
                    }`}
                    onClick={() => onManageSideChange(side.id as "home" | "away")}
                  >
                    {side.label}
                  </button>
                ))}
              </div>
              {topControls}
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                onClick={onClose}
                aria-label="Close"
                title="Close"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 6l12 12" />
                  <path d="M18 6l-12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div className="max-h-[calc(92vh-128px)] overflow-y-auto">{children}</div>
        <div className="sticky bottom-0 z-10 border-t border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_96%,transparent)] px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              className="rounded-full border border-[var(--line)] px-4 py-2 text-[11px] uppercase tracking-wide text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onApplyToHome}
              disabled={manageSide === "home"}
            >
              Copy to Home
            </button>
            <button
              className="rounded-full border border-[var(--line)] px-4 py-2 text-[11px] uppercase tracking-wide text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onApplyToAway}
              disabled={manageSide === "away"}
            >
              Copy to Away
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
