import { supabase } from "@/utils/supabaseClient";
import type { BugReportRow } from "@/persistence/bugReports";

export type AdminUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  plan: string;
  betaUser: boolean;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
};

const getAccessToken = async () => {
  if (!supabase) {
    return null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

const adminFetch = async (path: string, init?: RequestInit) => {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { ok: false as const, error: "Not authenticated." };
  }
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    users?: AdminUserRow[];
    reports?: BugReportRow[];
    networkCounters?: {
      key: string;
      calls: number;
      ok: number;
      error: number;
      errorRate: number;
    }[];
  };
  if (!response.ok) {
    return {
      ok: false as const,
      error: payload.error ?? "Request failed.",
    };
  }
  return { ok: true as const, payload };
};

export const fetchAdminUsers = async () => {
  const result = await adminFetch("/api/admin/users");
  if (!result.ok) {
    return result;
  }
  return { ok: true as const, users: result.payload.users ?? [] };
};

export const updateAdminUserFlags = async (payload: {
  id: string;
  betaUser?: boolean;
  isAdmin?: boolean;
}) => {
  const result = await adminFetch("/api/admin/users", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!result.ok) {
    return result;
  }
  return { ok: true as const };
};

export const fetchAdminReports = async () => {
  const result = await adminFetch("/api/admin/reports");
  if (!result.ok) {
    return result;
  }
  return { ok: true as const, reports: result.payload.reports ?? [] };
};

export type AdminAnalyticsSummary = {
  totalEvents: number;
  activeUsers30d: number;
  loginCount30d: number;
  averageSessionMinutes: number;
  totalHours30d: number;
};

export type AdminAnalyticsResponse = {
  summary: AdminAnalyticsSummary;
  toolUsage: { tool: string; count: number }[];
  loginMethods: { method: string; count: number }[];
  dailyActivity: { day: string; events: number; activeUsers: number }[];
  recentLogins: {
    at: string;
    userEmail: string | null;
    provider: string;
    path: string;
    device: string;
  }[];
  networkCounters: {
    key: string;
    calls: number;
    ok: number;
    error: number;
    errorRate: number;
  }[];
};

export const fetchAdminAnalytics = async () => {
  const result = await adminFetch("/api/admin/analytics");
  if (!result.ok) {
    return result;
  }
  const analytics = result.payload as Partial<AdminAnalyticsResponse>;
  return {
    ok: true as const,
    analytics: {
      summary: analytics.summary ?? {
        totalEvents: 0,
        activeUsers30d: 0,
        loginCount30d: 0,
        averageSessionMinutes: 0,
        totalHours30d: 0,
      },
      toolUsage: analytics.toolUsage ?? [],
      loginMethods: analytics.loginMethods ?? [],
      dailyActivity: analytics.dailyActivity ?? [],
      recentLogins: analytics.recentLogins ?? [],
      networkCounters: analytics.networkCounters ?? [],
    } satisfies AdminAnalyticsResponse,
  };
};
