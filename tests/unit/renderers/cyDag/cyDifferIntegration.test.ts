import { describe, test, expect } from "vitest";
import { diffCyElements, applyDiff } from "src/renderers/cyDag/cyDiffer";
import cytoscape from "cytoscape";
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
