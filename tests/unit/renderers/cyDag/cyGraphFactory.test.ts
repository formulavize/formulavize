import { describe, test, expect } from "vitest";
import {
  makeCyNodes,
  makeCyEdges,
  makeCyElements,
} from "src/renderers/cyDag/cyGraphFactory";
import { Dag } from "src/compiler/dag";

describe("makes cytoscape elements", () => {
  test("with two nodes", () => {
    const testDag = new Dag("DagId");
    testDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map(),
    });
    testDag.addNode({
      id: "idY",
      name: "nameY",
      styleTags: [["s"], ["t"]],
      styleProperties: new Map([["a", "1"]]),
    });
    const expectedCyNodes = [
      { data: { id: "idX", name: "nameX" } },
      { data: { id: "idY", name: "nameY" }, classes: "s t" },
    ];
    expect(makeCyNodes(testDag)).toEqual(expectedCyNodes);
  });
  test("with one edge", () => {
    const testDag = new Dag("DagId");
    testDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map(),
    });
    testDag.addNode({
      id: "idY",
      name: "nameY",
      styleTags: [],
      styleProperties: new Map(),
    });
    testDag.addEdge({
      id: "idZ",
      name: "nameZ",
      srcNodeId: "idX",
      destNodeId: "idY",
      styleTags: [["s"], ["t"]],
      styleProperties: new Map([["a", "1"]]),
    });
    const expectedCyEdges = [
      {
        data: {
          id: "idZ",
          name: "nameZ",
          source: "idX",
          target: "idY",
        },
        classes: "s t",
      },
    ];
    expect(makeCyEdges(testDag)).toEqual(expectedCyEdges);
  });
  test("dag style tags on root", () => {
    const dagStyleTags = [["s"], ["t"]];
    const dagStyleProperties = new Map([["a", "1"]]);
    const testDag = new Dag("D", null, "", dagStyleTags, dagStyleProperties);
    testDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map(),
    });
    // root level dag styles are ignored
    const expectedCyElements = {
      edges: [],
      nodes: [{ data: { id: "idX", name: "nameX", order: [0] } }],
    };
    expect(makeCyElements(testDag)).toEqual(expectedCyElements);
  });
  test("dag style tags on child", () => {
    const parentDag = new Dag("DagId");
    parentDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map(),
    });
    const dagStyleTags = [["s"], ["t"]];
    const dagStyleProperties = new Map([["a", "1"]]);
    const childDag = new Dag(
      "childDag",
      parentDag,
      "childDagName",
      dagStyleTags,
      dagStyleProperties,
    );
    childDag.addNode({
      id: "idY",
      name: "nameY",
      styleTags: [],
      styleProperties: new Map(),
    });

    const expectedCyElements = {
      edges: [],
      nodes: [
        { data: { id: "idX", name: "nameX", order: [0] } },
        {
          data: {
            id: "idY",
            name: "nameY",
            parent: "childDag",
            lineagePath: "/childDag",
            order: [1, 0],
          },
        },
        {
          data: {
            id: "childDag",
            name: "childDagName",
            order: [1],
          },
          classes: "s t",
        },
      ],
    };
    expect(makeCyElements(parentDag)).toEqual(expectedCyElements);
  });
  test("with top level dag only", () => {
    const topLevelDag = new Dag("DagId");
    topLevelDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map(),
    });
    const expectedCyNodes = {
      edges: [],
      nodes: [{ data: { id: "idX", name: "nameX", order: [0] } }],
    };
    expect(makeCyElements(topLevelDag)).toEqual(expectedCyNodes);
  });
  test("with empty child dag", () => {
    const parentDag = new Dag("DagId");
    parentDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map(),
    });

    const childDag = new Dag("childDag");
    parentDag.addChildDag(childDag);

    const expectedCyElements = {
      edges: [],
      nodes: [{ data: { id: "idX", name: "nameX", order: [0] } }],
    };
    expect(makeCyElements(parentDag)).toEqual(expectedCyElements);
  });
  test("with child dag", () => {
    const parentDag = new Dag("DagId");
    parentDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map(),
    });

    const childDag = new Dag("childDag");
    childDag.addNode({
      id: "idY",
      name: "nameY",
      styleTags: [],
      styleProperties: new Map(),
    });

    parentDag.addChildDag(childDag);

    const expectedCyElements = {
      edges: [],
      nodes: [
        { data: { id: "idX", name: "nameX", order: [0] } },
        {
          data: {
            id: "idY",
            name: "nameY",
            parent: "childDag",
            lineagePath: "/childDag",
            order: [1, 0],
          },
        },
        { data: { id: "childDag", name: "", order: [1] } },
      ],
    };
    expect(makeCyElements(parentDag)).toEqual(expectedCyElements);
  });
  test("with multiple child dags", () => {
    const parentDag = new Dag("DagId");
    parentDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map(),
    });

    const childDag1 = new Dag("childDag1");
    childDag1.addNode({
      id: "idY",
      name: "nameY",
      styleTags: [],
      styleProperties: new Map(),
    });
    parentDag.addChildDag(childDag1);

    const childDag2 = new Dag("childDag2", parentDag);
    childDag2.addNode({
      id: "idZ",
      name: "nameZ",
      styleTags: [],
      styleProperties: new Map(),
    });

    const expectedCyElements = {
      edges: [],
      nodes: [
        { data: { id: "idX", name: "nameX", order: [0] } },
        {
          data: {
            id: "idY",
            name: "nameY",
            parent: "childDag1",
            lineagePath: "/childDag1",
            order: [1, 0],
          },
        },
        { data: { id: "childDag1", name: "", order: [1] } },
        {
          data: {
            id: "idZ",
            name: "nameZ",
            parent: "childDag2",
            lineagePath: "/childDag2",
            order: [2, 0],
          },
        },
        { data: { id: "childDag2", name: "", order: [2] } },
      ],
    };
    expect(makeCyElements(parentDag)).toEqual(expectedCyElements);
  });
  test("with nested child dag", () => {
    const parentDag = new Dag("DagId");

    const childDag = new Dag("childDag", parentDag);

    const grandChildDag = new Dag("grandChildDag", childDag);
    grandChildDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map(),
    });
    grandChildDag.addNode({
      id: "idY",
      name: "nameY",
      styleTags: [],
      styleProperties: new Map(),
    });
    grandChildDag.addEdge({
      id: "idZ",
      name: "nameZ",
      srcNodeId: "idX",
      destNodeId: "idY",
      styleTags: [],
      styleProperties: new Map(),
    });

    const expectedCyElements = {
      edges: [
        {
          data: {
            id: "idZ",
            name: "nameZ",
            source: "idX",
            target: "idY",
            lineagePath: "/childDag/grandChildDag",
          },
        },
      ],
      nodes: [
        {
          data: {
            id: "idX",
            name: "nameX",
            parent: "grandChildDag",
            lineagePath: "/childDag/grandChildDag",
            order: [0, 0, 0],
          },
        },
        {
          data: {
            id: "idY",
            name: "nameY",
            parent: "grandChildDag",
            lineagePath: "/childDag/grandChildDag",
            order: [0, 0, 1],
          },
        },
        {
          data: {
            id: "grandChildDag",
            name: "",
            parent: "childDag",
            lineagePath: "/childDag",
            order: [0, 0],
          },
        },
        { data: { id: "childDag", name: "", order: [0] } },
      ],
    };
    expect(makeCyElements(parentDag)).toEqual(expectedCyElements);
  });
});

const makeSimpleNode = (id: string) => ({
  id,
  name: id,
  styleTags: [] as string[][],
  styleProperties: new Map<string, string>(),
});

const findNodeOrder = (
  nodes: ReturnType<typeof makeCyElements>["nodes"],
  id: string,
) => nodes.find((n) => n.data.id === id)?.data.order as number[] | undefined;

describe("element ordering", () => {
  test("interleaved nodes and child dags preserve source order", () => {
    const root = new Dag("root");
    root.addNode(makeSimpleNode("a")); // order 0
    const ns1 = new Dag("ns1");
    ns1.addNode(makeSimpleNode("b"));
    root.addChildDag(ns1); // order 1
    root.addNode(makeSimpleNode("c")); // order 2
    const ns2 = new Dag("ns2");
    ns2.addNode(makeSimpleNode("d"));
    root.addChildDag(ns2); // order 3

    const result = makeCyElements(root);
    // Root-level nodes get single-element tuples
    expect(findNodeOrder(result.nodes, "a")).toEqual([0]);
    expect(findNodeOrder(result.nodes, "c")).toEqual([2]);
    // Child nodes get [parentOrder, localOrder] lists
    expect(findNodeOrder(result.nodes, "b")).toEqual([1, 0]);
    // Compound parents get [parentOrder] lists
    expect(findNodeOrder(result.nodes, "ns1")).toEqual([1]);
    expect(findNodeOrder(result.nodes, "d")).toEqual([3, 0]);
    expect(findNodeOrder(result.nodes, "ns2")).toEqual([3]);
  });

  test("child nodes get list with parent and local order", () => {
    const root = new Dag("root");
    root.addNode(makeSimpleNode("x")); // order 0
    root.addNode(makeSimpleNode("y")); // order 1
    const ns = new Dag("ns");
    ns.addNode(makeSimpleNode("inner1")); // own order 0 within ns
    ns.addNode(makeSimpleNode("inner2")); // own order 1 within ns
    root.addChildDag(ns); // order 2

    const result = makeCyElements(root);
    // inner nodes get [2, localOrder] lists
    expect(findNodeOrder(result.nodes, "inner1")).toEqual([2, 0]);
    expect(findNodeOrder(result.nodes, "inner2")).toEqual([2, 1]);
    expect(findNodeOrder(result.nodes, "ns")).toEqual([2]);
  });

  test("deeply nested descendants get full order path", () => {
    const root = new Dag("root");
    root.addNode(makeSimpleNode("before")); // order 0
    const outer = new Dag("outer");
    const inner = new Dag("inner", outer);
    inner.addNode(makeSimpleNode("deep"));
    root.addChildDag(outer); // order 1

    const result = makeCyElements(root);
    expect(findNodeOrder(result.nodes, "before")).toEqual([0]);
    // deep node: root order 1, outer local 0, inner local 0
    expect(findNodeOrder(result.nodes, "deep")).toEqual([1, 0, 0]);
    expect(findNodeOrder(result.nodes, "inner")).toEqual([1, 0]);
    expect(findNodeOrder(result.nodes, "outer")).toEqual([1]);
  });

  test("merged dag elements get offset order values", () => {
    const root = new Dag("root");
    root.addNode(makeSimpleNode("a")); // order 0

    const imported = new Dag("imported");
    imported.addNode(makeSimpleNode("b")); // own order 0
    imported.addNode(makeSimpleNode("c")); // own order 1
    root.mergeDag(imported);

    root.addNode(makeSimpleNode("d")); // order 3

    const result = makeCyElements(root);
    expect(findNodeOrder(result.nodes, "a")).toEqual([0]);
    expect(findNodeOrder(result.nodes, "b")).toEqual([1]);
    expect(findNodeOrder(result.nodes, "c")).toEqual([2]);
    expect(findNodeOrder(result.nodes, "d")).toEqual([3]);
  });

  test("empty child dag produces no compound node or order entry", () => {
    const root = new Dag("root");
    root.addNode(makeSimpleNode("a")); // order 0
    const empty = new Dag("empty");
    root.addChildDag(empty); // order 1
    root.addNode(makeSimpleNode("b")); // order 2

    const result = makeCyElements(root);
    const ids = result.nodes.map((n) => n.data.id);
    expect(ids).not.toContain("empty");
    expect(findNodeOrder(result.nodes, "a")).toEqual([0]);
    expect(findNodeOrder(result.nodes, "b")).toEqual([2]);
  });
});
