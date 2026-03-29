import { describe, test, expect } from "vitest";
import { getRendererPropertyCompletions } from "src/autocomplete/rendererProperties";

describe("rendererProperties", () => {
  test("cytoscape returns a non-empty array", () => {
    const completions = getRendererPropertyCompletions("cytoscape");
    expect(completions.length).toBeGreaterThan(0);
  });

  test("all completions have type 'property'", () => {
    const completions = getRendererPropertyCompletions("cytoscape");
    for (const completion of completions) {
      expect(completion.type).toBe("property");
    }
  });

  test("no duplicate labels", () => {
    const completions = getRendererPropertyCompletions("cytoscape");
    const labels = completions.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  test("unknown renderer returns empty array", () => {
    const completions = getRendererPropertyCompletions("nonexistent");
    expect(completions).toEqual([]);
  });
});
