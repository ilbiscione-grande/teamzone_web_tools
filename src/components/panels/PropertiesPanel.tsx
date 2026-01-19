"use client";

import { useMemo } from "react";
import type { DrawableObject, TextLabel } from "@/models";
import { useProjectStore } from "@/state/useProjectStore";
import { useEditorStore } from "@/state/useEditorStore";
import { getActiveBoard, getBoardSquads } from "@/utils/board";
import { clone } from "@/utils/clone";
import { createId } from "@/utils/id";

const numberField = (
  value: number,
  onChange: (value: number) => void,
  min?: number,
  max?: number,
  step = 1
) => (
  <input
    type="number"
    className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent px-2 text-xs text-[var(--ink-0)]"
    value={Number.isFinite(value) ? value : 0}
    min={min}
    max={max}
    step={step}
    onChange={(event) => onChange(Number(event.target.value))}
  />
);

export default function PropertiesPanel() {
  const project = useProjectStore((state) => state.project);
  const updateObject = useProjectStore((state) => state.updateObject);
  const removeObject = useProjectStore((state) => state.removeObject);
  const addObject = useProjectStore((state) => state.addObject);
  const pushHistory = useEditorStore((state) => state.pushHistory);
  const selection = useEditorStore((state) => state.selection);
  const selectedLinkId = useEditorStore((state) => state.selectedLinkId);

  const board = getActiveBoard(project);
  const frameIndex = board?.activeFrameIndex ?? 0;
  const objects = board?.frames[frameIndex]?.objects ?? [];
  const canCopyAcrossFrames =
    board?.mode === "DYNAMIC" && (board?.frames.length ?? 0) > 1;
  const selected = useMemo(
    () => objects.filter((item) => selection.includes(item.id)),
    [objects, selection]
  );
  const target = selected[0];
  const selectedLink = board?.playerLinks?.find(
    (link) => link.id === selectedLinkId
  );

  if (!board) {
    return null;
  }

  const update = (payload: Partial<DrawableObject>) => {
    if (!target) {
      return;
    }
    pushHistory(clone(objects));
    updateObject(board.id, frameIndex, target.id, payload);
  };

  const handleDelete = () => {
    if (selected.length === 0) {
      return;
    }
    pushHistory(clone(objects));
    selected.forEach((item) =>
      removeObject(board.id, frameIndex, item.id)
    );
  };

  const handleDuplicate = () => {
    if (selected.length === 0) {
      return;
    }
    pushHistory(clone(objects));
    selected.forEach((item) => {
      const duplicate = clone(item);
      duplicate.id = createId();
      duplicate.position = {
        x: duplicate.position.x + 2,
        y: duplicate.position.y + 2,
      };
      addObject(board.id, frameIndex, duplicate);
    });
  };

  const handleDeleteLink = () => {
    if (!board || !selectedLinkId) {
      return;
    }
    const nextLinks = (board.playerLinks ?? []).filter(
      (link) => link.id !== selectedLinkId
    );
    useEditorStore.getState().setSelectedLinkId(null);
    useProjectStore.getState().updateBoard(board.id, {
      playerLinks: nextLinks,
    });
  };

  const copyPlayerPositions = (direction: "prev" | "next") => {
    if (!board || !canCopyAcrossFrames) {
      return;
    }
    const targetIndex = direction === "prev" ? frameIndex - 1 : frameIndex + 1;
    if (targetIndex < 0 || targetIndex >= board.frames.length) {
      return;
    }
    const targetObjects = board.frames[targetIndex]?.objects ?? [];
    pushHistory(clone(targetObjects));
    selected
      .filter((item) => item.type === "player")
      .forEach((player) => {
        const existing = targetObjects.find((item) => item.id === player.id);
        if (existing) {
          updateObject(board.id, targetIndex, player.id, {
            position: player.position,
          });
        } else {
          addObject(board.id, targetIndex, clone(player));
        }
      });
  };

  const boardSquads = getBoardSquads(project, board);
  const playerOptions = [
    ...(boardSquads.home?.players.map((player) => ({
      id: player.id,
      label: `Home: ${player.name} (${player.positionLabel})`,
    })) ?? []),
    ...(boardSquads.away?.players.map((player) => ({
      id: player.id,
      label: `Away: ${player.name} (${player.positionLabel})`,
    })) ?? []),
  ];

  return (
    <div className="space-y-4 text-xs text-[var(--ink-1)]">
      <div className="flex items-center justify-between">
        <span className="display-font text-sm text-[var(--accent-0)]">
          Properties
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-full border border-[var(--line)] px-3 py-1 hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
            onClick={handleDuplicate}
            disabled={selected.length === 0}
          >
            Duplicate
          </button>
          <button
            className="rounded-full border border-[var(--line)] px-3 py-1 hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
            onClick={handleDelete}
            disabled={selected.length === 0}
          >
            Delete
          </button>
        </div>
      </div>

      {selected.length === 0 && !selectedLink ? (
        <p>Select an object to edit its properties.</p>
      ) : (
        <div className="space-y-4">
          {selected.length === 0 && selectedLink && (
            <div className="rounded-2xl border border-[var(--line)] p-3">
              <p className="text-[11px] uppercase text-[var(--ink-1)]">
                Link line
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                  onClick={handleDeleteLink}
                >
                  Delete link
                </button>
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-[var(--line)] p-3">
            <p className="text-[11px] uppercase text-[var(--ink-1)]">Style</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {target.type !== "player" && (
                <>
                  <label className="space-y-1">
                    <span className="text-[11px]">Stroke</span>
                    <input
                      type="color"
                      className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent"
                      value={target.style.stroke}
                      onChange={(event) =>
                        update({
                          style: { ...target.style, stroke: event.target.value },
                        })
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px]">Fill</span>
                    <input
                      type="color"
                      className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent"
                      value={target.style.fill}
                      onChange={(event) =>
                        update({
                          style: { ...target.style, fill: event.target.value },
                        })
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px]">Stroke Width</span>
                    {numberField(target.style.strokeWidth, (value) =>
                      update({
                        style: { ...target.style, strokeWidth: value },
                      })
                    )}
                  </label>
                </>
              )}
              <label className="space-y-1">
                <span className="text-[11px]">Opacity</span>
                {numberField(target.style.opacity, (value) =>
                  update({
                    style: { ...target.style, opacity: value },
                  })
                )}
              </label>
              <label className="flex items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={target.style.dash.length > 0}
                  onChange={(event) =>
                    update({
                      style: {
                        ...target.style,
                        dash: event.target.checked ? [1, 1] : [],
                      },
                    })
                  }
                />
                Dashed
              </label>
            </div>
            {target.type === "player" && (
              <p className="mt-2 text-[11px] text-[var(--ink-1)]">
                Player colors are set in Squad.
              </p>
            )}
          </div>

          {target.type === "player" && (
            <div className="rounded-2xl border border-[var(--line)] p-3">
              <p className="text-[11px] uppercase text-[var(--ink-1)]">
                Player
              </p>
              <div className="mt-2 grid gap-2">
                {canCopyAcrossFrames && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                      onClick={() => copyPlayerPositions("prev")}
                      disabled={frameIndex === 0}
                    >
                      Copy pos to prev frame
                    </button>
                    <button
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                      onClick={() => copyPlayerPositions("next")}
                      disabled={frameIndex >= board.frames.length - 1}
                    >
                      Copy pos to next frame
                    </button>
                  </div>
                )}
                <label className="space-y-1">
                  <span className="text-[11px]">Squad Player</span>
                  <select
                    className="h-8 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2 text-xs text-[var(--ink-0)]"
                    value={target.squadPlayerId ?? ""}
                    onChange={(event) =>
                      update({ squadPlayerId: event.target.value || undefined })
                    }
                  >
                    <option
                      value=""
                      className="bg-[var(--panel-2)] text-[var(--ink-0)]"
                    >
                      Unlinked
                    </option>
                    {playerOptions.map((player) => (
                      <option
                        key={player.id}
                        value={player.id}
                        className="bg-[var(--panel-2)] text-[var(--ink-0)]"
                      >
                        {player.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={Boolean(target.hasBall)}
                    onChange={(event) =>
                      update({ hasBall: event.target.checked })
                    }
                  />
                  Player has ball
                </label>
              </div>
            </div>
          )}

          {target.type === "ball" && (
            <div className="rounded-2xl border border-[var(--line)] p-3">
              <p className="text-[11px] uppercase text-[var(--ink-1)]">Ball</p>
              <div className="mt-2 grid gap-2">
                <label className="space-y-1">
                  <span className="text-[11px]">Attach to player</span>
                  <select
                    className="h-8 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2 text-xs text-[var(--ink-0)]"
                    value={target.attachedToId ?? ""}
                    onChange={(event) =>
                      update({
                        attachedToId: event.target.value || undefined,
                      })
                    }
                  >
                    <option
                      value=""
                      className="bg-[var(--panel-2)] text-[var(--ink-0)]"
                    >
                      Free
                    </option>
                    {objects
                      .filter((item) => item.type === "player")
                      .map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                          className="bg-[var(--panel-2)] text-[var(--ink-0)]"
                        >
                          Player {item.id.slice(0, 4)}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          {target.type === "text" && (
            <div className="rounded-2xl border border-[var(--line)] p-3">
              <p className="text-[11px] uppercase text-[var(--ink-1)]">Text</p>
              <div className="mt-2 grid gap-2">
                <textarea
                  className="min-h-[80px] w-full rounded-lg border border-[var(--line)] bg-transparent p-2 text-xs text-[var(--ink-0)]"
                  value={target.text}
                  onChange={(event) => update({ text: event.target.value })}
                />
                <label className="space-y-1">
                  <span className="text-[11px]">Font size</span>
                  {numberField(target.fontSize, (value) =>
                    update({ fontSize: value })
                  )}
                </label>
                <label className="space-y-1">
                  <span className="text-[11px]">Align</span>
                  <select
                    className="h-8 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2 text-xs text-[var(--ink-0)]"
                    value={target.align}
                    onChange={(event) =>
                      update({ align: event.target.value as TextLabel["align"] })
                    }
                  >
                    <option value="left" className="bg-[var(--panel-2)] text-[var(--ink-0)]">
                      Left
                    </option>
                    <option value="center" className="bg-[var(--panel-2)] text-[var(--ink-0)]">
                      Center
                    </option>
                    <option value="right" className="bg-[var(--panel-2)] text-[var(--ink-0)]">
                      Right
                    </option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={target.bold}
                    onChange={(event) => update({ bold: event.target.checked })}
                  />
                  Bold
                </label>
                <label className="flex items-center gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={target.background}
                    onChange={(event) =>
                      update({ background: event.target.checked })
                    }
                  />
                  Background
                </label>
              </div>
            </div>
          )}

          {target.type === "arrow" && (
            <div className="rounded-2xl border border-[var(--line)] p-3">
              <p className="text-[11px] uppercase text-[var(--ink-1)]">Arrow</p>
              <div className="mt-2 grid gap-2">
                <label className="flex items-center gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={target.head}
                    onChange={(event) => update({ head: event.target.checked })}
                  />
                  Arrow head
                </label>
                <label className="flex items-center gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={target.dashed}
                    onChange={(event) => update({ dashed: event.target.checked })}
                  />
                  Dashed
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
