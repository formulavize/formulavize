import { describe, test, expect, vi, MockInstance } from "vitest";
import {
  getStyleDescriptions,
  getNamesWithStyleDescriptions,
  getNodeDescriptions,
  getEdgeDescriptions,
  getCompoundNodeDescriptions,
  DescriptionData,
  addCyPopperElementsFromDag,
} from "../../../src/common/cyPopperExtender";
import {
  DESCRIPTION_PROPERTY,
  TOP_LEVEL_DAG_ID,
} from "../../../src/common/constants";
import {
  Dag,
  NodeId,
  EdgeId,
  Keyword,
  StyleProperties,
} from "../../../src/common/dag";
import { Core } from "cytoscape";

function makeDescriptionData(
  description: string,
  descriptionStyleProperties?: StyleProperties,
): DescriptionData {
  return {
    description: description,
    descriptionStyleProperties: descriptionStyleProperties ?? new Map(),
  };
}

describe("makes style descriptions", () => {
  test("no matching styles", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.setStyle("empty", new Map());
    testDag.setStyle("x", new Map([["color", "red"]]));

    const expectedMap = new Map();
    expect(getStyleDescriptions(testDag)).toEqual(expectedMap);
  });
  test("two matching styles", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.setStyle("empty", new Map());
    testDag.setStyle("x", new Map([[DESCRIPTION_PROPERTY, "d1"]]));
    testDag.setStyle(
      "y",
      new Map([
        [DESCRIPTION_PROPERTY, "d2"],
        [DESCRIPTION_PROPERTY + "-color", "red"],
      ]),
    );

    const expectedMap = new Map<string, DescriptionData>([
      [".x", makeDescriptionData("d1")],
      [".y", makeDescriptionData("d2", new Map([["color", "red"]]))],
    ]);
    expect(getStyleDescriptions(testDag)).toEqual(expectedMap);
  });
});

describe("makes name descriptions", () => {
  test("style with description not bound", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.addStyleBinding("name", [["y"]]);
    testDag.setStyle("x", new Map([[DESCRIPTION_PROPERTY, "d1"]]));

    const expectedMap = new Map<Keyword, DescriptionData>();
    expect(getNamesWithStyleDescriptions(testDag)).toEqual(expectedMap);
  });
  test("bound name with matching style", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.addStyleBinding("name", [["x"]]);
    testDag.setStyle(
      "x",
      new Map([
        [DESCRIPTION_PROPERTY, "d1"],
        [`${DESCRIPTION_PROPERTY}-color`, "red"],
      ]),
    );
    const redDescriptionData = makeDescriptionData(
      "d1",
      new Map([["color", "red"]]),
    );
    const expectedMap = new Map<Keyword, DescriptionData>([
      ["[name='name']", redDescriptionData],
    ]);
    expect(getNamesWithStyleDescriptions(testDag)).toEqual(expectedMap);
  });
  test("bound name with two matching styles", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.addStyleBinding("name", [["y"], ["x"]]);
    testDag.setStyle("y", new Map([[DESCRIPTION_PROPERTY, "d2"]]));
    testDag.setStyle("x", new Map([[DESCRIPTION_PROPERTY, "d1"]]));

    // last style tag takes precedence
    const expectedMap = new Map<Keyword, DescriptionData>([
      ["[name='name']", makeDescriptionData("d1")],
    ]);
    expect(getNamesWithStyleDescriptions(testDag)).toEqual(expectedMap);
  });
  test("two names with bindings to the same style", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.addStyleBinding("name1", [["x"]]);
    testDag.addStyleBinding("name2", [["x"]]);
    testDag.setStyle("x", new Map([[DESCRIPTION_PROPERTY, "d1"]]));

    const expectedMap = new Map<Keyword, DescriptionData>([
      ["[name='name1']", makeDescriptionData("d1")],
      ["[name='name2']", makeDescriptionData("d1")],
    ]);
    expect(getNamesWithStyleDescriptions(testDag)).toEqual(expectedMap);
  });
  test("two names with bindings to different styles", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.addStyleBinding("name1", [["x"]]);
    testDag.addStyleBinding("name2", [["y"]]);
    testDag.setStyle("x", new Map([[DESCRIPTION_PROPERTY, "d1"]]));
    testDag.setStyle("y", new Map([[DESCRIPTION_PROPERTY, "d2"]]));

    const expectedMap = new Map<Keyword, DescriptionData>([
      ["[name='name1']", makeDescriptionData("d1")],
      ["[name='name2']", makeDescriptionData("d2")],
    ]);
    expect(getNamesWithStyleDescriptions(testDag)).toEqual(expectedMap);
  });
});

describe("makes element descriptions", () => {
  test("no matching nodes", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map([["a", "1"]]),
    });

    const expectedMap = new Map<NodeId, DescriptionData>();
    expect(getNodeDescriptions(testDag)).toEqual(expectedMap);
  });
  test("one matching node", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map([
        [DESCRIPTION_PROPERTY, "d1"],
        [DESCRIPTION_PROPERTY + "-color", "red"],
      ]),
    });

    const expectedMap = new Map<NodeId, DescriptionData>([
      ["node#idX", makeDescriptionData("d1", new Map([["color", "red"]]))],
    ]);
    expect(getNodeDescriptions(testDag)).toEqual(expectedMap);
  });
  test("two matching nodes", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map([[DESCRIPTION_PROPERTY, "d1"]]),
    });
    testDag.addNode({
      id: "idY",
      name: "nameY",
      styleTags: [],
      styleProperties: new Map([[DESCRIPTION_PROPERTY, "d2"]]),
    });

    const expectedMap = new Map<NodeId, DescriptionData>([
      ["node#idX", makeDescriptionData("d1")],
      ["node#idY", makeDescriptionData("d2")],
    ]);
    expect(getNodeDescriptions(testDag)).toEqual(expectedMap);
  });
  test("no matching edges", () => {
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
      id: "id1",
      name: "name1",
      srcNodeId: "idX",
      destNodeId: "idY",
      styleTags: [["s"], ["t"]],
      styleProperties: new Map([["a", "1"]]),
    });

    const expectedMap = new Map<EdgeId, DescriptionData>();
    expect(getEdgeDescriptions(testDag)).toEqual(expectedMap);
  });
  test("one matching edge", () => {
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
      id: "id1",
      name: "name1",
      srcNodeId: "idX",
      destNodeId: "idY",
      styleTags: [],
      styleProperties: new Map([
        [DESCRIPTION_PROPERTY, "d1"],
        [DESCRIPTION_PROPERTY + "-color", "red"],
      ]),
    });

    const expectedMap = new Map<EdgeId, DescriptionData>([
      ["edge#id1", makeDescriptionData("d1", new Map([["color", "red"]]))],
    ]);
    expect(getEdgeDescriptions(testDag)).toEqual(expectedMap);
  });
  test("two matching edges", () => {
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
    testDag.addNode({
      id: "idZ",
      name: "nameZ",
      styleTags: [],
      styleProperties: new Map(),
    });
    testDag.addEdge({
      id: "id1",
      name: "name1",
      srcNodeId: "idX",
      destNodeId: "idZ",
      styleTags: [],
      styleProperties: new Map([[DESCRIPTION_PROPERTY, "d1"]]),
    });
    testDag.addEdge({
      id: "id2",
      name: "name2",
      srcNodeId: "idY",
      destNodeId: "idZ",
      styleTags: [],
      styleProperties: new Map([[DESCRIPTION_PROPERTY, "d2"]]),
    });

    const expectedMap = new Map<EdgeId, DescriptionData>([
      ["edge#id1", makeDescriptionData("d1")],
      ["edge#id2", makeDescriptionData("d2")],
    ]);
    expect(getEdgeDescriptions(testDag)).toEqual(expectedMap);
  });
  test("one matching compound node", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    const stylePropMap = new Map([[DESCRIPTION_PROPERTY, "d1"]]);
    const subdag = new Dag("subDagId", testDag, "subdag", [], stylePropMap);

    const expectedMap = new Map<NodeId, DescriptionData>([
      ["node#subDagId", makeDescriptionData("d1")],
    ]);
    expect(getCompoundNodeDescriptions(subdag)).toEqual(expectedMap);
  });
});

describe("subdag descriptions", () => {
  function addCyPoppersAndReturnMockCyCore(testDag: Dag): MockInstance {
    const mockCyCore = {
      elements: () => [],
    } as unknown as Core;
    const mockCoreSpy = vi.spyOn(mockCyCore, "elements");
    const mockElement = {} as HTMLElement;
    addCyPopperElementsFromDag(mockCyCore, mockElement, testDag);
    return mockCoreSpy;
  }
  test("one matching node in subdag", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    const subdag = new Dag("subdag", testDag);
    subdag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map([[DESCRIPTION_PROPERTY, "d1"]]),
    });

    const mockCoreSpy = addCyPoppersAndReturnMockCyCore(testDag);
    expect(mockCoreSpy).toHaveBeenCalledWith("node#idX");
  });
  test("description on child dag", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    const descStyle = new Map([[DESCRIPTION_PROPERTY, "d1"]]);
    new Dag("childIdX", testDag, "child", [], descStyle);

    const mock = addCyPoppersAndReturnMockCyCore(testDag);
    expect(mock).toHaveBeenCalledWith("node#childIdX");
  });
  test("description in root dag style", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.setStyle("parentStyle", new Map([[DESCRIPTION_PROPERTY, "d1"]]));

    const mock = addCyPoppersAndReturnMockCyCore(testDag);
    expect(mock).toHaveBeenCalledWith(".parentStyle");
  });
  test("description in root dag name binding", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.setStyle("parentStyle", new Map([[DESCRIPTION_PROPERTY, "d1"]]));
    testDag.addStyleBinding("parentName", [["parentStyle"]]);

    const mock = addCyPoppersAndReturnMockCyCore(testDag);
    expect(mock).toHaveBeenCalledWith("[name='parentName']");
  });
  test("description defined in root dag and used in child dag", () => {
    const testDag = new Dag(TOP_LEVEL_DAG_ID);
    testDag.setStyle("parentStyle", new Map([[DESCRIPTION_PROPERTY, "d1"]]));
    const childDag = new Dag("childIdX", testDag, "child", [["parentStyle"]]);
    childDag.addNode({
      id: "childIdX",
      name: "childNameX",
      styleTags: [["parentStyle"]],
      styleProperties: new Map(),
    });

    const mock = addCyPoppersAndReturnMockCyCore(testDag);
    expect(mock).toHaveBeenCalledWith(".parentStyle");
  });
});
