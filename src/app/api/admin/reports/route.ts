import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/admin/_utils";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { data, error } = await admin.service
    .from("bug_reports")
    .select(
      "id,created_at,context,plan,report_type,user_email,project_name,board_name,url,user_agent,body"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reports: data ?? [] });
}
