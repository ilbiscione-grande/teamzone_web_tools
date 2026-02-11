import type { Board, Project, ProjectSummary } from "@/models";
import { supabase } from "@/utils/supabaseClient";
import {
  loadProject,
  loadProjectIndex,
  saveProject,
  saveProjectIndex,
} from "@/persistence/storage";

const TABLE = "projects";
const BOARDS_TABLE = "project_boards";
const SESSION_KEY_STORAGE = "tacticsboard:sessionKey";
const saveQueueByProject = new Map<string, Promise<boolean>>();
const pendingByProject = new Map<string, Project>();
type BoardSyncSnapshot = {
  signature: string;
  orderIndex: number;
};
const boardCacheByProject = new Map<string, Map<string, BoardSyncSnapshot>>();
const sessionTouchByUser = new Map<string, number>();

const getUserId = async () => {
  if (!supabase) {
    return null;
  }
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

const toSummary = (row: {
  id: string;
  name: string;
  updated_at: string | null;
  created_at: string | null;
}): ProjectSummary => ({
  id: row.id,
  name: row.name,
  updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
});

const boardSignature = (board: Board) => JSON.stringify(board);

const getCurrentSessionKey = async (userId: string) => {
  if (typeof window !== "undefined") {
    const cached = window.localStorage.getItem(SESSION_KEY_STORAGE);
    if (cached && cached.startsWith(`${userId}:`)) {
      return cached;
    }
  }
  if (!supabase) {
    return null;
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return null;
  }
  const sessionKey = `${userId}:${token.slice(-48)}`;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SESSION_KEY_STORAGE, sessionKey);
  }
  return sessionKey;
};

export const touchSessionActivityCloud = async (): Promise<void> => {
  if (!supabase) {
    return;
  }
  const userId = await getUserId();
  if (!userId) {
    return;
  }
  const now = Date.now();
  const lastTouch = sessionTouchByUser.get(userId) ?? 0;
  if (now - lastTouch < 60_000) {
    return;
  }
  if (typeof window !== "undefined" && !window.navigator.onLine) {
    return;
  }
  const sessionKey = await getCurrentSessionKey(userId);
  if (!sessionKey) {
    return;
  }
  sessionTouchByUser.set(userId, now);
  await supabase.from("user_sessions").upsert(
    {
      user_id: userId,
      session_key: sessionKey,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
};

export const fetchProjectIndexCloud = async (): Promise<ProjectSummary[]> => {
  if (!supabase) {
    return [];
  }
  const userId = await getUserId();
  if (!userId) {
    return [];
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,name,updated_at,created_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return data.map(toSummary);
};

export const fetchProjectCloud = async (id: string): Promise<Project | null> => {
  if (!supabase) {
    return null;
  }
  const userId = await getUserId();
  if (!userId) {
    return null;
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,name,created_at,updated_at,data")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error || !data) {
    return null;
  }
  const base = data.data as Project;

  const { data: boardRows, error: boardsError } = await supabase
    .from(BOARDS_TABLE)
    .select("id,board_name,order_index,updated_at,board_data")
    .eq("project_id", id)
    .eq("user_id", userId)
    .order("order_index", { ascending: true });

  // Backward compatibility: if board rows are missing, keep boards from legacy project payload.
  if (boardsError || !boardRows || boardRows.length === 0) {
    return base;
  }

  const boards = boardRows.map((row) => {
    const parsed = row.board_data as Board;
    return {
      ...parsed,
      id: parsed.id || row.id,
      name: parsed.name || row.board_name,
    };
  });

  const cached = new Map<string, BoardSyncSnapshot>();
  boards.forEach((board, index) => {
    cached.set(board.id, { signature: boardSignature(board), orderIndex: index });
  });
  boardCacheByProject.set(id, cached);

  return {
    ...base,
    boards,
  };
};

const saveProjectCloudNow = async (project: Project): Promise<boolean> => {
  if (!supabase) {
    return false;
  }
  const userId = await getUserId();
  if (!userId) {
    return false;
  }
  const projectPayload = {
    ...project,
    // Boards are stored in the dedicated table to keep project rows small.
    boards: [],
  };

  const payload = {
    id: project.id,
    user_id: userId,
    name: project.name,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
    data: projectPayload,
  };
  const { error } = await supabase.from(TABLE).upsert(payload, {
    onConflict: "id",
  });
  if (error) {
    return false;
  }

  const previous = boardCacheByProject.get(project.id) ?? new Map();
  const next = new Map<string, BoardSyncSnapshot>();

  const changedPayloads = project.boards
    .map((board, index) => {
      const signature = boardSignature(board);
      const snapshot: BoardSyncSnapshot = { signature, orderIndex: index };
      next.set(board.id, snapshot);
      const prev = previous.get(board.id);
      if (
        prev &&
        prev.signature === snapshot.signature &&
        prev.orderIndex === snapshot.orderIndex
      ) {
        return null;
      }
      return {
        id: board.id,
        project_id: project.id,
        user_id: userId,
        board_name: board.name,
        order_index: index,
        updated_at: project.updatedAt,
        board_data: board,
      };
    })
    .filter((item) => item !== null);

  if (changedPayloads.length > 0) {
    const { error: upsertBoardsError } = await supabase
      .from(BOARDS_TABLE)
      .upsert(changedPayloads, { onConflict: "id" });
    if (upsertBoardsError) {
      return false;
    }
  }

  const removedIds = Array.from(previous.keys()).filter((id) => !next.has(id));
  if (removedIds.length > 0) {
    const { error: removeBoardsError } = await supabase
      .from(BOARDS_TABLE)
      .delete()
      .eq("project_id", project.id)
      .eq("user_id", userId)
      .in("id", removedIds);
    if (removeBoardsError) {
      return false;
    }
  }

  boardCacheByProject.set(project.id, next);

  return true;
};

export const saveProjectCloud = async (project: Project): Promise<boolean> => {
  pendingByProject.set(project.id, project);
  const existing = saveQueueByProject.get(project.id);
  if (existing) {
    return existing;
  }

  const run = (async () => {
    let ok = true;
    try {
      while (true) {
        const next = pendingByProject.get(project.id);
        if (!next) {
          break;
        }
        pendingByProject.delete(project.id);
        const stepOk = await saveProjectCloudNow(next);
        ok = ok && stepOk;
      }
      return ok;
    } finally {
      saveQueueByProject.delete(project.id);
    }
  })();

  saveQueueByProject.set(project.id, run);
  return run;
};

export const deleteProjectCloud = async (id: string): Promise<boolean> => {
  if (!supabase) {
    return false;
  }
  const userId = await getUserId();
  if (!userId) {
    return false;
  }
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    return false;
  }
  const { error: boardsError } = await supabase
    .from(BOARDS_TABLE)
    .delete()
    .eq("project_id", id)
    .eq("user_id", userId);
  boardCacheByProject.delete(id);
  return !boardsError;
};

const compareUpdatedAt = (a: string, b: string) => a.localeCompare(b);

const safeTimestamp = (value: string | null | undefined) => {
  const ts = Date.parse(value ?? "");
  return Number.isFinite(ts) ? ts : -1;
};

const getProjectShapeScore = (project: Project) => {
  let frames = 0;
  let objects = 0;
  for (const board of project.boards ?? []) {
    frames += board.frames?.length ?? 0;
    for (const frame of board.frames ?? []) {
      objects += frame.objects?.length ?? 0;
    }
  }
  return {
    boards: project.boards?.length ?? 0,
    frames,
    objects,
  };
};

const chooseBestProject = (local: Project | null, cloud: Project | null) => {
  if (local && !cloud) {
    return local;
  }
  if (cloud && !local) {
    return cloud;
  }
  if (!local && !cloud) {
    return null;
  }
  const localProject = local as Project;
  const cloudProject = cloud as Project;

  const localTs = safeTimestamp(localProject.updatedAt ?? localProject.createdAt);
  const cloudTs = safeTimestamp(cloudProject.updatedAt ?? cloudProject.createdAt);

  if (localTs > cloudTs) {
    return localProject;
  }
  if (cloudTs > localTs) {
    return cloudProject;
  }

  const localShape = getProjectShapeScore(localProject);
  const cloudShape = getProjectShapeScore(cloudProject);

  if (localShape.boards !== cloudShape.boards) {
    return localShape.boards > cloudShape.boards ? localProject : cloudProject;
  }
  if (localShape.frames !== cloudShape.frames) {
    return localShape.frames > cloudShape.frames ? localProject : cloudProject;
  }
  if (localShape.objects !== cloudShape.objects) {
    return localShape.objects > cloudShape.objects ? localProject : cloudProject;
  }

  return localProject;
};

const sameProjectShape = (a: Project, b: Project) => {
  const aShape = getProjectShapeScore(a);
  const bShape = getProjectShapeScore(b);
  return (
    (a.updatedAt ?? "") === (b.updatedAt ?? "") &&
    aShape.boards === bShape.boards &&
    aShape.frames === bShape.frames &&
    aShape.objects === bShape.objects
  );
};

export const syncProjects = async (): Promise<ProjectSummary[]> => {
  if (!supabase) {
    return loadProjectIndex();
  }
  const userId = await getUserId();
  if (!userId) {
    return loadProjectIndex();
  }

  const localIndex = loadProjectIndex(userId);
  const cloudIndex = await fetchProjectIndexCloud();
  const localIdSet = new Set(localIndex.map((item) => item.id));
  const cloudIdSet = new Set(cloudIndex.map((item) => item.id));
  const allIds = new Set<string>([...localIdSet, ...cloudIdSet]);

  const summaries: ProjectSummary[] = [];

  for (const id of allIds) {
    const localProject = loadProject(id, userId);
    const cloudProject = cloudIdSet.has(id) ? await fetchProjectCloud(id) : null;
    const best = chooseBestProject(localProject, cloudProject);

    if (!best) {
      continue;
    }

    if (!localProject || !sameProjectShape(localProject, best)) {
      saveProject(best, userId);
    }
    if (!cloudProject || !sameProjectShape(cloudProject, best)) {
      await saveProjectCloud(best);
    }

    summaries.push({
      id: best.id,
      name: best.name,
      updatedAt: best.updatedAt ?? best.createdAt ?? new Date().toISOString(),
    });
  }

  const mergedIndex = summaries.sort((a, b) =>
    compareUpdatedAt(b.updatedAt, a.updatedAt)
  );
  saveProjectIndex(mergedIndex, userId);
  return mergedIndex;
};
