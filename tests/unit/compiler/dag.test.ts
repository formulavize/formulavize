import { describe, test, expect, vi } from "vitest";
import { Dag } from "src/compiler/dag";

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
    const styleNode1 = {
      styleTags: [["tag1"]],
      styleProperties: new Map([["color", "red"]]),
    };
    dag1.addStyleBinding("keyword1", styleNode1);

    const dag2 = new Dag("root2");
    const styleNode2 = {
      styleTags: [["tag2"]],
      styleProperties: new Map([["color", "green"]]),
    };
    dag2.addStyleBinding("keyword2", styleNode2);

    dag1.mergeDag(dag2);
    expect(dag1.getStyleBindings()).toEqual(
      new Map([
        ["keyword1", styleNode1],
        ["keyword2", styleNode2],
      ]),
    );
  });
  test("merge dag style bindings with conflicting names", () => {
    const dag1 = new Dag("root1");
    const styleNode1 = {
      styleTags: [["tag1"]],
      styleProperties: new Map([["color", "red"]]),
    };
    dag1.addStyleBinding("keyword1", styleNode1);

    const dag2 = new Dag("root2");
    const styleNode2 = {
      styleTags: [["tag2"]],
      styleProperties: new Map([["color", "green"]]),
    };
    dag2.addStyleBinding("keyword1", styleNode2);

    dag1.mergeDag(dag2);
    expect(dag1.getStyleBindings()).toEqual(
      new Map([["keyword1", styleNode2]]),
    );
  });
  test("merge dag renderer directives", () => {
    // Anonymous imports merge into the importing dag, so a directive carried
    // by an imported file would be silently dropped without this.
    const dag1 = new Dag("root1");
    const directive1 = {
      styleTags: [],
      styleProperties: new Map([["rankDir", "LR"]]),
    };
    dag1.addRendererDirective("cytoscape", directive1);
    const dag2 = new Dag("root2");
    const directive2 = {
      styleTags: [],
      styleProperties: new Map([["spacing", "2"]]),
    };
    dag2.addRendererDirective("minimal", directive2);

    dag1.mergeDag(dag2);
    expect(dag1.getRendererDirectives()).toEqual(
      new Map([
        ["cytoscape", directive1],
        ["minimal", directive2],
      ]),
    );
  });
  test("merge dag renderer directives with conflicting ids", () => {
    const dag1 = new Dag("root1");
    dag1.addRendererDirective("cytoscape", {
      styleTags: [],
      styleProperties: new Map([["rankDir", "LR"]]),
    });
    const dag2 = new Dag("root2");
    const directive2 = {
      styleTags: [],
      styleProperties: new Map([["rankDir", "BT"]]),
    };
    dag2.addRendererDirective("cytoscape", directive2);

    dag1.mergeDag(dag2);
    expect(dag1.getRendererDirectives()).toEqual(
      new Map([["cytoscape", directive2]]),
    );
  });
  test("merge dag about notes", () => {
    // Anonymous imports merge into the importing dag, so metadata carried by
    // an imported file would be silently dropped without this.
    const dag1 = new Dag("root1");
    const note1 = {
      styleTags: [],
      styleProperties: new Map([["author", "Remy"]]),
    };
    dag1.addAboutNote("about", note1);
    const dag2 = new Dag("root2");
    const note2 = {
      styleTags: [],
      styleProperties: new Map([["source", "upstream"]]),
    };
    dag2.addAboutNote("provenance", note2);

    dag1.mergeDag(dag2);
    expect(dag1.getAboutNotes()).toEqual(
      new Map([
        ["about", note1],
        ["provenance", note2],
      ]),
    );
  });
  test("merge dag about notes with conflicting names", () => {
    const dag1 = new Dag("root1");
    dag1.addAboutNote("about", {
      styleTags: [],
      styleProperties: new Map([["version", "1"]]),
    });
    const dag2 = new Dag("root2");
    const note2 = {
      styleTags: [],
      styleProperties: new Map([["version", "2"]]),
    };
    dag2.addAboutNote("about", note2);

    dag1.mergeDag(dag2);
    expect(dag1.getAboutNotes()).toEqual(new Map([["about", note2]]));
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

const makeSimpleNode = (id: string) => ({
  id,
  name: id,
  styleTags: [],
  styleProperties: new Map(),
});

describe("insertion order tests", () => {
  test("addNode tracks insertion order", () => {
    const dag = new Dag("root");
    dag.addNode(makeSimpleNode("a"));
    dag.addNode(makeSimpleNode("b"));
    dag.addNode(makeSimpleNode("c"));
    const order = dag.getElementInsertionOrder();
    expect(order.get("a")).toBe(0);
    expect(order.get("b")).toBe(1);
    expect(order.get("c")).toBe(2);
  });

  test("addChildDag tracks insertion order", () => {
    const dag = new Dag("root");
    const child1 = new Dag("child1");
    const child2 = new Dag("child2");
    dag.addChildDag(child1);
    dag.addChildDag(child2);
    const order = dag.getElementInsertionOrder();
    expect(order.get("child1")).toBe(0);
    expect(order.get("child2")).toBe(1);
  });

  test("nodes and child dags share insertion counter", () => {
    const dag = new Dag("root");
    dag.addNode(makeSimpleNode("a"));
    const child = new Dag("child1");
    dag.addChildDag(child);
    dag.addNode(makeSimpleNode("b"));
    const order = dag.getElementInsertionOrder();
    expect(order.get("a")).toBe(0);
    expect(order.get("child1")).toBe(1);
    expect(order.get("b")).toBe(2);
  });

  test("constructor with parent tracks insertion order", () => {
    const dag = new Dag("root");
    dag.addNode(makeSimpleNode("a"));
    new Dag("child1", dag);
    dag.addNode(makeSimpleNode("b"));
    const order = dag.getElementInsertionOrder();
    expect(order.get("a")).toBe(0);
    expect(order.get("child1")).toBe(1);
    expect(order.get("b")).toBe(2);
  });

  test("mergeDag preserves relative order with offset", () => {
    const dag1 = new Dag("root1");
    dag1.addNode(makeSimpleNode("a"));
    dag1.addNode(makeSimpleNode("b"));

    const dag2 = new Dag("root2");
    dag2.addNode(makeSimpleNode("c"));
    dag2.addNode(makeSimpleNode("d"));

    dag1.mergeDag(dag2);
    const order = dag1.getElementInsertionOrder();
    expect(order.get("a")).toBe(0);
    expect(order.get("b")).toBe(1);
    expect(order.get("c")).toBe(2);
    expect(order.get("d")).toBe(3);
  });

  test("mergeDag preserves child dag order with offset", () => {
    const dag1 = new Dag("root1");
    dag1.addNode(makeSimpleNode("a"));

    const dag2 = new Dag("root2");
    const child = new Dag("child1");
    dag2.addChildDag(child);
    dag2.addNode(makeSimpleNode("b"));

    dag1.mergeDag(dag2);
    const order = dag1.getElementInsertionOrder();
    expect(order.get("a")).toBe(0);
    expect(order.get("child1")).toBe(1);
    expect(order.get("b")).toBe(2);
  });

  test("addNode after mergeDag continues from merged counter", () => {
    const dag1 = new Dag("root1");
    dag1.addNode(makeSimpleNode("a"));

    const dag2 = new Dag("root2");
    dag2.addNode(makeSimpleNode("b"));
    dag2.addNode(makeSimpleNode("c"));

    dag1.mergeDag(dag2);
    dag1.addNode(makeSimpleNode("d"));

    const order = dag1.getElementInsertionOrder();
    expect(order.get("a")).toBe(0);
    expect(order.get("b")).toBe(1);
    expect(order.get("c")).toBe(2);
    expect(order.get("d")).toBe(3);
  });

  test("edges and styles do not affect insertion order", () => {
    const dag = new Dag("root");
    dag.addNode(makeSimpleNode("a"));
    dag.addNode(makeSimpleNode("b"));
    dag.addEdge({
      id: "e1",
      name: "e1",
      srcNodeId: "a",
      destNodeId: "b",
      styleTags: [],
      styleProperties: new Map(),
    });
    const order = dag.getElementInsertionOrder();
    expect(order.get("a")).toBe(0);
    expect(order.get("b")).toBe(1);
    expect(order.has("e1")).toBe(false);
  });

  test("empty dag merge does not advance counter", () => {
    const dag1 = new Dag("root1");
    dag1.addNode(makeSimpleNode("a"));

    const dag2 = new Dag("root2");
    dag1.mergeDag(dag2);

    dag1.addNode(makeSimpleNode("b"));
    const order = dag1.getElementInsertionOrder();
    expect(order.get("a")).toBe(0);
    expect(order.get("b")).toBe(1);
  });
});

describe("clone tests", () => {
  function makePopulatedDag(): Dag {
    const dag = new Dag(
      "rootId",
      null,
      "rootName",
      [["dagTag"]],
      new Map([["color", "red"]]),
    );
    dag.addNode({
      id: "node1",
      name: "f",
      styleTags: [["nodeTag"]],
      styleProperties: new Map([["shape", "circle"]]),
    });
    dag.addNode({
      id: "node2",
      name: "g",
      styleTags: [],
      styleProperties: new Map(),
    });
    dag.addEdge({
      id: "edge1",
      name: "e",
      styleTags: [],
      styleProperties: new Map([["width", "2"]]),
      srcNodeId: "node1",
      destNodeId: "node2",
    });
    dag.setStyle("s", new Map([["color", "blue"]]));
    dag.addStyleBinding("node", {
      styleTags: [["s"]],
      styleProperties: new Map(),
    });
    dag.addGlobalStyleBinding("edge", {
      styleTags: [],
      styleProperties: new Map([["color", "green"]]),
    });
    dag.addRendererDirective("cytoscape", {
      styleTags: [],
      styleProperties: new Map([["layout", "dagre"]]),
    });
    dag.addAboutNote("", {
      styleTags: [],
      styleProperties: new Map([["author", "someone"]]),
    });
    dag.setVarNode("x", "node1");
    dag.setVarStyle("y", { styleTags: [["s"]], styleProperties: new Map() });
    dag.addUsedImport("pkg.fiz");

    const childDag = new Dag("childId", dag, "child");
    childDag.addNode({
      id: "node3",
      name: "h",
      styleTags: [],
      styleProperties: new Map(),
    });
    return dag;
  }

  test("clone matches the original", () => {
    const dag = makePopulatedDag();
    const copy = dag.clone();
    expect(copy).not.toBe(dag);
    expect(copy).toEqual(dag);
    expect(copy.debugDumpDag()).toEqual(dag.debugDumpDag());
  });

  test("clone is detached from any parent", () => {
    const dag = new Dag("rootId");
    const childDag = new Dag("childId", dag, "child");
    const copy = childDag.clone();
    expect(copy.Parent).toBeNull();
    expect(copy.getDagAsDagNode().id).toEqual("childId");
  });

  test("clone child dags are owned by the clone", () => {
    const dag = makePopulatedDag();
    const copy = dag.clone();
    const [originalChild] = dag.getChildDags();
    const [copiedChild] = copy.getChildDags();
    expect(copiedChild).not.toBe(originalChild);
    expect(copiedChild.Parent).toBe(copy);
    // the original keeps its child: attaching the copy elsewhere must not
    // re-parent what the original owns
    expect(originalChild.Parent).toBe(dag);
  });

  test("mutating a clone leaves the original untouched", () => {
    const dag = makePopulatedDag();
    const copy = dag.clone();

    copy.Id = "newId";
    copy.Name = "newName";
    copy.addNode({
      id: "node4",
      name: "extra",
      styleTags: [],
      styleProperties: new Map(),
    });
    copy.getChildDags()[0].Name = "renamed";
    copy.getNodeList()[0].styleProperties.set("shape", "square");
    copy.UsedImports.add("other.fiz");

    expect(dag.Id).toEqual("rootId");
    expect(dag.Name).toEqual("rootName");
    expect(dag.getNodeList()).toHaveLength(2);
    expect(dag.getChildDags()[0].Name).toEqual("child");
    expect(dag.getNodeList()[0].styleProperties.get("shape")).toEqual("circle");
    expect(dag.UsedImports).toEqual(new Set(["pkg.fiz"]));
  });

  test("clone shares no style maps with the original", () => {
    const dag = makePopulatedDag();
    const copy = dag.clone();

    expect(copy.getFlattenedStyles().get("s")).not.toBe(
      dag.getFlattenedStyles().get("s"),
    );
    expect(copy.getStyleBindings().get("node")).not.toBe(
      dag.getStyleBindings().get("node"),
    );
    expect(copy.DagStyleProperties).not.toBe(dag.DagStyleProperties);

    copy.getFlattenedStyles().get("s")?.set("color", "yellow");
    expect(dag.getFlattenedStyles().get("s")?.get("color")).toEqual("blue");
  });

  test("clone preserves element insertion order", () => {
    const dag = makePopulatedDag();
    const copy = dag.clone();
    expect(copy.getElementInsertionOrder()).toEqual(
      dag.getElementInsertionOrder(),
    );
    copy.addNode({
      id: "node5",
      name: "later",
      styleTags: [],
      styleProperties: new Map(),
    });
    // the restored insertion counter keeps new elements ordered last
    const order = copy.getElementInsertionOrder();
    const maxOriginalOrder = Math.max(
      ...Array.from(dag.getElementInsertionOrder().values()),
    );
    expect(order.get("node5")).toBeGreaterThan(maxOriginalOrder);
  });
});

describe("deep clone lineage", () => {
  test("clone of a three level dag keeps every lineage path", () => {
    const root = new Dag("rootId");
    const child = new Dag("childId", root, "child");
    const grandchild = new Dag("grandchildId", child, "grandchild");
    grandchild.addNode({
      id: "node1",
      name: "f",
      styleTags: [],
      styleProperties: new Map(),
    });

    const copy = root.clone();
    const copiedChild = copy.getChildDags()[0];
    const copiedGrandchild = copiedChild.getChildDags()[0];

    expect(copiedChild.LineagePath).toEqual(child.LineagePath);
    expect(copiedGrandchild.LineagePath).toEqual(grandchild.LineagePath);
    expect(copiedGrandchild.DagLineagePath).toEqual(grandchild.DagLineagePath);
    expect(copy).toEqual(root);
  });
});
describe("lineage cycle guard", () => {
  test("a looped lineage stops the upward traversal", () => {
    const root = new Dag("rootId");
    const child = new Dag("childId", root, "child");
    const grandchild = new Dag("grandchildId", child, "grandchild");
    // a lineage loop should never occur in practice, but resolution must not
    // recurse forever if one ever does
    root.Parent = grandchild;

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(grandchild.getVarNode(["missing"])).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      "Cycle detected in the DAG lineage, stopping traversal",
    );
    warn.mockRestore();
  });

  test("resolution still reaches outer scopes", () => {
    const root = new Dag("rootId");
    root.setVarNode("x", "node1");
    const child = new Dag("childId", root, "child");
    const grandchild = new Dag("grandchildId", child, "grandchild");

    expect(grandchild.getVarNode(["x"])).toEqual("node1");
    expect(root.getVarNode(["child", "grandchild", "x"])).toBeUndefined();
    grandchild.setVarNode("y", "node2");
    expect(root.getVarNode(["child", "grandchild", "y"])).toEqual("node2");
  });
});
