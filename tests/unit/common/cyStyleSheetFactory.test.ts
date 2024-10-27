import { describe, test, expect } from "vitest";
import {
  keyStartsWithNonCytoscapePrefix,
  filterCytoscapeProperties,
  makeNodeStylesheets,
  makeEdgeStyleSheets,
  makeClassStyleSheets,
  makeNameStyleSheets,
  getBaseStylesheet,
  makeCyStylesheets,
} from "../../../src/common/cyStyleSheetsFactory";
import {
  TOP_LEVEL_DAG_ID,
  DESCRIPTION_PROPERTY,
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

describe("makes cytoscape stylesheets", () => {
  test("node styles", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [["s"]],
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
      styleTags: [["s"]],
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
    testDag.setStyle(
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
    childDag.setStyle(
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
    testDag.addStyleBinding("x", [["a"], ["b"]]);
    expect(makeNameStyleSheets(testDag)).toEqual([]);
  });
  test("name styles", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.addStyleBinding("x", [["a"], ["b"]]);
    testDag.setStyle("a", new Map([["i", "1"]]));
    testDag.setStyle(
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
    childDag.setStyle("a", new Map([["i", "1"]]));
    childDag.setStyle(
      "b",
      new Map([
        ["j", "2"],
        ["k", "3"],
      ]),
    );
    childDag.addStyleBinding("x", [["a"], ["b"]]);
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
    childDag.setStyle("a", new Map([["background-color", "red"]]));
    childDag.addStyleBinding("x", [["a"]]);

    const grandChildDag = new Dag("grandChildDag", childDag);
    grandChildDag.setStyle("b", new Map([["shape", "hexagon"]]));
    const expectedCyStyles = getBaseStylesheet().concat([
      {
        selector: ".a[lineagePath*='/childDag']",
        style: { "background-color": "red" },
      },
      {
        selector: "[name='x'][lineagePath*='/childDag']",
        style: { "background-color": "red" },
      },
      {
        selector: ".b[lineagePath*='/grandChildDag']",
        style: { shape: "hexagon" },
      },
    ]);
    expect(makeCyStylesheets(testDag)).toEqual(expectedCyStyles);
  });
  test("sub dag with style property", () => {
    const rootDag = new Dag(TOP_LEVEL_DAG_ID, null, "top");
    const childDag = new Dag(
      "x",
      null,
      "child",
      [],
      new Map([["background-color", "blue"]]),
    );
    rootDag.addChildDag(childDag);

    const expectedCyStyles = getBaseStylesheet().concat([
      {
        selector: "node#x",
        style: { "background-color": "blue" },
      },
    ]);
    expect(makeCyStylesheets(rootDag)).toEqual(expectedCyStyles);
  });
  test("sub dag with style tag", () => {
    const rootDag = new Dag(TOP_LEVEL_DAG_ID);
    const childDag = new Dag("x", rootDag, "child", [["b"]]); // styleTag ignored
    childDag.setStyle("b", new Map([["background-color", "red"]]));
    const grandChildDag = new Dag("y", childDag, "grandChild", [["b"]]);
    grandChildDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map(),
    });

    const expectedCyStyles = getBaseStylesheet().concat([
      {
        selector: ".b[lineagePath*='/x']",
        style: { "background-color": "red" },
      },
    ]);
    expect(makeCyStylesheets(rootDag)).toEqual(expectedCyStyles);
  });
  test("sub dags with name style", () => {
    const rootDag = new Dag(TOP_LEVEL_DAG_ID);
    const childDag = new Dag("x", rootDag);
    childDag.setStyle("b", new Map([["background-color", "red"]]));
    childDag.addStyleBinding("y", [["b"]]);
    const grandChildDag = new Dag("y", childDag);
    grandChildDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map(),
    });

    const expectedCyStyles = getBaseStylesheet().concat([
      {
        selector: ".b[lineagePath*='/x']",
        style: { "background-color": "red" },
      },
      {
        selector: "[name='y'][lineagePath*='/x']",
        style: { "background-color": "red" },
      },
    ]);
    expect(makeCyStylesheets(rootDag)).toEqual(expectedCyStyles);
  });
});
