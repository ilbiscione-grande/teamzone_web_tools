import type { Project, ProjectSummary } from "@/models";
import { supabase } from "@/utils/supabaseClient";
import {
  loadProject,
  loadProjectIndex,
  saveProject,
  saveProjectIndex,
} from "@/persistence/storage";

const TABLE = "projects";

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
    .select("data")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error || !data) {
    return null;
  }
  return data.data as Project;
};

export const saveProjectCloud = async (project: Project): Promise<boolean> => {
  if (!supabase) {
    return false;
  }
  const userId = await getUserId();
  if (!userId) {
    return false;
  }
  const payload = {
    id: project.id,
    user_id: userId,
    name: project.name,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
    data: project,
  };
  const { error } = await supabase.from(TABLE).upsert(payload, {
    onConflict: "id",
  });
  return !error;
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
  return !error;
};

const compareUpdatedAt = (a: string, b: string) => a.localeCompare(b);

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
  const cloudMap = new Map(cloudIndex.map((item) => [item.id, item]));
  const localMap = new Map(localIndex.map((item) => [item.id, item]));

  for (const local of localIndex) {
    const cloud = cloudMap.get(local.id);
    if (!cloud || compareUpdatedAt(local.updatedAt, cloud.updatedAt) > 0) {
      const project = loadProject(local.id, userId);
      if (project) {
        await saveProjectCloud(project);
      }
    }
  }

  for (const cloud of cloudIndex) {
    const local = localMap.get(cloud.id);
    if (!local || compareUpdatedAt(cloud.updatedAt, local.updatedAt) > 0) {
      const project = await fetchProjectCloud(cloud.id);
      if (project) {
        saveProject(project, userId);
      }
    }
  }

  const merged = new Map<string, ProjectSummary>();
  for (const item of localIndex) {
    merged.set(item.id, item);
  }
  for (const item of cloudIndex) {
    const existing = merged.get(item.id);
    if (!existing || compareUpdatedAt(item.updatedAt, existing.updatedAt) > 0) {
      merged.set(item.id, item);
    }
  }

  const mergedIndex = Array.from(merged.values()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
  saveProjectIndex(mergedIndex, userId);
  return mergedIndex;
};
