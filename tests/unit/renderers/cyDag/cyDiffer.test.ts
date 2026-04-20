import { describe, test, expect } from "vitest";
import { diffCyElements } from "src/renderers/cyDag/cyDiffer";
import { ElementsDefinition } from "cytoscape";

describe("diffCyElements", () => {
  test("identical elements produce empty diff with no topology change", () => {
    const elements: ElementsDefinition = {
      nodes: [{ data: { id: "n1", name: "a" } }],
      edges: [{ data: { id: "e1", source: "n1", target: "n2" } }],
    };
    const diff = diffCyElements(elements, elements);
    expect(diff.nodesToAdd).toEqual([]);
    expect(diff.nodesToRemove).toEqual([]);
    expect(diff.nodesToUpdate).toEqual([]);
    expect(diff.edgesToAdd).toEqual([]);
    expect(diff.edgesToRemove).toEqual([]);
    expect(diff.edgesToUpdate).toEqual([]);
    expect(diff.topologyChanged).toBe(false);
  });

  test("added node sets topologyChanged", () => {
    const oldElements: ElementsDefinition = {
      nodes: [{ data: { id: "n1", name: "a" } }],
      edges: [],
    };
    const newElements: ElementsDefinition = {
      nodes: [
        { data: { id: "n1", name: "a" } },
        { data: { id: "n2", name: "b" } },
      ],
      edges: [],
    };
    const diff = diffCyElements(oldElements, newElements);
    expect(diff.nodesToAdd).toEqual([{ data: { id: "n2", name: "b" } }]);
    expect(diff.topologyChanged).toBe(true);
  });

  test("removed node sets topologyChanged", () => {
    const oldElements: ElementsDefinition = {
      nodes: [
        { data: { id: "n1", name: "a" } },
        { data: { id: "n2", name: "b" } },
      ],
      edges: [],
    };
    const newElements: ElementsDefinition = {
      nodes: [{ data: { id: "n1", name: "a" } }],
      edges: [],
    };
    const diff = diffCyElements(oldElements, newElements);
    expect(diff.nodesToRemove).toEqual(["n2"]);
    expect(diff.topologyChanged).toBe(true);
  });

  test("changed node data produces update without topology change", () => {
    const oldElements: ElementsDefinition = {
      nodes: [{ data: { id: "n1", name: "a" } }],
      edges: [],
    };
    const newElements: ElementsDefinition = {
      nodes: [{ data: { id: "n1", name: "b" } }],
      edges: [],
    };
    const diff = diffCyElements(oldElements, newElements);
    expect(diff.nodesToUpdate).toEqual([
      { id: "n1", data: { id: "n1", name: "b" }, classes: undefined },
    ]);
    expect(diff.topologyChanged).toBe(false);
  });

  test("changed node classes produces update without topology change", () => {
    const oldElements: ElementsDefinition = {
      nodes: [{ data: { id: "n1", name: "a" }, classes: "foo" }],
      edges: [],
    };
    const newElements: ElementsDefinition = {
      nodes: [{ data: { id: "n1", name: "a" }, classes: "bar" }],
      edges: [],
    };
    const diff = diffCyElements(oldElements, newElements);
    expect(diff.nodesToUpdate).toEqual([
      { id: "n1", data: { id: "n1", name: "a" }, classes: "bar" },
    ]);
    expect(diff.topologyChanged).toBe(false);
  });

  test("added edge sets topologyChanged", () => {
    const oldElements: ElementsDefinition = {
      nodes: [],
      edges: [],
    };
    const newElements: ElementsDefinition = {
      nodes: [],
      edges: [{ data: { id: "e1", source: "n1", target: "n2" } }],
    };
    const diff = diffCyElements(oldElements, newElements);
    expect(diff.edgesToAdd).toHaveLength(1);
    expect(diff.topologyChanged).toBe(true);
  });

  test("removed edge sets topologyChanged", () => {
    const oldElements: ElementsDefinition = {
      nodes: [],
      edges: [{ data: { id: "e1", source: "n1", target: "n2" } }],
    };
    const newElements: ElementsDefinition = {
      nodes: [],
      edges: [],
    };
    const diff = diffCyElements(oldElements, newElements);
    expect(diff.edgesToRemove).toEqual(["e1"]);
    expect(diff.topologyChanged).toBe(true);
  });

  test("changed edge source/target sets topologyChanged", () => {
    const oldElements: ElementsDefinition = {
      nodes: [],
      edges: [{ data: { id: "e1", source: "n1", target: "n2" } }],
    };
    const newElements: ElementsDefinition = {
      nodes: [],
      edges: [{ data: { id: "e1", source: "n1", target: "n3" } }],
    };
    const diff = diffCyElements(oldElements, newElements);
    expect(diff.topologyChanged).toBe(true);
    // Cytoscape edges have immutable source/target, so changed edges must be removed and re-added
    expect(diff.edgesToRemove).toEqual(["e1"]);
    expect(diff.edgesToAdd).toEqual([
      { data: { id: "e1", source: "n1", target: "n3" } },
    ]);
    expect(diff.edgesToUpdate).toHaveLength(0);
  });

  test("changed edge data without source/target change does not set topologyChanged", () => {
    const oldElements: ElementsDefinition = {
      nodes: [],
      edges: [{ data: { id: "e1", source: "n1", target: "n2", name: "x" } }],
    };
    const newElements: ElementsDefinition = {
      nodes: [],
      edges: [{ data: { id: "e1", source: "n1", target: "n2", name: "y" } }],
    };
    const diff = diffCyElements(oldElements, newElements);
    expect(diff.topologyChanged).toBe(false);
    expect(diff.edgesToUpdate).toEqual([
      {
        id: "e1",
        data: { id: "e1", source: "n1", target: "n2", name: "y" },
        classes: undefined,
      },
    ]);
  });

  test("identical array data does not produce update", () => {
    const oldElements: ElementsDefinition = {
      nodes: [{ data: { id: "n1", name: "a", order: [0, 1] } }],
      edges: [],
    };
    const newElements: ElementsDefinition = {
      nodes: [{ data: { id: "n1", name: "a", order: [0, 1] } }],
      edges: [],
    };
    const diff = diffCyElements(oldElements, newElements);
    expect(diff.nodesToUpdate).toEqual([]);
    expect(diff.topologyChanged).toBe(false);
  });

  test("changed array data produces update", () => {
    const oldElements: ElementsDefinition = {
      nodes: [{ data: { id: "n1", name: "a", order: [0, 1] } }],
      edges: [],
    };
    const newElements: ElementsDefinition = {
      nodes: [{ data: { id: "n1", name: "a", order: [0, 2] } }],
      edges: [],
    };
    const diff = diffCyElements(oldElements, newElements);
    expect(diff.nodesToUpdate).toHaveLength(1);
    expect(diff.topologyChanged).toBe(false);
  });

  test("empty old and new elements produce empty diff", () => {
    const elements: ElementsDefinition = { nodes: [], edges: [] };
    const diff = diffCyElements(elements, elements);
    expect(diff.topologyChanged).toBe(false);
    expect(diff.nodesToAdd).toEqual([]);
    expect(diff.nodesToRemove).toEqual([]);
    expect(diff.edgesToAdd).toEqual([]);
    expect(diff.edgesToRemove).toEqual([]);
  });
});
