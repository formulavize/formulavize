import { describe, test, expect } from "vitest";
import {
  RecipeTreeNode as Recipe,
  CallTreeNode as Call,
  AssignmentTreeNode as Assignment,
  LocalVarTreeNode as LocalVariable,
  QualifiedVarTreeNode as QualifiedVariable,
  NamespaceTreeNode as Namespace,
  ValueListTreeNode as ValueList,
  StatementListTreeNode as StatementList,
} from "src/compiler/ast";
import { makeDag } from "src/compiler/dagFactory";
import { Compiler } from "src/compiler/driver";
import { ImportCacher } from "src/compiler/importCacher";

const dummyImporter = {} as ImportCacher;

function getNodeIds(dag: Awaited<ReturnType<typeof makeDag>>["dag"]): string[] {
  return dag.getNodeList().map((n) => n.id);
}

function getEdgeIds(dag: Awaited<ReturnType<typeof makeDag>>["dag"]): string[] {
  return dag.getEdgeList().map((e) => e.id);
}

describe("stable ID generation", () => {
  test("same source compiled twice produces identical IDs", async () => {
    const makeRecipe = () =>
      new Recipe([
        new Call("a", new ValueList([])),
        new Call("b", new ValueList([])),
      ]);
    const { dag: dag1 } = await makeDag(makeRecipe(), dummyImporter);
    const { dag: dag2 } = await makeDag(makeRecipe(), dummyImporter);
    expect(getNodeIds(dag1)).toEqual(getNodeIds(dag2));
    expect(getEdgeIds(dag1)).toEqual(getEdgeIds(dag2));
  });

  test("full pipeline: a(a(a(), a()), a(a(), a())) produces correct tree", async () => {
    const compiler = new Compiler();
    const compilation = await compiler.compileFromSource(
      "a(a(a(), a()), a(a(), a()))",
    );
    const dag = compilation.DAG;
    const nodes = dag.getNodeList();
    const edges = dag.getEdgeList();

    expect(nodes).toHaveLength(7);
    expect(edges).toHaveLength(6);

    // All IDs unique
    const nodeIds = new Set(nodes.map((n) => n.id));
    expect(nodeIds.size).toBe(7);

    // Build adjacency: count incoming edges per node
    const inDegree = new Map<string, number>();
    for (const node of nodes) inDegree.set(node.id, 0);
    for (const edge of edges) {
      inDegree.set(edge.destNodeId, (inDegree.get(edge.destNodeId) ?? 0) + 1);
    }

    const degrees = Array.from(inDegree.values()).sort();
    // 4 leaves (0 incoming), 2 mid nodes (2 incoming each), 1 root (2 incoming)
    expect(degrees).toEqual([0, 0, 0, 0, 2, 2, 2]);
  });

  describe("nodes", () => {
    test("root dag has stable ID 'root'", async () => {
      const recipe = new Recipe([]);
      const { dag } = await makeDag(recipe, dummyImporter);
      expect(dag.Id).toBe("root");
    });

    test("node IDs include call name and occurrence index", async () => {
      const recipe = new Recipe([
        new Call("f", new ValueList([])),
        new Call("g", new ValueList([])),
        new Call("f", new ValueList([])),
      ]);
      const { dag } = await makeDag(recipe, dummyImporter);
      const nodeIds = getNodeIds(dag);
      expect(nodeIds).toContain("root-n-f-0");
      expect(nodeIds).toContain("root-n-g-0");
      expect(nodeIds).toContain("root-n-f-1");
    });

    test("adding a node at end preserves existing IDs", async () => {
      const recipe1 = new Recipe([
        new Call("a", new ValueList([])),
        new Call("b", new ValueList([])),
      ]);
      const recipe2 = new Recipe([
        new Call("a", new ValueList([])),
        new Call("b", new ValueList([])),
        new Call("c", new ValueList([])),
      ]);
      const { dag: dag1 } = await makeDag(recipe1, dummyImporter);
      const { dag: dag2 } = await makeDag(recipe2, dummyImporter);

      const ids1 = getNodeIds(dag1);
      const ids2 = getNodeIds(dag2);
      // All original IDs are preserved
      for (const id of ids1) {
        expect(ids2).toContain(id);
      }
      // New node has expected ID
      expect(ids2).toContain("root-n-c-0");
    });

    test("changing a node name changes only that node's ID", async () => {
      const recipe1 = new Recipe([
        new Call("a", new ValueList([])),
        new Call("b", new ValueList([])),
      ]);
      const recipe2 = new Recipe([
        new Call("a", new ValueList([])),
        new Call("c", new ValueList([])),
      ]);
      const { dag: dag1 } = await makeDag(recipe1, dummyImporter);
      const { dag: dag2 } = await makeDag(recipe2, dummyImporter);

      const ids1 = getNodeIds(dag1);
      const ids2 = getNodeIds(dag2);
      // "a" ID preserved
      expect(ids1).toContain("root-n-a-0");
      expect(ids2).toContain("root-n-a-0");
      // "b" gone, "c" appeared
      expect(ids1).toContain("root-n-b-0");
      expect(ids2).not.toContain("root-n-b-0");
      expect(ids2).toContain("root-n-c-0");
    });

    test("node named 'n' does not collide with ID structure", async () => {
      const recipe = new Recipe([
        new Call("n", new ValueList([])),
        new Call("e", new ValueList([])),
        new Call("ns", new ValueList([])),
      ]);
      const { dag } = await makeDag(recipe, dummyImporter);
      const nodeIds = getNodeIds(dag);
      expect(nodeIds).toContain("root-n-n-0");
      expect(nodeIds).toContain("root-n-e-0");
      expect(nodeIds).toContain("root-n-ns-0");
      // All three must be unique
      expect(new Set(nodeIds).size).toBe(3);
    });

    test("unicode node names produce valid IDs", async () => {
      const recipe = new Recipe([
        new Call("sauté", new ValueList([])),
        new Call("慢火", new ValueList([])),
        new Call("_under", new ValueList([])),
      ]);
      const { dag } = await makeDag(recipe, dummyImporter);
      const nodeIds = getNodeIds(dag);
      expect(nodeIds).toContain("root-n-sauté-0");
      expect(nodeIds).toContain("root-n-慢火-0");
      expect(nodeIds).toContain("root-n-_under-0");
      expect(new Set(nodeIds).size).toBe(3);
    });

    test("nested calls with same name produce unique IDs and correct edges", async () => {
      // a(a(a(), a()), a(a(), a()))
      const recipe = new Recipe([
        new Call(
          "a",
          new ValueList([
            new Call(
              "a",
              new ValueList([
                new Call("a", new ValueList([])),
                new Call("a", new ValueList([])),
              ]),
            ),
            new Call(
              "a",
              new ValueList([
                new Call("a", new ValueList([])),
                new Call("a", new ValueList([])),
              ]),
            ),
          ]),
        ),
      ]);
      const { dag } = await makeDag(recipe, dummyImporter);
      const nodes = dag.getNodeList();
      const edges = dag.getEdgeList();
      expect(nodes).toHaveLength(7);
      expect(edges).toHaveLength(6);

      // All node IDs must be unique
      const nodeIds = nodes.map((n) => n.id);
      expect(new Set(nodeIds).size).toBe(7);

      // All edge source/target must reference existing nodes
      const nodeIdSet = new Set(nodeIds);
      for (const edge of edges) {
        expect(nodeIdSet.has(edge.srcNodeId)).toBe(true);
        expect(nodeIdSet.has(edge.destNodeId)).toBe(true);
      }
    });
  });

  describe("edges", () => {
    test("edge IDs encode endpoints", async () => {
      const recipe = new Recipe([
        new Assignment(
          [new LocalVariable("x")],
          new Call("a", new ValueList([])),
        ),
        new Call("b", new ValueList([new QualifiedVariable(["x"])])),
      ]);
      const { dag } = await makeDag(recipe, dummyImporter);
      const edgeIds = getEdgeIds(dag);
      expect(edgeIds).toContain("root-e-root-n-a-0>root-n-b-0-0");
    });

    test("parallel edges between same nodes get unique IDs", async () => {
      // x = a(); b(x, x) — two edges from a to b
      const recipe = new Recipe([
        new Assignment(
          [new LocalVariable("x")],
          new Call("a", new ValueList([])),
        ),
        new Call(
          "b",
          new ValueList([
            new QualifiedVariable(["x"]),
            new QualifiedVariable(["x"]),
          ]),
        ),
      ]);
      const { dag } = await makeDag(recipe, dummyImporter);
      const edgeIds = getEdgeIds(dag);
      expect(edgeIds).toHaveLength(2);
      expect(edgeIds).toContain("root-e-root-n-a-0>root-n-b-0-0");
      expect(edgeIds).toContain("root-e-root-n-a-0>root-n-b-0-1");
    });

    test("edge IDs are stable across identical compilations", async () => {
      const makeRecipe = () =>
        new Recipe([
          new Assignment(
            [new LocalVariable("x")],
            new Call("a", new ValueList([])),
          ),
          new Call("b", new ValueList([new QualifiedVariable(["x"])])),
        ]);
      const { dag: dag1 } = await makeDag(makeRecipe(), dummyImporter);
      const { dag: dag2 } = await makeDag(makeRecipe(), dummyImporter);
      expect(getEdgeIds(dag1)).toEqual(getEdgeIds(dag2));
    });
  });

  describe("namespaces", () => {
    test("namespace nodes get scoped IDs", async () => {
      const recipe = new Recipe([
        new Namespace(
          "myNs",
          new StatementList([new Call("inner", new ValueList([]))]),
        ),
      ]);
      const { dag } = await makeDag(recipe, dummyImporter);
      const childDags = dag.getChildDags();
      expect(childDags).toHaveLength(1);
      expect(childDags[0].Id).toBe("root-ns-myNs-0");

      const innerNodeIds = childDags[0].getNodeList().map((n) => n.id);
      expect(innerNodeIds).toContain("root-ns-myNs-0-n-inner-0");
    });

    test("duplicate namespace names get unique scoped IDs", async () => {
      const recipe = new Recipe([
        new Namespace(
          "foo",
          new StatementList([new Call("a", new ValueList([]))]),
        ),
        new Namespace(
          "foo",
          new StatementList([new Call("b", new ValueList([]))]),
        ),
      ]);
      const { dag } = await makeDag(recipe, dummyImporter);
      const childDags = dag.getChildDags();
      expect(childDags).toHaveLength(2);

      expect(childDags[0].Id).toBe("root-ns-foo-0");
      expect(childDags[1].Id).toBe("root-ns-foo-1");

      const ids0 = childDags[0].getNodeList().map((n) => n.id);
      const ids1 = childDags[1].getNodeList().map((n) => n.id);
      expect(ids0).toContain("root-ns-foo-0-n-a-0");
      expect(ids1).toContain("root-ns-foo-1-n-b-0");
    });

    test("node named 'n' does not collide with namespace named 'n'", async () => {
      const recipe = new Recipe([
        new Call("n", new ValueList([])),
        new Namespace(
          "n",
          new StatementList([new Call("inner", new ValueList([]))]),
        ),
      ]);
      const { dag } = await makeDag(recipe, dummyImporter);
      const nodeId = "root-n-n-0";
      const nsScope = "root-ns-n-0";

      expect(getNodeIds(dag)).toContain(nodeId);
      expect(dag.getChildDags()[0].Id).toBe(nsScope);
      expect(nodeId).not.toBe(nsScope);
    });
  });
});
