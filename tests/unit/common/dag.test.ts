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
