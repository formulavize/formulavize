import { describe, test, expect, vi, MockInstance } from "vitest";
import {
  getStyleDescriptions,
  getNamesWithStyleDescriptions,
  getNodeDescriptions,
  getEdgeDescriptions,
  getCompoundNodeDescriptions,
  DescriptionData,
  SelectorDescriptionPair,
  addCyPopperElementsFromDag,
} from "src/renderers/cyDag/cyPopperExtender";
import { DESCRIPTION_PROPERTY } from "src/compiler/constants";
import { Dag, StyleProperties } from "src/compiler/dag";
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
    const testDag = new Dag("DagId");
    testDag.setStyle("empty", new Map());
    testDag.setStyle("x", new Map([["color", "red"]]));

    const expectedDescs: SelectorDescriptionPair[] = [];
    expect(getStyleDescriptions(testDag)).toEqual(expectedDescs);
  });
  test("two matching styles", () => {
    const testDag = new Dag("DagId");
    testDag.setStyle("empty", new Map());
    testDag.setStyle("x", new Map([[DESCRIPTION_PROPERTY, "d1"]]));
    testDag.setStyle(
      "y",
      new Map([
        [DESCRIPTION_PROPERTY, "d2"],
        [DESCRIPTION_PROPERTY + "-color", "red"],
      ]),
    );

    const expectedDescs: SelectorDescriptionPair[] = [
      [".x", makeDescriptionData("d1")],
      [".y", makeDescriptionData("d2", new Map([["color", "red"]]))],
    ];
    expect(getStyleDescriptions(testDag)).toEqual(expectedDescs);
  });
});

describe("makes name descriptions", () => {
  test("style with description not bound", () => {
    const testDag = new Dag("DagId");
    testDag.addStyleBinding("name", {
      styleTags: [["y"]],
      styleProperties: new Map(),
    });
    testDag.setStyle("x", new Map([[DESCRIPTION_PROPERTY, "d1"]]));

    const expectedDescs: SelectorDescriptionPair[] = [];
    expect(getNamesWithStyleDescriptions(testDag)).toEqual(expectedDescs);
  });
  test("bound name with matching style", () => {
    const testDag = new Dag("DagId");
    testDag.addStyleBinding("name", {
      styleTags: [["x"]],
      styleProperties: new Map(),
    });
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
    const expectedDescs: SelectorDescriptionPair[] = [
      ["[name='name']", redDescriptionData],
    ];
    expect(getNamesWithStyleDescriptions(testDag)).toEqual(expectedDescs);
  });
  test("bound name with two matching styles", () => {
    const testDag = new Dag("DagId");
    testDag.addStyleBinding("name", {
      styleTags: [["y"], ["x"]],
      styleProperties: new Map(),
    });
    testDag.setStyle("y", new Map([[DESCRIPTION_PROPERTY, "d2"]]));
    testDag.setStyle("x", new Map([[DESCRIPTION_PROPERTY, "d1"]]));

    // there can be multiple descriptions for a single name
    // this behavior is likely impractical for users
    // except as a defensive measure for names not intended to be reused
    // this may be changed to let the last description to take precedence later
    const expectedDescs: SelectorDescriptionPair[] = [
      ["[name='name']", makeDescriptionData("d2")],
      ["[name='name']", makeDescriptionData("d1")],
    ];
    expect(getNamesWithStyleDescriptions(testDag)).toEqual(expectedDescs);
  });
  test("two names with bindings to the same style", () => {
    const testDag = new Dag("DagId");
    testDag.addStyleBinding("name1", {
      styleTags: [["x"]],
      styleProperties: new Map(),
    });
    testDag.addStyleBinding("name2", {
      styleTags: [["x"]],
      styleProperties: new Map(),
    });
    testDag.setStyle("x", new Map([[DESCRIPTION_PROPERTY, "d1"]]));

    const expectedDescs: SelectorDescriptionPair[] = [
      ["[name='name1']", makeDescriptionData("d1")],
      ["[name='name2']", makeDescriptionData("d1")],
    ];
    expect(getNamesWithStyleDescriptions(testDag)).toEqual(expectedDescs);
  });
  test("two names with bindings to different styles", () => {
    const testDag = new Dag("DagId");
    testDag.addStyleBinding("name1", {
      styleTags: [["x"]],
      styleProperties: new Map(),
    });
    testDag.addStyleBinding("name2", {
      styleTags: [["y"]],
      styleProperties: new Map(),
    });
    testDag.setStyle("x", new Map([[DESCRIPTION_PROPERTY, "d1"]]));
    testDag.setStyle("y", new Map([[DESCRIPTION_PROPERTY, "d2"]]));

    const expectedDescs: SelectorDescriptionPair[] = [
      ["[name='name1']", makeDescriptionData("d1")],
      ["[name='name2']", makeDescriptionData("d2")],
    ];
    expect(getNamesWithStyleDescriptions(testDag)).toEqual(expectedDescs);
  });
  test("inline description in binding", () => {
    const testDag = new Dag("DagId");
    testDag.addStyleBinding("name", {
      styleTags: [],
      styleProperties: new Map([[DESCRIPTION_PROPERTY, "inline desc"]]),
    });

    const expectedDescs: SelectorDescriptionPair[] = [
      ["[name='name']", makeDescriptionData("inline desc")],
    ];
    expect(getNamesWithStyleDescriptions(testDag)).toEqual(expectedDescs);
  });
  test("mixed tag description and inline description", () => {
    const testDag = new Dag("DagId");
    testDag.setStyle("x", new Map([[DESCRIPTION_PROPERTY, "tag desc"]]));
    testDag.addStyleBinding("name", {
      styleTags: [["x"]],
      styleProperties: new Map([[DESCRIPTION_PROPERTY, "inline desc"]]),
    });

    const expectedDescs: SelectorDescriptionPair[] = [
      ["[name='name']", makeDescriptionData("tag desc")],
      ["[name='name']", makeDescriptionData("inline desc")],
    ];
    expect(getNamesWithStyleDescriptions(testDag)).toEqual(expectedDescs);
  });
});

describe("makes element descriptions", () => {
  test("no matching nodes", () => {
    const testDag = new Dag("DagId");
    testDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map([["a", "1"]]),
    });

    const expectedDescs: SelectorDescriptionPair[] = [];
    expect(getNodeDescriptions(testDag)).toEqual(expectedDescs);
  });
  test("one matching node", () => {
    const testDag = new Dag("DagId");
    testDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map([
        [DESCRIPTION_PROPERTY, "d1"],
        [DESCRIPTION_PROPERTY + "-color", "red"],
      ]),
    });

    const expectedDescs: SelectorDescriptionPair[] = [
      [
        "node[id = 'idX']",
        makeDescriptionData("d1", new Map([["color", "red"]])),
      ],
    ];
    expect(getNodeDescriptions(testDag)).toEqual(expectedDescs);
  });
  test("two matching nodes", () => {
    const testDag = new Dag("DagId");
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

    const expectedDescs: SelectorDescriptionPair[] = [
      ["node[id = 'idX']", makeDescriptionData("d1")],
      ["node[id = 'idY']", makeDescriptionData("d2")],
    ];
    expect(getNodeDescriptions(testDag)).toEqual(expectedDescs);
  });
  test("no matching edges", () => {
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
      id: "id1",
      name: "name1",
      srcNodeId: "idX",
      destNodeId: "idY",
      styleTags: [["s"], ["t"]],
      styleProperties: new Map([["a", "1"]]),
    });

    const expectedDescs: SelectorDescriptionPair[] = [];
    expect(getEdgeDescriptions(testDag)).toEqual(expectedDescs);
  });
  test("one matching edge", () => {
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

    const expectedDescs: SelectorDescriptionPair[] = [
      [
        "edge[id = 'id1']",
        makeDescriptionData("d1", new Map([["color", "red"]])),
      ],
    ];
    expect(getEdgeDescriptions(testDag)).toEqual(expectedDescs);
  });
  test("two matching edges", () => {
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

    const expectedDescs: SelectorDescriptionPair[] = [
      ["edge[id = 'id1']", makeDescriptionData("d1")],
      ["edge[id = 'id2']", makeDescriptionData("d2")],
    ];
    expect(getEdgeDescriptions(testDag)).toEqual(expectedDescs);
  });
  test("one matching compound node", () => {
    const testDag = new Dag("DagId");
    const stylePropMap = new Map([[DESCRIPTION_PROPERTY, "d1"]]);
    const subdag = new Dag("subDagId", testDag, "subdag", [], stylePropMap);

    const expectedDescs = [
      ["node[id = 'subDagId']", makeDescriptionData("d1")],
    ];
    expect(getCompoundNodeDescriptions(subdag)).toEqual(expectedDescs);
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
    const testDag = new Dag("DagId");
    const subdag = new Dag("subdag", testDag);
    subdag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map([[DESCRIPTION_PROPERTY, "d1"]]),
    });

    const mockCoreSpy = addCyPoppersAndReturnMockCyCore(testDag);
    expect(mockCoreSpy).toHaveBeenCalledWith("node[id = 'idX']");
  });
  test("description on child dag", () => {
    const testDag = new Dag("DagId");
    const descStyle = new Map([[DESCRIPTION_PROPERTY, "d1"]]);
    new Dag("childIdX", testDag, "child", [], descStyle);

    const mock = addCyPoppersAndReturnMockCyCore(testDag);
    expect(mock).toHaveBeenCalledWith("node[id = 'childIdX']");
  });
  test("description in root dag style", () => {
    const testDag = new Dag("DagId");
    testDag.setStyle("parentStyle", new Map([[DESCRIPTION_PROPERTY, "d1"]]));

    const mock = addCyPoppersAndReturnMockCyCore(testDag);
    expect(mock).toHaveBeenCalledWith(".parentStyle");
  });
  test("description in root dag name binding", () => {
    const testDag = new Dag("DagId");
    testDag.setStyle("parentStyle", new Map([[DESCRIPTION_PROPERTY, "d1"]]));
    testDag.addStyleBinding("parentName", {
      styleTags: [["parentStyle"]],
      styleProperties: new Map(),
    });

    const mock = addCyPoppersAndReturnMockCyCore(testDag);
    expect(mock).toHaveBeenCalledWith("[name='parentName']");
  });
  test("description defined in root dag and used in child dag", () => {
    const testDag = new Dag("DagId");
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
  test("description style defined in child dag", () => {
    const testDag = new Dag("DagId");
    const childDag = new Dag("childIdX", testDag, "child");
    childDag.setStyle("childStyle", new Map([[DESCRIPTION_PROPERTY, "d1"]]));

    const mock = addCyPoppersAndReturnMockCyCore(testDag);
    expect(mock).toHaveBeenCalledWith(".childStyle[lineagePath*='/childIdX']");
  });
  test("description name defined in child dag", () => {
    const testDag = new Dag("DagId");
    const childDag = new Dag("childIdX", testDag, "child");
    childDag.addStyleBinding("styleName", {
      styleTags: [["childStyle"]],
      styleProperties: new Map(),
    });
    childDag.setStyle("childStyle", new Map([[DESCRIPTION_PROPERTY, "d1"]]));

    const mock = addCyPoppersAndReturnMockCyCore(testDag);
    expect(mock).toHaveBeenCalledWith(
      "[name='styleName'][lineagePath*='/childIdX']",
    );
  });
  test("description used in name binding in sibling dag", () => {
    const testDag = new Dag("DagId");
    const childDag1 = new Dag("childId1", testDag, "child1");
    const childDag2 = new Dag("childId2", testDag, "child2");
    childDag1.setStyle("childStyle1", new Map([[DESCRIPTION_PROPERTY, "d1"]]));
    childDag2.addStyleBinding("childName1", {
      styleTags: [["child1", "childStyle1"]],
      styleProperties: new Map(),
    });

    const mock = addCyPoppersAndReturnMockCyCore(testDag);
    expect(mock).toHaveBeenCalledWith(".childStyle1[lineagePath*='/childId1']");
    expect(mock).toHaveBeenCalledWith(
      "[name='childName1'][lineagePath*='/childId2']",
    );
  });
  test("description via scoped style tag in node from sibling dag", () => {
    const testDag = new Dag("DagId");
    const childDag1 = new Dag("childId1", testDag, "child1");
    const childDag2 = new Dag("childId2", testDag, "child2");
    childDag1.setStyle("childStyle1", new Map([[DESCRIPTION_PROPERTY, "d1"]]));
    childDag2.addNode({
      id: "childId2",
      name: "childName2",
      styleTags: [["child1", "childStyle1"]],
      styleProperties: new Map([[DESCRIPTION_PROPERTY, "d2"]]),
    });

    const mock = addCyPoppersAndReturnMockCyCore(testDag);
    expect(mock).toHaveBeenCalledWith(".childStyle1[lineagePath*='/childId1']");
    expect(mock).toHaveBeenCalledWith("node[id = 'childId2']");

    // like name bindings, conflicting descriptions are likely impractical
    // except as a defensive measure for styles not intended to be reused
    const expectedDescs: SelectorDescriptionPair[] = [
      ["node[id = 'childId2']", makeDescriptionData("d2")],
      ["node[id = 'childId2']", makeDescriptionData("d1")],
    ];
    expect(getNodeDescriptions(childDag2)).toEqual(expectedDescs);
  });
});
