import type {
  Board,
  PublicBoard,
  PublicBoardReport,
  PublicBoardStatus,
  Project,
  SharedBoardSnapshot,
} from "@/models";
import { supabase } from "@/utils/supabaseClient";

const PUBLIC_TABLE = "public_boards";
const REPORT_TABLE = "public_board_reports";

const mapPublicBoard = (row: any): PublicBoard => ({
  id: row.id,
  ownerId: row.owner_id,
  ownerEmail: row.owner_email,
  boardId: row.board_id,
  boardName: row.board_name,
  projectName: row.project_name,
  title: row.title,
  description: row.description ?? "",
  tags: row.tags ?? [],
  formation: row.formation ?? null,
  status: row.status as PublicBoardStatus,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  boardData: row.board_data as SharedBoardSnapshot,
});

const mapReport = (row: any): PublicBoardReport => ({
  id: row.id,
  boardId: row.board_id,
  reporterId: row.reporter_id,
  reporterEmail: row.reporter_email,
  reason: row.reason,
  createdAt: row.created_at,
});

export const fetchPublicBoards = async () => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data, error } = await supabase
    .from(PUBLIC_TABLE)
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true, boards: (data ?? []).map(mapPublicBoard) } as const;
};

export const fetchPublicBoardForOwner = async (boardId: string) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, error: "Please sign in." } as const;
  }
  const { data, error } = await supabase
    .from(PUBLIC_TABLE)
    .select("*")
    .eq("board_id", boardId)
    .eq("owner_id", userData.user.id)
    .maybeSingle();
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true, board: data ? mapPublicBoard(data) : null } as const;
};

export const publishPublicBoard = async (payload: {
  project: Project;
  board: Board;
  title: string;
  description: string;
  tags: string[];
  formation?: string;
}) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, error: "Please sign in to publish." } as const;
  }
  const ownerId = userData.user.id;
  const ownerEmail = userData.user.email ?? "";
  const snapshot: SharedBoardSnapshot = {
    schemaVersion: payload.project.schemaVersion,
    board: payload.board,
    squads: payload.project.squads,
    settings: payload.project.settings,
  };
  const { data, error } = await supabase
    .from(PUBLIC_TABLE)
    .upsert(
      {
        owner_id: ownerId,
        owner_email: ownerEmail,
        board_id: payload.board.id,
        board_name: payload.board.name,
        project_name: payload.project.name,
        title: payload.title,
        description: payload.description,
        tags: payload.tags,
        formation: payload.formation ?? null,
        status: "unverified",
        board_data: snapshot,
      },
      { onConflict: "owner_id,board_id" }
    )
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to publish." } as const;
  }
  return { ok: true, board: mapPublicBoard(data) } as const;
};

export const unpublishPublicBoard = async (publicId: string) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { error } = await supabase.from(PUBLIC_TABLE).delete().eq("id", publicId);
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true } as const;
};

export const reportPublicBoard = async (payload: {
  boardId: string;
  reason: string;
}) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, error: "Please sign in to report." } as const;
  }
  const { data, error } = await supabase
    .from(REPORT_TABLE)
    .insert({
      board_id: payload.boardId,
      reporter_id: userData.user.id,
      reporter_email: userData.user.email ?? "",
      reason: payload.reason,
    })
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to report." } as const;
  }
  return { ok: true, report: mapReport(data) } as const;
};
