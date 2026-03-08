import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/admin/_utils";

type AnalyticsEvent = {
  created_at: string;
  user_id: string;
  user_email: string | null;
  event_type: string;
  tool: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown> | null;
};

type NetworkCounterEntry = {
  calls: number;
  ok: number;
  error: number;
};

type NetworkCounterAggregate = NetworkCounterEntry & {
  key: string;
  errorRate: number;
};

const toDayKey = (value: string) => value.slice(0, 10);

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin.service
    .from("app_analytics_events")
    .select("created_at,user_id,user_email,event_type,tool,duration_ms,metadata")
    .gte("created_at", sinceDate)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data ?? []) as AnalyticsEvent[];
  const totalEvents = events.length;
  const loginEvents = events.filter((event) => event.event_type === "login");
  const toolEvents = events.filter((event) => event.event_type === "tool_selected");
  const sessionEndEvents = events.filter(
    (event) => event.event_type === "session_end" && (event.duration_ms ?? 0) > 0
  );

  const activeUsers = new Set(events.map((event) => event.user_id)).size;
  const totalSessionMs = sessionEndEvents.reduce(
    (sum, event) => sum + (event.duration_ms ?? 0),
    0
  );
  const averageSessionMs = sessionEndEvents.length
    ? Math.round(totalSessionMs / sessionEndEvents.length)
    : 0;

  const toolUsageMap = new Map<string, number>();
  for (const event of toolEvents) {
    if (!event.tool) {
      continue;
    }
    toolUsageMap.set(event.tool, (toolUsageMap.get(event.tool) ?? 0) + 1);
  }
  const toolUsage = Array.from(toolUsageMap.entries())
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const loginMethodMap = new Map<string, number>();
  for (const event of loginEvents) {
    const provider = String(event.metadata?.provider ?? "unknown");
    loginMethodMap.set(provider, (loginMethodMap.get(provider) ?? 0) + 1);
  }
  const loginMethods = Array.from(loginMethodMap.entries())
    .map(([method, count]) => ({ method, count }))
    .sort((a, b) => b.count - a.count);

  const dailyMap = new Map<string, { events: number; users: Set<string> }>();
  for (const event of events) {
    const day = toDayKey(event.created_at);
    const bucket = dailyMap.get(day) ?? { events: 0, users: new Set<string>() };
    bucket.events += 1;
    bucket.users.add(event.user_id);
    dailyMap.set(day, bucket);
  }
  const dailyActivity = Array.from(dailyMap.entries())
    .map(([day, value]) => ({
      day,
      events: value.events,
      activeUsers: value.users.size,
    }))
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-14);

  const recentLogins = loginEvents.slice(0, 50).map((event) => ({
    at: event.created_at,
    userEmail: event.user_email,
    provider: String(event.metadata?.provider ?? "unknown"),
    path: String(event.metadata?.path ?? ""),
    device: String(event.metadata?.device ?? ""),
  }));

  const networkCounterMap = new Map<string, NetworkCounterEntry>();
  for (const event of events) {
    const raw = event.metadata?.networkCounters;
    if (!raw || typeof raw !== "object") {
      continue;
    }
    for (const [key, value] of Object.entries(raw)) {
      if (!value || typeof value !== "object") {
        continue;
      }
      const calls = Number((value as { calls?: unknown }).calls ?? 0);
      const ok = Number((value as { ok?: unknown }).ok ?? 0);
      const error = Number((value as { error?: unknown }).error ?? 0);
      if (!Number.isFinite(calls) && !Number.isFinite(ok) && !Number.isFinite(error)) {
        continue;
      }
      const previous = networkCounterMap.get(key) ?? { calls: 0, ok: 0, error: 0 };
      previous.calls += Number.isFinite(calls) ? Math.max(0, Math.round(calls)) : 0;
      previous.ok += Number.isFinite(ok) ? Math.max(0, Math.round(ok)) : 0;
      previous.error += Number.isFinite(error) ? Math.max(0, Math.round(error)) : 0;
      networkCounterMap.set(key, previous);
    }
  }
  const networkCounters: NetworkCounterAggregate[] = Array.from(
    networkCounterMap.entries()
  )
    .map(([key, value]) => ({
      key,
      ...value,
      errorRate: value.calls > 0 ? Number(((value.error / value.calls) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 30);

  return NextResponse.json({
    summary: {
      totalEvents,
      activeUsers30d: activeUsers,
      loginCount30d: loginEvents.length,
      averageSessionMinutes: Number((averageSessionMs / 60000).toFixed(1)),
      totalHours30d: Number((totalSessionMs / 3600000).toFixed(1)),
    },
    toolUsage,
    loginMethods,
    dailyActivity,
    recentLogins,
    networkCounters,
  });
}
