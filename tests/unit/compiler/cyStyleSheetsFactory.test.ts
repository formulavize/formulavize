import { describe, test, expect } from "vitest";
import {
  keyStartsWithNonCytoscapePrefix,
  filterCytoscapeProperties,
  hasStyleData,
  makeStyleObject,
  makeNodeStylesheets,
  makeEdgeStyleSheets,
  makeClassStyleSheets,
  makeNameStyleSheets,
  getBaseStylesheet,
  makeCyStylesheets,
} from "src/compiler/cyStyleSheetsFactory";
import { DESCRIPTION_PROPERTY } from "src/compiler/constants";
import { Dag, DagElement } from "src/compiler/dag";

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

describe("makeElementStylesheets utilities", () => {
  function getBaseTestElement(): DagElement {
    return {
      id: "test",
      name: "test",
      styleProperties: new Map(),
      styleTags: [],
    };
  }
  test("empty style properties and tags", () => {
    const testElement = getBaseTestElement();
    expect(hasStyleData(testElement)).toBe(false);

    const testDag = new Dag("DagId");
    expect(makeStyleObject(testDag, testElement)).toEqual({});
  });
  test("non-empty style properties and empty tags", () => {
    const testElement = getBaseTestElement();
    testElement.styleProperties = new Map([["a", "1"]]);
    expect(hasStyleData(testElement)).toBe(true);

    const testDag = new Dag("DagId");
    expect(makeStyleObject(testDag, testElement)).toEqual({ a: "1" });
  });
  test("empty style properties and no scoped tags", () => {
    const testElement = getBaseTestElement();
    testElement.styleTags = [["s"]];
    expect(hasStyleData(testElement)).toBe(false);

    const testDag = new Dag("DagId");
    testDag.setStyle("s", new Map([["a", "1"]]));
    expect(makeStyleObject(testDag, testElement)).toEqual({});
  });
  test("empty style properties and scoped tags", () => {
    const testElement = getBaseTestElement();
    testElement.styleTags = [["n", "s"]];
    expect(hasStyleData(testElement)).toBe(true);

    const testDag = new Dag("DagId");
    const childDag = new Dag("childDag", testDag, "n");
    childDag.setStyle("s", new Map([["a", "1"]]));
    expect(makeStyleObject(testDag, testElement)).toEqual({ a: "1" });
  });
});

describe("makes cytoscape stylesheets", () => {
  test("node styles", () => {
    const testDag = new Dag("DagId");
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
    const testDag = new Dag("DagId");
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
    const testDag = new Dag("DagId");
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
    const testDag = new Dag("DagId");
    testDag.addStyleBinding("x", [["a"], ["b"]]);
    expect(makeNameStyleSheets(testDag)).toEqual([]);
  });
  test("name styles", () => {
    const testDag = new Dag("DagId");
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
    const testDag = new Dag("DagId");
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
    const testDag = new Dag("DagId");
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
    const rootDag = new Dag("DagId", null, "top");
    const blueStyle = new Map([["background-color", "blue"]]);
    new Dag("x", rootDag, "child", [], blueStyle);

    const expectedCyStyles = getBaseStylesheet().concat([
      {
        selector: "node#x",
        style: { "background-color": "blue" },
      },
    ]);
    expect(makeCyStylesheets(rootDag)).toEqual(expectedCyStyles);
  });
  test("sub dag with style tag", () => {
    const rootDag = new Dag("DagId");
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
    const rootDag = new Dag("DagId");
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
  test("use scoped style tag defined in child", () => {
    const rootDag = new Dag("DagId");
    const childDag = new Dag("x", rootDag, "child");
    childDag.setStyle("b", new Map([["background-color", "red"]]));
    rootDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [["child", "b"]],
      styleProperties: new Map(),
    });
    const expectedCyStyles = getBaseStylesheet().concat([
      {
        selector: "node#idX",
        style: { "background-color": "red" },
      },
      {
        selector: ".b[lineagePath*='/x']",
        style: { "background-color": "red" },
      },
    ]);
    expect(makeCyStylesheets(rootDag)).toEqual(expectedCyStyles);
  });
  test("use scoped style tag defined in sibiling", () => {
    const rootDag = new Dag("DagId");
    const childDag1 = new Dag("x", rootDag, "child1");
    const childDag2 = new Dag("y", rootDag, "child2");
    childDag1.setStyle("b", new Map([["background-color", "red"]]));
    childDag2.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [["child1", "b"]],
      styleProperties: new Map(),
    });
    const expectedCyStyles = getBaseStylesheet().concat([
      {
        selector: ".b[lineagePath*='/x']",
        style: { "background-color": "red" },
      },
      {
        selector: "node#idX",
        style: { "background-color": "red" },
      },
    ]);
    expect(makeCyStylesheets(rootDag)).toEqual(expectedCyStyles);
  });
  test("use undefined scoped style tag", () => {
    const rootDag = new Dag("DagId");
    new Dag("x", rootDag, "child");
    rootDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [["child", "b"]],
      styleProperties: new Map(),
    });
    const expectedCyStyles = getBaseStylesheet();
    expect(makeCyStylesheets(rootDag)).toEqual(expectedCyStyles);
  });
});
