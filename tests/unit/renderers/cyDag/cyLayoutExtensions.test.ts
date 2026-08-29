import { describe, test, expect, beforeEach, vi } from "vitest";
import cytoscape from "cytoscape";
import {
  ensureLayoutRegistered,
  resetRegisteredLayouts,
} from "src/renderers/cyDag/cyLayoutExtensions";

// Only 'use' is exercised, so a stub stands in for the cytoscape module.
function makeCytoscapeStub() {
  return { use: vi.fn() } as unknown as typeof cytoscape & {
    use: ReturnType<typeof vi.fn>;
  };
}

describe("layout extension registration", () => {
  beforeEach(() => {
    resetRegisteredLayouts();
  });

  test.each(["dagre", "elk"] as const)(
    "%s registers its extension",
    async (layoutName) => {
      const cy = makeCytoscapeStub();
      await ensureLayoutRegistered(cy, layoutName);
      expect(cy.use).toHaveBeenCalledTimes(1);
      expect(typeof cy.use.mock.calls[0][0]).toBe("function");
    },
  );

  // 'preset' is what the 'manual' layout runs.
  test.each(["breadthfirst", "preset"])(
    "%s is built into cytoscape core",
    async (layoutName) => {
      const cy = makeCytoscapeStub();
      await ensureLayoutRegistered(cy, layoutName);
      expect(cy.use).not.toHaveBeenCalled();
    },
  );

  test("repeat registration is skipped", async () => {
    const cy = makeCytoscapeStub();
    await ensureLayoutRegistered(cy, "dagre");
    await ensureLayoutRegistered(cy, "dagre");
    expect(cy.use).toHaveBeenCalledTimes(1);
  });

  test("each layout registers independently", async () => {
    const cy = makeCytoscapeStub();
    await ensureLayoutRegistered(cy, "dagre");
    await ensureLayoutRegistered(cy, "elk");
    expect(cy.use).toHaveBeenCalledTimes(2);
  });
});
