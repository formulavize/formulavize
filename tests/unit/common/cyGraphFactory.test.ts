import { describe, test, expect } from "vitest";
import {
  keyStartsWithNonCytoscapePrefix,
  filterCytoscapeProperties,
  makeCyNodes,
  makeCyEdges,
  makeNodeStylesheets,
  makeEdgeStyleSheets,
  makeClassStyleSheets,
  makeNameStyleSheets,
  makeCyElements,
  getBaseStylesheet,
  makeCyStylesheets,
} from "../../../src/common/cyGraphFactory";
import {
  DESCRIPTION_PROPERTY,
  TOP_LEVEL_DAG_ID,
} from "../../../src/common/constants";
import { Dag } from "../../../src/common/dag";

describe("filters out non-cytoscape properties", () => {
  test("property with non-cytoscape prefix", () => {
    expect(
      keyStartsWithNonCytoscapePrefix(DESCRIPTION_PROPERTY + "-font-size"),
    ).toBe(true);
  });
  test("property without non-cytoscape prefix", () => {
    expect(keyStartsWithNonCytoscapePrefix("test")).toBe(false);
  });
  test("empty map", () => {
    const testMap = new Map();
    const expectedMap = new Map();
    expect(filterCytoscapeProperties(testMap)).toEqual(expectedMap);
  });
  test("map without description property", () => {
    const testMap = new Map([
      ["a", "1"],
      ["b", "2"],
    ]);
    const expectedMap = new Map([
      ["a", "1"],
      ["b", "2"],
    ]);
    expect(filterCytoscapeProperties(testMap)).toEqual(expectedMap);
  });
  test("map with only description property", () => {
    const testMap = new Map([[DESCRIPTION_PROPERTY, "desc"]]);
    const expectedMap = new Map();
    expect(filterCytoscapeProperties(testMap)).toEqual(expectedMap);
  });
  test("map with multiple properties and a description property", () => {
    const testMap = new Map([
      ["a", "1"],
      [DESCRIPTION_PROPERTY, "desc"],
      ["b", "2"],
    ]);
    const expectedMap = new Map([
      ["a", "1"],
      ["b", "2"],
    ]);
    expect(filterCytoscapeProperties(testMap)).toEqual(expectedMap);
  });
  test("map with multiple properties and a prefixed description properties", () => {
    const testMap = new Map([
      ["a", "1"],
      [DESCRIPTION_PROPERTY, "desc"],
      [DESCRIPTION_PROPERTY + "-font-size", "12"],
    ]);
    const expectedMap = new Map([["a", "1"]]);
    expect(filterCytoscapeProperties(testMap)).toEqual(expectedMap);
  });
});

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

describe("makes cytoscape stylesheets", () => {
  test("node styles", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: ["s"],
      styleProperties: new Map(),
    });
    testDag.addNode({
      id: "idY",
      name: "nameY",
      styleTags: [],
      styleProperties: new Map([["a", "1"]]),
    });
    const expectedCyNodeStyles = [
      {
        selector: "node#idY",
        style: { a: "1" },
      },
    ];
    expect(makeNodeStylesheets(testDag)).toEqual(expectedCyNodeStyles);
  });
  test("edge styles", () => {
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
      styleTags: ["s"],
      styleProperties: new Map([["a", "1"]]),
    });
    const expectedCyEdgeStyles = [
      {
        selector: "edge#idZ",
        style: { a: "1" },
      },
    ];
    expect(makeEdgeStyleSheets(testDag)).toEqual(expectedCyEdgeStyles);
  });
  test("class styles", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.addStyle(
      "s",
      new Map([
        ["a", "1"],
        ["b", "2"],
      ]),
    );
    const expectedCyClassStyles = [
      {
        selector: ".s",
        style: { a: "1", b: "2" },
      },
    ];
    expect(makeClassStyleSheets(testDag)).toEqual(expectedCyClassStyles);
  });
  test("class styles from sub dags", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    const childDag = new Dag("childDag", testDag);
    childDag.addStyle(
      "s",
      new Map([
        ["a", "1"],
        ["b", "2"],
      ]),
    );
    const expectedCyClassStyles = [
      {
        selector: ".s[lineagePath*='/childDag']",
        style: { a: "1", b: "2" },
      },
    ];
    expect(makeClassStyleSheets(childDag)).toEqual(expectedCyClassStyles);
  });
  test("name style on undeclared styleTags", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.addStyleBinding("x", ["a", "b"]);
    expect(makeNameStyleSheets(testDag)).toEqual([]);
  });
  test("name styles", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.addStyleBinding("x", ["a", "b"]);
    testDag.addStyle("a", new Map([["i", "1"]]));
    testDag.addStyle(
      "b",
      new Map([
        ["j", "2"],
        ["k", "3"],
      ]),
    );
    const expectedCyNameStyles = [
      {
        selector: "[name='x']",
        style: { i: "1" },
      },
      {
        selector: "[name='x']",
        style: { j: "2", k: "3" },
      },
    ];
    expect(makeNameStyleSheets(testDag)).toEqual(expectedCyNameStyles);
  });
  test("name styles from sub dags", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    const childDag = new Dag("childDag", testDag);
    childDag.addStyle("a", new Map([["i", "1"]]));
    childDag.addStyle(
      "b",
      new Map([
        ["j", "2"],
        ["k", "3"],
      ]),
    );
    childDag.addStyleBinding("x", ["a", "b"]);
    const expectedCyNameStyles = [
      {
        selector: "[name='x'][lineagePath*='/childDag']",
        style: { i: "1" },
      },
      {
        selector: "[name='x'][lineagePath*='/childDag']",
        style: { j: "2", k: "3" },
      },
    ];
    expect(makeNameStyleSheets(childDag)).toEqual(expectedCyNameStyles);
  });
  test("styles from sub dags", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    const childDag = new Dag("childDag", testDag);
    childDag.addStyle(
      "a",
      new Map([
        ["background-color", "red"],
        ["border-width", "1"],
      ]),
    );
    childDag.addStyleBinding("x", ["a"]);

    const grandChildDag = new Dag("grandChildDag", childDag);
    grandChildDag.addStyle("b", new Map([["shape", "hexagon"]]));
    const expectedCyStyles = getBaseStylesheet().concat([
      {
        selector: ".a[lineagePath*='/childDag']",
        style: { "background-color": "red", "border-width": "1" },
      },
      {
        selector: "[name='x'][lineagePath*='/childDag']",
        style: { "background-color": "red", "border-width": "1" },
      },
      {
        selector: ".b[lineagePath*='/grandChildDag']",
        style: { shape: "hexagon" },
      },
    ]);
    expect(makeCyStylesheets(testDag)).toEqual(expectedCyStyles);
  });
});
