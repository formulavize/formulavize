import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { TutorialProgressStore } from "src/tutorial/tutorialProgressStore";

const STORAGE_KEY = "formulavize-tutorial-progress";

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

describe("TutorialProgressStore", () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    vi.stubGlobal("localStorage", mockStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("initial state", () => {
    test("returns -1 when no progress exists", () => {
      const store = new TutorialProgressStore();
      expect(store.getHighestCompletedIndex()).toBe(-1);
    });

    test("hasProgress returns false with no progress", () => {
      const store = new TutorialProgressStore();
      expect(store.hasProgress()).toBe(false);
    });
  });

  describe("markCompleted", () => {
    test("stores progress", () => {
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

    test("persists across instances", () => {
      const store1 = new TutorialProgressStore();
      store1.markCompleted(3);

      const store2 = new TutorialProgressStore();
      expect(store2.getHighestCompletedIndex()).toBe(3);
    });
  });

  describe("clearProgress", () => {
    test("removes all progress", () => {
      const store = new TutorialProgressStore();
      store.markCompleted(5);
      store.clearProgress();
      expect(store.getHighestCompletedIndex()).toBe(-1);
      expect(store.hasProgress()).toBe(false);
    });

    test("cleared progress is not seen by new instances", () => {
      const store1 = new TutorialProgressStore();
      store1.markCompleted(3);
      store1.clearProgress();

      const store2 = new TutorialProgressStore();
      expect(store2.hasProgress()).toBe(false);
    });
  });

  describe("version handling", () => {
    test("ignores data with mismatched version", () => {
      mockStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 999, highestCompleted: 10 }),
      );
      const store = new TutorialProgressStore();
      expect(store.getHighestCompletedIndex()).toBe(-1);
    });

    test("ignores corrupted data", () => {
      mockStorage.setItem(STORAGE_KEY, "not valid json");
      const store = new TutorialProgressStore();
      expect(store.getHighestCompletedIndex()).toBe(-1);
    });
  });
});
