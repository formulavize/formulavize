import { describe, test, expect } from "vitest";
import {
  getStyleDescriptionData,
  getNamesWithStyleDescriptionData,
  getNodeDescriptionData,
  getEdgeDescriptionData,
  DescriptionData,
} from "../../../src/common/cyPopperExtender";
import { DESCRIPTION_PROPERTY } from "../../../src/common/constants";
import {
  Dag,
  NodeId,
  EdgeId,
  StyleTag,
  Keyword,
  StyleProperties,
} from "../../../src/common/dag";

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
    const testDag = new Dag();
    testDag.addStyle("empty", new Map());
    testDag.addStyle("x", new Map([["color", "red"]]));

    const expectedMap = new Map();
    expect(getStyleDescriptionData(testDag)).toEqual(expectedMap);
  });
  test("two matching styles", () => {
    const testDag = new Dag();
    testDag.addStyle("empty", new Map());
    testDag.addStyle("x", new Map([[DESCRIPTION_PROPERTY, "d1"]]));
    testDag.addStyle(
      "y",
      new Map([
        [DESCRIPTION_PROPERTY, "d2"],
        [DESCRIPTION_PROPERTY + "-color", "red"],
      ]),
    );

    const expectedMap = new Map<StyleTag, DescriptionData>([
      ["x", makeDescriptionData("d1")],
      ["y", makeDescriptionData("d2", new Map([["color", "red"]]))],
    ]);
    expect(getStyleDescriptionData(testDag)).toEqual(expectedMap);
  });
});

describe("makes name descriptions", () => {
  test("style with description not bound", () => {
    const styleDescriptions = new Map<StyleTag, DescriptionData>([
      ["x", makeDescriptionData("d1")],
    ]);
    const testDag = new Dag();
    testDag.addStyleBinding("name", ["y"]);

    const expectedMap = new Map<Keyword, DescriptionData>();
    expect(
      getNamesWithStyleDescriptionData(testDag, styleDescriptions),
    ).toEqual(expectedMap);
  });
  test("bound name with matching style", () => {
    const redDescriptionData = makeDescriptionData(
      "d1",
      new Map([["color", "red"]]),
    );
    const styleDescriptions = new Map<StyleTag, DescriptionData>([
      ["x", redDescriptionData],
    ]);
    const testDag = new Dag();
    testDag.addStyleBinding("name", ["x"]);

    const expectedMap = new Map<Keyword, DescriptionData>([
      ["name", redDescriptionData],
    ]);
    expect(
      getNamesWithStyleDescriptionData(testDag, styleDescriptions),
    ).toEqual(expectedMap);
  });
  test("bound name with two matching styles", () => {
    const styleDescriptions = new Map<StyleTag, DescriptionData>([
      ["x", makeDescriptionData("d1")],
      ["y", makeDescriptionData("d2")],
    ]);
    const testDag = new Dag();
    testDag.addStyleBinding("name", ["y", "x"]);

    // usage order takes precedence
    const expectedMap = new Map<Keyword, DescriptionData>([
      ["name", makeDescriptionData("d2")],
    ]);
    expect(
      getNamesWithStyleDescriptionData(testDag, styleDescriptions),
    ).toEqual(expectedMap);
  });
  test("two names with bindings to the same style", () => {
    const styleDescriptions = new Map<StyleTag, DescriptionData>([
      ["x", makeDescriptionData("d1")],
    ]);
    const testDag = new Dag();
    testDag.addStyleBinding("name1", ["x"]);
    testDag.addStyleBinding("name2", ["x"]);

    const expectedMap = new Map<Keyword, DescriptionData>([
      ["name1", makeDescriptionData("d1")],
      ["name2", makeDescriptionData("d1")],
    ]);
    expect(
      getNamesWithStyleDescriptionData(testDag, styleDescriptions),
    ).toEqual(expectedMap);
  });
  test("two names with bindings to different styles", () => {
    const styleDescriptions = new Map<StyleTag, DescriptionData>([
      ["x", makeDescriptionData("d1")],
      ["y", makeDescriptionData("d2")],
    ]);
    const testDag = new Dag();
    testDag.addStyleBinding("name1", ["x"]);
    testDag.addStyleBinding("name2", ["y"]);

    const expectedMap = new Map<Keyword, DescriptionData>([
      ["name1", makeDescriptionData("d1")],
      ["name2", makeDescriptionData("d2")],
    ]);
    expect(
      getNamesWithStyleDescriptionData(testDag, styleDescriptions),
    ).toEqual(expectedMap);
  });
});

describe("makes element descriptions", () => {
  test("no matching nodes", () => {
    const testDag = new Dag();
    testDag.addNode({
      id: "idX",
      name: "nameX",
      styleTags: [],
      styleProperties: new Map([["a", "1"]]),
    });

    const expectedMap = new Map<NodeId, DescriptionData>();
    expect(getNodeDescriptionData(testDag)).toEqual(expectedMap);
  });
  test("one matching node", () => {
    const testDag = new Dag();
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
      ["idX", makeDescriptionData("d1", new Map([["color", "red"]]))],
    ]);
    expect(getNodeDescriptionData(testDag)).toEqual(expectedMap);
  });
  test("two matching nodes", () => {
    const testDag = new Dag();
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
      ["idX", makeDescriptionData("d1")],
      ["idY", makeDescriptionData("d2")],
    ]);
    expect(getNodeDescriptionData(testDag)).toEqual(expectedMap);
  });
  test("no matching edges", () => {
    const testDag = new Dag();
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
      styleTags: ["s", "t"],
      styleProperties: new Map([["a", "1"]]),
    });

    const expectedMap = new Map<EdgeId, DescriptionData>();
    expect(getEdgeDescriptionData(testDag)).toEqual(expectedMap);
  });
  test("one matching edge", () => {
    const testDag = new Dag();
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
      ["id1", makeDescriptionData("d1", new Map([["color", "red"]]))],
    ]);
    expect(getEdgeDescriptionData(testDag)).toEqual(expectedMap);
  });
  test("two matching edges", () => {
    const testDag = new Dag();
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
      ["id1", makeDescriptionData("d1")],
      ["id2", makeDescriptionData("d2")],
    ]);
    expect(getEdgeDescriptionData(testDag)).toEqual(expectedMap);
  });
});
