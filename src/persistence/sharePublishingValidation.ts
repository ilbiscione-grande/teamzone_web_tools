import type { Board, Project } from "@/models";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeText = (value: string) => value.trim();

const normalizeTags = (tags: string[]) => {
  const seen = new Set<string>();
  return tags
    .map((tag) => normalizeText(tag))
    .filter((tag) => {
      if (!tag) {
        return false;
      }
      const key = tag.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

const hasBoardIdentity = (board: Board) =>
  Boolean(board.id.trim()) && Boolean(board.name.trim());

const hasProjectIdentity = (project: Project) =>
  Boolean(project.id.trim()) && Boolean(project.name.trim());

export const validateBoardSharePayload = (payload: {
  project: Project;
  board: Board;
  recipientEmail: string;
}) => {
  if (!hasProjectIdentity(payload.project)) {
    return { ok: false, error: "Project metadata is incomplete." } as const;
  }
  if (!hasBoardIdentity(payload.board)) {
    return { ok: false, error: "Board metadata is incomplete." } as const;
  }
  const recipientEmail = normalizeText(payload.recipientEmail).toLowerCase();
  if (!recipientEmail) {
    return { ok: false, error: "Enter a recipient email." } as const;
  }
  if (!EMAIL_PATTERN.test(recipientEmail)) {
    return { ok: false, error: "Enter a valid recipient email." } as const;
  }
  return { ok: true, recipientEmail } as const;
};

export const validatePublicBoardPayload = (payload: {
  project: Project;
  board: Board;
  title: string;
  description: string;
  category: string;
  tags: string[];
  formation?: string;
  thumbnail?: string | null;
}) => {
  if (!hasProjectIdentity(payload.project)) {
    return { ok: false, error: "Project metadata is incomplete." } as const;
  }
  if (!hasBoardIdentity(payload.board)) {
    return { ok: false, error: "Board metadata is incomplete." } as const;
  }
  if ((payload.board.frames?.length ?? 0) === 0) {
    return { ok: false, error: "Board must contain at least one frame." } as const;
  }
  const title = normalizeText(payload.title);
  if (!title) {
    return { ok: false, error: "Enter a title for the library." } as const;
  }
  const description = normalizeText(payload.description);
  const category = normalizeText(payload.category);
  const formation = payload.formation ? normalizeText(payload.formation) : undefined;
  const thumbnail = payload.thumbnail ?? null;
  if (thumbnail !== null && !thumbnail.trim()) {
    return { ok: false, error: "Thumbnail data is invalid." } as const;
  }
  return {
    ok: true,
    value: {
      title,
      description,
      category,
      tags: normalizeTags(payload.tags),
      formation,
      thumbnail,
    },
  } as const;
};

export const validatePublicProjectPayload = (payload: {
  project: Project;
  title: string;
  description: string;
  category: string;
  tags: string[];
}) => {
  if (!hasProjectIdentity(payload.project)) {
    return { ok: false, error: "Project metadata is incomplete." } as const;
  }
  if ((payload.project.boards?.length ?? 0) === 0) {
    return { ok: false, error: "Select at least one board to publish." } as const;
  }
  const title = normalizeText(payload.title);
  if (!title) {
    return { ok: false, error: "Enter a title." } as const;
  }
  return {
    ok: true,
    value: {
      title,
      description: normalizeText(payload.description),
      category: normalizeText(payload.category),
      tags: normalizeTags(payload.tags),
    },
  } as const;
};
