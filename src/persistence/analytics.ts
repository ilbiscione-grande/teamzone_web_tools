import { supabase } from "@/utils/supabaseClient";
import type { Tool } from "@/state/useEditorStore";

export type AnalyticsEventPayload = {
  eventType:
    | "login"
    | "session_start"
    | "session_heartbeat"
    | "session_end"
    | "tool_selected";
  tool?: Tool;
  durationMs?: number;
  sessionKey?: string;
  path?: string;
  metadata?: Record<string, unknown>;
};

const getAccessToken = async () => {
  if (!supabase) {
    return null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

export const trackAnalyticsEvent = async (
  payload: AnalyticsEventPayload,
  options?: { keepalive?: boolean }
) => {
  const token = await getAccessToken();
  if (!token) {
    return;
  }
  try {
    await fetch("/api/analytics/ingest", {
      method: "POST",
      keepalive: options?.keepalive ?? false,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Intentionally ignore analytics transport errors.
  }
};
