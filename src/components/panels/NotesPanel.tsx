"use client";

import type { Board } from "@/models";
import { useProjectStore } from "@/state/useProjectStore";

type NotesPanelProps = {
  board: Board;
};

export default function NotesPanel({ board }: NotesPanelProps) {
  const setBoardNotes = useProjectStore((state) => state.setBoardNotes);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="display-font text-sm text-[var(--accent-0)]">
          Notes
        </span>
      </div>
      <textarea
        className="min-h-[140px] w-full rounded-2xl border border-[var(--line)] bg-transparent p-3 text-xs text-[var(--ink-0)]"
        value={board.notes}
        onChange={(event) => setBoardNotes(board.id, event.target.value)}
      />
    </div>
  );
}
