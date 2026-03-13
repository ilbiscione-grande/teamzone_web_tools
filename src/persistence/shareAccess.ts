import type { BoardSharePermission } from "@/models";

type ShareAccessInput = {
  ownerId: string;
  recipientEmail: string;
  permission: BoardSharePermission;
  currentUserId: string;
  currentUserEmail: string;
};

type ShareAccessResult = {
  canView: boolean;
  canComment: boolean;
  isOwner: boolean;
};

export const resolveBoardShareAccess = (
  input: ShareAccessInput
): ShareAccessResult => {
  const normalizedCurrentEmail = input.currentUserEmail.trim().toLowerCase();
  const normalizedRecipientEmail = input.recipientEmail.trim().toLowerCase();
  const isOwner = input.ownerId === input.currentUserId;
  const isRecipient =
    normalizedCurrentEmail.length > 0 &&
    normalizedCurrentEmail === normalizedRecipientEmail;
  const canView = isOwner || isRecipient;
  const canComment = isOwner || (isRecipient && input.permission === "comment");
  return {
    canView,
    canComment,
    isOwner,
  };
};
