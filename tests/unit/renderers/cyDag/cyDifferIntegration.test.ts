import { afterEach, describe, test, expect } from "vitest";
import {
  diffCyElements,
  applyDiff,
  applyDataUpdates,
} from "src/renderers/cyDag/cyDiffer";
import cytoscape, { Core, ElementsDefinition } from "cytoscape";
import { Compiler } from "src/compiler/driver";
import { Dag } from "src/compiler/dag";
import { makeCyElements } from "src/renderers/cyDag/cyGraphFactory";

describe("diffCyElements integration", () => {
  test("diff from empty to tree produces correct adds", async () => {
    const compiler = new Compiler();
    const compilation = await compiler.compileFromSource(
      "a(a(a(), a()), a(a(), a()))",
    );
    const dag = compilation.DAG;
    const newElements = makeCyElements(dag);

    // Simulate the initial state: empty dag
    const emptyElements = makeCyElements(new Dag(""));

    const diff = diffCyElements(emptyElements, newElements);

    expect(diff.nodesToAdd).toHaveLength(7);
    expect(diff.edgesToAdd).toHaveLength(6);
    expect(diff.nodesToRemove).toHaveLength(0);
    expect(diff.edgesToRemove).toHaveLength(0);
    expect(diff.topologyChanged).toBe(true);

    // All added edges reference valid added node IDs
    const addedNodeIds = new Set(diff.nodesToAdd.map((n) => n.data.id));
    for (const edge of diff.edgesToAdd) {
      expect(addedNodeIds.has(edge.data.source)).toBe(true);
      expect(addedNodeIds.has(edge.data.target)).toBe(true);
    }
  });

  test("headless Cytoscape handles diff path correctly", async () => {
    const compiler = new Compiler();
    const compilation = await compiler.compileFromSource(
      "a(a(a(), a()), a(a(), a()))",
    );
    const newElements = makeCyElements(compilation.DAG);
    const emptyDag = new Dag("");
    const emptyElements = makeCyElements(emptyDag);

    // Simulate diff path: start with empty, diff to tree
    const cy = cytoscape({ headless: true });
    cy.add(emptyElements);

    const diff = diffCyElements(emptyElements, newElements);

    // Apply diff in same order as CytoscapeRenderer
    applyDiff(cy, diff);

    // Verify same structure as full add
    expect(cy.nodes().length).toBe(7);
    expect(cy.edges().length).toBe(6);

    cy.edges().forEach((edge) => {
      expect(edge.source().length).toBe(1);
      expect(edge.target().length).toBe(1);
    });

    const rootNode = cy.getElementById("root-n-a-0");
    expect(rootNode.incomers("edge").length).toBe(2);

    cy.destroy();
  });

  test("diff from partial tree to full tree preserves existing edges", async () => {
    const compiler = new Compiler();
    // Partial: a(a(a(), a()))  — only left subtree
    const partial = await compiler.compileFromSource("a(a(a(), a()))");
    const partialElements = makeCyElements(partial.DAG);

    // Full: a(a(a(), a()), a(a(), a()))  — both subtrees
    const full = await compiler.compileFromSource(
      "a(a(a(), a()), a(a(), a()))",
    );
    const fullElements = makeCyElements(full.DAG);

    // Build headless Cytoscape with partial tree
    const cy = cytoscape({ headless: true });
    cy.add(partialElements);
    expect(cy.nodes().length).toBe(4);
    expect(cy.edges().length).toBe(3);

    // Apply diff to transition to full tree
    const diff = diffCyElements(partialElements, fullElements);

    // With endpoint-based edge IDs, all existing edges are preserved
    // (no source/target changes), only new edges are added
    expect(diff.edgesToRemove).toHaveLength(0);
    expect(diff.edgesToUpdate).toHaveLength(0);
    expect(diff.edgesToAdd).toHaveLength(3);
    expect(diff.nodesToAdd).toHaveLength(3);
    expect(diff.nodesToRemove).toHaveLength(0);

    applyDiff(cy, diff);

    // Verify correct binary tree structure
    expect(cy.nodes().length).toBe(7);
    expect(cy.edges().length).toBe(6);

    // Root has exactly 2 incoming edges
    const root = cy.getElementById("root-n-a-0");
    expect(root.incomers("edge").length).toBe(2);

    // Mid nodes each have exactly 2 incoming edges
    expect(cy.getElementById("root-n-a-1").incomers("edge").length).toBe(2);
    expect(cy.getElementById("root-n-a-4").incomers("edge").length).toBe(2);

    // Leaves have 0 incoming edges
    for (const leafId of [
      "root-n-a-2",
      "root-n-a-3",
      "root-n-a-5",
      "root-n-a-6",
    ]) {
      expect(cy.getElementById(leafId).incomers("edge").length).toBe(0);
    }

    cy.destroy();
  });

  test("element order data is stable after remove and re-add", async () => {
    const compiler = new Compiler();

    // Original: x = f(), a(x), b(x)
    const original = await compiler.compileFromSource("x = f()\na(x)\nb(x)");
    const originalElements = makeCyElements(original.DAG);

    // Remove a(x): x = f(), b(x)
    const reduced = await compiler.compileFromSource("x = f()\nb(x)");
    const reducedElements = makeCyElements(reduced.DAG);

    // Restore a(x): x = f(), a(x), b(x)
    const restored = await compiler.compileFromSource("x = f()\na(x)\nb(x)");
    const restoredElements = makeCyElements(restored.DAG);

    // Build a map of node id → order for easy comparison
    const getOrderMap = (elements: ReturnType<typeof makeCyElements>) => {
      const map = new Map<string, number[]>();
      for (const node of elements.nodes) {
        map.set(node.data.id as string, node.data.order as number[]);
      }
      return map;
    };

    const originalOrders = getOrderMap(originalElements);
    const restoredOrders = getOrderMap(restoredElements);

    // Verify the reduced compilation actually removed a node (sanity check)
    const reducedOrders = getOrderMap(reducedElements);
    expect(reducedOrders.size).toBeLessThan(originalOrders.size);

    // The restored elements should have the same order values as the originals
    expect(restoredOrders.size).toBe(originalOrders.size);
    for (const [id, order] of originalOrders) {
      expect(restoredOrders.get(id)).toEqual(order);
    }
  });

  test("recompiling same source produces empty diff", async () => {
    const compiler = new Compiler();
    const source = "a(a(a(), a()), a(a(), a()))";
    const comp1 = await compiler.compileFromSource(source);
    const comp2 = await compiler.compileFromSource(source);
    const elements1 = makeCyElements(comp1.DAG);
    const elements2 = makeCyElements(comp2.DAG);

    const diff = diffCyElements(elements1, elements2);

    expect(diff.nodesToAdd).toHaveLength(0);
    expect(diff.nodesToRemove).toHaveLength(0);
    expect(diff.nodesToUpdate).toHaveLength(0);
    expect(diff.edgesToAdd).toHaveLength(0);
    expect(diff.edgesToRemove).toHaveLength(0);
    expect(diff.edgesToUpdate).toHaveLength(0);
    expect(diff.topologyChanged).toBe(false);
  });
});

describe("applyDataUpdates", () => {
  let cy: Core;

  afterEach(() => {
    cy.destroy();
  });

  function applyDataUpdateScenario(
    oldElements: ElementsDefinition,
    newElements: ElementsDefinition,
    initialElements: ElementsDefinition = oldElements,
  ) {
    cy = cytoscape({ headless: true });
    cy.add(initialElements);

    const diff = diffCyElements(oldElements, newElements);
    applyDataUpdates(cy, diff);

    return { diff, cy };
  }

  test("updates node data in place", () => {
    const oldElements: ElementsDefinition = {
      nodes: [{ data: { id: "n1", name: "old" } }],
      edges: [],
    };
    const newElements: ElementsDefinition = {
      nodes: [{ data: { id: "n1", name: "new" } }],
      edges: [],
    };

    const { diff, cy } = applyDataUpdateScenario(oldElements, newElements);

    expect(diff.topologyChanged).toBe(false);
    expect(cy.getElementById("n1").data("name")).toBe("new");
  });

  test("updates node classes in place", () => {
    const oldElements: ElementsDefinition = {
      nodes: [{ data: { id: "n1" }, classes: "foo" }],
      edges: [],
    };
    const newElements: ElementsDefinition = {
      nodes: [{ data: { id: "n1" }, classes: "bar" }],
      edges: [],
    };

    const { diff, cy } = applyDataUpdateScenario(oldElements, newElements);

    expect(diff.topologyChanged).toBe(false);
    expect(cy.getElementById("n1").hasClass("bar")).toBe(true);
    expect(cy.getElementById("n1").hasClass("foo")).toBe(false);
  });

  test("updates edge data in place", () => {
    const oldElements: ElementsDefinition = {
      nodes: [{ data: { id: "n1" } }, { data: { id: "n2" } }],
      edges: [{ data: { id: "e1", source: "n1", target: "n2", label: "old" } }],
    };
    const newElements: ElementsDefinition = {
      nodes: [{ data: { id: "n1" } }, { data: { id: "n2" } }],
      edges: [{ data: { id: "e1", source: "n1", target: "n2", label: "new" } }],
    };

    const { diff, cy } = applyDataUpdateScenario(oldElements, newElements);

    expect(diff.topologyChanged).toBe(false);
    expect(cy.getElementById("e1").data("label")).toBe("new");
  });

  test("does not add or remove elements", () => {
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

    const { diff, cy } = applyDataUpdateScenario(oldElements, newElements);

    expect(diff.topologyChanged).toBe(true);
    expect(cy.nodes().length).toBe(1);
  });

  test("no-op on empty diff", () => {
    const elements: ElementsDefinition = {
      nodes: [{ data: { id: "n1", name: "a" } }],
      edges: [],
    };

    const { diff, cy } = applyDataUpdateScenario(elements, elements);

    expect(diff.topologyChanged).toBe(false);
    expect(cy.getElementById("n1").data("name")).toBe("a");
  });
});
