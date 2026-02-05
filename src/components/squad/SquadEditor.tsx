"use client";

import { useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/state/useProjectStore";
import { useEditorStore } from "@/state/useEditorStore";
import { createId } from "@/utils/id";
import type { Squad } from "@/models";
import { getActiveBoard, getBoardSquads } from "@/utils/board";
import { can } from "@/utils/plan";
import { createSquadPreset } from "@/persistence/squadPresets";

export default function SquadEditor() {
  const project = useProjectStore((state) => state.project);
  const updateSquad = useProjectStore((state) => state.updateSquad);
  const addSquadPlayer = useProjectStore((state) => state.addSquadPlayer);
  const updateSquadPlayer = useProjectStore((state) => state.updateSquadPlayer);
  const removeSquadPlayer = useProjectStore((state) => state.removeSquadPlayer);
  const plan = useProjectStore((state) => state.plan);
  const authUser = useProjectStore((state) => state.authUser);
  const setPlayerSide = useEditorStore((state) => state.setPlayerSide);
  const [activeSide, setActiveSide] = useState<"home" | "away">("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetStatus, setPresetStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const board = useMemo(() => getActiveBoard(project ?? null), [project]);
  const boards = project?.boards ?? [];
  const [importBoardId, setImportBoardId] = useState<string>("");
  const [importSide, setImportSide] = useState<"home" | "away">("home");
  const boardSquads = useMemo(
    () => getBoardSquads(project ?? null, board ?? null),
    [project, board]
  );
  const activeSquad = activeSide === "home" ? boardSquads.home : boardSquads.away;

  const onAddPlayer = () => {
    if (!activeSquad) {
      return;
    }
    addSquadPlayer(activeSquad.id, {
      id: createId(),
      name: "New Player",
      positionLabel: "POS",
      number: undefined,
      vestColor: undefined,
    });
  };

  const onLogoUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string" && activeSquad) {
        updateSquad(activeSquad.id, { clubLogo: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const onExportSquad = () => {
    if (!can(plan, "squad.export")) {
      window.alert("Squad export is not available on this plan.");
      return;
    }
    if (!activeSquad) {
      return;
    }
    const data = JSON.stringify(activeSquad, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeSquad.name.replace(/\s+/g, "_")}.squad.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const onImportSquad = async (file: File) => {
    if (!can(plan, "squad.import")) {
      window.alert("Squad import is not available on this plan.");
      return;
    }
    const raw = await file.text();
    try {
      const parsed = JSON.parse(raw) as Squad;
      if (!parsed || !parsed.name || !parsed.kit || !Array.isArray(parsed.players)) {
        return;
      }
      if (!activeSquad) {
        return;
      }
      updateSquad(activeSquad.id, {
        name: parsed.name,
        clubLogo: parsed.clubLogo,
        kit: parsed.kit,
        players: parsed.players.map((player) => ({
          ...player,
          id: createId(),
        })),
      });
    } catch {
      return;
    }
  };

  const importFromBoard = () => {
    if (!project || !activeSquad || !board || !importBoardId) {
      return;
    }
    const sourceBoard = project.boards.find((item) => item.id === importBoardId);
    if (!sourceBoard) {
      return;
    }
    const sourceSquads = getBoardSquads(project, sourceBoard);
    const sourceSquad = importSide === "home" ? sourceSquads.home : sourceSquads.away;
    if (!sourceSquad) {
      return;
    }
    updateSquad(activeSquad.id, {
      name: sourceSquad.name,
      clubLogo: sourceSquad.clubLogo,
      kit: sourceSquad.kit,
      players: sourceSquad.players.map((player) => ({
        ...player,
        id: createId(),
      })),
    });
  };

  return (
    <div className="flex h-full flex-col text-xs text-[var(--ink-1)]">
      <div className="flex items-center justify-between">
        <span className="display-font text-sm text-[var(--accent-0)]">
          Squad Editor
        </span>
        <button
          className="rounded-full border border-[var(--line)] p-2 hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
          onClick={() => setSettingsOpen(true)}
          aria-label="Squad settings"
          title="Squad settings"
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
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
            <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.1a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.1a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.1a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.1a1 1 0 0 0-.5.6z" />
          </svg>
        </button>
      </div>

      {activeSquad ? (
        <div className="mt-3 flex min-h-0 flex-1 flex-col space-y-3">
          <div className="flex min-h-0 flex-1 flex-col space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase text-[var(--ink-1)]">
                {activeSide === "home" ? "Home squad" : "Away squad"}
              </span>
              <button
                className="rounded-full border border-[var(--line)] px-3 py-1 hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                onClick={onAddPlayer}
              >
                Add player
              </button>
            </div>
            <div className="grid grid-cols-[28px_minmax(0,1fr)_50px_20px] items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
              <span>#</span>
              <span>Name</span>
              <span>Pos</span>
              <span />
            </div>
            <div className="flex-1 space-y-2 overflow-auto pr-1" data-scrollable>
              {activeSquad.players.map((player) => (
                <div
                  key={player.id}
                  className="grid grid-cols-[28px_minmax(0,1fr)_50px_20px] items-center gap-2"
                >
                  <input
                    className="h-7 rounded-md border border-[var(--line)] bg-transparent px-1 text-center text-[11px] text-[var(--ink-0)]"
                    value={player.number ?? ""}
                    onChange={(event) =>
                      updateSquadPlayer(activeSquad.id, player.id, {
                        number: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      })
                    }
                  />
                  <input
                    className="h-7 w-full rounded-md border border-[var(--line)] bg-transparent px-1 text-[11px] text-[var(--ink-0)]"
                    value={player.name}
                    onChange={(event) =>
                      updateSquadPlayer(activeSquad.id, player.id, {
                        name: event.target.value,
                      })
                    }
                  />
                  <select
                    className="h-7 w-full rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-1 text-[10px] text-[var(--ink-0)]"
                    value={player.positionLabel}
                    onChange={(event) =>
                      updateSquadPlayer(activeSquad.id, player.id, {
                        positionLabel: event.target.value,
                      })
                    }
                  >
                    <option value="" className="bg-[var(--panel-2)] text-[var(--ink-0)]">
                      
                    </option>
                    {[
                      "GK",
                      "RB",
                      "RCB",
                      "CB",
                      "LCB",
                      "LB",
                      "RWB",
                      "LWB",
                      "DM",
                      "CDM",
                      "CM",
                      "AM",
                      "CAM",
                      "RM",
                      "LM",
                      "RW",
                      "LW",
                      "ST",
                      "CF",
                      "SS",
                    ].map((pos) => (
                      <option
                        key={pos}
                        value={pos}
                        className="bg-[var(--panel-2)] text-[var(--ink-0)]"
                      >
                        {pos}
                      </option>
                    ))}
                  </select>
                  <button
                    className="rounded-full border border-[var(--line)] p-1 text-[10px] hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                    onClick={() => removeSquadPlayer(activeSquad.id, player.id)}
                    title="Delete"
                    aria-label="Delete"
                  >
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 7h16" />
                      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      <path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p>No squads yet.</p>
      )}
      {settingsOpen && activeSquad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink-0)] shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="display-font text-lg text-[var(--accent-0)]">
                  Squad settings
                </h2>
                <p className="text-xs text-[var(--ink-1)]">
                  Update squad details, kits, logos, and imports.
                </p>
              </div>
              <button
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                onClick={() => setSettingsOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs text-[var(--ink-1)]">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "home", label: "Home" },
                  { id: "away", label: "Away" },
                ].map((side) => (
                  <button
                    key={side.id}
                    className={`rounded-2xl border px-3 py-2 text-[11px] uppercase tracking-wide ${
                      activeSide === side.id
                        ? "border-[var(--accent-0)] text-[var(--ink-0)]"
                        : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                    }`}
                    onClick={() => {
                      const nextSide = side.id as "home" | "away";
                      setActiveSide(nextSide);
                      setPlayerSide(nextSide);
                    }}
                  >
                    {side.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-3">
                <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
                  Save preset
                </p>
                {plan !== "PAID" || !authUser ? (
                  <p className="text-xs text-[var(--ink-1)]">
                    Squad presets are available on paid plans.
                  </p>
                ) : (
                  <>
                    <input
                      className="h-9 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                      placeholder="Preset name"
                      value={presetName}
                      onChange={(event) => setPresetName(event.target.value)}
                    />
                    <button
                      className="rounded-full border border-[var(--line)] px-3 py-2 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                      onClick={async () => {
                        if (!activeSquad) {
                          return;
                        }
                        if (!presetName.trim()) {
                          setPresetStatus("Enter a preset name.");
                          return;
                        }
                        setPresetStatus(null);
                        const result = await createSquadPreset({
                          name: presetName.trim(),
                          squad: activeSquad,
                        });
                        if (!result.ok) {
                          setPresetStatus(result.error);
                          return;
                        }
                        setPresetStatus("Preset saved.");
                        setPresetName("");
                      }}
                    >
                      Save preset
                    </button>
                    {presetStatus ? (
                      <p className="text-xs text-[var(--accent-1)]">
                        {presetStatus}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-full border border-[var(--line)] px-3 py-1 hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                  onClick={onExportSquad}
                  disabled={!can(plan, "squad.export")}
                  data-locked={!can(plan, "squad.export")}
                >
                  Export squad
                </button>
                <button
                  className="rounded-full border border-[var(--line)] px-3 py-1 hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                  onClick={() => importRef.current?.click()}
                  disabled={!can(plan, "squad.import")}
                  data-locked={!can(plan, "squad.import")}
                >
                  Import squad
                </button>
              </div>
              {boards.length > 1 && (
                <div className="rounded-2xl border border-[var(--line)] p-3 text-[11px]">
                  <p className="mb-2 uppercase text-[var(--ink-1)]">
                    Import from board
                  </p>
                  <div className="grid gap-2">
                    <select
                      className="h-9 w-full rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                      value={importBoardId}
                      onChange={(event) => setImportBoardId(event.target.value)}
                    >
                      <option
                        value=""
                        className="bg-[var(--panel-2)] text-[var(--ink-0)]"
                      >
                        Select board
                      </option>
                      {boards
                        .filter((item) => item.id !== board?.id)
                        .map((item) => (
                          <option
                            key={item.id}
                            value={item.id}
                            className="bg-[var(--panel-2)] text-[var(--ink-0)]"
                          >
                            {item.name}
                          </option>
                        ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "home", label: "Home" },
                        { id: "away", label: "Away" },
                      ].map((side) => (
                        <button
                          key={side.id}
                          className={`rounded-2xl border px-3 py-2 text-[11px] uppercase tracking-wide ${
                            importSide === side.id
                              ? "border-[var(--accent-0)] text-[var(--ink-0)]"
                              : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                          }`}
                          onClick={() =>
                            setImportSide(side.id as "home" | "away")
                          }
                        >
                          {side.label}
                        </button>
                      ))}
                    </div>
                    <button
                      className="rounded-2xl border border-[var(--line)] px-3 py-2 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                      onClick={importFromBoard}
                      disabled={!importBoardId}
                    >
                      Replace current squad
                    </button>
                  </div>
                </div>
              )}
              <input
                className="h-9 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                value={activeSquad.name}
                onChange={(event) =>
                  updateSquad(activeSquad.id, { name: event.target.value })
                }
              />
              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px]">Shirt</span>
                  <input
                    type="color"
                    className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent"
                    value={activeSquad.kit.shirt}
                    onChange={(event) =>
                      updateSquad(activeSquad.id, {
                        kit: { ...activeSquad.kit, shirt: event.target.value },
                      })
                    }
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px]">Shorts</span>
                  <input
                    type="color"
                    className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent"
                    value={activeSquad.kit.shorts}
                    onChange={(event) =>
                      updateSquad(activeSquad.id, {
                        kit: { ...activeSquad.kit, shorts: event.target.value },
                      })
                    }
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px]">Socks</span>
                  <input
                    type="color"
                    className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent"
                    value={activeSquad.kit.socks}
                    onChange={(event) =>
                      updateSquad(activeSquad.id, {
                        kit: { ...activeSquad.kit, socks: event.target.value },
                      })
                    }
                  />
                </label>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="rounded-full border border-[var(--line)] px-3 py-1 hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                  onClick={() => fileRef.current?.click()}
                >
                  Upload logo
                </button>
                {activeSquad.clubLogo ? (
                  <img
                    src={activeSquad.clubLogo}
                    alt="Club logo"
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span>None</span>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    onLogoUpload(file);
                  }
                }}
              />
              <input
                ref={importRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    onImportSquad(file);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
