import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AnalyticsPayload = {
  eventType?: string;
  tool?: string | null;
  durationMs?: number | null;
  sessionKey?: string | null;
  path?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase configuration." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  if (!accessToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as AnalyticsPayload;
  const eventType = String(body?.eventType ?? "").trim().toLowerCase();
  if (!eventType) {
    return NextResponse.json({ error: "Missing eventType." }, { status: 400 });
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { error } = await service.from("app_analytics_events").insert({
    user_id: userData.user.id,
    user_email: userData.user.email ?? null,
    session_key: body?.sessionKey ?? null,
    event_type: eventType,
    tool: body?.tool ?? null,
    duration_ms:
      typeof body?.durationMs === "number" && Number.isFinite(body.durationMs)
        ? Math.max(0, Math.round(body.durationMs))
        : null,
    path: body?.path ?? null,
    metadata: body?.metadata ?? {},
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
