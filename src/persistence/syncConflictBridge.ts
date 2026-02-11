export type SyncConflictChoice = "cloud" | "local" | "export";

export type SyncConflictPayload = {
  projectName: string;
};

type SyncConflictHandler = (
  payload: SyncConflictPayload
) => Promise<SyncConflictChoice>;

let handler: SyncConflictHandler | null = null;

export const registerSyncConflictHandler = (next: SyncConflictHandler) => {
  handler = next;
  return () => {
    if (handler === next) {
      handler = null;
    }
  };
};

export const requestSyncConflictResolution = async (
  payload: SyncConflictPayload
): Promise<SyncConflictChoice> => {
  if (!handler) {
    return "cloud";
  }
  return handler(payload);
};

