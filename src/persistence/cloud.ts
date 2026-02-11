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

  return {
    ...base,
    boards,
  };
};

export const saveProjectCloud = async (project: Project): Promise<boolean> => {
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

  const { error: clearBoardsError } = await supabase
    .from(BOARDS_TABLE)
    .delete()
    .eq("project_id", project.id)
    .eq("user_id", userId);
  if (clearBoardsError) {
    return false;
  }

  if (project.boards.length > 0) {
    const boardPayloads = project.boards.map((board, index) => ({
      id: board.id,
      project_id: project.id,
      user_id: userId,
      board_name: board.name,
      order_index: index,
      updated_at: project.updatedAt,
      board_data: board,
    }));

    const { error: insertBoardsError } = await supabase
      .from(BOARDS_TABLE)
      .insert(boardPayloads);
    if (insertBoardsError) {
      return false;
    }
  }

  return true;
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
