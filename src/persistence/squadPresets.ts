import { supabase } from "@/utils/supabaseClient";
import type { Squad, SquadPreset } from "@/models";

const TABLE = "squad_presets";

const mapPreset = (row: {
  id: string;
  user_id: string;
  name: string;
  squad_data: Squad;
  created_at: string;
  updated_at: string;
}): SquadPreset => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  squad: row.squad_data,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const fetchSquadPresets = async () => {
  if (!supabase) {
    return { ok: false as const, error: "Supabase not configured." };
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return { ok: false as const, error: "Not authenticated." };
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, user_id, name, squad_data, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) {
    return { ok: false as const, error: error.message };
  }
  return {
    ok: true as const,
    presets: (data ?? []).map(mapPreset),
  };
};

export const createSquadPreset = async (payload: {
  name: string;
  squad: Squad;
}) => {
  if (!supabase) {
    return { ok: false as const, error: "Supabase not configured." };
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return { ok: false as const, error: "Not authenticated." };
  }
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userData.user.id,
      name: payload.name,
      squad_data: payload.squad,
    })
    .select("id, user_id, name, squad_data, created_at, updated_at")
    .single();
  if (error) {
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const, preset: mapPreset(data) };
};

export const updateSquadPreset = async (payload: {
  id: string;
  name?: string;
  squad?: Squad;
}) => {
  if (!supabase) {
    return { ok: false as const, error: "Supabase not configured." };
  }
  const update: Record<string, unknown> = {};
  if (payload.name) {
    update.name = payload.name;
  }
  if (payload.squad) {
    update.squad_data = payload.squad;
  }
  if (Object.keys(update).length === 0) {
    return { ok: false as const, error: "Nothing to update." };
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update(update)
    .eq("id", payload.id)
    .select("id, user_id, name, squad_data, created_at, updated_at")
    .single();
  if (error) {
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const, preset: mapPreset(data) };
};

export const deleteSquadPreset = async (presetId: string) => {
  if (!supabase) {
    return { ok: false as const, error: "Supabase not configured." };
  }
  const { error } = await supabase.from(TABLE).delete().eq("id", presetId);
  if (error) {
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const };
};
