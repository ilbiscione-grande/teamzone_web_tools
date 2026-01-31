import type {
  Project,
  PublicProject,
  PublicProjectReport,
  PublicProjectStatus,
} from "@/models";
import { supabase } from "@/utils/supabaseClient";

const PUBLIC_TABLE = "public_projects";
const REPORT_TABLE = "public_project_reports";

const mapPublicProject = (row: any): PublicProject => ({
  id: row.id,
  ownerId: row.owner_id,
  ownerEmail: row.owner_email,
  projectId: row.project_id,
  projectName: row.project_name,
  title: row.title,
  description: row.description ?? "",
  tags: row.tags ?? [],
  status: row.status as PublicProjectStatus,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  projectData: row.project_data as Project,
});

const mapReport = (row: any): PublicProjectReport => ({
  id: row.id,
  projectId: row.project_id,
  reporterId: row.reporter_id,
  reporterEmail: row.reporter_email,
  reason: row.reason,
  createdAt: row.created_at,
});

export const fetchPublicProjects = async () => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data, error } = await supabase
    .from(PUBLIC_TABLE)
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true, projects: (data ?? []).map(mapPublicProject) } as const;
};

export const fetchPublicProjectForOwner = async (projectId: string) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, error: "Please sign in." } as const;
  }
  const { data, error } = await supabase
    .from(PUBLIC_TABLE)
    .select("*")
    .eq("project_id", projectId)
    .eq("owner_id", userData.user.id)
    .maybeSingle();
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true, project: data ? mapPublicProject(data) : null } as const;
};

export const publishPublicProject = async (payload: {
  project: Project;
  title: string;
  description: string;
  tags: string[];
}) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, error: "Please sign in to publish." } as const;
  }
  const ownerId = userData.user.id;
  const ownerEmail = userData.user.email ?? "";
  const { data, error } = await supabase
    .from(PUBLIC_TABLE)
    .upsert(
      {
        owner_id: ownerId,
        owner_email: ownerEmail,
        project_id: payload.project.id,
        project_name: payload.project.name,
        title: payload.title,
        description: payload.description,
        tags: payload.tags,
        status: "unverified",
        project_data: payload.project,
      },
      { onConflict: "owner_id,project_id" }
    )
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to publish." } as const;
  }
  return { ok: true, project: mapPublicProject(data) } as const;
};

export const unpublishPublicProject = async (publicId: string) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { error } = await supabase.from(PUBLIC_TABLE).delete().eq("id", publicId);
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true } as const;
};

export const reportPublicProject = async (payload: {
  projectId: string;
  reason: string;
}) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, error: "Please sign in to report." } as const;
  }
  const { data, error } = await supabase
    .from(REPORT_TABLE)
    .insert({
      project_id: payload.projectId,
      reporter_id: userData.user.id,
      reporter_email: userData.user.email ?? "",
      reason: payload.reason,
    })
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to report." } as const;
  }
  return { ok: true, report: mapReport(data) } as const;
};
