import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/admin/_utils";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const [bugReportsResult, boardReportsResult, projectReportsResult] =
    await Promise.all([
      admin.service
        .from("bug_reports")
        .select("id,created_at,report_type,user_email,project_name,board_name,body")
        .order("created_at", { ascending: false })
        .limit(300),
      admin.service
        .from("public_board_reports")
        .select(
          "id,created_at,reason,reporter_email,public_boards(title,board_name,project_name)"
        )
        .order("created_at", { ascending: false })
        .limit(100),
      admin.service
        .from("public_project_reports")
        .select(
          "id,created_at,reason,reporter_email,public_projects(title,project_name)"
        )
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  if (bugReportsResult.error) {
    return NextResponse.json({ error: bugReportsResult.error.message }, { status: 500 });
  }
  if (boardReportsResult.error) {
    return NextResponse.json({ error: boardReportsResult.error.message }, { status: 500 });
  }
  if (projectReportsResult.error) {
    return NextResponse.json({ error: projectReportsResult.error.message }, { status: 500 });
  }

  const bugReports = (bugReportsResult.data ?? []).map((row: any) => ({
    id: row.id,
    created_at: row.created_at,
    report_type: row.report_type,
    user_email: row.user_email,
    project_name: row.project_name,
    board_name: row.board_name,
    body: row.body,
    source: "bug_report",
  }));

  const boardReports = (boardReportsResult.data ?? []).map((row: any) => ({
    id: row.id,
    created_at: row.created_at,
    report_type: "public_board_report",
    user_email: row.reporter_email ?? null,
    project_name: row.public_boards?.project_name ?? null,
    board_name: row.public_boards?.title ?? row.public_boards?.board_name ?? null,
    body: row.reason,
    source: "public_board_report",
  }));

  const projectReports = (projectReportsResult.data ?? []).map((row: any) => ({
    id: row.id,
    created_at: row.created_at,
    report_type: "public_project_report",
    user_email: row.reporter_email ?? null,
    project_name: row.public_projects?.title ?? row.public_projects?.project_name ?? null,
    board_name: null,
    body: row.reason,
    source: "public_project_report",
  }));

  const reports = [...bugReports, ...boardReports, ...projectReports].sort((a, b) =>
    Date.parse(b.created_at) - Date.parse(a.created_at)
  );

  return NextResponse.json({ reports });
}
