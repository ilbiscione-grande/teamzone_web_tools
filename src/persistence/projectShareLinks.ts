import { supabase } from "@/utils/supabaseClient";
import type { Project } from "@/models";
import { createId } from "@/utils/id";

const TABLE = "project_share_links";

type ProjectShareRow = {
  id: string;
  token: string;
  user_id: string;
  project_id: string;
  project_name: string;
  project_data: Project;
  created_at: string;
};

export const createProjectShareLink = async (project: Project) => {
  if (!supabase) {
    return { ok: false as const, error: "Supabase not configured." };
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return { ok: false as const, error: "Not authenticated." };
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userData.user.id)
    .maybeSingle<{ plan: string }>();
  if (profileError || !profile?.plan) {
    return { ok: false as const, error: "Unable to verify plan." };
  }
  if (profile.plan !== "PAID") {
    return {
      ok: false as const,
      error: "Paid plan required to create share links.",
    };
  }
  const { data: existing, error: existingError } = await supabase
    .from(TABLE)
    .select("id, token")
    .eq("project_id", project.id)
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (existingError) {
    return {
      ok: false as const,
      error: existingError.message || "Failed to check existing share link.",
    };
  }
  const existingRow = Array.isArray(existing) ? existing[0] : undefined;
  const token = existingRow?.token ?? createId();
  if (existingRow?.id) {
    const { error: deleteError } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", existingRow.id)
      .eq("user_id", userData.user.id);
    if (deleteError) {
      return {
        ok: false as const,
        error: deleteError.message || "Failed to update share link.",
      };
    }
  }
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      token,
      user_id: userData.user.id,
      project_id: project.id,
      project_name: project.name,
      project_data: project,
    })
    .select("token")
    .single();
  if (error || !data) {
    return { ok: false as const, error: error?.message ?? "Failed to share." };
  }
  return { ok: true as const, token: data.token as string };
};

export const fetchProjectShareLink = async (token: string) => {
  if (!supabase) {
    return { ok: false as const, error: "Supabase not configured." };
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, token, project_id, project_name, project_data, created_at")
    .eq("token", token)
    .maybeSingle<ProjectShareRow>();
  if (error) {
    return {
      ok: false as const,
      error: error.message || "Unable to fetch share link.",
    };
  }
  if (!data) {
    return { ok: false as const, error: "Share link not found." };
  }
  return {
    ok: true as const,
    project: data.project_data,
    projectName: data.project_name,
    createdAt: data.created_at,
  };
};
