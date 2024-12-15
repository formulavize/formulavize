import { describe, test, expect } from "vitest";
import {
  RecipeTreeNode as Recipe,
  CallTreeNode as Call,
  AssignmentTreeNode as Assignment,
  AliasTreeNode as Alias,
  LocalVarTreeNode as LocalVariable,
  QualifiedVarTreeNode as QualifiedVariable,
  StyleTreeNode as Style,
  NamedStyleTreeNode as NamedStyle,
  StyleBindingTreeNode as StyleBinding,
  NamespaceTreeNode as Namespace,
  ImportTreeNode as Import,
} from "../../../src/compiler/ast";
import { DESCRIPTION_PROPERTY } from "../../../src/compiler/constants";
import {
  Dag,
  StyleTag,
  StyleProperties,
  Keyword,
} from "../../../src/compiler/dag";
import { makeDag } from "../../../src/compiler/astToDag";
import { ImportCacher } from "../../../src/compiler/importCacher";

const dummyImporter = {} as ImportCacher;

describe("node tests", () => {
  async function makeDagAndReturnNodeNames(recipe: Recipe): Promise<string[]> {
    const dag = await makeDag(recipe, dummyImporter);
    return dag
      .getNodeList()
      .map((node) => node.name)
      .sort();
  }

  test("empty recipe", async () => {
    const recipe = new Recipe();
    const dag = await makeDag(recipe, dummyImporter);
    expect(dag).toEqual(new Dag(dag.Id));
  });
  test("one node", async () => {
    const recipe = new Recipe([new Call("a", [])]);
    const nodeList = await makeDagAndReturnNodeNames(recipe);
    expect(nodeList).toEqual(["a"]);
  });
  test("two nodes", async () => {
    const recipe = new Recipe([new Call("b", []), new Call("a", [])]);
    const nodeList = await makeDagAndReturnNodeNames(recipe);
    expect(nodeList).toEqual(["a", "b"]);
  });
  test("duplicate name nodes", async () => {
    const recipe = new Recipe([new Call("a", []), new Call("a", [])]);
    const nodeList = await makeDagAndReturnNodeNames(recipe);
    expect(nodeList).toEqual(["a", "a"]);
  });
  test("nested name nodes", async () => {
    const recipe = new Recipe([new Call("f", [new Call("v", [])])]);
    const nodeList = await makeDagAndReturnNodeNames(recipe);
    expect(nodeList).toEqual(["f", "v"]);
  });
});

describe("edge tests", () => {
  type NodeNamePair = [string | undefined, string | undefined];
  function getDagNodeIdsToNames(dag: Dag): Map<string, string> {
    return new Map<string, string>(
      dag.getNodeList().map((node) => [node.id, node.name]),
    );
  }

  function getAllNodeNamesToNodeIds(dag: Dag): Map<string, string> {
    const nodeIdToNameMap = new Map<string, string>(getDagNodeIdsToNames(dag));
    return dag
      .getChildDags()
      .map((childDag) => getDagNodeIdsToNames(childDag))
      .reduce((acc, val) => new Map([...acc, ...val]), nodeIdToNameMap);
  }

  function getDagEdgeNames(
    dag: Dag,
    nodeIdToNameMap: Map<string, string>,
  ): NodeNamePair[] {
    return dag
      .getEdgeList()
      .map(
        (edge) =>
          [
            nodeIdToNameMap.get(edge.srcNodeId),
            nodeIdToNameMap.get(edge.destNodeId),
          ] as NodeNamePair,
      )
      .sort();
  }

  async function makeDagAndReturnEdgeNames(
    recipe: Recipe,
  ): Promise<NodeNamePair[]> {
    const dag = await makeDag(recipe, dummyImporter);
    const nodeIdToNameMap = getAllNodeNamesToNodeIds(dag);
    const edgeList = getDagEdgeNames(dag, nodeIdToNameMap);
    return dag
      .getChildDags()
      .map((childDag) => getDagEdgeNames(childDag, nodeIdToNameMap))
      .reduce((acc, val) => acc.concat(val), edgeList);
  }

  test("no edge", async () => {
    const recipe = new Recipe([new Call("b", []), new Call("a", [])]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([]);
  });
  test("one edge through call", async () => {
    const recipe = new Recipe([new Call("f", [new Call("v", [])])]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([["v", "f"]]);
  });
  test("one edge through variable", async () => {
    const recipe = new Recipe([
      new Assignment([new LocalVariable("x")], new Call("y", [])),
      new Call("z", [new QualifiedVariable(["x"])]),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([["y", "z"]]);
  });
  test("two separate edges", async () => {
    const recipe = new Recipe([
      new Assignment([new LocalVariable("a")], new Call("b", [])),
      new Assignment([new LocalVariable("c")], new Call("d", [])),
      new Call("e", [new QualifiedVariable(["a"])]),
      new Call("f", [new QualifiedVariable(["c"])]),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([
      ["b", "e"],
      ["d", "f"],
    ]);
  });
  test("two dependency function", async () => {
    const recipe = new Recipe([
      new Assignment([new LocalVariable("a")], new Call("b", [])),
      new Assignment([new LocalVariable("c")], new Call("d", [])),
      new Call("e", [
        new QualifiedVariable(["a"]),
        new QualifiedVariable(["c"]),
      ]),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([
      ["b", "e"],
      ["d", "e"],
    ]);
  });
  test("function with one var multiple consumers", async () => {
    const recipe = new Recipe([
      new Assignment([new LocalVariable("a")], new Call("b", [])),
      new Call("y", [new QualifiedVariable(["a"])]),
      new Call("x", [new QualifiedVariable(["a"])]),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([
      ["b", "x"],
      ["b", "y"],
    ]);
  });
  test("function with two vars different consumers", async () => {
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("a"), new LocalVariable("b")],
        new Call("c", []),
      ),
      new Call("y", [new QualifiedVariable(["a"])]),
      new Call("x", [new QualifiedVariable(["b"])]),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([
      ["c", "x"],
      ["c", "y"],
    ]);
  });
  test("function with double edge", async () => {
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("a"), new LocalVariable("b")],
        new Call("c", []),
      ),
      new Call("y", [
        new QualifiedVariable(["a"]),
        new QualifiedVariable(["b"]),
      ]),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([
      ["c", "y"],
      ["c", "y"],
    ]);
  });
  test("function with re-used vars", async () => {
    const recipe = new Recipe([
      new Assignment([new LocalVariable("a")], new Call("c", [])),
      new Call("y", [
        new QualifiedVariable(["a"]),
        new QualifiedVariable(["a"]),
        new QualifiedVariable(["a"]),
      ]),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([
      ["c", "y"],
      ["c", "y"],
      ["c", "y"],
    ]);
  });
  test("aliased variable", async () => {
    const recipe = new Recipe([
      new Assignment([new LocalVariable("a")], new Call("c", [])),
      new Alias(new LocalVariable("b"), new QualifiedVariable(["a"])),
      new Call("y", [new QualifiedVariable(["b"])]),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([["c", "y"]]);
  });
  test("call with nested call and var", async () => {
    const recipe = new Recipe([
      new Assignment([new LocalVariable("a")], new Call("c", [])),
      new Call("y", [new QualifiedVariable(["a"]), new Call("b", [])]),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([
      ["b", "y"],
      ["c", "y"],
    ]);
  });
  test("duplicate nested calls", async () => {
    const recipe = new Recipe([
      new Call("y", [new Call("b", []), new Call("b", [])]),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([
      ["b", "y"],
      ["b", "y"],
    ]);
  });
  test("cannot resolve variable usage before assignment", async () => {
    const recipe = new Recipe([
      new Call("y", [new QualifiedVariable(["a"])]),
      new Assignment([new LocalVariable("a")], new Call("b", [])),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    // no edge should be created because variable a is used before assignment
    expect(edgeList).toEqual([]);
  });
  test("resolve variable in parent namespace", async () => {
    const recipe = new Recipe([
      new Assignment([new LocalVariable("a")], new Call("b", [])),
      new Namespace("child", [new Call("y", [new QualifiedVariable(["a"])])]),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([["b", "y"]]);
  });
  test("cannot directly resolve variable in child namespace", async () => {
    const recipe = new Recipe([
      new Namespace("child", [
        new Assignment([new LocalVariable("a")], new Call("b", [])),
      ]),
      new Call("y", [new QualifiedVariable(["a"])]),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([]);
  });
  test("resolve variable in child namespace", async () => {
    const recipe = new Recipe([
      new Namespace("child", [
        new Assignment([new LocalVariable("a")], new Call("b", [])),
      ]),
      new Call("y", [new QualifiedVariable(["child", "a"])]),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([["b", "y"]]);
  });
  test("resolve variable in sibling namespace", async () => {
    const recipe = new Recipe([
      new Namespace("child", [
        new Assignment([new LocalVariable("a")], new Call("b", [])),
      ]),
      new Namespace("sibling", [
        new Call("y", [new QualifiedVariable(["child", "a"])]),
      ]),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([["b", "y"]]);
  });
  test("namespace with args makes incoming edges", async () => {
    const recipe = new Recipe([
      new Assignment([new LocalVariable("y")], new Call("f", [])),
      new Namespace(
        "child",
        [new Call("g", [])],
        [new QualifiedVariable(["y"]), new Call("h", [])],
      ),
    ]);
    const dag = await makeDag(recipe, dummyImporter);
    const nodeIdToNameMap = getAllNodeNamesToNodeIds(dag);
    const rawEdgeList = dag
      .getEdgeList()
      .sort((a, b) => a.name.localeCompare(b.name));
    expect(rawEdgeList).toHaveLength(2);

    expect(rawEdgeList[0].name).toEqual("");
    expect(nodeIdToNameMap.get(rawEdgeList[0].srcNodeId)).toEqual("h");

    expect(rawEdgeList[1].name).toEqual("y");
    expect(nodeIdToNameMap.get(rawEdgeList[1].srcNodeId)).toEqual("f");

    const childDags = dag.getChildDags();
    expect(childDags).toHaveLength(1);
    const childDag = childDags[0];
    expect(rawEdgeList[0].destNodeId).toBe(childDag.Id);
    expect(rawEdgeList[0].destNodeId).toEqual(rawEdgeList[1].destNodeId);
  });
  test("edge from anonymous namespace", async () => {
    const recipe = new Recipe([
      new Assignment([new LocalVariable("y")], new Namespace()),
      new Call("g", [new QualifiedVariable(["y"])]),
    ]);
    const dag = await makeDag(recipe, dummyImporter);
    const nodeIdToNameMap = getAllNodeNamesToNodeIds(dag);

    const edgeList = dag.getEdgeList();
    expect(edgeList).toHaveLength(1);
    expect(nodeIdToNameMap.get(edgeList[0].destNodeId)).toEqual("g");

    const childDags = dag.getChildDags();
    expect(childDags).toHaveLength(1);
    const childDag = childDags[0];
    expect(edgeList[0].srcNodeId).toBe(childDag.Id);
  });
  test("edge from named namespace", async () => {
    const recipe = new Recipe([
      new Assignment([new LocalVariable("y")], new Namespace("child")),
      new Call("g", [new QualifiedVariable(["y"])]),
    ]);
    const dag = await makeDag(recipe, dummyImporter);
    const nodeIdToNameMap = getAllNodeNamesToNodeIds(dag);

    const edgeList = dag.getEdgeList();
    expect(edgeList).toHaveLength(1);
    expect(nodeIdToNameMap.get(edgeList[0].destNodeId)).toEqual("g");

    const childDags = dag.getChildDags();
    expect(childDags).toHaveLength(1);
    const childDag = childDags[0];
    expect(edgeList[0].srcNodeId).toBe(childDag.Id);
  });
});

describe("style tests", () => {
  async function makeDagAndReturnStyleMap(
    recipe: Recipe,
  ): Promise<Map<string, StyleProperties>> {
    const dag = await makeDag(recipe, dummyImporter);
    return dag.getFlattenedStyles();
  }

  test("basic named style", async () => {
    const sampleMap: StyleProperties = new Map([["a", "1"]]);
    const recipe = new Recipe([new NamedStyle("s", new Style(sampleMap))]);
    const expectedMap: Map<string, StyleProperties> = new Map([
      ["s", sampleMap],
    ]);
    const styleMap = await makeDagAndReturnStyleMap(recipe);
    expect(styleMap).toEqual(expectedMap);
  });
  test("named style referenced", async () => {
    const sampleMap: StyleProperties = new Map([["a", "1"]]);
    const recipe = new Recipe([
      new NamedStyle("s", new Style(sampleMap)),
      new NamedStyle("t", new Style(undefined, [["s"]])),
    ]);
    const expectedMap: Map<string, StyleProperties> = new Map([
      ["s", sampleMap],
      ["t", sampleMap],
    ]);
    const styleMap = await makeDagAndReturnStyleMap(recipe);
    expect(styleMap).toEqual(expectedMap);
  });
  test("named style local overwrite", async () => {
    const sampleMap: StyleProperties = new Map([["a", "old"]]);
    const localMap: StyleProperties = new Map([["a", "new"]]);
    const recipe = new Recipe([
      new NamedStyle("s", new Style(sampleMap)),
      new NamedStyle("t", new Style(localMap, [["s"]])),
    ]);
    const expectedMap: Map<string, StyleProperties> = new Map([
      ["s", sampleMap],
      ["t", localMap],
    ]);
    const styleMap = await makeDagAndReturnStyleMap(recipe);
    expect(styleMap).toEqual(expectedMap);
  });

  test("named style undeclared tag", async () => {
    const recipe = new Recipe([
      new NamedStyle("s", new Style(undefined, [["s"]])),
    ]);
    const expectedMap: Map<string, StyleProperties> = new Map([
      ["s", new Map()],
    ]);
    const styleMap = await makeDagAndReturnStyleMap(recipe);
    expect(styleMap).toEqual(expectedMap);
  });
  test("call styled", async () => {
    const sampleMap: StyleProperties = new Map([["a", "1"]]);
    const recipe = new Recipe([
      new Call("f", [], new Style(sampleMap, [["s"]])),
    ]);
    const dag = await makeDag(recipe, dummyImporter);
    const dagNodeList = dag.getNodeList();
    expect(dagNodeList).toHaveLength(1);
    const dagNode = dagNodeList[0];
    expect(dagNode.styleProperties).toEqual(sampleMap);
    expect(dagNode.styleTags).toEqual([["s"]]);
  });
  test("variable styled", async () => {
    const sampleMap: StyleProperties = new Map([["a", "1"]]);
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("x", new Style(sampleMap, [["s"]]))],
        new Call("f", []),
      ),
      new Call("g", [new QualifiedVariable(["x"])]),
    ]);
    const dag = await makeDag(recipe, dummyImporter);
    const dagEdgeList = dag.getEdgeList();
    expect(dagEdgeList).toHaveLength(1);
    const dagEdge = dagEdgeList[0];
    expect(dagEdge.styleProperties).toEqual(sampleMap);
    expect(dagEdge.styleTags).toEqual([["s"]]);
  });
  test("multiple styled variables assigned", async () => {
    const sampleMap: StyleProperties = new Map([["a", "1"]]);
    const sampleMap2: StyleProperties = new Map([["b", "2"]]);
    const recipe = new Recipe([
      new NamedStyle("s", new Style(sampleMap)),
      new Assignment(
        [
          new LocalVariable("x", new Style(undefined, [["s"]])),
          new LocalVariable("y", new Style(sampleMap2, [])),
        ],
        new Call("f", []),
      ),
      new Call("g", [
        new QualifiedVariable(["x"]),
        new QualifiedVariable(["y"]),
      ]),
    ]);
    const dag = await makeDag(recipe, dummyImporter);
    const dagEdgeList = dag.getEdgeList();
    expect(dagEdgeList).toHaveLength(2);
    let dagEdge1 = dagEdgeList[0];
    let dagEdge2 = dagEdgeList[1];
    if (dagEdge1.name === "y" && dagEdge2.name === "x") {
      [dagEdge1, dagEdge2] = [dagEdge2, dagEdge1];
    }
    expect(dagEdge1.styleProperties).toEqual(new Map());
    expect(dagEdge1.styleTags).toEqual([["s"]]);
    expect(dagEdge2.styleProperties).toEqual(sampleMap2);
    expect(dagEdge2.styleTags).toEqual([]);
  });
  test("variable styled in parent namespace", async () => {
    const sampleMap: StyleProperties = new Map([["a", "1"]]);
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("x", new Style(sampleMap, []))],
        new Call("f", []),
      ),
      new Namespace("child", [new Call("g", [new QualifiedVariable(["x"])])]),
    ]);
    const dag = await makeDag(recipe, dummyImporter);
    expect(dag.getEdgeList()).toHaveLength(0);
    const childDags = dag.getChildDags();
    expect(childDags).toHaveLength(1);
    const childDag = childDags[0];
    const dagEdgeList = childDag.getEdgeList();
    expect(dagEdgeList).toHaveLength(1);
    const dagEdge = dagEdgeList[0];
    expect(dagEdge.styleProperties).toEqual(sampleMap);
    expect(dagEdge.styleTags).toEqual([]);
  });
  test("variable styled not defined in child namespace", async () => {
    const sampleMap: StyleProperties = new Map([["a", "1"]]);
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("x", new Style(sampleMap, []))],
        new Call("f", []),
      ),
      new Namespace("child", [
        new Assignment([new LocalVariable("x")], new Call("h", [])),
        new Call("g", [new QualifiedVariable(["x"])]),
      ]),
    ]);
    const dag = await makeDag(recipe, dummyImporter);
    expect(dag.getEdgeList()).toHaveLength(0);
    const childDags = dag.getChildDags();
    expect(childDags).toHaveLength(1);
    const childDag = childDags[0];
    const dagEdgeList = childDag.getEdgeList();
    expect(dagEdgeList).toHaveLength(1);
    const dagEdge = dagEdgeList[0];
    expect(dagEdge.styleProperties).toEqual(new Map());
    expect(dagEdge.styleTags).toEqual([]);
  });
  test("named style in parent namespace", async () => {
    const sampleMap: StyleProperties = new Map([["a", "1"]]);
    const recipe = new Recipe([
      new NamedStyle("s", new Style(sampleMap)),
      new Namespace("child", [
        new Call("g", [], new Style(undefined, [["s"]])),
      ]),
    ]);
    const dag = await makeDag(recipe, dummyImporter);
    const childDags = dag.getChildDags();
    expect(childDags).toHaveLength(1);
    const childDag = childDags[0];
    const dagNodeList = childDag.getNodeList();
    expect(dagNodeList).toHaveLength(1);
    const dagNode = dagNodeList[0];
    expect(dagNode.styleProperties).toEqual(new Map());
    expect(dagNode.styleTags).toEqual([["s"]]);
  });
  test("named style in child namespace", async () => {
    const sampleMap: StyleProperties = new Map([["a", "1"]]);
    const recipe = new Recipe([
      new Namespace("child", [new NamedStyle("s", new Style(sampleMap))]),
      new Call("g", [], new Style(undefined, [["child", "s"]])),
    ]);
    const dag = await makeDag(recipe, dummyImporter);
    const dagNodeList = dag.getNodeList();
    expect(dagNodeList).toHaveLength(1);
    const dagNode = dagNodeList[0];
    expect(dagNode.styleProperties).toEqual(new Map());
    expect(dagNode.styleTags).toEqual([["child", "s"]]);
  });
  test("node description and label property", async () => {
    const recipe = new Recipe([
      new Call(
        "name",
        [],
        new Style(
          new Map([
            [DESCRIPTION_PROPERTY, "my_desc"],
            ["label", "my_label"],
          ]),
        ),
      ),
    ]);
    const dag = await makeDag(recipe, dummyImporter);
    const dagNodeList = dag.getNodeList();
    expect(dagNodeList).toHaveLength(1);
    const dagNode = dagNodeList[0];
    const expectedStyleMap: StyleProperties = new Map([
      [DESCRIPTION_PROPERTY, "my_desc"],
      ["label", "my_label"],
    ]);
    expect(dagNode.styleProperties).toEqual(expectedStyleMap);
  });
  test("edge description and label property", async () => {
    const recipe = new Recipe([
      new Assignment(
        [
          new LocalVariable(
            "x",
            new Style(
              new Map([
                [DESCRIPTION_PROPERTY, "my_desc"],
                ["label", "my_label"],
              ]),
            ),
          ),
        ],
        new Call("f", []),
      ),
      new Call("g", [new QualifiedVariable(["x"])]),
    ]);
    const dag = await makeDag(recipe, dummyImporter);
    const dagEdgeList = dag.getEdgeList();
    expect(dagEdgeList).toHaveLength(1);
    const dagEdge = dagEdgeList[0];
    const expectedStyleMap: StyleProperties = new Map([
      [DESCRIPTION_PROPERTY, "my_desc"],
      ["label", "my_label"],
    ]);
    expect(dagEdge.styleProperties).toEqual(expectedStyleMap);
  });
});

describe("style binding tests", () => {
  test("no style binding", async () => {
    const recipe = new Recipe([]);
    const dag = await makeDag(recipe, dummyImporter);
    const defaultBindings = dag.getStyleBindings();
    expect(defaultBindings).toEqual(new Map<Keyword, StyleTag[]>());
  });
  test("empty style binding", async () => {
    const recipe = new Recipe([new StyleBinding("x", [])]);
    const dag = await makeDag(recipe, dummyImporter);
    const styleBindings = dag.getStyleBindings();
    const expectedBinding = new Map<Keyword, StyleTag[]>([["x", []]]);
    expect(styleBindings).toEqual(expectedBinding);
  });
  test("style bind multiple styles", async () => {
    const recipe = new Recipe([new StyleBinding("x", [["a"], ["b"]])]);
    const dag = await makeDag(recipe, dummyImporter);
    const styleBindings = dag.getStyleBindings();
    const expectedBinding = new Map<Keyword, StyleTag[]>([
      ["x", [["a"], ["b"]]],
    ]);
    expect(styleBindings).toEqual(expectedBinding);
  });
});

describe("import tests", () => {
  const importedDag = new Dag("ImportTest");
  importedDag.addNode({
    id: "idX",
    name: "nameX",
    styleTags: [],
    styleProperties: new Map(),
  });
  const mockImporter = {
    getPackage: async () => importedDag,
  } as unknown as ImportCacher;

  test("imported anonymous namespace", async () => {
    const recipe = new Recipe([new Import("path")]);
    const dag = await makeDag(recipe, mockImporter);
    expect(dag.getChildDags()).toHaveLength(0);
    const dagNodeList = dag.getNodeList();
    expect(dagNodeList).toHaveLength(1);
    const dagNode = dagNodeList[0];
    expect(dagNode.name).toEqual("nameX");
  });
  test("imported named namespace", async () => {
    const recipe = new Recipe([new Import("path", "alias")]);
    const dag = await makeDag(recipe, mockImporter);
    expect(dag.getNodeList()).toHaveLength(0);
    expect(dag.getChildDags()).toHaveLength(1);
    const childDag = dag.getChildDags()[0];
    expect(childDag.Name).toEqual("alias");
    const dagNodeList = childDag.getNodeList();
    expect(dagNodeList).toHaveLength(1);
    const dagNode = dagNodeList[0];
    expect(dagNode.name).toEqual("nameX");
  });
});
