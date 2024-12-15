import { describe, test, expect } from "vitest";
import {
  makeCyNodes,
  makeCyEdges,
  makeCyElements,
} from "../../../src/compiler/cyGraphFactory";
import { Dag } from "../../../src/compiler/dag";

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
      nodes: [{ data: { id: "idX", name: "nameX" } }],
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
        { data: { id: "idX", name: "nameX" } },
        {
          data: {
            id: "idY",
            name: "nameY",
            parent: "childDag",
            lineagePath: "/childDag",
          },
        },
        { data: { id: "childDag", name: "childDagName" }, classes: "s t" },
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
      nodes: [{ data: { id: "idX", name: "nameX" } }],
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
      nodes: [{ data: { id: "idX", name: "nameX" } }],
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
        { data: { id: "idX", name: "nameX" } },
        {
          data: {
            id: "idY",
            name: "nameY",
            parent: "childDag",
            lineagePath: "/childDag",
          },
        },
        { data: { id: "childDag", name: "" } },
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
        { data: { id: "idX", name: "nameX" } },
        {
          data: {
            id: "idY",
            name: "nameY",
            parent: "childDag1",
            lineagePath: "/childDag1",
          },
        },
        { data: { id: "childDag1", name: "" } },
        {
          data: {
            id: "idZ",
            name: "nameZ",
            parent: "childDag2",
            lineagePath: "/childDag2",
          },
        },
        { data: { id: "childDag2", name: "" } },
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
          },
        },
        {
          data: {
            id: "idY",
            name: "nameY",
            parent: "grandChildDag",
            lineagePath: "/childDag/grandChildDag",
          },
        },
        {
          data: {
            id: "grandChildDag",
            name: "",
            parent: "childDag",
            lineagePath: "/childDag",
          },
        },
        { data: { id: "childDag", name: "" } },
      ],
    };
    expect(makeCyElements(parentDag)).toEqual(expectedCyElements);
  });
});
