import { supabase } from "@/utils/supabaseClient";
import type { Project } from "@/models";
import { createId } from "@/utils/id";
import { hasEffectivePaidAccess, type ProfilePlanSnapshot } from "@/utils/effectivePlan";
import { recordNetworkCall } from "@/persistence/networkCounters";

const TABLE = "project_share_links";

type ProjectShareRow = {
  id: string;
  token: string;
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
    .select("plan,manual_paid_override")
    .eq("id", userData.user.id)
    .maybeSingle<ProfilePlanSnapshot>();
  recordNetworkCall("supabase.profiles.plan_check", !profileError);
  if (profileError || !profile) {
    return { ok: false as const, error: "Unable to verify plan." };
  }
  if (!hasEffectivePaidAccess(profile)) {
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
  recordNetworkCall("supabase.project_share_links.by_owner_project", !existingError);
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
    recordNetworkCall("supabase.project_share_links.replace_delete", !deleteError);
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
  recordNetworkCall("supabase.project_share_links.create", !error);
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
    .rpc("get_project_share_link", { p_token: token })
    .maybeSingle<ProjectShareRow>();
  recordNetworkCall("supabase.project_share_links.get_by_token", !error);
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

export const fetchProjectShareLinkForOwner = async (projectId: string) => {
  if (!supabase) {
    return { ok: false as const, error: "Supabase not configured." };
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return { ok: false as const, error: "Not authenticated." };
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select("token, created_at")
    .eq("project_id", projectId)
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ token: string; created_at: string }>();
  recordNetworkCall("supabase.project_share_links.owner_existing", !error);
  if (error) {
    return {
      ok: false as const,
      error: error.message || "Unable to fetch existing share link.",
    };
  }
  if (!data?.token) {
    return { ok: true as const, token: null as string | null };
  }
  return {
    ok: true as const,
    token: data.token,
    createdAt: data.created_at,
  };
};
