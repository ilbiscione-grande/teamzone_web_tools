#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.findIndex((arg) => arg === `--${name}`);
  if (index < 0) {
    return undefined;
  }
  return args[index + 1];
};

const userFilter = getArg("user");
const projectFilter = getArg("project");
const limitArg = Number(getArg("limit") ?? "0");
const maxProjects = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : 0;

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (preferred)."
  );
  process.exit(1);
}

const usingServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!usingServiceRole) {
  console.warn(
    "Running without SUPABASE_SERVICE_ROLE_KEY. Results may be incomplete due to RLS."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fetchAll = async (table, selectColumns) => {
  const pageSize = 1000;
  let from = 0;
  let all = [];
  while (true) {
    let query = supabase
      .from(table)
      .select(selectColumns)
      .range(from, from + pageSize - 1);
    if (userFilter) {
      query = query.eq("user_id", userFilter);
    }
    if (table === "projects" && projectFilter) {
      query = query.eq("id", projectFilter);
    }
    if (table === "project_boards" && projectFilter) {
      query = query.eq("project_id", projectFilter);
    }
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    const chunk = data ?? [];
    all = all.concat(chunk);
    if (chunk.length < pageSize) {
      break;
    }
    from += pageSize;
  }
  return all;
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const nowIso = new Date().toISOString();
console.log(`[${nowIso}] Starting project integrity audit...`);

const [projects, boardRows] = await Promise.all([
  fetchAll("projects", "id,user_id,name,updated_at,data"),
  fetchAll(
    "project_boards",
    "id,project_id,user_id,board_name,order_index,updated_at,board_data"
  ),
]);

const projectRows = maxProjects > 0 ? projects.slice(0, maxProjects) : projects;
const projectByKey = new Map(
  projectRows.map((row) => [`${row.user_id}:${row.id}`, row])
);
const boardsByProjectKey = new Map();
for (const row of boardRows) {
  const key = `${row.user_id}:${row.project_id}`;
  const list = boardsByProjectKey.get(key) ?? [];
  list.push(row);
  boardsByProjectKey.set(key, list);
}

const issues = [];
const pushIssue = (severity, code, context, detail) => {
  issues.push({ severity, code, context, detail });
};

for (const projectRow of projectRows) {
  const key = `${projectRow.user_id}:${projectRow.id}`;
  const rowBoards = (boardsByProjectKey.get(key) ?? []).slice();
  rowBoards.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  if (rowBoards.length === 0) {
    pushIssue("critical", "NO_BOARD_ROWS", key, "No rows in project_boards.");
    continue;
  }

  const boardIds = rowBoards.map((row) => row.id);
  const uniqueBoardIds = new Set(boardIds);
  if (uniqueBoardIds.size !== boardIds.length) {
    pushIssue(
      "critical",
      "DUP_BOARD_IDS",
      key,
      "Duplicate board ids in project_boards for same project."
    );
  }

  const orderIndexes = rowBoards.map((row) => row.order_index ?? -1);
  const uniqueOrderIndexes = new Set(orderIndexes);
  if (uniqueOrderIndexes.size !== orderIndexes.length) {
    pushIssue(
      "warning",
      "DUP_ORDER_INDEX",
      key,
      "Duplicate order_index values in project_boards."
    );
  }

  const base = projectRow.data ?? {};
  const activeBoardId = base?.activeBoardId;
  if (activeBoardId && !uniqueBoardIds.has(activeBoardId)) {
    pushIssue(
      "critical",
      "ACTIVE_BOARD_MISSING",
      key,
      `activeBoardId (${activeBoardId}) is missing from project_boards.`
    );
  }

  const payloadBoards = toArray(base?.boards);
  if (payloadBoards.length > 0 && payloadBoards.length !== rowBoards.length) {
    pushIssue(
      "warning",
      "BASE_BOARD_COUNT_MISMATCH",
      key,
      `projects.data.boards has ${payloadBoards.length}, project_boards has ${rowBoards.length}.`
    );
  }

  for (const boardRow of rowBoards) {
    const boardData = boardRow.board_data ?? {};
    const frames = toArray(boardData.frames);
    if (frames.length === 0) {
      pushIssue(
        "critical",
        "BOARD_WITH_NO_FRAMES",
        `${key}:${boardRow.id}`,
        "Board has zero frames."
      );
      continue;
    }
    const activeFrameIndex = Number(boardData.activeFrameIndex ?? 0);
    if (activeFrameIndex < 0 || activeFrameIndex >= frames.length) {
      pushIssue(
        "warning",
        "ACTIVE_FRAME_OUT_OF_RANGE",
        `${key}:${boardRow.id}`,
        `activeFrameIndex=${activeFrameIndex}, frames=${frames.length}.`
      );
    }
    const frameIds = frames.map((frame) => frame?.id).filter(Boolean);
    if (new Set(frameIds).size !== frameIds.length) {
      pushIssue(
        "warning",
        "DUP_FRAME_IDS",
        `${key}:${boardRow.id}`,
        "Duplicate frame ids detected."
      );
    }
  }
}

for (const boardRow of boardRows) {
  const key = `${boardRow.user_id}:${boardRow.project_id}`;
  if (!projectByKey.has(key)) {
    pushIssue(
      "warning",
      "ORPHAN_BOARD_ROW",
      key,
      `Board row ${boardRow.id} has no matching projects row in current query scope.`
    );
  }
}

const critical = issues.filter((item) => item.severity === "critical");
const warning = issues.filter((item) => item.severity === "warning");

console.log("");
console.log("Audit summary");
console.log(`- Projects scanned: ${projectRows.length}`);
console.log(`- Board rows scanned: ${boardRows.length}`);
console.log(`- Critical issues: ${critical.length}`);
console.log(`- Warnings: ${warning.length}`);
console.log("");

if (issues.length === 0) {
  console.log("No issues found.");
  process.exit(0);
}

for (const item of issues) {
  console.log(
    `[${item.severity.toUpperCase()}] ${item.code} :: ${item.context} :: ${item.detail}`
  );
}

process.exit(critical.length > 0 ? 2 : 0);
