"use client";

import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/state/useProjectStore";
import { deserializeProject } from "@/persistence/serialize";
import { loadProject, saveProject } from "@/persistence/storage";
import type { BoardShare, Project } from "@/models";
import { can, getPlanLimits } from "@/utils/plan";
import AdBanner from "@/components/AdBanner";
import PlanModal from "@/components/PlanModal";
import { fetchSharedBoards } from "@/persistence/shares";

export default function ProjectList() {
  const index = useProjectStore((state) => state.index);
  const openProject = useProjectStore((state) => state.openProject);
  const openSharedBoard = useProjectStore((state) => state.openSharedBoard);
  const createProject = useProjectStore((state) => state.createProject);
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const loadSample = useProjectStore((state) => state.loadSample);
  const plan = useProjectStore((state) => state.plan);
  const project = useProjectStore((state) => state.project);
  const authUser = useProjectStore((state) => state.authUser);
  const [planOpen, setPlanOpen] = useState(false);
  const [name, setName] = useState("");
  const [homeKit, setHomeKit] = useState({
    shirt: "#e24a3b",
    shorts: "#0f1b1a",
    socks: "#f06d4f",
    vest: "",
  });
  const [awayKit, setAwayKit] = useState({
    shirt: "#2f6cf6",
    shorts: "#0f1b1a",
    socks: "#f2f1e9",
    vest: "",
  });
  const [attachBallToPlayer, setAttachBallToPlayer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [sharedBoards, setSharedBoards] = useState<BoardShare[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const limits = getPlanLimits(plan);
  const projectCount = new Set(
    [...index.map((item) => item.id), project?.id].filter(Boolean)
  ).size;
  const projectLimitReached =
    Number.isFinite(limits.maxProjects) && projectCount >= limits.maxProjects;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const update = () => setIsOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!authUser || plan !== "PAID") {
      setSharedBoards([]);
      return;
    }
    if (typeof window !== "undefined" && !navigator.onLine) {
      setSharedError("Offline. Shared boards are unavailable.");
      return;
    }
    setSharedLoading(true);
    setSharedError(null);
    fetchSharedBoards()
      .then((result) => {
        if (!result.ok) {
          setSharedError(result.error);
          setSharedBoards([]);
          return;
        }
        setSharedBoards(result.shares);
      })
      .finally(() => setSharedLoading(false));
  }, [authUser, plan]);

  const onCreate = () => {
    if (!name.trim()) {
      return;
    }
    const limits = getPlanLimits(plan);
    const existingIds = new Set(index.map((item) => item.id));
    if (project) {
      existingIds.add(project.id);
    }
    if (existingIds.size >= limits.maxProjects) {
      setError("Project limit reached for this plan.");
      return;
    }
    createProject(name.trim(), {
      homeKit,
      awayKit,
      attachBallToPlayer,
    });
    setName("");
    setHomeKit({
      shirt: "#e24a3b",
      shorts: "#0f1b1a",
      socks: "#f06d4f",
      vest: "",
    });
    setAwayKit({
      shirt: "#2f6cf6",
      shorts: "#0f1b1a",
      socks: "#f2f1e9",
      vest: "",
    });
    setAttachBallToPlayer(false);
  };

  const onImport = async (file: File) => {
    if (!can(plan, "project.import")) {
      setError("Import is not available on this plan.");
      return;
    }
    const text = await file.text();
    const result = deserializeProject(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const project = result.project as Project;
    if (can(plan, "project.save")) {
      saveProject(project, authUser?.id ?? null);
    }
    openProject(project.id);
    setError(null);
  };

  return (
    <div className="h-screen overflow-y-auto px-8 py-12" data-scrollable>
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col gap-2">
          <span className="display-font text-xs uppercase tracking-[0.4em] text-[var(--accent-2)]">
            Tactics Board Web
          </span>
          <h1 className="display-font text-5xl text-[var(--ink-0)]">
            Project Console
          </h1>
          {!can(plan, "project.save") && (
            <div className="inline-flex w-fit rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--accent-1)]">
              Free mode - no save · Max {getPlanLimits(plan).maxProjects} project · Max{" "}
              {getPlanLimits(plan).maxBoards} boards
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
            <div className="rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1">
              Projects {projectCount}/
              {Number.isFinite(limits.maxProjects) ? limits.maxProjects : "inf"}
            </div>
            <div className="rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1">
              Boards {project?.boards?.length ?? 0}/
              {Number.isFinite(limits.maxBoards) ? limits.maxBoards : "inf"}
            </div>
            {authUser && (
              <div className="rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1 text-[var(--accent-2)]">
                {authUser.name}
              </div>
            )}
            <div
              className={`rounded-full border px-3 py-1 ${
                isOffline
                  ? "border-[var(--accent-1)] text-[var(--accent-1)]"
                  : "border-[var(--line)] text-[var(--ink-1)]"
              }`}
              title={
                isOffline
                  ? "Offline. Only projects saved on this device are available."
                  : "Online"
              }
            >
              <span className="inline-flex items-center gap-1">
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
                  {isOffline ? (
                    <>
                      <path d="M2 2l20 20" />
                      <path d="M4.5 8.5a12 12 0 0 1 15 1" />
                      <path d="M8 12a7 7 0 0 1 8.5 1.5" />
                      <path d="M12 16h.01" />
                    </>
                  ) : (
                    <>
                      <path d="M5 9.5a11 11 0 0 1 14 1" />
                      <path d="M8 13a6.5 6.5 0 0 1 8 1.5" />
                      <path d="M12 16h.01" />
                    </>
                  )}
                </svg>
                {isOffline ? "Offline" : "Online"}
              </span>
            </div>
            <button
              className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] uppercase tracking-widest hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              onClick={() => setPlanOpen(true)}
            >
              Account
            </button>
          </div>
          <p className="max-w-2xl text-sm text-[var(--ink-1)]">
            Create a new tactics project, resume from local storage, or import a
            JSON file.
          </p>
        </header>

        <section className="grid gap-6 rounded-3xl border border-[var(--line)] bg-[var(--panel)]/80 p-6 shadow-2xl shadow-black/40 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <h2 className="display-font text-xl text-[var(--accent-0)]">
              New Project
            </h2>
            <AdBanner />
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                className="h-12 flex-1 rounded-full border border-[var(--line)] bg-transparent px-4 text-sm text-[var(--ink-0)] placeholder:text-[var(--ink-1)] focus:outline-none"
                placeholder="Project name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <button
                className="h-12 rounded-full bg-[var(--accent-0)] px-6 text-sm font-semibold text-black transition hover:brightness-110"
                onClick={onCreate}
                disabled={projectLimitReached}
                data-locked={projectLimitReached}
                title={
                  projectLimitReached
                    ? "Project limit reached for this plan."
                    : "Create project"
                }
              >
                Create
              </button>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-4 text-xs text-[var(--ink-1)]">
              <p className="mb-3 text-[11px] uppercase">Project defaults</p>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <p className="text-[11px] uppercase text-[var(--ink-1)]">
                    Home kit
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2">
                      <span>Shirt</span>
                      <input
                        type="color"
                        value={homeKit.shirt}
                        onChange={(event) =>
                          setHomeKit((prev) => ({
                            ...prev,
                            shirt: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span>Shorts</span>
                      <input
                        type="color"
                        value={homeKit.shorts}
                        onChange={(event) =>
                          setHomeKit((prev) => ({
                            ...prev,
                            shorts: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span>Socks</span>
                      <input
                        type="color"
                        value={homeKit.socks}
                        onChange={(event) =>
                          setHomeKit((prev) => ({
                            ...prev,
                            socks: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>
                <div className="grid gap-2">
                  <p className="text-[11px] uppercase text-[var(--ink-1)]">
                    Away kit
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2">
                      <span>Shirt</span>
                      <input
                        type="color"
                        value={awayKit.shirt}
                        onChange={(event) =>
                          setAwayKit((prev) => ({
                            ...prev,
                            shirt: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span>Shorts</span>
                      <input
                        type="color"
                        value={awayKit.shorts}
                        onChange={(event) =>
                          setAwayKit((prev) => ({
                            ...prev,
                            shorts: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span>Socks</span>
                      <input
                        type="color"
                        value={awayKit.socks}
                        onChange={(event) =>
                          setAwayKit((prev) => ({
                            ...prev,
                            socks: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>
                <label className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-3 py-2 text-[11px]">
                  <span>Attach ball to player on drop</span>
                  <input
                    type="checkbox"
                    checked={attachBallToPlayer}
                    onChange={(event) =>
                      setAttachBallToPlayer(event.target.checked)
                    }
                  />
                </label>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-[var(--ink-1)]">
              <button
                className="rounded-full border border-[var(--line)] px-4 py-2 hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                onClick={loadSample}
                disabled={projectLimitReached}
                data-locked={projectLimitReached}
                title={
                  projectLimitReached
                    ? "Project limit reached for this plan."
                    : "Load sample project"
                }
              >
                Load sample project
              </button>
              <button
                className="rounded-full border border-[var(--line)] px-4 py-2 hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                onClick={() => fileRef.current?.click()}
                disabled={!can(plan, "project.import")}
                data-locked={!can(plan, "project.import")}
                title={
                  can(plan, "project.import")
                    ? "Import JSON"
                    : "Import is not available on this plan."
                }
              >
                Import JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    onImport(file);
                  }
                }}
              />
            </div>
            {error ? (
              <p className="text-xs text-[var(--accent-1)]">{error}</p>
            ) : null}
          </div>

          <div className="space-y-3">
            <h2 className="display-font text-xl text-[var(--accent-0)]">
              Recent Projects
            </h2>
            <div className="space-y-2">
              {index.length === 0 ? (
                <p className="text-sm text-[var(--ink-1)]">
                  No saved projects yet.
                </p>
              ) : (
                index.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--ink-0)]">
                        {project.name}
                      </p>
                      <p className="text-xs text-[var(--ink-1)]">
                        Updated {new Date(project.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                        onClick={() => {
                          if (typeof window !== "undefined" && !navigator.onLine) {
                            const cached = loadProject(project.id, authUser?.id ?? null);
                            if (!cached) {
                              setError(
                                "This project is not available offline yet. Reconnect to sync."
                              );
                              return;
                            }
                          }
                          setError(null);
                          openProject(project.id);
                        }}
                      >
                        Open
                      </button>
                      <button
                        className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete "${project.name}"? This cannot be undone.`
                            )
                          ) {
                            deleteProject(project.id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-6 space-y-2">
              <h3 className="display-font text-lg text-[var(--accent-0)]">
                Shared with me
              </h3>
              {!authUser || !can(plan, "board.share") ? (
                <p className="text-sm text-[var(--ink-1)]">
                  Sign in with sharing enabled to access shared boards.
                </p>
              ) : sharedLoading ? (
                <p className="text-sm text-[var(--ink-1)]">
                  Loading shared boards...
                </p>
              ) : sharedError ? (
                <p className="text-sm text-[var(--accent-1)]">
                  {sharedError}
                </p>
              ) : sharedBoards.length === 0 ? (
                <p className="text-sm text-[var(--ink-1)]">
                  No shared boards yet.
                </p>
              ) : (
                sharedBoards.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--ink-0)]">
                        {share.boardName}
                      </p>
                      <p className="text-xs text-[var(--ink-1)]">
                        {share.projectName} · {share.ownerEmail}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-[var(--ink-1)]">
                        {share.permission} access
                      </p>
                    </div>
                    <button
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                      onClick={() => openSharedBoard(share)}
                    >
                      Open
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
      <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} />
    </div>
  );
}
