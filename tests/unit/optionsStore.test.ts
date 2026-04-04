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

  test("defaults to tabToIndent false", () => {
    expect(new OptionsStore().load().tabToIndent).toBe(false);
  });

  test("defaults to debugMode false", () => {
    expect(new OptionsStore().load().debugMode).toBe(false);
  });

  test("defaults to cytoscape renderer", () => {
    expect(new OptionsStore().load().selectedRenderer).toBe("cytoscape");
  });

  test("round-trips all option fields", () => {
    const store = new OptionsStore();
    const options = {
      tabToIndent: true,
      debugMode: true,
      selectedRenderer: "minimal",
    };
    store.save(options);
    expect(store.load()).toEqual(options);
  });
});
