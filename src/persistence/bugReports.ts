import { supabase } from "@/utils/supabaseClient";

export type BugReportPayload = {
  context: "console" | "board";
  plan: string;
  userEmail?: string | null;
  projectName?: string | null;
  boardName?: string | null;
  url?: string | null;
  userAgent?: string | null;
  body: string;
};

export const submitBugReport = async (payload: BugReportPayload) => {
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." } as const;
  }
  const { error } = await supabase.from("bug_reports").insert({
    context: payload.context,
    plan: payload.plan,
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
