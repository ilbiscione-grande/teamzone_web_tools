"use client";

import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "@/state/useProjectStore";
import { useEditorStore } from "@/state/useEditorStore";
import { getActiveBoard, getBoardSquads } from "@/utils/board";
import { clone } from "@/utils/clone";
import { createPlayer } from "@/board/objects/objectFactory";
import { createId } from "@/utils/id";
import type { PlayerToken, Squad, SquadPlayer } from "@/models";
import { can } from "@/utils/plan";

const PITCH_LENGTH = 105;
const PITCH_WIDTH = 68;

const formations: Record<string, number[]> = {
  "4-3-3": [4, 3, 3],
  "4-4-2": [4, 4, 2],
  "3-5-2": [3, 5, 2],
  "4-2-3-1": [4, 2, 3, 1],
  "3-4-3": [3, 4, 3],
  "4-1-4-1": [4, 1, 4, 1],
  "4-5-1": [4, 5, 1],
  "4-3-1-2": [4, 3, 1, 2],
  "4-1-2-1-2": [4, 1, 2, 1, 2],
  "3-4-1-2": [3, 4, 1, 2],
  "3-4-2-1": [3, 4, 2, 1],
  "3-5-1-1": [3, 5, 1, 1],
  "5-3-2": [5, 3, 2],
  "5-2-3": [5, 2, 3],
  "5-4-1": [5, 4, 1],
};

type CustomFormation = {
  name: string;
  side: "home" | "away";
  slots: { position: { x: number; y: number }; playerId?: string }[];
};

type LegacyCustomFormation = {
  name: string;
  pattern: number[];
};

const getFormationStorageKey = (projectId: string) =>
  `tacticsboard:formations:${projectId}`;

const normalizeCustomFormations = (value: unknown): CustomFormation[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: CustomFormation[] = [];
  value.forEach((entry) => {
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as { name?: unknown }).name === "string"
    ) {
      const name = (entry as { name: string }).name;
      if (
        Array.isArray((entry as CustomFormation).slots) &&
        (entry as CustomFormation).slots.length > 0
      ) {
        const side = (entry as CustomFormation).side === "away" ? "away" : "home";
        const slots = (entry as CustomFormation).slots
          .map((slot) => ({
            position: slot.position,
            playerId: slot.playerId,
          }))
          .filter((slot) => slot.position && Number.isFinite(slot.position.x));
        if (slots.length > 0) {
          result.push({ name, side, slots });
        }
        return;
      }
      if (Array.isArray((entry as LegacyCustomFormation).pattern)) {
        const pattern = (entry as LegacyCustomFormation).pattern;
        const positions = getFormationPositions(pattern, "home");
        result.push({
          name,
          side: "home",
          slots: positions.map((position) => ({
            position,
            playerId: undefined,
          })),
        });
      }
    }
  });
  return result;
};

const getLineYs = (count: number) => {
  const margin = 8;
  if (count <= 1) {
    return [PITCH_WIDTH / 2];
  }
  const spacing = (PITCH_WIDTH - margin * 2) / (count - 1);
  return Array.from({ length: count }, (_, index) => margin + spacing * index);
};

const getLineXs = (lineCount: number) => {
  if (lineCount <= 1) {
    return [PITCH_LENGTH * 0.5];
  }
  const minX = 22;
  const maxX = 88;
  const spacing = (maxX - minX) / (lineCount - 1);
  return Array.from({ length: lineCount }, (_, index) => minX + spacing * index);
};

const getFormationPositions = (formation: number[], side: "home" | "away") => {
  const positions: { x: number; y: number }[] = [];
  const gkX = side === "home" ? 8 : PITCH_LENGTH - 8;
  positions.push({ x: gkX, y: PITCH_WIDTH / 2 });
  const lineXs = getLineXs(formation.length).map((x) =>
    side === "home" ? x : PITCH_LENGTH - x
  );
  formation.forEach((count, index) => {
    const ys = getLineYs(count);
    ys.forEach((y) => positions.push({ x: lineXs[index]!, y }));
  });
  return positions;
};

export default function FormationMenu() {
  const project = useProjectStore((state) => state.project);
  const setFrameObjects = useProjectStore((state) => state.setFrameObjects);
  const addSquadPlayer = useProjectStore((state) => state.addSquadPlayer);
  const plan = useProjectStore((state) => state.plan);
  const pushHistory = useEditorStore((state) => state.pushHistory);
  const playerTokenSize = useEditorStore((state) => state.playerTokenSize);

  const board = useMemo(() => getActiveBoard(project ?? null), [project]);
  const boardSquads = useMemo(
    () => getBoardSquads(project ?? null, board ?? null),
    [project, board]
  );
  const frameIndex = board?.activeFrameIndex ?? 0;
  const objects = board?.frames[frameIndex]?.objects ?? [];
  const formationDisabled = board?.mode === "DYNAMIC" && (board?.frames.length ?? 0) > 1;

  const [open, setOpen] = useState(false);
  const [formationKey, setFormationKey] = useState("4-3-3");
  const [formationSide, setFormationSide] = useState<"home" | "away">("home");
  const [customFormations, setCustomFormations] = useState<CustomFormation[]>([]);
  const [customName, setCustomName] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const canCustom = can(plan, "formation.custom");

  useEffect(() => {
    if (!project?.id) {
      setCustomFormations([]);
      return;
    }
    const raw = window.localStorage.getItem(getFormationStorageKey(project.id));
    if (!raw) {
      setCustomFormations([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setCustomFormations(normalizeCustomFormations(parsed));
    } catch {
      setCustomFormations([]);
    }
  }, [project?.id]);

  const persistCustomFormations = (next: CustomFormation[]) => {
    if (!project?.id) {
      return;
    }
    if (!canCustom) {
      return;
    }
    setCustomFormations(next);
    window.localStorage.setItem(
      getFormationStorageKey(project.id),
      JSON.stringify(next)
    );
  };

  const getSlotsFromLayout = (squad: Squad) => {
    const squadPlayerIds = new Set(squad.players.map((player) => player.id));
    return objects
      .filter((item) => item.type === "player")
      .map((item) => item as PlayerToken)
      .filter(
        (token) =>
          !token.squadPlayerId || squadPlayerIds.has(token.squadPlayerId)
      )
      .map((token) => ({
        position: { x: token.position.x, y: token.position.y },
        playerId: token.squadPlayerId,
      }))
      .sort((a, b) =>
        a.position.x === b.position.x
          ? a.position.y - b.position.y
          : a.position.x - b.position.x
      );
  };

  const overwriteCustomFormation = (name: string) => {
    if (!canCustom) {
      return;
    }
    const squad = formationSide === "home" ? boardSquads.home : boardSquads.away;
    if (!squad) {
      return;
    }
    const confirmed = window.confirm(`Overwrite "${name}" with current layout?`);
    if (!confirmed) {
      return;
    }
    const slots = getSlotsFromLayout(squad);
    if (slots.length === 0) {
      return;
    }
    const next = [
      ...customFormations.filter((item) => item.name !== name),
      { name, side: formationSide, slots },
    ];
    persistCustomFormations(next);
    setFormationKey(name);
  };

  const deleteCustomFormation = (name: string) => {
    if (!canCustom) {
      return;
    }
    const confirmed = window.confirm(`Delete "${name}"?`);
    if (!confirmed) {
      return;
    }
    const next = customFormations.filter((item) => item.name !== name);
    persistCustomFormations(next);
    setFormationKey(Object.keys(formations)[0] ?? "4-3-3");
  };

  const applyFormation = (key: string) => {
    if (!board) {
      return;
    }
    const squad: Squad | undefined =
      formationSide === "home" ? boardSquads.home : boardSquads.away;
    if (!squad) {
      return;
    }
    const squadPlayerIds = new Set(squad.players.map((player) => player.id));
    const existingSquadTokens = objects.filter(
      (item) =>
        item.type === "player" &&
        (item as PlayerToken).squadPlayerId &&
        squadPlayerIds.has((item as PlayerToken).squadPlayerId!)
    );
    if (existingSquadTokens.length > 0) {
      const confirmed = window.confirm(
        `Replace existing ${formationSide} players with this formation?`
      );
      if (!confirmed) {
        return;
      }
    }
    const preset = formations[key];
    const custom = customFormations.find((item) => item.name === key);
    const snapshot = clone(objects);
    const next = clone(objects).filter(
      (item) =>
        item.type !== "player" ||
        !(
          (item as PlayerToken).squadPlayerId &&
          squadPlayerIds.has((item as PlayerToken).squadPlayerId!)
        )
    ) as PlayerToken[];

    const ensureSquadPlayers = (count: number) => {
      const players: SquadPlayer[] = [...squad.players];
      for (let i = players.length; i < count; i += 1) {
        const player: SquadPlayer = {
          id: createId(),
          name: `Player ${i + 1}`,
          positionLabel: "",
          number: undefined,
        };
        players.push(player);
        addSquadPlayer(squad.id, player);
      }
      return players;
    };

    if (preset) {
      const positions = getFormationPositions(preset, formationSide);
      const squadPlayers = ensureSquadPlayers(positions.length);
      positions.forEach((position, index) => {
        const player = squadPlayers[index];
        const token = createPlayer(
          position,
          playerTokenSize,
          squad?.kit.shirt
        );
        if (player) {
          token.squadPlayerId = player.id;
        }
        next.push(token);
      });
    } else if (custom) {
      const slots =
        custom.side === formationSide
          ? custom.slots
          : custom.slots.map((slot) => ({
              position: {
                x: PITCH_LENGTH - slot.position.x,
                y: slot.position.y,
              },
              playerId: slot.playerId,
            }));
      const usedPlayers = new Set<string>();
      const squadPlayers = ensureSquadPlayers(slots.length);
      slots.forEach((slot) => {
        let player =
          custom.side === formationSide && slot.playerId
            ? squadPlayers.find((item) => item.id === slot.playerId)
            : undefined;
        if (!player) {
          player = squadPlayers.find((item) => !usedPlayers.has(item.id));
        }
        if (player) {
          usedPlayers.add(player.id);
        }
        const token = createPlayer(
          slot.position,
          playerTokenSize,
          squad?.kit.shirt
        );
        if (player) {
          token.squadPlayerId = player.id;
        }
        next.push(token);
      });
    } else {
      return;
    }
    pushHistory(snapshot);
    setFrameObjects(board.id, frameIndex, next);
    setOpen(false);
    setListOpen(false);
  };

  return (
    <div className="relative">
      <button
        className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
        onClick={() => {
          setOpen((value) => {
            if (value) {
              setListOpen(false);
            }
            return !value;
          });
        }}
        disabled={formationDisabled}
        data-locked={formationDisabled}
      >
        Formations
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-72 rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-3 text-[11px] text-[var(--ink-1)] shadow-xl shadow-black/40">
          <p className="mb-2 uppercase text-[var(--ink-1)]">Formation</p>
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "home", label: boardSquads.home?.name ?? "Home" },
                { id: "away", label: boardSquads.away?.name ?? "Away" },
              ].map((side) => (
                <button
                  key={side.id}
                  className={`rounded-2xl border px-3 py-2 text-[11px] uppercase tracking-wide ${
                    formationSide === side.id
                      ? "border-[var(--accent-0)] text-[var(--ink-0)]"
                      : "border-[var(--line)] text-[var(--ink-1)] hover:border-[var(--accent-2)]"
                  }`}
                  onClick={() => setFormationSide(side.id as "home" | "away")}
                  disabled={
                    (side.id === "home" && !boardSquads.home) ||
                    (side.id === "away" && !boardSquads.away)
                  }
                >
                  {side.label}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-2">
              <button
                className="flex w-full items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[11px]"
                onClick={() => setListOpen((value) => !value)}
              >
                <span>{formationKey}</span>
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
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {listOpen && (
                <div className="mt-2 max-h-56 space-y-2 overflow-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2">
                  <div>
                    <p className="mb-2 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                      Presets
                    </p>
                    <div className="grid gap-1">
                      {Object.keys(formations).map((key) => (
                        <button
                          key={key}
                          className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-[11px] ${
                            formationKey === key
                              ? "bg-[var(--panel-2)] text-[var(--ink-0)]"
                              : "text-[var(--ink-1)] hover:bg-[var(--panel-2)]"
                          }`}
                          onClick={() => {
                            setFormationKey(key);
                            applyFormation(key);
                          }}
                          disabled={formationDisabled}
                        >
                          <span>{key}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                      Custom
                    </p>
                    {customFormations.length === 0 ? (
                      <p className="px-2 py-1 text-[10px] text-[var(--ink-1)]">
                        No custom formations yet.
                      </p>
                    ) : (
                      <div className="grid gap-1">
                        {customFormations.map((item) => (
                          <div
                            key={item.name}
                            className={`flex items-center gap-2 rounded-lg px-2 py-1 ${
                              formationKey === item.name
                                ? "bg-[var(--panel-2)] text-[var(--ink-0)]"
                                : "text-[var(--ink-1)] hover:bg-[var(--panel-2)]"
                            }`}
                          >
                            <button
                              className="flex-1 text-left text-[11px]"
                              onClick={() => {
                                setFormationKey(item.name);
                                applyFormation(item.name);
                              }}
                              disabled={formationDisabled}
                            >
                              {item.name}
                            </button>
                            <button
                              className="rounded-full border border-[var(--line)] p-1 hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (!formationDisabled) {
                                  overwriteCustomFormation(item.name);
                                }
                              }}
                              title="Overwrite"
                              aria-label="Overwrite"
                              disabled={formationDisabled || !canCustom}
                              data-locked={!canCustom}
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
                                <path d="M5 5h11l3 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
                                <path d="M7 5v6h8V5" />
                              </svg>
                            </button>
                            <button
                              className="rounded-full border border-[var(--line)] p-1 hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteCustomFormation(item.name);
                              }}
                              title="Delete"
                              aria-label="Delete"
                              disabled={!canCustom}
                              data-locked={!canCustom}
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
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                className="h-9 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-3 text-xs text-[var(--ink-0)]"
                placeholder="Save as..."
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                disabled={!canCustom}
              />
              <button
                className="rounded-2xl border border-[var(--line)] px-3 py-2 text-[11px] uppercase tracking-wide hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                onClick={() => {
                  const name = customName.trim();
                  if (!name) {
                    return;
                  }
                  if (!canCustom) {
                    window.alert("Custom formations are not available on this plan.");
                    return;
                  }
                  const squad =
                    formationSide === "home" ? boardSquads.home : boardSquads.away;
                  if (!squad) {
                    return;
                  }
                  const slots = getSlotsFromLayout(squad);
                  if (slots.length === 0) {
                    return;
                  }
                  const next = [
                    ...customFormations.filter((item) => item.name !== name),
                    { name, side: formationSide, slots },
                  ];
                  persistCustomFormations(next);
                  setFormationKey(name);
                  setCustomName("");
                }}
                disabled={formationDisabled || !canCustom}
                data-locked={!canCustom}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
