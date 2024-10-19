import { describe, test, expect } from "vitest";
import {
  makeCyNodes,
  makeCyEdges,
  makeCyElements,
} from "../../../src/common/cyGraphFactory";
import { TOP_LEVEL_DAG_ID } from "../../../src/common/constants";
import { Dag } from "../../../src/common/dag";

describe("makes cytoscape elements", () => {
  test("with two nodes", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map(),
    });
    testDag.addNode({
      id: "idY",
      name: "nameY",
      styleTags: ["s", "t"],
      styleProperties: new Map([["a", "1"]]),
    });
    const expectedCyNodes = [
      { data: { id: "idX", name: "nameX" } },
      { data: { id: "idY", name: "nameY" }, classes: "s t" },
    ];
    expect(makeCyNodes(testDag)).toEqual(expectedCyNodes);
  });
  test("with one edge", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
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
      styleTags: ["s", "t"],
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
  test("with top level dag only", () => {
    const topLevelDag = new Dag(TOP_LEVEL_DAG_ID);
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
    const parentDag = new Dag(TOP_LEVEL_DAG_ID);
    parentDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map(),
    });

    const childDag = new Dag("childDag");
    parentDag.addChildDag(childDag);

    const expectedCyNodes = {
      edges: [],
      nodes: [{ data: { id: "idX", name: "nameX" } }],
    };
    expect(makeCyElements(parentDag)).toEqual(expectedCyNodes);
  });
  test("with child dag", () => {
    const parentDag = new Dag(TOP_LEVEL_DAG_ID);
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

    const expectedCyNodes = {
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
    expect(makeCyElements(parentDag)).toEqual(expectedCyNodes);
  });
  test("with multiple child dags", () => {
    const parentDag = new Dag(TOP_LEVEL_DAG_ID);
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

    const expectedCyNodes = {
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
    expect(makeCyElements(parentDag)).toEqual(expectedCyNodes);
  });
  test("with nested child dag", () => {
    const parentDag = new Dag(TOP_LEVEL_DAG_ID);

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

    const expectedCyNodes = {
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
        { data: { id: "grandChildDag", name: "", parent: "childDag" } },
        { data: { id: "childDag", name: "" } },
      ],
    };
    expect(makeCyElements(parentDag)).toEqual(expectedCyNodes);
  });
});
