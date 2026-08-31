import { describe, test, expect } from "vitest";
import { PropertyCompletion } from "src/rendererApi";
import { cytoscapeCompletions } from "src/renderers/cyDag/completions";
import { DEFAULT_CYTOSCAPE_LAYOUT } from "src/renderers/cyDag/layouts";

function names(properties: PropertyCompletion[]): string[] {
  return properties.map((property) => property.name);
}

function directiveNames(layout?: string): string[] {
  const declared = new Map(layout === undefined ? [] : [["layout", layout]]);
  return names(cytoscapeCompletions.directiveProperties(declared));
}

describe("cytoscape style properties", () => {
  test("returns a non-empty list", () => {
    expect(cytoscapeCompletions.styleProperties().length).toBeGreaterThan(0);
  });

  test("no duplicate names", () => {
    const allNames = names(cytoscapeCompletions.styleProperties());
    expect(new Set(allNames).size).toBe(allNames.length);
  });

  test("node and edge offers are narrowed from the full list", () => {
    const nodeNames = names(cytoscapeCompletions.styleProperties("node"));
    const edgeNames = names(cytoscapeCompletions.styleProperties("edge"));

    expect(nodeNames).toContain("border-width");
    expect(nodeNames).not.toContain("curve-style");
    expect(edgeNames).toContain("curve-style");
    expect(edgeNames).not.toContain("border-width");
  });

  test("subgraphs are styled like nodes", () => {
    expect(cytoscapeCompletions.styleProperties("subgraph")).toEqual(
      cytoscapeCompletions.styleProperties("node"),
    );
  });

  test("an unrecognized element type falls back to the full list", () => {
    expect(cytoscapeCompletions.styleProperties("sandwich")).toEqual(
      cytoscapeCompletions.styleProperties(),
    );
  });
});

describe("cytoscape directive properties", () => {
  test("cover the supported keys", () => {
    const labels = directiveNames("dagre");
    expect(labels).toContain("rankDir");
    expect(labels).toContain("background-color");
  });

  test("exclude stylesheet properties", () => {
    const labels = directiveNames();
    expect(labels).not.toContain("border-width");
    expect(labels).not.toContain("curve-style");
  });

  test("an absent layout offers the default layout's properties", () => {
    // A directive block that names no layout still gets one: the renderer
    // resolves the missing name to the default layout, so those are the
    // options the block will really honour.
    expect(directiveNames()).toEqual(directiveNames(DEFAULT_CYTOSCAPE_LAYOUT));
    const labels = directiveNames();
    expect(labels).toContain("background-color");
    expect(labels).toContain("layout");
    expect(labels).toContain("rankDir");
  });

  test("a declared layout narrows the offered options", () => {
    const labels = directiveNames("elk");
    expect(labels).toContain("elk-direction");
    expect(labels).toContain("layout");
    expect(labels).not.toContain("rankDir");
    expect(labels).not.toContain("thoroughness");
  });

  test("the manual layout offers only what it can honour", () => {
    const labels = directiveNames("manual");
    expect(labels).toContain("layout");
    expect(labels).toContain("padding");
    // Nothing that would imply the renderer positions nodes for you.
    expect(labels).not.toContain("rankDir");
    expect(labels).not.toContain("spacingFactor");
    expect(labels).not.toContain("nodeDimensionsIncludeLabels");
  });

  test("layout names are matched case-insensitively", () => {
    expect(directiveNames(" ELK ")).toEqual(directiveNames("elk"));
  });

  test("an unrecognized layout falls back to the default layout", () => {
    expect(directiveNames("elkk")).toEqual(directiveNames());
  });

  test("keys other than the layout do not disturb the offer", () => {
    const declared = new Map([
      ["background-color", "#fff"],
      ["layout", "elk"],
    ]);
    expect(names(cytoscapeCompletions.directiveProperties(declared))).toEqual(
      directiveNames("elk"),
    );
  });
});
