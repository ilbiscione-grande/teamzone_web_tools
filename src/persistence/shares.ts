import type {
  Board,
  BoardComment,
  BoardShare,
  BoardSharePermission,
  Project,
  SharedBoardSnapshot,
} from "@/models";
import { supabase } from "@/utils/supabaseClient";
import { recordNetworkCall } from "@/persistence/networkCounters";
import { validateBoardSharePayload } from "@/persistence/sharePublishingValidation";
import { resolveBoardShareAccess } from "@/persistence/shareAccess";

const SHARE_TABLE = "board_shares";
const COMMENT_TABLE = "board_comments";
const SHARE_COLUMNS_MIN =
  "id,owner_id,owner_email,recipient_email,board_id,board_name,project_name,permission,created_at,updated_at";
const SHARE_COLUMNS_FULL = `${SHARE_COLUMNS_MIN},board_data`;
const COMMENT_COLUMNS =
  "id,share_id,board_id,frame_id,object_id,author_id,author_email,body,created_at";

type BoardShareRow = {
  id: string;
  owner_id: string;
  owner_email: string;
  recipient_email: string;
  board_id: string;
  board_name: string;
  project_name: string;
  permission: BoardSharePermission;
  created_at: string;
  updated_at: string;
  board_data: SharedBoardSnapshot;
};
type BoardShareSummaryRow = Omit<BoardShareRow, "board_data">;

type BoardCommentRow = {
  id: string;
  share_id: string;
  board_id: string;
  frame_id: string | null;
  object_id: string | null;
  author_id: string;
  author_email: string;
  body: string;
  created_at: string;
};

const mapShare = (row: BoardShareRow): BoardShare => ({
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
  boardData: row.board_data,
});
const mapShareSummary = (row: BoardShareSummaryRow) => ({
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
});

const mapComment = (row: BoardCommentRow): BoardComment => ({
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

const getCurrentUser = async (purpose: string) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, error: `Please sign in to ${purpose}.` } as const;
  }
  return { ok: true, user: userData.user } as const;
};

const getCurrentShareAccess = async (shareId: string) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  if (!shareId.trim()) {
    return { ok: false, error: "Share id is required." } as const;
  }
  const userResult = await getCurrentUser("access this share");
  if (!userResult.ok) {
    return userResult;
  }
  const { data: shareData, error: shareError } = await supabase
    .from(SHARE_TABLE)
    .select(SHARE_COLUMNS_MIN)
    .eq("id", shareId)
    .maybeSingle();
  recordNetworkCall("supabase.board_shares.access", !shareError);
  if (shareError || !shareData) {
    return { ok: false, error: shareError?.message ?? "Share not found." } as const;
  }
  const access = resolveBoardShareAccess({
    ownerId: shareData.owner_id,
    recipientEmail: shareData.recipient_email,
    permission: shareData.permission,
    currentUserId: userResult.user.id,
    currentUserEmail: userResult.user.email ?? "",
  });
  return {
    ok: true,
    share: shareData as BoardShareSummaryRow,
    user: userResult.user,
    access,
  } as const;
};

export const createBoardShare = async (payload: {
  project: Project;
  board: Board;
  recipientEmail: string;
  permission: BoardSharePermission;
}) => {
  const validated = validateBoardSharePayload(payload);
  if (!validated.ok) {
    return validated;
  }
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const userResult = await getCurrentUser("share");
  if (!userResult.ok) {
    return userResult;
  }
  if (validated.recipientEmail === (userResult.user.email ?? "").trim().toLowerCase()) {
    return { ok: false, error: "You cannot share a board with yourself." } as const;
  }
  const ownerId = userResult.user.id;
  const ownerEmail = userResult.user.email ?? "";
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
      recipient_email: validated.recipientEmail,
      board_id: payload.board.id,
      board_name: payload.board.name,
      project_name: payload.project.name,
      permission: payload.permission,
      board_data: snapshot,
    })
    .select(SHARE_COLUMNS_MIN)
    .single();
  recordNetworkCall("supabase.board_shares.create", !error);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to share board." } as const;
  }
  return {
    ok: true,
    share: mapShareSummary(data as BoardShareSummaryRow),
  } as const;
};

export const fetchBoardSharesForOwner = async (boardId: string) => {
  if (!boardId.trim()) {
    return { ok: false, error: "Board id is required." } as const;
  }
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const userResult = await getCurrentUser("view shares");
  if (!userResult.ok) {
    return userResult;
  }
  const { data, error } = await supabase
    .from(SHARE_TABLE)
    .select(SHARE_COLUMNS_MIN)
    .eq("board_id", boardId)
    .eq("owner_id", userResult.user.id)
    .order("created_at", { ascending: false });
  recordNetworkCall("supabase.board_shares.by_board", !error);
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true, shares: (data ?? []).map(mapShareSummary) } as const;
};

export const fetchSharesByOwner = async () => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const userResult = await getCurrentUser("view shares");
  if (!userResult.ok) {
    return userResult;
  }
  const { data, error } = await supabase
    .from(SHARE_TABLE)
    .select(SHARE_COLUMNS_MIN)
    .eq("owner_id", userResult.user.id)
    .order("created_at", { ascending: false });
  recordNetworkCall("supabase.board_shares.by_owner", !error);
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true, shares: (data ?? []).map(mapShareSummary) } as const;
};

export const revokeBoardShare = async (shareId: string) => {
  const accessResult = await getCurrentShareAccess(shareId);
  if (!accessResult.ok) {
    return accessResult;
  }
  if (!accessResult.access.isOwner) {
    return { ok: false, error: "Only the share owner can revoke access." } as const;
  }
  const sb = supabase;
  if (!sb) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { error } = await sb
    .from(SHARE_TABLE)
    .delete()
    .eq("id", shareId)
    .eq("owner_id", accessResult.user.id);
  recordNetworkCall("supabase.board_shares.revoke", !error);
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true } as const;
};

export const fetchSharedBoards = async () => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const userResult = await getCurrentUser("view shares");
  if (!userResult.ok) {
    return userResult;
  }
  const email = (userResult.user.email ?? "").toLowerCase();
  if (!email) {
    return { ok: false, error: "Your account is missing an email address." } as const;
  }
  const { data, error } = await supabase
    .from(SHARE_TABLE)
    .select(SHARE_COLUMNS_MIN)
    .eq("recipient_email", email)
    .order("created_at", { ascending: false });
  recordNetworkCall("supabase.board_shares.by_recipient", !error);
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true, shares: (data ?? []).map(mapShareSummary) } as const;
};

export const fetchBoardShareById = async (shareId: string) => {
  const accessResult = await getCurrentShareAccess(shareId);
  if (!accessResult.ok) {
    return accessResult;
  }
  if (!accessResult.access.canView) {
    return { ok: false, error: "You do not have access to this share." } as const;
  }
  const sb = supabase;
  if (!sb) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data, error } = await sb
    .from(SHARE_TABLE)
    .select(SHARE_COLUMNS_FULL)
    .eq("id", shareId)
    .maybeSingle();
  recordNetworkCall("supabase.board_shares.get", !error);
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  if (!data) {
    return { ok: false, error: "Share not found." } as const;
  }
  return { ok: true, share: mapShare(data as BoardShareRow) } as const;
};

export const fetchBoardComments = async (shareId: string) => {
  const accessResult = await getCurrentShareAccess(shareId);
  if (!accessResult.ok) {
    return accessResult;
  }
  if (!accessResult.access.canView) {
    return { ok: false, error: "You do not have access to this share." } as const;
  }
  const sb = supabase;
  if (!sb) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data, error } = await sb
    .from(COMMENT_TABLE)
    .select(COMMENT_COLUMNS)
    .eq("share_id", shareId)
    .order("created_at", { ascending: true });
  recordNetworkCall("supabase.board_comments.by_share", !error);
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true, comments: (data ?? []).map(mapComment) } as const;
};

export const fetchLatestCommentsForShares = async (shareIds: string[]) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  if (shareIds.length === 0) {
    return { ok: true, latest: {} as Record<string, string> } as const;
  }
  const { data, error } = await supabase
    .from(COMMENT_TABLE)
    .select("share_id, created_at")
    .in("share_id", shareIds)
    .order("created_at", { ascending: false });
  recordNetworkCall("supabase.board_comments.latest", !error);
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  const latest: Record<string, string> = {};
  (data ?? []).forEach((row) => {
    if (!latest[row.share_id]) {
      latest[row.share_id] = row.created_at;
    }
  });
  return { ok: true, latest } as const;
};

export const addBoardComment = async (payload: {
  shareId: string;
  boardId: string;
  body: string;
}) => {
  const body = payload.body.trim();
  if (!body) {
    return { ok: false, error: "Enter a comment." } as const;
  }
  const accessResult = await getCurrentShareAccess(payload.shareId);
  if (!accessResult.ok) {
    return accessResult;
  }
  if (!accessResult.access.canComment) {
    return { ok: false, error: "Commenting is disabled for this share." } as const;
  }
  const sb = supabase;
  if (!sb) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data, error } = await sb
    .from(COMMENT_TABLE)
    .insert({
      share_id: payload.shareId,
      board_id: payload.boardId,
      frame_id: null,
      object_id: null,
      author_id: accessResult.user.id,
      author_email: accessResult.user.email ?? "",
      body,
    })
    .select(COMMENT_COLUMNS)
    .single();
  recordNetworkCall("supabase.board_comments.add", !error);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to add comment." } as const;
  }
  return { ok: true, comment: mapComment(data) } as const;
};
