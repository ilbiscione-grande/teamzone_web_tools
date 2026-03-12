import type {
  Project,
  PublicProject,
  PublicProjectReport,
  PublicProjectStatus,
} from "@/models";
import { supabase } from "@/utils/supabaseClient";
import { recordNetworkCall } from "@/persistence/networkCounters";
import { validatePublicProjectPayload } from "@/persistence/sharePublishingValidation";

const PUBLIC_TABLE = "public_projects";
const REPORT_TABLE = "public_project_reports";
const PUBLIC_PROJECT_COLUMNS_MIN =
  "id,owner_id,owner_email,project_id,project_name,title,description,category,tags,status,created_at,updated_at";

type PublicProjectRow = {
  id: string;
  owner_id: string;
  owner_email: string;
  project_id: string;
  project_name: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  status: PublicProjectStatus;
  created_at: string;
  updated_at: string;
  project_data?: Project;
};

type PublicProjectReportRow = {
  id: string;
  project_id: string;
  reporter_id: string;
  reporter_email: string;
  reason: string;
  created_at: string;
};

const mapPublicProject = (row: PublicProjectRow): PublicProject => ({
  id: row.id,
  ownerId: row.owner_id,
  ownerEmail: row.owner_email,
  projectId: row.project_id,
  projectName: row.project_name,
  title: row.title,
  description: row.description ?? "",
  category: row.category ?? "",
  tags: row.tags ?? [],
  status: row.status as PublicProjectStatus,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  projectData: row.project_data,
});

const mapReport = (row: PublicProjectReportRow): PublicProjectReport => ({
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
    .select(PUBLIC_PROJECT_COLUMNS_MIN)
    .order("updated_at", { ascending: false });
  recordNetworkCall("supabase.public_projects.list", !error);
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
    .select(PUBLIC_PROJECT_COLUMNS_MIN)
    .eq("project_id", projectId)
    .eq("owner_id", userData.user.id)
    .maybeSingle();
  recordNetworkCall("supabase.public_projects.by_owner_project", !error);
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true, project: data ? mapPublicProject(data) : null } as const;
};

export const publishPublicProject = async (payload: {
  project: Project;
  title: string;
  description: string;
  category: string;
  tags: string[];
}) => {
  const validated = validatePublicProjectPayload(payload);
  if (!validated.ok) {
    return validated;
  }
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
        title: validated.value.title,
        description: validated.value.description,
        category: validated.value.category,
        tags: validated.value.tags,
        status: "unverified",
        project_data: payload.project,
      },
      { onConflict: "owner_id,project_id" }
    )
    .select(PUBLIC_PROJECT_COLUMNS_MIN)
    .single();
  recordNetworkCall("supabase.public_projects.publish", !error);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to publish." } as const;
  }
  return { ok: true, project: mapPublicProject(data) } as const;
};
const PUBLIC_PROJECT_REPORT_COLUMNS =
  "id,project_id,reporter_id,reporter_email,reason,created_at";

export const fetchPublicProjectData = async (publicId: string) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data, error } = await supabase
    .from(PUBLIC_TABLE)
    .select("project_data")
    .eq("id", publicId)
    .maybeSingle<{ project_data: Project }>();
  recordNetworkCall("supabase.public_projects.get_data", !error);
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  if (!data?.project_data) {
    return { ok: false, error: "Project data not found." } as const;
  }
  return { ok: true, projectData: data.project_data } as const;
};

export const unpublishPublicProject = async (publicId: string) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { error } = await supabase.from(PUBLIC_TABLE).delete().eq("id", publicId);
  recordNetworkCall("supabase.public_projects.unpublish", !error);
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
    .select(PUBLIC_PROJECT_REPORT_COLUMNS)
    .single();
  recordNetworkCall("supabase.public_project_reports.create", !error);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to report." } as const;
  }
  return { ok: true, report: mapReport(data) } as const;
};
