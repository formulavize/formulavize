import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { TutorialManager } from "src/tutorial/tutorialManager";
import { createMockLocalStorage } from "../versionedStoreTestHelpers";

const STORAGE_KEY = "formulavize-tutorial-progress";

function setupManager(): {
  manager: TutorialManager;
  editorText: { value: string };
  headerText: { value: string };
  examplesText: { value: string };
  onComplete: ReturnType<typeof vi.fn>;
} {
  const manager = new TutorialManager();
  manager.setDisableAnimations(true);
  const editorText = { value: "" };
  const headerText = { value: "" };
  const examplesText = { value: "" };
  const onComplete = vi.fn();
  manager.setCallbacks(
    (t) => (editorText.value = t),
    (t) => (headerText.value = t),
    (t) => (examplesText.value = t),
    onComplete,
  );
  return { manager, editorText, headerText, examplesText, onComplete };
}

describe("TutorialManager", () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    vi.stubGlobal("localStorage", mockStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("initial state", () => {
    test("has no progress initially", () => {
      const { manager } = setupManager();
      expect(manager.hasProgress()).toBe(false);
      expect(manager.getHighestCompletedIndex()).toBe(-1);
    });

    test("loads existing progress from localStorage", () => {
      mockStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, highestCompleted: 3 }),
      );
      const manager = new TutorialManager();
      expect(manager.hasProgress()).toBe(true);
      expect(manager.getHighestCompletedIndex()).toBe(3);
      expect(manager.cachedHighestCompleted).toBe(3);
    });
  });

  describe("startTutorialAt", () => {
    test("starts at a specific puzzlet index", () => {
      const { manager, headerText } = setupManager();
      manager.startTutorialAt(2);
      const lesson = manager.getLesson();
      expect(lesson.getCurrentPuzzletIndex()).toBe(2);
      expect(headerText.value).not.toBe("");
    });

    test("clears editor on start", () => {
      const { manager, editorText } = setupManager();
      editorText.value = "existing code";
      manager.startTutorialAt(0);
      expect(editorText.value).toBe("");
    });

    test("does nothing without callbacks", () => {
      const manager = new TutorialManager();
      // Should not throw
      manager.startTutorialAt(0);
    });
  });

  describe("progress tracking", () => {
    test("clearProgress resets cached value and localStorage", () => {
      mockStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, highestCompleted: 5 }),
      );
      const manager = new TutorialManager();
      expect(manager.cachedHighestCompleted).toBe(5);

      manager.clearProgress();
      expect(manager.hasProgress()).toBe(false);
      expect(manager.cachedHighestCompleted).toBe(-1);
      expect(mockStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe("stopTutorial", () => {
    test("stops an active tutorial", () => {
      const { manager } = setupManager();
      manager.startTutorialAt(0);
      manager.stopTutorial();
      // Starting again should work without error
      manager.startTutorialAt(0);
    });
  });
});
