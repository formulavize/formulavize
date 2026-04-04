import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { TutorialProgressStore } from "src/tutorial/tutorialProgressStore";
import { createMockLocalStorage } from "../versionedStoreTestHelpers";

describe("TutorialProgressStore", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMockLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("returns -1 with no progress", () => {
    expect(new TutorialProgressStore().getHighestCompletedIndex()).toBe(-1);
  });

  test("hasProgress returns false with no progress", () => {
    expect(new TutorialProgressStore().hasProgress()).toBe(false);
  });

  describe("markCompleted", () => {
    test("stores progress and reports hasProgress", () => {
      const store = new TutorialProgressStore();
      store.markCompleted(0);
      expect(store.getHighestCompletedIndex()).toBe(0);
      expect(store.hasProgress()).toBe(true);
    });

    test("updates when new index is higher", () => {
      const store = new TutorialProgressStore();
      store.markCompleted(2);
      store.markCompleted(5);
      expect(store.getHighestCompletedIndex()).toBe(5);
    });

    test("does not regress when new index is lower", () => {
      const store = new TutorialProgressStore();
      store.markCompleted(5);
      store.markCompleted(2);
      expect(store.getHighestCompletedIndex()).toBe(5);
    });
  });

  describe("clearProgress", () => {
    test("resets to initial state", () => {
      const store = new TutorialProgressStore();
      store.markCompleted(5);
      store.clearProgress();
      expect(store.getHighestCompletedIndex()).toBe(-1);
      expect(store.hasProgress()).toBe(false);
    });
  });
});
