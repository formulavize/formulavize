import { describe, test, expect } from "vitest";
import {
  getRendererPropertyCompletions,
  getRendererDirectiveCompletions,
} from "src/autocomplete/rendererProperties";
import { DEFAULT_CYTOSCAPE_LAYOUT } from "src/compiler/constants";

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

describe("renderer directive completions", () => {
  test("cytoscape directives cover the supported keys", () => {
    const labels = getRendererDirectiveCompletions("cytoscape", "dagre").map(
      (c) => c.label,
    );
    expect(labels).toContain("rankDir");
    expect(labels).toContain("background-color");
  });

  test("directives exclude stylesheet properties", () => {
    const labels = getRendererDirectiveCompletions("cytoscape").map(
      (c) => c.label,
    );
    expect(labels).not.toContain("border-width");
    expect(labels).not.toContain("curve-style");
  });

  test("renderer without directives returns empty array", () => {
    expect(getRendererDirectiveCompletions("minimal")).toEqual([]);
    expect(getRendererDirectiveCompletions("nonexistent")).toEqual([]);
  });

  test("an absent layout offers the default layout's properties", () => {
    // A directive block that names no layout still gets one: the renderer
    // resolves the missing name to the default layout, so those are the
    // options the block will really honour.
    expect(getRendererDirectiveCompletions("cytoscape")).toEqual(
      getRendererDirectiveCompletions("cytoscape", DEFAULT_CYTOSCAPE_LAYOUT),
    );
    const labels = getRendererDirectiveCompletions("cytoscape").map(
      (c) => c.label,
    );
    expect(labels).toContain("background-color");
    expect(labels).toContain("layout");
    expect(labels).toContain("rankDir");
  });

  test("a declared layout narrows the offered options", () => {
    const labels = getRendererDirectiveCompletions("cytoscape", "elk").map(
      (c) => c.label,
    );
    expect(labels).toContain("elk-direction");
    expect(labels).toContain("layout");
    expect(labels).not.toContain("rankDir");
    expect(labels).not.toContain("thoroughness");
  });

  test("the manual layout offers only what it can honour", () => {
    const labels = getRendererDirectiveCompletions("cytoscape", "manual").map(
      (c) => c.label,
    );
    expect(labels).toContain("layout");
    expect(labels).toContain("padding");
    // Nothing that would imply the renderer positions nodes for you.
    expect(labels).not.toContain("rankDir");
    expect(labels).not.toContain("spacingFactor");
    expect(labels).not.toContain("nodeDimensionsIncludeLabels");
  });

  test("layout names are matched case-insensitively", () => {
    expect(getRendererDirectiveCompletions("cytoscape", " ELK ")).toEqual(
      getRendererDirectiveCompletions("cytoscape", "elk"),
    );
  });

  test("an unrecognized layout falls back to the default layout", () => {
    expect(getRendererDirectiveCompletions("cytoscape", "elkk")).toEqual(
      getRendererDirectiveCompletions("cytoscape"),
    );
  });
});
