import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { OptionsStore } from "src/optionsStore";
import { createMockLocalStorage } from "./versionedStoreTestHelpers";

describe("OptionsStore", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMockLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("defaults to enableTabbingInEditor false", () => {
    expect(new OptionsStore().load().enableTabbingInEditor).toBe(false);
  });

  test("defaults to debugMode false", () => {
    expect(new OptionsStore().load().debugMode).toBe(false);
  });

  test("round-trips all option fields", () => {
    const store = new OptionsStore();
    const options = {
      enableTabbingInEditor: true,
      debugMode: true,
    };
    store.save(options);
    expect(store.load()).toEqual(options);
  });
});
