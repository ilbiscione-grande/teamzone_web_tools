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

type PropertiesPanelProps = {
  floating: boolean;
  onToggleFloating: () => void;
};

export default function PropertiesPanel({
  floating,
  onToggleFloating,
}: PropertiesPanelProps) {
  const project = useProjectStore((state) => state.project);
  const updateObject = useProjectStore((state) => state.updateObject);
  const removeObject = useProjectStore((state) => state.removeObject);
  const addObject = useProjectStore((state) => state.addObject);
  const updateSquadPlayer = useProjectStore((state) => state.updateSquadPlayer);
  const updateBoard = useProjectStore((state) => state.updateBoard);
  const pushHistory = useEditorStore((state) => state.pushHistory);
  const selection = useEditorStore((state) => state.selection);
  const selectedLinkId = useEditorStore((state) => state.selectedLinkId);

  const board = getActiveBoard(project);
  const frameIndex = board?.activeFrameIndex ?? 0;
  const activeFrame = board?.frames[frameIndex];
  const objects = board?.frames[frameIndex]?.objects ?? [];
  const canCopyAcrossFrames =
    board?.mode === "DYNAMIC" && (board?.frames.length ?? 0) > 1;
  const selected = useMemo(
    () => objects.filter((item) => selection.includes(item.id)),
    [objects, selection]
  );
  const target = selected[0];
  const lockableSelected = selected.filter((item) =>
    ["cone", "goal", "circle", "rect", "triangle", "arrow", "text"].includes(
      item.type
    )
  );
  const allLocked =
    lockableSelected.length > 0 &&
    lockableSelected.every((item) => item.locked);
  const selectedLink = activeFrame?.playerLinks?.find(
    (link) => link.id === selectedLinkId
  );
  const memoBoardSquads = useMemo(
    () => getBoardSquads(project ?? null, board ?? null),
    [project, board]
  );
  const playerNameById = useMemo(() => {
    const map = new Map<string, string>();
    const squads = [memoBoardSquads.home, memoBoardSquads.away].filter(Boolean);
    squads.forEach((squad) => {
      squad?.players.forEach((player) => {
        const label = player.name || player.positionLabel || "";
        map.set(player.id, label);
      });
    });
    return map;
  }, [memoBoardSquads]);
  const selectedLinkStyle = selectedLink?.style ?? {
    stroke: "#f9bf4a",
    strokeWidth: 0.5,
    fill: "transparent",
    dash: [],
    opacity: 1,
    outlineStroke: "#111111",
    outlineWidth: 0.35,
  };

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

  const toggleLock = (nextLocked: boolean) => {
    if (lockableSelected.length === 0) {
      return;
    }
    pushHistory(clone(objects));
    lockableSelected.forEach((item) => {
      updateObject(board.id, frameIndex, item.id, { locked: nextLocked });
    });
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
    const nextLinks = (activeFrame?.playerLinks ?? []).filter(
      (link) => link.id !== selectedLinkId
    );
    useEditorStore.getState().setSelectedLinkId(null);
    const nextFrames = board.frames.map((frame, index) =>
      index === frameIndex ? { ...frame, playerLinks: nextLinks } : frame
    );
    updateBoard(board.id, { frames: nextFrames });
  };
  const updateLinkStyle = (payload: Partial<typeof selectedLinkStyle>) => {
    if (!board || !selectedLink) {
      return;
    }
    const nextLinks = (activeFrame?.playerLinks ?? []).map((link) =>
      link.id === selectedLink.id
        ? { ...link, style: { ...selectedLinkStyle, ...payload } }
        : link
    );
    const nextFrames = board.frames.map((frame, index) =>
      index === frameIndex ? { ...frame, playerLinks: nextLinks } : frame
    );
    updateBoard(board.id, { frames: nextFrames });
  };
  const removeLinkPlayer = (index: number) => {
    if (!board || !selectedLink) {
      return;
    }
    const nextIds = selectedLink.playerIds.filter((_, i) => i !== index);
    if (nextIds.length < 2) {
      const nextLinks = (activeFrame?.playerLinks ?? []).filter(
        (link) => link.id !== selectedLink.id
      );
      useEditorStore.getState().setSelectedLinkId(null);
      const nextFrames = board.frames.map((frame, idx) =>
        idx === frameIndex ? { ...frame, playerLinks: nextLinks } : frame
      );
      updateBoard(board.id, { frames: nextFrames });
      return;
    }
    const nextLinks = (activeFrame?.playerLinks ?? []).map((link) =>
      link.id === selectedLink.id ? { ...link, playerIds: nextIds } : link
    );
    const nextFrames = board.frames.map((frame, idx) =>
      idx === frameIndex ? { ...frame, playerLinks: nextLinks } : frame
    );
    updateBoard(board.id, { frames: nextFrames });
  };
  const getLinkPlayerLabel = (playerId: string) => {
    const playerObject = objects.find(
      (item) => item.id === playerId && item.type === "player"
    );
    if (playerObject && "squadPlayerId" in playerObject) {
      const name = playerObject.squadPlayerId
        ? playerNameById.get(playerObject.squadPlayerId)
        : "";
      if (name) {
        return name;
      }
    }
    return playerId;
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

  const copySelectionToFrame = (direction: "prev" | "next") => {
    if (!board || !canCopyAcrossFrames || selected.length === 0) {
      return;
    }
    const targetIndex = direction === "prev" ? frameIndex - 1 : frameIndex + 1;
    if (targetIndex < 0 || targetIndex >= board.frames.length) {
      return;
    }
    const targetObjects = board.frames[targetIndex]?.objects ?? [];
    pushHistory(clone(targetObjects));
    selected.forEach((item) => {
      const existing = targetObjects.find((entry) => entry.id === item.id);
      const { id, ...payload } = clone(item);
      if (existing) {
        updateObject(board.id, targetIndex, item.id, payload);
      } else {
        addObject(board.id, targetIndex, clone(item));
      }
    });
  };

  const squadPlayerById = useMemo(() => {
    const map = new Map<
      string,
      typeof memoBoardSquads.all[number]["players"][number]
    >();
    memoBoardSquads.all.forEach((squad) => {
      squad.players.forEach((player) => {
        map.set(player.id, player);
      });
    });
    return map;
  }, [memoBoardSquads]);
  const squadIdByPlayerId = useMemo(() => {
    const map = new Map<string, string>();
    memoBoardSquads.all.forEach((squad) => {
      squad.players.forEach((player) => {
        map.set(player.id, squad.id);
      });
    });
    return map;
  }, [memoBoardSquads]);
  const playerOptions = [
    ...(memoBoardSquads.home?.players.map((player) => ({
      id: player.id,
      label: `Home: ${player.name} (${player.positionLabel})`,
    })) ?? []),
    ...(memoBoardSquads.away?.players.map((player) => ({
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
            onClick={onToggleFloating}
          >
            {floating ? "Dock" : "Float"}
          </button>
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
      {lockableSelected.length > 0 && (
        <label className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-3 py-2 text-xs">
          <span>Locked</span>
          <input
            type="checkbox"
            checked={allLocked}
            onChange={(event) => toggleLock(event.target.checked)}
            disabled={project?.isShared}
          />
        </label>
      )}

      {selected.length === 0 && !selectedLink ? (
        <p>Select an object to edit its properties.</p>
      ) : (
        <div className="space-y-4">
          {selected.length === 0 && selectedLink && (
            <div className="rounded-2xl border border-[var(--line)] p-3">
              <p className="text-[11px] uppercase text-[var(--ink-1)]">
                Link line
              </p>
              <div className="mt-2 space-y-2">
                {selectedLink.playerIds.map((id, index) => (
                  <div
                    key={`${id}-${index}`}
                    className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--panel-2)]/70 px-3 py-2 text-[11px]"
                  >
                    <span>
                      {index + 1}. {getLinkPlayerLabel(id)}
                    </span>
                    <button
                      className="rounded-full border border-[var(--line)] px-2 py-1 text-[10px] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                      onClick={() => removeLinkPlayer(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px]">Stroke</span>
                  <input
                    type="color"
                    className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent"
                    value={selectedLinkStyle.stroke}
                    onChange={(event) =>
                      updateLinkStyle({ stroke: event.target.value })
                    }
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px]">Outline</span>
                  <input
                    type="color"
                    className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent"
                    value={selectedLinkStyle.outlineStroke ?? "#111111"}
                    onChange={(event) =>
                      updateLinkStyle({ outlineStroke: event.target.value })
                    }
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px]">Stroke Width</span>
                  {numberField(selectedLinkStyle.strokeWidth, (value) =>
                    updateLinkStyle({ strokeWidth: value })
                  )}
                </label>
                <label className="space-y-1">
                  <span className="text-[11px]">Outline Width</span>
                  {numberField(selectedLinkStyle.outlineWidth ?? 0, (value) =>
                    updateLinkStyle({ outlineWidth: value })
                  )}
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
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
                  {target.type === "arrow" && (
                    <>
                      <label className="space-y-1">
                        <span className="text-[11px]">Outline</span>
                        <input
                          type="color"
                          className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent"
                          value={target.style.outlineStroke ?? "#111111"}
                          onChange={(event) =>
                            update({
                              style: {
                                ...target.style,
                                outlineStroke: event.target.value,
                              },
                            })
                          }
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px]">Outline Width</span>
                        {numberField(target.style.outlineWidth ?? 0, (value) =>
                          update({
                            style: { ...target.style, outlineWidth: value },
                          })
                        )}
                      </label>
                    </>
                  )}
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

          {canCopyAcrossFrames && selected.length > 0 && (
            <div className="rounded-2xl border border-[var(--line)] p-3">
              <p className="text-[11px] uppercase text-[var(--ink-1)]">
                Copy to frame
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                  onClick={() => copySelectionToFrame("prev")}
                  disabled={frameIndex === 0}
                >
                  Copy to prev frame
                </button>
                <button
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                  onClick={() => copySelectionToFrame("next")}
                  disabled={frameIndex >= board.frames.length - 1}
                >
                  Copy to next frame
                </button>
              </div>
            </div>
          )}

          {(target.type === "cone" ||
            target.type === "goal" ||
            target.type === "circle" ||
            target.type === "rect" ||
            target.type === "triangle") && (
            <div className="rounded-2xl border border-[var(--line)] p-3">
              <p className="text-[11px] uppercase text-[var(--ink-1)]">
                Rotation
              </p>
              <div className="mt-2 grid gap-2">
                <label className="space-y-1">
                  <span className="text-[11px]">Degrees</span>
                  {numberField(target.rotation, (value) =>
                    update({ rotation: value })
                  )}
                </label>
              </div>
            </div>
          )}

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
                <label className="space-y-1">
                  <span className="text-[11px]">Vest color</span>
                  {target.squadPlayerId ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        className="h-8 w-10 rounded-lg border border-[var(--line)] bg-transparent"
                        value={
                          squadPlayerById.get(target.squadPlayerId)?.vestColor ??
                          "#000000"
                        }
                        onChange={(event) =>
                          (() => {
                            const squadPlayerId = target.squadPlayerId;
                            if (!squadPlayerId) {
                              return;
                            }
                            const squadId = squadIdByPlayerId.get(squadPlayerId);
                            if (!squadId) {
                              return;
                            }
                            updateSquadPlayer(squadId, squadPlayerId, {
                              vestColor: event.target.value,
                            });
                          })()
                        }
                        title="Vest color"
                      />
                      <button
                        className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                        onClick={() =>
                          (() => {
                            const squadPlayerId = target.squadPlayerId;
                            if (!squadPlayerId) {
                              return;
                            }
                            const squadId = squadIdByPlayerId.get(squadPlayerId);
                            if (!squadId) {
                              return;
                            }
                            updateSquadPlayer(squadId, squadPlayerId, {
                              vestColor: undefined,
                            });
                          })()
                        }
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        className="h-8 w-10 rounded-lg border border-[var(--line)] bg-transparent"
                        value={target.vestColor ?? "#000000"}
                        onChange={(event) =>
                          update({ vestColor: event.target.value })
                        }
                        title="Vest color"
                      />
                      <button
                        className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                        onClick={() => update({ vestColor: undefined })}
                      >
                        Clear
                      </button>
                    </div>
                  )}
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
                  <span className="text-[11px]">Rotation</span>
                  {numberField(target.rotation, (value) =>
                    update({ rotation: value })
                  )}
                </label>
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
                    checked={Boolean(target.curved)}
                    onChange={(event) => {
                      const nextCurved = event.target.checked;
                      if (!nextCurved) {
                        update({ curved: false, control: undefined });
                        return;
                      }
                      const end = { x: target.points[2], y: target.points[3] };
                      update({
                        curved: true,
                        control: { x: end.x / 2, y: end.y / 2 },
                      });
                    }}
                  />
                  Curved
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
