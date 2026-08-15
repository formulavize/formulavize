import { describe, test, expect } from "vitest";
import { Dag } from "src/compiler/dag";
import {
  getCytoscapeDirectiveProperties,
  getCanvasBackgroundColor,
} from "src/renderers/cyDag/cyRendererDirectives";

describe("renderer directive properties", () => {
  test("no directive", () => {
    const testDag = new Dag("DagId");
    expect(getCytoscapeDirectiveProperties(testDag)).toEqual(new Map());
    expect(getCanvasBackgroundColor(testDag)).toBeUndefined();
  });
  test("directive without a background color", () => {
    const testDag = new Dag("DagId");
    testDag.addRendererDirective("cytoscape", {
      styleTags: [],
      styleProperties: new Map([["color", "red"]]),
    });
    expect(getCanvasBackgroundColor(testDag)).toBeUndefined();
  });
  test("directive with inline properties", () => {
    const testDag = new Dag("DagId");
    testDag.addRendererDirective("cytoscape", {
      styleTags: [],
      styleProperties: new Map([["background-color", "#fff"]]),
    });
    expect(getCanvasBackgroundColor(testDag)).toBe("#fff");
  });
  test("directive with style tags", () => {
    const testDag = new Dag("DagId");
    testDag.setStyle("light", new Map([["background-color", "#eee"]]));
    testDag.addRendererDirective("cytoscape", {
      styleTags: [["light"]],
      styleProperties: new Map(),
    });
    expect(getCanvasBackgroundColor(testDag)).toBe("#eee");
  });
  test("inline properties take precedence over style tags", () => {
    const testDag = new Dag("DagId");
    testDag.setStyle("light", new Map([["background-color", "#eee"]]));
    testDag.addRendererDirective("cytoscape", {
      styleTags: [["light"]],
      styleProperties: new Map([["background-color", "#fff"]]),
    });
    expect(getCanvasBackgroundColor(testDag)).toBe("#fff");
  });
  test("unresolved style tag is skipped", () => {
    const testDag = new Dag("DagId");
    testDag.addRendererDirective("cytoscape", {
      styleTags: [["missing"]],
      styleProperties: new Map(),
    });
    expect(getCytoscapeDirectiveProperties(testDag)).toEqual(new Map());
  });
  test("directive for another renderer is not read", () => {
    const testDag = new Dag("DagId");
    testDag.addRendererDirective("minimal", {
      styleTags: [],
      styleProperties: new Map([["background-color", "#fff"]]),
    });
    expect(getCytoscapeDirectiveProperties(testDag)).toEqual(new Map());
    expect(getCanvasBackgroundColor(testDag)).toBeUndefined();
  });
});
