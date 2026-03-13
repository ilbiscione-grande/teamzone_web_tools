import type {
  Board,
  PublicBoard,
  PublicBoardReport,
  PublicBoardStatus,
  Project,
  SharedBoardSnapshot,
} from "@/models";
import { supabase } from "@/utils/supabaseClient";
import { recordNetworkCall } from "@/persistence/networkCounters";
import { validatePublicBoardPayload } from "@/persistence/sharePublishingValidation";

const PUBLIC_TABLE = "public_boards";
const REPORT_TABLE = "public_board_reports";
const PUBLIC_BOARD_COLUMNS_MIN =
  "id,owner_id,owner_email,board_id,board_name,project_name,title,description,category,tags,formation,thumbnail,status,created_at,updated_at";

type PublicBoardRow = {
  id: string;
  owner_id: string;
  owner_email: string;
  board_id: string;
  board_name: string;
  project_name: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  formation: string | null;
  thumbnail: string | null;
  status: PublicBoardStatus;
  created_at: string;
  updated_at: string;
  board_data?: SharedBoardSnapshot;
};

type PublicBoardReportRow = {
  id: string;
  board_id: string;
  reporter_id: string;
  reporter_email: string;
  reason: string;
  created_at: string;
};

const mapPublicBoard = (row: PublicBoardRow): PublicBoard => ({
  id: row.id,
  ownerId: row.owner_id,
  ownerEmail: row.owner_email,
  boardId: row.board_id,
  boardName: row.board_name,
  projectName: row.project_name,
  title: row.title,
  description: row.description ?? "",
  category: row.category ?? "",
  tags: row.tags ?? [],
  formation: row.formation ?? null,
  thumbnail: row.thumbnail ?? null,
  status: row.status as PublicBoardStatus,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  boardData: row.board_data,
});

const mapReport = (row: PublicBoardReportRow): PublicBoardReport => ({
  id: row.id,
  boardId: row.board_id,
  reporterId: row.reporter_id,
  reporterEmail: row.reporter_email,
  reason: row.reason,
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

const getOwnedPublicBoard = async (publicId: string) => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  if (!publicId.trim()) {
    return { ok: false, error: "Public board id is required." } as const;
  }
  const userResult = await getCurrentUser("manage this public board");
  if (!userResult.ok) {
    return userResult;
  }
  const { data, error } = await supabase
    .from(PUBLIC_TABLE)
    .select("id,owner_id")
    .eq("id", publicId)
    .maybeSingle<{ id: string; owner_id: string }>();
  recordNetworkCall("supabase.public_boards.access", !error);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Public board not found." } as const;
  }
  if (data.owner_id !== userResult.user.id) {
    return { ok: false, error: "Only the owner can manage this public board." } as const;
  }
  return { ok: true, user: userResult.user } as const;
};

export const fetchPublicBoards = async () => {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data, error } = await supabase
    .from(PUBLIC_TABLE)
    .select(PUBLIC_BOARD_COLUMNS_MIN)
    .order("updated_at", { ascending: false });
  recordNetworkCall("supabase.public_boards.list", !error);
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true, boards: (data ?? []).map(mapPublicBoard) } as const;
};

export const fetchPublicBoardForOwner = async (boardId: string) => {
  if (!boardId.trim()) {
    return { ok: false, error: "Board id is required." } as const;
  }
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const userResult = await getCurrentUser("view your public boards");
  if (!userResult.ok) {
    return userResult;
  }
  const { data, error } = await supabase
    .from(PUBLIC_TABLE)
    .select(PUBLIC_BOARD_COLUMNS_MIN)
    .eq("board_id", boardId)
    .eq("owner_id", userResult.user.id)
    .maybeSingle();
  recordNetworkCall("supabase.public_boards.by_owner_board", !error);
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
  category: string;
  tags: string[];
  formation?: string;
  thumbnail?: string | null;
}) => {
  const validated = validatePublicBoardPayload(payload);
  if (!validated.ok) {
    return validated;
  }
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const userResult = await getCurrentUser("publish");
  if (!userResult.ok) {
    return userResult;
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
    .from(PUBLIC_TABLE)
    .upsert(
      {
        owner_id: ownerId,
        owner_email: ownerEmail,
        board_id: payload.board.id,
        board_name: payload.board.name,
        project_name: payload.project.name,
        title: validated.value.title,
        description: validated.value.description,
        category: validated.value.category,
        tags: validated.value.tags,
        formation: validated.value.formation ?? null,
        thumbnail: validated.value.thumbnail,
        status: "unverified",
        board_data: snapshot,
      },
      { onConflict: "owner_id,board_id" }
    )
    .select(PUBLIC_BOARD_COLUMNS_MIN)
    .single();
  recordNetworkCall("supabase.public_boards.publish", !error);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to publish." } as const;
  }
  return { ok: true, board: mapPublicBoard(data) } as const;
};
const PUBLIC_BOARD_REPORT_COLUMNS =
  "id,board_id,reporter_id,reporter_email,reason,created_at";

export const fetchPublicBoardData = async (publicId: string) => {
  if (!publicId.trim()) {
    return { ok: false, error: "Public board id is required." } as const;
  }
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { data, error } = await supabase
    .from(PUBLIC_TABLE)
    .select("board_data")
    .eq("id", publicId)
    .maybeSingle<{ board_data: SharedBoardSnapshot }>();
  recordNetworkCall("supabase.public_boards.get_data", !error);
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  if (!data?.board_data) {
    return { ok: false, error: "Board data not found." } as const;
  }
  return { ok: true, boardData: data.board_data } as const;
};

export const unpublishPublicBoard = async (publicId: string) => {
  const ownerResult = await getOwnedPublicBoard(publicId);
  if (!ownerResult.ok) {
    return ownerResult;
  }
  const sb = supabase;
  if (!sb) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const { error } = await sb
    .from(PUBLIC_TABLE)
    .delete()
    .eq("id", publicId)
    .eq("owner_id", ownerResult.user.id);
  recordNetworkCall("supabase.public_boards.unpublish", !error);
  if (error) {
    return { ok: false, error: error.message } as const;
  }
  return { ok: true } as const;
};

export const reportPublicBoard = async (payload: {
  boardId: string;
  reason: string;
}) => {
  const boardId = payload.boardId.trim();
  const reason = payload.reason.trim();
  if (!boardId) {
    return { ok: false, error: "Public board id is required." } as const;
  }
  if (!reason) {
    return { ok: false, error: "Enter a report reason." } as const;
  }
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." } as const;
  }
  const userResult = await getCurrentUser("report");
  if (!userResult.ok) {
    return userResult;
  }
  const { data: boardData, error: boardError } = await supabase
    .from(PUBLIC_TABLE)
    .select("owner_id")
    .eq("id", boardId)
    .maybeSingle<{ owner_id: string }>();
  recordNetworkCall("supabase.public_boards.report_access", !boardError);
  if (boardError || !boardData) {
    return { ok: false, error: boardError?.message ?? "Public board not found." } as const;
  }
  if (boardData.owner_id === userResult.user.id) {
    return { ok: false, error: "You cannot report your own public board." } as const;
  }
  const { data, error } = await supabase
    .from(REPORT_TABLE)
    .insert({
      board_id: boardId,
      reporter_id: userResult.user.id,
      reporter_email: userResult.user.email ?? "",
      reason,
    })
    .select(PUBLIC_BOARD_REPORT_COLUMNS)
    .single();
  recordNetworkCall("supabase.public_board_reports.create", !error);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to report." } as const;
  }
  return { ok: true, report: mapReport(data) } as const;
};
