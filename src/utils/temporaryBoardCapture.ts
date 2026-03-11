import type { Board } from "@/models";

type EditorViewport = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

type EditorCaptureState = {
  playheadFrame: number;
  viewport: EditorViewport;
  isPlaying: boolean;
  setPlaying: (playing: boolean) => void;
  setPlayheadFrame: (value: number) => void;
  setViewport: (viewport: EditorViewport) => void;
};

type WithTemporaryBoardCaptureStateParams<T> = {
  board: Board;
  editorState: EditorCaptureState;
  setActiveFrameIndex: (boardId: string, index: number) => void;
  run: () => Promise<T>;
};

export const withTemporaryBoardCaptureState = async <T>({
  board,
  editorState,
  setActiveFrameIndex,
  run,
}: WithTemporaryBoardCaptureStateParams<T>): Promise<T> => {
  const previousFrameIndex = board.activeFrameIndex;
  const previousPlayhead = editorState.playheadFrame;
  const previousViewport = editorState.viewport;
  const wasPlaying = editorState.isPlaying;
  const shouldResetFrame = board.mode === "DYNAMIC";

  editorState.setPlaying(false);
  if (shouldResetFrame) {
    if (previousFrameIndex !== 0) {
      setActiveFrameIndex(board.id, 0);
    }
    if (previousPlayhead !== 0) {
      editorState.setPlayheadFrame(0);
    }
  }
  editorState.setViewport({ zoom: 1, offsetX: 0, offsetY: 0 });

  try {
    return await run();
  } finally {
    editorState.setViewport(previousViewport);
    if (shouldResetFrame) {
      if (previousFrameIndex !== 0) {
        setActiveFrameIndex(board.id, previousFrameIndex);
      }
      if (previousPlayhead !== 0) {
        editorState.setPlayheadFrame(previousPlayhead);
      }
    }
    if (wasPlaying) {
      editorState.setPlaying(true);
    }
  }
};
