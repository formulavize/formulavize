import { describe, test, expect } from "vitest";
import { NodeSingular } from "cytoscape";
import { Dag } from "src/compiler/dag";
import {
  getRankDirection,
  makeDagreLayoutOptions,
} from "src/renderers/cyDag/cyLayout";

function makeDagWithDirective(
  rendererName: string,
  properties: [string, string][],
): Dag {
  const dag = new Dag("DagId");
  dag.addRendererDirective(rendererName, {
    styleTags: [],
    styleProperties: new Map(properties),
  });
  return dag;
}

// Minimal stand-in for a cytoscape node exposing only data("order"),
// which is all the sort hint reads.
function makeOrderedNode(order: number[]): NodeSingular {
  return { data: () => order } as unknown as NodeSingular;
}

describe("rank direction resolution", () => {
  test("no directive leaves rankDir unset", () => {
    const dag = new Dag("DagId");
    expect(getRankDirection(dag)).toBeUndefined();
    expect(makeDagreLayoutOptions(dag)).not.toHaveProperty("rankDir");
  });
  test("recognized direction is applied", () => {
    const dag = makeDagWithDirective("cytoscape", [["rankDir", "LR"]]);
    expect(getRankDirection(dag)).toBe("LR");
    expect(makeDagreLayoutOptions(dag).rankDir).toBe("LR");
  });
  test("lowercase direction is normalized", () => {
    const dag = makeDagWithDirective("cytoscape", [["rankDir", "lr"]]);
    expect(getRankDirection(dag)).toBe("LR");
  });
  test("surrounding whitespace is tolerated", () => {
    const dag = makeDagWithDirective("cytoscape", [["rankDir", " BT "]]);
    expect(getRankDirection(dag)).toBe("BT");
  });
  test("unrecognized direction is omitted entirely", () => {
    // Directives are not validated, so a typo silently falls back to the
    // dagre default rather than emitting an invalid option.
    const dag = makeDagWithDirective("cytoscape", [["rankDir", "sideways"]]);
    expect(getRankDirection(dag)).toBeUndefined();
    expect(makeDagreLayoutOptions(dag)).not.toHaveProperty("rankDir");
  });
  test("directive for another renderer is ignored", () => {
    const dag = makeDagWithDirective("minimal", [["rankDir", "LR"]]);
    expect(getRankDirection(dag)).toBeUndefined();
  });
  test("rankDir resolves through a style tag", () => {
    const dag = new Dag("DagId");
    dag.setStyle("compact", new Map([["rankDir", "RL"]]));
    dag.addRendererDirective("cytoscape", {
      styleTags: [["compact"]],
      styleProperties: new Map(),
    });
    expect(getRankDirection(dag)).toBe("RL");
  });
});

describe("dagre layout options", () => {
  test("layout name is always dagre", () => {
    expect(makeDagreLayoutOptions(new Dag("DagId")).name).toBe("dagre");
  });
  test("insertion order sort hint is preserved", () => {
    const { sort } = makeDagreLayoutOptions(new Dag("DagId"));
    expect(sort(makeOrderedNode([0]), makeOrderedNode([1]))).toBeLessThan(0);
    expect(sort(makeOrderedNode([2]), makeOrderedNode([1]))).toBeGreaterThan(0);
    expect(sort(makeOrderedNode([1]), makeOrderedNode([1]))).toBe(0);
  });
  test("sort hint compares nested lineage order", () => {
    const { sort } = makeDagreLayoutOptions(new Dag("DagId"));
    expect(sort(makeOrderedNode([1, 0]), makeOrderedNode([1, 1]))).toBeLessThan(
      0,
    );
    expect(sort(makeOrderedNode([1]), makeOrderedNode([1, 0]))).toBeLessThan(0);
  });
  test("sort hint is present alongside a rankDir", () => {
    const dag = makeDagWithDirective("cytoscape", [["rankDir", "LR"]]);
    const options = makeDagreLayoutOptions(dag);
    expect(options.rankDir).toBe("LR");
    expect(typeof options.sort).toBe("function");
  });
});
