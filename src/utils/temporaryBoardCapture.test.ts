import { describe, expect, it, vi } from "vitest";
import type { Board } from "@/models";
import { withTemporaryBoardCaptureState } from "./temporaryBoardCapture";

const createBoard = (mode: Board["mode"], activeFrameIndex = 2): Board => ({
  id: "board-1",
  name: "Board",
  mode,
  pitchView: "FULL",
  pitchOverlay: "NONE",
  pitchOverlayText: false,
  notes: "",
  playerLabel: {
    showName: true,
    showPosition: false,
    showNumber: false,
  },
  playerHighlights: [],
  playerLinks: [],
  layers: [],
  frames: [
    { id: "frame-1", name: "Frame 1", objects: [] },
    { id: "frame-2", name: "Frame 2", objects: [] },
    { id: "frame-3", name: "Frame 3", objects: [] },
  ],
  activeFrameIndex,
});

describe("withTemporaryBoardCaptureState", () => {
  it("restores viewport, playhead and playback after successful capture", async () => {
    const editorState = {
      playheadFrame: 4,
      viewport: { zoom: 2, offsetX: 12, offsetY: 34 },
      isPlaying: true,
      setPlaying: vi.fn(),
      setPlayheadFrame: vi.fn(),
      setViewport: vi.fn(),
    };
    const setActiveFrameIndex = vi.fn();

    const result = await withTemporaryBoardCaptureState({
      board: createBoard("DYNAMIC", 2),
      editorState,
      setActiveFrameIndex,
      run: async () => "ok",
    });

    expect(result).toBe("ok");
    expect(editorState.setPlaying).toHaveBeenNthCalledWith(1, false);
    expect(editorState.setViewport).toHaveBeenNthCalledWith(1, {
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });
    expect(setActiveFrameIndex).toHaveBeenNthCalledWith(1, "board-1", 0);
    expect(editorState.setPlayheadFrame).toHaveBeenNthCalledWith(1, 0);
    expect(editorState.setViewport).toHaveBeenLastCalledWith({
      zoom: 2,
      offsetX: 12,
      offsetY: 34,
    });
    expect(setActiveFrameIndex).toHaveBeenLastCalledWith("board-1", 2);
    expect(editorState.setPlayheadFrame).toHaveBeenLastCalledWith(4);
    expect(editorState.setPlaying).toHaveBeenLastCalledWith(true);
  });

  it("restores editor state even when capture fails", async () => {
    const editorState = {
      playheadFrame: 3,
      viewport: { zoom: 1.5, offsetX: 7, offsetY: 9 },
      isPlaying: false,
      setPlaying: vi.fn(),
      setPlayheadFrame: vi.fn(),
      setViewport: vi.fn(),
    };
    const setActiveFrameIndex = vi.fn();

    await expect(
      withTemporaryBoardCaptureState({
        board: createBoard("DYNAMIC", 1),
        editorState,
        setActiveFrameIndex,
        run: async () => {
          throw new Error("capture failed");
        },
      })
    ).rejects.toThrow("capture failed");

    expect(editorState.setViewport).toHaveBeenLastCalledWith({
      zoom: 1.5,
      offsetX: 7,
      offsetY: 9,
    });
    expect(setActiveFrameIndex).toHaveBeenLastCalledWith("board-1", 1);
    expect(editorState.setPlayheadFrame).toHaveBeenLastCalledWith(3);
  });

  it("does not reset frame index for static boards", async () => {
    const editorState = {
      playheadFrame: 0,
      viewport: { zoom: 1, offsetX: 0, offsetY: 0 },
      isPlaying: false,
      setPlaying: vi.fn(),
      setPlayheadFrame: vi.fn(),
      setViewport: vi.fn(),
    };
    const setActiveFrameIndex = vi.fn();

    await withTemporaryBoardCaptureState({
      board: createBoard("STATIC", 0),
      editorState,
      setActiveFrameIndex,
      run: async () => null,
    });

    expect(setActiveFrameIndex).not.toHaveBeenCalled();
    expect(editorState.setPlayheadFrame).not.toHaveBeenCalled();
  });
});
