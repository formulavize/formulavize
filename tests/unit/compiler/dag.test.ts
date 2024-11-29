import { describe, test, expect } from "vitest";
import { Dag } from "../../../src/compiler/dag";

describe("accessor tests", () => {
  // verify non-trivial accessor behavior
  test("style insertion order preserved in getFlattenedStyles", () => {
    const dag = new Dag("rootId");
    dag.setStyle("x", new Map([["color", "red"]]));
    dag.setStyle("y", new Map([["color", "green"]]));
    dag.setStyle("z", new Map([["color", "blue"]]));
    const flattenedStyles = dag.getFlattenedStyles();
    expect(Array.from(flattenedStyles.keys())).toEqual(["x", "y", "z"]);
  });
});

describe("mutator tests", () => {
  // verify non-trivial mutator behavior
  test("rename child dag with empty name", () => {
    const dag = new Dag("rootId");
    const childDag = new Dag("childId", dag, "n");
    childDag.setVarNode("x", "node1");
    expect(dag.getVarNode(["n", "x"])).toEqual("node1");
    childDag.Name = "";
    expect(dag.getVarNode(["n", "x"])).toEqual(undefined);
  });
  test("rename child dag with non-empty name", () => {
    const dag = new Dag("rootId");
    const childDag = new Dag("childId", dag, "n");
    childDag.setVarNode("x", "node1");
    expect(dag.getVarNode(["n", "x"])).toEqual("node1");
    childDag.Name = "o";
    expect(dag.getVarNode(["o", "x"])).toEqual("node1");
  });
  test("re-assign dag id", () => {
    const dag = new Dag("rootId");
    dag.Id = "newId";
    expect(dag.Id).toEqual("newId");
    expect(dag.LineagePath).toEqual("");
    expect(dag.DagLineagePath).toEqual("");
  });
  test("re-assign id of child dag id with non-empty name", () => {
    const dag = new Dag("rootId");
    const childDag = new Dag("childId", dag, "n");
    childDag.setVarNode("x", "node1");
    childDag.Id = "newId";
    expect(dag.getVarNode(["n", "x"])).toEqual("node1");
    expect(childDag.Id).toEqual("newId");
    expect(childDag.LineagePath).toEqual("/newId");
    expect(childDag.DagLineagePath).toEqual("");
  });
  test("re-assign id of grandchild dag id with empty name", () => {
    const dag = new Dag("rootId");
    const childDag = new Dag("childId", dag, "n");
    const grandchildDag = new Dag("grandchildId", childDag);
    grandchildDag.setVarNode("x", "node1");
    grandchildDag.Id = "newId";
    expect(childDag.getVarNode(["", "x"])).toEqual(undefined);
    expect(grandchildDag.Id).toEqual("newId");
    expect(grandchildDag.LineagePath).toEqual("/childId/newId");
    expect(grandchildDag.DagLineagePath).toEqual("/childId");
  });
});

describe("subdag tests", () => {
  test("switch parent", () => {
    const dag = new Dag("root1");
    const childDag = new Dag("child");
    dag.addChildDag(childDag);

    const newParent = new Dag("root2");
    newParent.addChildDag(childDag);

    expect(childDag.Parent).toEqual(newParent);
    expect(dag.getChildDags()).toEqual([]);
    expect(newParent.getChildDags()).toHaveLength(1);
  });
  test("lineage path", () => {
    const dag = new Dag("root1");
    const childDag = new Dag("child");
    dag.addChildDag(childDag);
    const grandchildDag = new Dag("grandchild");
    childDag.addChildDag(grandchildDag);

    expect(dag.LineagePath).toEqual("");
    expect(dag.DagLineagePath).toEqual("");
    expect(childDag.LineagePath).toEqual("/child");
    expect(childDag.DagLineagePath).toEqual("");
    expect(grandchildDag.LineagePath).toEqual("/child/grandchild");
    expect(grandchildDag.DagLineagePath).toEqual("/child");
  });
});

describe("scoping tests", () => {
  test("resolve variable in current scope", () => {
    const dag = new Dag("rootId");
    dag.setVarNode("x", "node1");
    const nodeId = dag.getVarNode(["x"]);
    expect(nodeId).toEqual("node1");
  });
  test("resolve variable in parent scope", () => {
    const dag = new Dag("rootId");
    dag.setVarNode("x", "node1");
    const childDag = new Dag("childId", dag);
    const nodeId = childDag.getVarNode(["x"]);
    expect(nodeId).toEqual("node1");
  });
  test("resolve variable in grandparent scope", () => {
    const dag = new Dag("rootId");
    dag.setVarNode("x", "node1");
    const childDag = new Dag("childId", dag);
    const grandchildDag = new Dag("grandchildId", childDag);
    const nodeId = grandchildDag.getVarNode(["x"]);
    expect(nodeId).toEqual("node1");
  });
  test("cannot directly resolve variable in child scope", () => {
    const dag = new Dag("rootId");
    const childDag = new Dag("childId", dag);
    childDag.setVarNode("x", "node1");
    const nodeId = dag.getVarNode(["x"]);
    expect(nodeId).toEqual(undefined);
  });
  test("resolve variable in child scope", () => {
    const dag = new Dag("rootId");
    const childDag = new Dag("childId", dag, "childName");
    childDag.setVarNode("x", "node1");
    const nodeId = dag.getVarNode(["childName", "x"]);
    expect(nodeId).toEqual("node1");
  });
  test("resolve variable in grandchild scope", () => {
    const dag = new Dag("rootId");
    const childDag = new Dag("childId", dag, "childName");
    const grandchildDag = new Dag("grandchildId", childDag, "grandchildName");
    grandchildDag.setVarNode("x", "node1");
    const nodeId = dag.getVarNode(["childName", "grandchildName", "x"]);
    expect(nodeId).toEqual("node1");
  });
  test("cannot resolve variable in anonymous child scope", () => {
    const dag = new Dag("rootId");
    const childDag = new Dag("childId", dag);
    childDag.setVarNode("x", "node1");
    const nodeId = dag.getVarNode(["child", "x"]);
    expect(nodeId).toEqual(undefined);
  });
  test("resolve variable in sibling scope", () => {
    const dag = new Dag("rootId");
    const childDag1 = new Dag("childId1", dag, "childName1");
    const childDag2 = new Dag("childId2", dag, "childName2");
    childDag1.setVarNode("x", "node1");
    const nodeId = childDag2.getVarNode(["childName1", "x"]);
    expect(nodeId).toEqual("node1");
  });
  test("cannot resolve variable in overwritten sibling scope with same name", () => {
    const dag = new Dag("rootId");
    const childDag1 = new Dag("childId1", dag, "childName");
    const childDag2 = new Dag("childId2", dag, "childName");
    childDag1.setVarNode("x", "node1");
    const nodeId = childDag2.getVarNode(["childName", "x"]);
    expect(nodeId).toEqual(undefined);
  });
  test("resolve variable style in sibling scope", () => {
    const dag = new Dag("rootId");
    const childDag1 = new Dag("childId1", dag, "childName1");
    const childDag2 = new Dag("childId2", dag, "childName2");
    childDag1.setStyle("x", new Map([["color", "red"]]));
    const style = childDag2.getStyle(["childName1", "x"]);
    expect(style).toEqual(new Map([["color", "red"]]));
  });
  test("resolve style tag in sibling scope", () => {
    const dag = new Dag("rootId");
    const childDag1 = new Dag("childId1", dag, "childName1");
    const childDag2 = new Dag("childId2", dag, "childName2");
    childDag1.setStyle("x", new Map([["color", "red"]]));
    const style = childDag2.getStyle(["childName1", "x"]);
    expect(style).toEqual(new Map([["color", "red"]]));
  });
});

describe("merge dag tests", () => {
  test("merge dag nodes", () => {
    const dag1 = new Dag("root1");
    const node1 = {
      id: "node1",
      name: "node1",
      styleTags: [],
      styleProperties: new Map(),
    };
    dag1.addNode(node1);

    const dag2 = new Dag("root2");
    const node2 = {
      id: "node2",
      name: "node2",
      styleTags: [],
      styleProperties: new Map(),
    };
    dag2.addNode(node2);
    dag1.mergeDag(dag2);
    expect(dag1.getNodeList()).toEqual([node1, node2]);
  });
  test("merge dag edges", () => {
    const dag1 = new Dag("root1");
    const edge1 = {
      id: "edge1",
      name: "edge1",
      srcNodeId: "src1",
      destNodeId: "dest1",
      styleTags: [],
      styleProperties: new Map(),
    };
    dag1.addEdge(edge1);

    const dag2 = new Dag("root2");
    const edge2 = {
      id: "edge2",
      name: "edge2",
      srcNodeId: "src2",
      destNodeId: "dest2",
      styleTags: [],
      styleProperties: new Map(),
    };
    dag2.addEdge(edge2);
    dag1.mergeDag(dag2);
    expect(dag1.getEdgeList()).toEqual([edge1, edge2]);
  });
  test("merge dag style tags with no conflicts", () => {
    const dag1 = new Dag("root1");
    dag1.setStyle("tag1", new Map([["color", "red"]]));
    const dag2 = new Dag("root2");
    dag2.setStyle("tag2", new Map([["color", "green"]]));
    dag1.mergeDag(dag2);
    expect(dag1.getFlattenedStyles()).toEqual(
      new Map([
        ["tag1", new Map([["color", "red"]])],
        ["tag2", new Map([["color", "green"]])],
      ]),
    );
  });
  test("merge dag style tags with conflicting names", () => {
    const dag1 = new Dag("root1");
    dag1.setStyle("tag1", new Map([["color", "red"]]));
    const dag2 = new Dag("root2");
    dag2.setStyle("tag1", new Map([["color", "green"]]));
    dag1.mergeDag(dag2);
    expect(dag1.getFlattenedStyles()).toEqual(
      new Map([["tag1", new Map([["color", "green"]])]]),
    );
  });
  test("merge dag style bindings with no conflicts", () => {
    const dag1 = new Dag("root1");
    dag1.addStyleBinding("keyword1", [["tag1"]]);
    const dag2 = new Dag("root2");
    dag2.addStyleBinding("keyword2", [["tag2"]]);
    dag1.mergeDag(dag2);
    expect(dag1.getStyleBindings()).toEqual(
      new Map([
        ["keyword1", [["tag1"]]],
        ["keyword2", [["tag2"]]],
      ]),
    );
  });
  test("merge dag style bindings with conflicting names", () => {
    const dag1 = new Dag("root1");
    dag1.addStyleBinding("keyword1", [["tag1"]]);
    const dag2 = new Dag("root2");
    dag2.addStyleBinding("keyword1", [["tag2"]]);
    dag1.mergeDag(dag2);
    expect(dag1.getStyleBindings()).toEqual(
      new Map([["keyword1", [["tag2"]]]]),
    );
  });
  test("merge dag var nodes with no conflicts", () => {
    const dag1 = new Dag("root1");
    dag1.setVarNode("x", "node1");
    const dag2 = new Dag("root2");
    dag2.setVarNode("y", "node2");
    dag1.mergeDag(dag2);
    expect(dag1.getVarNode(["x"])).toEqual("node1");
    expect(dag1.getVarNode(["y"])).toEqual("node2");
  });
  test("merge dag var nodes with conflicting names", () => {
    const dag1 = new Dag("root1");
    dag1.setVarNode("x", "node1");
    const dag2 = new Dag("root2");
    dag2.setVarNode("x", "node2");
    dag1.mergeDag(dag2);
    expect(dag1.getVarNode(["x"])).toEqual("node2");
  });
  test("merge dag var styles with no conflicts", () => {
    const dag1 = new Dag("root1");
    const dagStyle1 = {
      styleTags: [],
      styleProperties: new Map([["color", "red"]]),
    };
    dag1.setVarStyle("x", dagStyle1);
    const dag2 = new Dag("root2");
    const dagStyle2 = {
      styleTags: [],
      styleProperties: new Map([["color", "green"]]),
    };
    dag2.setVarStyle("y", dagStyle2);
    dag1.mergeDag(dag2);
    expect(dag1.getVarStyle(["x"])).toEqual(dagStyle1);
    expect(dag1.getVarStyle(["y"])).toEqual(dagStyle2);
  });
  test("merge dag var styles with conflicting names", () => {
    const dag1 = new Dag("root1");
    const dagStyle1 = {
      styleTags: [],
      styleProperties: new Map([["color", "red"]]),
    };
    dag1.setVarStyle("x", dagStyle1);
    const dag2 = new Dag("root2");
    const dagStyle2 = {
      styleTags: [],
      styleProperties: new Map([["color", "green"]]),
    };
    dag2.setVarStyle("x", dagStyle2);
    dag1.mergeDag(dag2);
    expect(dag1.getVarStyle(["x"])).toEqual(dagStyle2);
  });
  test("merge dag child dags", () => {
    const dag1 = new Dag("root1");
    const childDag1 = new Dag("child1", dag1);

    const dag2 = new Dag("root2");
    const childDag2 = new Dag("child2", dag2);
    dag1.mergeDag(dag2);
    expect(dag1.getChildDags()).toEqual([childDag1, childDag2]);
  });
  test("merge dag child dags with conflicting names", () => {
    const dag1 = new Dag("root1");
    const childDag1 = new Dag("child1", dag1, "n");
    childDag1.setVarNode("x", "node1");

    const dag2 = new Dag("root2");
    const childDag2 = new Dag("child2", dag2, "n");
    childDag2.setVarNode("x", "node2");
    dag1.mergeDag(dag2);
    expect(dag1.getChildDags()).toEqual([childDag1, childDag2]);
    expect(dag1.getVarNode(["n", "x"])).toEqual("node2");
  });
});
