import { describe, test, expect } from "vitest";
import { Dag } from "../../../src/common/dag";

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
