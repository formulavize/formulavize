import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { VersionedStore } from "src/versionedStore";
import { createMockLocalStorage } from "./versionedStoreTestHelpers";

interface TestData {
  name: string;
  count: number;
}

const STORAGE_KEY = "test-store";
const VERSION = 1;
const DEFAULTS: TestData = { name: "default", count: 0 };

class TestStore extends VersionedStore<TestData> {
  constructor() {
    super(STORAGE_KEY, VERSION, DEFAULTS);
  }
}

describe("VersionedStore", () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    vi.stubGlobal("localStorage", mockStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("load", () => {
    test("returns defaults when nothing is stored", () => {
      const store = new TestStore();
      expect(store.load()).toEqual(DEFAULTS);
    });

    test("returns saved data", () => {
      const store = new TestStore();
      store.save({ name: "fizz", count: 6 });
      expect(store.load()).toEqual({ name: "fizz", count: 6 });
    });

    test("persists across instances", () => {
      new TestStore().save({ name: "buzz", count: 7 });
      expect(new TestStore().load()).toEqual({ name: "buzz", count: 7 });
    });

    test("returns defaults for mismatched version", () => {
      mockStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 999, name: "stale", count: 1 }),
      );
      expect(new TestStore().load()).toEqual(DEFAULTS);
    });

    test("returns defaults for corrupted JSON", () => {
      mockStorage.setItem(STORAGE_KEY, "not valid json");
      expect(new TestStore().load()).toEqual(DEFAULTS);
    });

    test("does not include version field in returned data", () => {
      const store = new TestStore();
      store.save({ name: "test", count: 1 });
      const loaded = store.load();
      expect(loaded).not.toHaveProperty("version");
    });
  });

  describe("save", () => {
    test("overwrites previous data", () => {
      const store = new TestStore();
      store.save({ name: "first", count: 1 });
      store.save({ name: "second", count: 2 });
      expect(store.load()).toEqual({ name: "second", count: 2 });
    });

    test("stores version in localStorage", () => {
      new TestStore().save({ name: "test", count: 1 });
      const raw = JSON.parse(mockStorage.getItem(STORAGE_KEY)!);
      expect(raw.version).toBe(VERSION);
    });

    test("warns on localStorage failure", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockStorage.setItem = () => {
        throw new Error("quota exceeded");
      };

      new TestStore().save({ name: "fail", count: 0 });

      expect(warnSpy).toHaveBeenCalledWith(
        `Unable to save to localStorage key "${STORAGE_KEY}"`,
      );
      warnSpy.mockRestore();
    });
  });

  describe("clear", () => {
    test("removes stored data", () => {
      const store = new TestStore();
      store.save({ name: "data", count: 5 });
      store.clear();
      expect(store.load()).toEqual(DEFAULTS);
    });

    test("cleared data is not seen by new instances", () => {
      const store = new TestStore();
      store.save({ name: "data", count: 5 });
      store.clear();
      expect(new TestStore().load()).toEqual(DEFAULTS);
    });

    test("warns on localStorage failure", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockStorage.removeItem = () => {
        throw new Error("access denied");
      };

      new TestStore().clear();

      expect(warnSpy).toHaveBeenCalledWith(
        `Unable to clear localStorage key "${STORAGE_KEY}"`,
      );
      warnSpy.mockRestore();
    });
  });
});
