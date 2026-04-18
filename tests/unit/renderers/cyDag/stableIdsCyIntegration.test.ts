import { describe, test, expect } from "vitest";
import {
  RecipeTreeNode as Recipe,
  CallTreeNode as Call,
  AssignmentTreeNode as Assignment,
  LocalVarTreeNode as LocalVariable,
  QualifiedVarTreeNode as QualifiedVariable,
  ValueListTreeNode as ValueList,
} from "src/compiler/ast";
import { makeDag } from "src/compiler/dagFactory";
import { Compiler } from "src/compiler/driver";
import { ImportCacher } from "src/compiler/importCacher";
import { makeCyElements } from "src/renderers/cyDag/cyGraphFactory";
import cytoscape from "cytoscape";

const dummyImporter = {} as ImportCacher;

describe("stable IDs with Cytoscape integration", () => {
  test("unicode node IDs work in headless Cytoscape selectors", async () => {
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("x")],
        new Call("sauté", new ValueList([])),
      ),
      new Call("慢火", new ValueList([new QualifiedVariable(["x"])])),
    ]);
    const { dag } = await makeDag(recipe, dummyImporter);
    const cyElements = makeCyElements(dag);

    const cy = cytoscape({ headless: true });
    cy.add(cyElements);

    // Attribute selectors must resolve unicode IDs
    const sauteNode = cy.elements("node[id = 'root-n-sauté-0']");
    expect(sauteNode.length).toBe(1);

    const simmerNode = cy.elements("node[id = 'root-n-慢火-0']");
    expect(simmerNode.length).toBe(1);

    // Edge with unicode endpoint IDs must resolve
    const edges = cy.edges();
    expect(edges.length).toBe(1);
    expect(edges[0].source().id()).toBe("root-n-sauté-0");
    expect(edges[0].target().id()).toBe("root-n-慢火-0");

    // Edge attribute selector with > separator must work
    const edgeSel = cy.elements(
      "edge[id = 'root-e-root-n-sauté-0>root-n-慢火-0-0']",
    );
    expect(edgeSel.length).toBe(1);

    cy.destroy();
  });

  test("edge IDs with > work in Cytoscape attribute selectors but not # selectors", async () => {
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("x")],
        new Call("a", new ValueList([])),
      ),
      new Call("b", new ValueList([new QualifiedVariable(["x"])])),
    ]);
    const { dag } = await makeDag(recipe, dummyImporter);
    const cyElements = makeCyElements(dag);

    const cy = cytoscape({ headless: true });
    cy.add(cyElements);

    const edgeId = "root-e-root-n-a-0>root-n-b-0-0";

    // getElementById: always works
    expect(cy.getElementById(edgeId).length).toBe(1);

    // Attribute selector: works (> is inside quotes)
    expect(cy.elements(`edge[id = '${edgeId}']`).length).toBe(1);

    // # selector: fails (> is a CSS combinator outside quotes)
    expect(cy.elements(`#${edgeId}`).length).toBe(0);

    cy.destroy();
  });

  test("CyElements for tree have correct edge source/target", async () => {
    const compiler = new Compiler();
    const compilation = await compiler.compileFromSource(
      "a(a(a(), a()), a(a(), a()))",
    );
    const dag = compilation.DAG;
    const cyElements = makeCyElements(dag);

    expect(cyElements.nodes).toHaveLength(7);
    expect(cyElements.edges).toHaveLength(6);

    // All node IDs are unique
    const nodeIds = new Set(cyElements.nodes.map((n) => n.data.id));
    expect(nodeIds.size).toBe(7);

    // All edge source/target reference valid node IDs
    for (const edge of cyElements.edges) {
      expect(nodeIds.has(edge.data.source)).toBe(true);
      expect(nodeIds.has(edge.data.target)).toBe(true);
    }

    // Verify correct tree structure via in-degree
    const inDegree = new Map<string, number>();
    for (const node of cyElements.nodes)
      inDegree.set(node.data.id as string, 0);
    for (const edge of cyElements.edges) {
      const target = edge.data.target as string;
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    }
    const degrees = Array.from(inDegree.values()).sort();
    expect(degrees).toEqual([0, 0, 0, 0, 2, 2, 2]);
  });

  test("headless Cytoscape resolves edges correctly with stable IDs", async () => {
    const compiler = new Compiler();
    const compilation = await compiler.compileFromSource(
      "a(a(a(), a()), a(a(), a()))",
    );
    const cyElements = makeCyElements(compilation.DAG);

    // Create headless Cytoscape instance and add elements
    const cy = cytoscape({ headless: true });
    cy.add(cyElements);

    // Verify all 7 nodes exist
    expect(cy.nodes().length).toBe(7);
    // Verify all 6 edges exist
    expect(cy.edges().length).toBe(6);

    // Verify every edge has valid source and target
    cy.edges().forEach((edge) => {
      const src = edge.source();
      const tgt = edge.target();
      expect(src.length).toBe(1);
      expect(tgt.length).toBe(1);
      // Source and target should be different nodes
      expect(src.id()).not.toBe(tgt.id());
    });

    // Verify tree structure: root node (a-0) should have 2 incoming edges
    const rootNode = cy.getElementById("root-n-a-0");
    expect(rootNode.length).toBe(1);
    expect(rootNode.incomers("edge").length).toBe(2);

    // Mid nodes should each have 2 incoming edges
    const mid1 = cy.getElementById("root-n-a-1");
    const mid2 = cy.getElementById("root-n-a-4");
    expect(mid1.incomers("edge").length).toBe(2);
    expect(mid2.incomers("edge").length).toBe(2);

    // Leaf nodes should have 0 incoming edges
    for (const leafId of [
      "root-n-a-2",
      "root-n-a-3",
      "root-n-a-5",
      "root-n-a-6",
    ]) {
      const leaf = cy.getElementById(leafId);
      expect(leaf.incomers("edge").length).toBe(0);
    }

    cy.destroy();
  });
});
