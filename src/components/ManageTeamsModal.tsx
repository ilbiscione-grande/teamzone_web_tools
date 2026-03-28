"use client";

import type { ReactNode } from "react";

type ManageTeamsModalProps = {
  open: boolean;
  manageSide: "home" | "away";
  currentHomeTeamName?: string | null;
  currentAwayTeamName?: string | null;
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
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/20 px-4 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                  <div className="min-w-0">
                    <h2 className="display-font text-xl text-[var(--accent-0)]">
                      Team manager
                    </h2>
                    <p className="text-xs text-[var(--ink-1)]">
                      Choose a side, edit its roster, then decide whether the result stays local or becomes a reusable team.
                    </p>
                  </div>
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
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
                  <span className="rounded-full border border-[var(--line)] px-2.5 py-1">
                    Editing: {manageSide}
                  </span>
                  <span className="rounded-full border border-[var(--line)] px-2.5 py-1">
                    Focus: roster
                  </span>
                  <span className="rounded-full border border-[var(--line)] px-2.5 py-1">
                    Scope: current project
                  </span>
                  <span className="rounded-full border border-[var(--line)] px-2.5 py-1 normal-case tracking-normal">
                    Home linked: {currentHomeTeamName ?? "None"}
                  </span>
                  <span className="rounded-full border border-[var(--line)] px-2.5 py-1 normal-case tracking-normal">
                    Away linked: {currentAwayTeamName ?? "None"}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-stretch gap-2 xl:justify-end">
                <button
                  className="rounded-full border border-[var(--line)] px-3 py-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                  onClick={onApplyToHome}
                >
                  Use for Home
                </button>
                <button
                  className="rounded-full border border-[var(--line)] px-3 py-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                  onClick={onApplyToAway}
                >
                  Use for Away
                </button>
                <button
                  className="flex flex-col items-center gap-1 rounded-xl border border-[var(--line)] p-2 hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
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
                  <span className="text-[9px] uppercase tracking-wide">Close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
