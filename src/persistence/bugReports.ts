import { supabase } from "@/utils/supabaseClient";

export type BugReportType = "bug" | "feedback" | "suggestion";

export type BugReportPayload = {
  context: "console" | "board";
  plan: string;
  reportType?: BugReportType;
  userEmail?: string | null;
  projectName?: string | null;
  boardName?: string | null;
  url?: string | null;
  userAgent?: string | null;
  body: string;
};

export type BugReportRow = {
  id: string;
  created_at: string;
  context: "console" | "board";
  plan: string;
  report_type: BugReportType;
  user_email: string | null;
  project_name: string | null;
  board_name: string | null;
  url: string | null;
  user_agent: string | null;
  body: string;
};

export const submitBugReport = async (payload: BugReportPayload) => {
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." } as const;
  }
  const { error } = await supabase.from("bug_reports").insert({
    context: payload.context,
    plan: payload.plan,
    report_type: payload.reportType ?? "bug",
    user_email: payload.userEmail ?? null,
    project_name: payload.projectName ?? null,
    board_name: payload.boardName ?? null,
    url: payload.url ?? null,
    user_agent: payload.userAgent ?? null,
    body: payload.body,
  });
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true } as const;
};

export const fetchBugReports = async (limit = 200) => {
  if (!supabase) {
    return { ok: false as const, error: "Supabase is not configured." };
  }
  const { data, error } = await supabase
    .from("bug_reports")
    .select(
      "id,created_at,context,plan,report_type,user_email,project_name,board_name,url,user_agent,body"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const, reports: (data ?? []) as BugReportRow[] };
};
