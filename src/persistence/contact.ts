import { supabase } from "@/utils/supabaseClient";

export type ContactPayload = {
  plan: string;
  userEmail?: string | null;
  subject?: string;
  message: string;
  url?: string;
  userAgent?: string;
};

export const submitContactMessage = async (payload: ContactPayload) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { error } = await supabase.from("contact_messages").insert({
    plan: payload.plan,
    user_email: payload.userEmail ?? null,
    subject: payload.subject ?? null,
    message: payload.message,
    url: payload.url ?? null,
    user_agent: payload.userAgent ?? null,
  });
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true } as const;
};
