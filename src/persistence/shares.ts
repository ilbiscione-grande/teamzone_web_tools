import type {
  Board,
  BoardComment,
  BoardShare,
  BoardSharePermission,
  Project,
  SharedBoardSnapshot,
} from "@/models";
import { supabase } from "@/utils/supabaseClient";

const SHARE_TABLE = "board_shares";
const COMMENT_TABLE = "board_comments";

const mapShare = (row: any): BoardShare => ({
  id: row.id,
  ownerId: row.owner_id,
  ownerEmail: row.owner_email,
  recipientEmail: row.recipient_email,
  boardId: row.board_id,
  boardName: row.board_name,
  projectName: row.project_name,
  permission: row.permission,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  boardData: row.board_data as SharedBoardSnapshot,
});

const mapComment = (row: any): BoardComment => ({
  id: row.id,
  shareId: row.share_id,
  boardId: row.board_id,
  frameId: row.frame_id ?? null,
  objectId: row.object_id ?? null,
  authorId: row.author_id,
  authorEmail: row.author_email,
  body: row.body,
  createdAt: row.created_at,
});

export const createBoardShare = async (payload: {
  project: Project;
  board: Board;
  recipientEmail: string;
  permission: BoardSharePermission;
}) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, error: "Please sign in to share." } as const;
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
    .from(SHARE_TABLE)
    .insert({
      owner_id: ownerId,
      owner_email: ownerEmail,
      recipient_email: payload.recipientEmail.toLowerCase(),
      board_id: payload.board.id,
      board_name: payload.board.name,
      project_name: payload.project.name,
      permission: payload.permission,
      board_data: snapshot,
    })
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to share board." } as const;
  }
  return { ok: true, share: mapShare(data) } as const;
};

export const fetchBoardSharesForOwner = async (boardId: string) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data, error } = await supabase
    .from(SHARE_TABLE)
    .select("*")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false });
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true, shares: (data ?? []).map(mapShare) } as const;
};

export const revokeBoardShare = async (shareId: string) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { error } = await supabase.from(SHARE_TABLE).delete().eq("id", shareId);
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true } as const;
};

export const fetchSharedBoards = async () => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user?.email) {
    return { ok: false, error: "Please sign in to view shares." } as const;
  }
  const email = userData.user.email.toLowerCase();
  const { data, error } = await supabase
    .from(SHARE_TABLE)
    .select("*")
    .eq("recipient_email", email)
    .order("created_at", { ascending: false });
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true, shares: (data ?? []).map(mapShare) } as const;
};

export const fetchBoardComments = async (shareId: string) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data, error } = await supabase
    .from(COMMENT_TABLE)
    .select("*")
    .eq("share_id", shareId)
    .order("created_at", { ascending: true });
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true, comments: (data ?? []).map(mapComment) } as const;
};

export const addBoardComment = async (payload: {
  shareId: string;
  boardId: string;
  body: string;
}) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, error: "Please sign in to comment." } as const;
  }
  const { data, error } = await supabase
    .from(COMMENT_TABLE)
    .insert({
      share_id: payload.shareId,
      board_id: payload.boardId,
      frame_id: null,
      object_id: null,
      author_id: userData.user.id,
      author_email: userData.user.email ?? "",
      body: payload.body,
    })
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to add comment." } as const;
  }
  return { ok: true, comment: mapComment(data) } as const;
};
