import { describe, test, expect } from "vitest";
import {
  RecipeTreeNode as Recipe,
  CallTreeNode as Call,
  AssignmentTreeNode as Assignment,
  LocalVarTreeNode as LocalVariable,
  QualifiedVarTreeNode as QualifiedVariable,
  StyleTreeNode as Style,
  StyleTagTreeNode as StyleTagNode,
  StyleTagListTreeNode as StyleTagList,
  NamedStyleTreeNode as NamedStyle,
  StyleBindingTreeNode as StyleBinding,
  NamespaceTreeNode as Namespace,
  ImportTreeNode as Import,
  ValueListTreeNode as ValueList,
} from "src/compiler/ast";
import { DESCRIPTION_PROPERTY } from "src/compiler/constants";
import { Dag, StyleTag, StyleProperties, Keyword } from "src/compiler/dag";
import { makeDag } from "src/compiler/dagFactory";
import { ImportCacher } from "src/compiler/importCacher";
import {
  DEFAULT_POSITION,
  CompilationError,
} from "src/compiler/compilationErrors";

const dummyImporter = {} as ImportCacher;

describe("node tests", () => {
  async function makeDagAndReturnNodeNames(recipe: Recipe): Promise<string[]> {
    const { dag } = await makeDag(recipe, dummyImporter);
    return dag
      .getNodeList()
      .map((node) => node.name)
      .sort();
  }

  test("empty recipe", async () => {
    const recipe = new Recipe();
    const { dag } = await makeDag(recipe, dummyImporter);
    expect(dag).toEqual(new Dag(dag.Id));
  });
  test("one node", async () => {
    const recipe = new Recipe([new Call("a", new ValueList([]))]);
    const nodeList = await makeDagAndReturnNodeNames(recipe);
    expect(nodeList).toEqual(["a"]);
  });
  test("two nodes", async () => {
    const recipe = new Recipe([
      new Call("b", new ValueList([])),
      new Call("a", new ValueList([])),
    ]);
    const nodeList = await makeDagAndReturnNodeNames(recipe);
    expect(nodeList).toEqual(["a", "b"]);
  });
  test("duplicate name nodes", async () => {
    const recipe = new Recipe([
      new Call("a", new ValueList([])),
      new Call("a", new ValueList([])),
    ]);
    const nodeList = await makeDagAndReturnNodeNames(recipe);
    expect(nodeList).toEqual(["a", "a"]);
  });
  test("nested name nodes", async () => {
    const recipe = new Recipe([
      new Call("f", new ValueList([new Call("v", new ValueList([]))])),
    ]);
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
    const { dag } = await makeDag(recipe, dummyImporter);
    const nodeIdToNameMap = getAllNodeNamesToNodeIds(dag);
    const edgeList = getDagEdgeNames(dag, nodeIdToNameMap);
    return dag
      .getChildDags()
      .map((childDag) => getDagEdgeNames(childDag, nodeIdToNameMap))
      .reduce((acc, val) => acc.concat(val), edgeList);
  }

  test("no edge", async () => {
    const recipe = new Recipe([
      new Call("b", new ValueList([])),
      new Call("a", new ValueList([])),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([]);
  });
  test("one edge through call", async () => {
    const recipe = new Recipe([
      new Call("f", new ValueList([new Call("v", new ValueList([]))])),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([["v", "f"]]);
  });
  test("one edge through variable", async () => {
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("x")],
        new Call("y", new ValueList([])),
      ),
      new Call("z", new ValueList([new QualifiedVariable(["x"])])),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([["y", "z"]]);
  });
  test("two separate edges", async () => {
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("a")],
        new Call("b", new ValueList([])),
      ),
      new Assignment(
        [new LocalVariable("c")],
        new Call("d", new ValueList([])),
      ),
      new Call("e", new ValueList([new QualifiedVariable(["a"])])),
      new Call("f", new ValueList([new QualifiedVariable(["c"])])),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([
      ["b", "e"],
      ["d", "f"],
    ]);
  });
  test("two dependency function", async () => {
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("a")],
        new Call("b", new ValueList([])),
      ),
      new Assignment(
        [new LocalVariable("c")],
        new Call("d", new ValueList([])),
      ),
      new Call(
        "e",
        new ValueList([
          new QualifiedVariable(["a"]),
          new QualifiedVariable(["c"]),
        ]),
      ),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([
      ["b", "e"],
      ["d", "e"],
    ]);
  });
  test("function with one var multiple consumers", async () => {
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("a")],
        new Call("b", new ValueList([])),
      ),
      new Call("y", new ValueList([new QualifiedVariable(["a"])])),
      new Call("x", new ValueList([new QualifiedVariable(["a"])])),
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
        new Call("c", new ValueList([])),
      ),
      new Call("y", new ValueList([new QualifiedVariable(["a"])])),
      new Call("x", new ValueList([new QualifiedVariable(["b"])])),
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
        new Call("c", new ValueList([])),
      ),
      new Call(
        "y",
        new ValueList([
          new QualifiedVariable(["a"]),
          new QualifiedVariable(["b"]),
        ]),
      ),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([
      ["c", "y"],
      ["c", "y"],
    ]);
  });
  test("function with re-used vars", async () => {
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("a")],
        new Call("c", new ValueList([])),
      ),
      new Call(
        "y",
        new ValueList([
          new QualifiedVariable(["a"]),
          new QualifiedVariable(["a"]),
          new QualifiedVariable(["a"]),
        ]),
      ),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([
      ["c", "y"],
      ["c", "y"],
      ["c", "y"],
    ]);
  });
  test("transitive reference to assigned variable", async () => {
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("a")],
        new Call("c", new ValueList([])),
      ),
      new Assignment([new LocalVariable("b")], new QualifiedVariable(["a"])),
      new Call("y", new ValueList([new QualifiedVariable(["b"])])),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([["c", "y"]]);
  });
  test("call with nested call and var", async () => {
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("a")],
        new Call("c", new ValueList([])),
      ),
      new Call(
        "y",
        new ValueList([
          new QualifiedVariable(["a"]),
          new Call("b", new ValueList([])),
        ]),
      ),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([
      ["b", "y"],
      ["c", "y"],
    ]);
  });
  test("duplicate nested calls", async () => {
    const recipe = new Recipe([
      new Call(
        "y",
        new ValueList([
          new Call("b", new ValueList([])),
          new Call("b", new ValueList([])),
        ]),
      ),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([
      ["b", "y"],
      ["b", "y"],
    ]);
  });
  test("cannot resolve variable usage before assignment", async () => {
    const recipe = new Recipe([
      new Call("y", new ValueList([new QualifiedVariable(["a"])])),
      new Assignment(
        [new LocalVariable("a")],
        new Call("b", new ValueList([])),
      ),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    // no edge should be created because variable a is used before assignment
    expect(edgeList).toEqual([]);
  });
  test("resolve variable in parent namespace", async () => {
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("a")],
        new Call("b", new ValueList([])),
      ),
      new Namespace("child", [
        new Call("y", new ValueList([new QualifiedVariable(["a"])])),
      ]),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([["b", "y"]]);
  });
  test("cannot directly resolve variable in child namespace", async () => {
    const recipe = new Recipe([
      new Namespace("child", [
        new Assignment(
          [new LocalVariable("a")],
          new Call("b", new ValueList([])),
        ),
      ]),
      new Call("y", new ValueList([new QualifiedVariable(["a"])])),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([]);
  });
  test("resolve variable in child namespace", async () => {
    const recipe = new Recipe([
      new Namespace("child", [
        new Assignment(
          [new LocalVariable("a")],
          new Call("b", new ValueList([])),
        ),
      ]),
      new Call("y", new ValueList([new QualifiedVariable(["child", "a"])])),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([["b", "y"]]);
  });
  test("resolve variable in sibling namespace", async () => {
    const recipe = new Recipe([
      new Namespace("child", [
        new Assignment(
          [new LocalVariable("a")],
          new Call("b", new ValueList([])),
        ),
      ]),
      new Namespace("sibling", [
        new Call("y", new ValueList([new QualifiedVariable(["child", "a"])])),
      ]),
    ]);
    const edgeList = await makeDagAndReturnEdgeNames(recipe);
    expect(edgeList).toEqual([["b", "y"]]);
  });
  test("namespace with args makes incoming edges", async () => {
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("y")],
        new Call("f", new ValueList([])),
      ),
      new Namespace(
        "child",
        [new Call("g", new ValueList([]))],
        new ValueList([
          new QualifiedVariable(["y"]),
          new Call("h", new ValueList([])),
        ]),
      ),
    ]);
    const { dag } = await makeDag(recipe, dummyImporter);
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
      new Call("g", new ValueList([new QualifiedVariable(["y"])])),
    ]);
    const { dag } = await makeDag(recipe, dummyImporter);
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
      new Call("g", new ValueList([new QualifiedVariable(["y"])])),
    ]);
    const { dag } = await makeDag(recipe, dummyImporter);
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
    const { dag } = await makeDag(recipe, dummyImporter);
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
      new NamedStyle("t", new Style(undefined, [new StyleTagNode(["s"])])),
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
      new NamedStyle("t", new Style(localMap, [new StyleTagNode(["s"])])),
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
      new NamedStyle("s", new Style(undefined, [new StyleTagNode(["s"])])),
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
      new Call(
        "f",
        new ValueList([]),
        new Style(sampleMap, [new StyleTagNode(["s"])]),
      ),
    ]);
    const { dag } = await makeDag(recipe, dummyImporter);
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
        [
          new LocalVariable(
            "x",
            new Style(sampleMap, [new StyleTagNode(["s"])]),
          ),
        ],
        new Call("f", new ValueList([])),
      ),
      new Call("g", new ValueList([new QualifiedVariable(["x"])])),
    ]);
    const { dag } = await makeDag(recipe, dummyImporter);
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
          new LocalVariable(
            "x",
            new Style(undefined, [new StyleTagNode(["s"])]),
          ),
          new LocalVariable("y", new Style(sampleMap2, [])),
        ],
        new Call("f", new ValueList([])),
      ),
      new Call(
        "g",
        new ValueList([
          new QualifiedVariable(["x"]),
          new QualifiedVariable(["y"]),
        ]),
      ),
    ]);
    const { dag } = await makeDag(recipe, dummyImporter);
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
        new Call("f", new ValueList([])),
      ),
      new Namespace("child", [
        new Call("g", new ValueList([new QualifiedVariable(["x"])])),
      ]),
    ]);
    const { dag } = await makeDag(recipe, dummyImporter);
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
        new Call("f", new ValueList([])),
      ),
      new Namespace("child", [
        new Assignment(
          [new LocalVariable("x")],
          new Call("h", new ValueList([])),
        ),
        new Call("g", new ValueList([new QualifiedVariable(["x"])])),
      ]),
    ]);
    const { dag } = await makeDag(recipe, dummyImporter);
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
        new Call(
          "g",
          new ValueList([]),
          new Style(undefined, [new StyleTagNode(["s"])]),
        ),
      ]),
    ]);
    const { dag } = await makeDag(recipe, dummyImporter);
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
      new Call(
        "g",
        new ValueList([]),
        new Style(undefined, [new StyleTagNode(["child", "s"])]),
      ),
    ]);
    const { dag } = await makeDag(recipe, dummyImporter);
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
        new ValueList([]),
        new Style(
          new Map([
            [DESCRIPTION_PROPERTY, "my_desc"],
            ["label", "my_label"],
          ]),
        ),
      ),
    ]);
    const { dag } = await makeDag(recipe, dummyImporter);
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
        new Call("f", new ValueList([])),
      ),
      new Call("g", new ValueList([new QualifiedVariable(["x"])])),
    ]);
    const { dag } = await makeDag(recipe, dummyImporter);
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
    const { dag } = await makeDag(recipe, dummyImporter);
    const defaultBindings = dag.getStyleBindings();
    expect(defaultBindings).toEqual(new Map<Keyword, StyleTag[]>());
  });
  test("empty style binding", async () => {
    const recipe = new Recipe([new StyleBinding("x", new StyleTagList([]))]);
    const { dag } = await makeDag(recipe, dummyImporter);
    const styleBindings = dag.getStyleBindings();
    const expectedBinding = new Map<Keyword, StyleTag[]>([["x", []]]);
    expect(styleBindings).toEqual(expectedBinding);
  });
  test("style bind multiple styles", async () => {
    const recipe = new Recipe([
      new StyleBinding(
        "x",
        new StyleTagList([new StyleTagNode(["a"]), new StyleTagNode(["b"])]),
      ),
    ]);
    const { dag } = await makeDag(recipe, dummyImporter);
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
    getPackageDag: async () => importedDag,
  } as unknown as ImportCacher;

  test("imported anonymous namespace", async () => {
    const recipe = new Recipe([new Import("path")]);
    const { dag } = await makeDag(recipe, mockImporter);
    expect(dag.getChildDags()).toHaveLength(0);
    const dagNodeList = dag.getNodeList();
    expect(dagNodeList).toHaveLength(1);
    const dagNode = dagNodeList[0];
    expect(dagNode.name).toEqual("nameX");
  });
  test("imported named namespace", async () => {
    const recipe = new Recipe([new Import("path", "alias")]);
    const { dag } = await makeDag(recipe, mockImporter);
    expect(dag.getNodeList()).toHaveLength(0);
    expect(dag.getChildDags()).toHaveLength(1);
    const childDag = dag.getChildDags()[0];
    expect(childDag.Name).toEqual("alias");
    const dagNodeList = childDag.getNodeList();
    expect(dagNodeList).toHaveLength(1);
    const dagNode = dagNodeList[0];
    expect(dagNode.name).toEqual("nameX");
  });
  test("imported anonymous namespace in assignment", async () => {
    const recipe = new Recipe([
      new Assignment([new LocalVariable("x")], new Import("path")),
      new Call("y", new ValueList([new QualifiedVariable(["x"])])),
    ]);
    const { dag } = await makeDag(recipe, mockImporter);
    expect(dag.getChildDags()).toHaveLength(1);
    const childDag = dag.getChildDags()[0];
    expect(childDag.Name).toEqual("");
    const childDagNodeList = childDag.getNodeList();
    expect(childDagNodeList).toHaveLength(1);
    const childDagNode = childDagNodeList[0];
    expect(childDagNode.name).toEqual("nameX");

    const dagEdgeList = dag.getEdgeList();
    expect(dagEdgeList).toHaveLength(1);
  });
  test("imported named namespace in assignment", async () => {
    const recipe = new Recipe([
      new Assignment([new LocalVariable("x")], new Import("path", "alias")),
      new Call("y", new ValueList([new QualifiedVariable(["x"])])),
    ]);
    const { dag } = await makeDag(recipe, mockImporter);
    expect(dag.getChildDags()).toHaveLength(1);
    const childDag = dag.getChildDags()[0];
    expect(childDag.Name).toEqual("alias");
    const childDagNodeList = childDag.getNodeList();
    expect(childDagNodeList).toHaveLength(1);
    const childDagNode = childDagNodeList[0];
    expect(childDagNode.name).toEqual("nameX");

    const dagEdgeList = dag.getEdgeList();
    expect(dagEdgeList).toHaveLength(1);
  });

  const mockImporterError = {
    getPackageDag: async () => {
      throw new Error("import error");
    },
  } as unknown as ImportCacher;

  test("continue after problematic import", async () => {
    const recipe = new Recipe([
      new Import("path"),
      new Call("f", new ValueList([])),
    ]);
    const { dag } = await makeDag(recipe, mockImporterError);
    expect(dag.getChildDags()).toHaveLength(0);
    const dagNodeList = dag.getNodeList();
    expect(dagNodeList).toHaveLength(1);
    const dagNode = dagNodeList[0];
    expect(dagNode.name).toEqual("f");
  });
});

describe("error reporting", () => {
  function expectError(
    error: CompilationError,
    expectedError: {
      message: string;
      severity: string;
      source: string;
    },
  ): void {
    expect(error.message).toEqual(expectedError.message);
    expect(error.severity).toEqual(expectedError.severity);
    expect(error.source).toEqual(expectedError.source);
  }
  function expectReferenceError(
    error: CompilationError,
    expectedMessage: string,
  ): void {
    expectError(error, {
      message: expectedMessage,
      severity: "error",
      source: "Reference",
    });
  }
  function expectSyntaxError(
    error: CompilationError,
    expectedMessage: string,
  ): void {
    expectError(error, {
      message: expectedMessage,
      severity: "error",
      source: "Syntax",
    });
  }
  test("argListToEdgeInfo reports error when variable not found", async () => {
    const recipe = new Recipe([
      new Call("f", new ValueList([new QualifiedVariable(["not_found_var"])])),
    ]);
    const { dag, errors } = await makeDag(recipe, dummyImporter);

    expect(errors).toHaveLength(1);
    expectReferenceError(errors[0], "Variable 'not_found_var' not found");

    const dagNodeList = dag.getNodeList();
    expect(dagNodeList).toHaveLength(1);
    const dagNode = dagNodeList[0];
    expect(dagNode.name).toEqual("f");
  });
  test("assignment reports error when variable not found", async () => {
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("b")],
        new QualifiedVariable(["not_found_var"]),
      ),
    ]);
    const { dag, errors } = await makeDag(recipe, dummyImporter);

    expect(errors).toHaveLength(1);
    expectReferenceError(errors[0], "Variable 'not_found_var' not found");

    expect(dag.getNodeList()).toHaveLength(0);
    expect(dag.getEdgeList()).toHaveLength(0);
  });
  test("error reporting when import fails", async () => {
    const mockImporterError = {
      getPackageDag: async () => {
        throw new Error("import error");
      },
    } as unknown as ImportCacher;

    const recipe = new Recipe([new Import("bad_path")]);
    const { dag, errors } = await makeDag(recipe, mockImporterError);

    expect(errors).toHaveLength(1);
    expectError(errors[0], {
      message: "import error",
      severity: "error",
      source: "Import",
    });

    expect(dag.getNodeList()).toHaveLength(0);
    expect(dag.getEdgeList()).toHaveLength(0);
    expect(dag.getChildDags()).toHaveLength(0);
  });
  test("error uses default position when node has no position", async () => {
    const recipe = new Recipe([
      new Call("f", new ValueList([new QualifiedVariable(["not_found_var"])])),
    ]);
    const { errors } = await makeDag(recipe, dummyImporter);

    expect(errors).toHaveLength(1);
    expect(errors[0].position).toEqual(DEFAULT_POSITION);
  });
  test("error uses node position when available", async () => {
    const recipe = new Recipe(
      [
        new Call(
          "f",
          new ValueList([
            new QualifiedVariable(["not_found_var"], { from: 2, to: 16 }),
          ]),
          undefined,
          {
            from: 0,
            to: 17,
          },
        ),
      ],
      { from: 0, to: 17 },
    );
    const { errors } = await makeDag(recipe, dummyImporter);

    expect(errors).toHaveLength(1);
    expect(errors[0].position).toEqual({ from: 2, to: 16 });
  });
  test("call with missing style tag reports error", async () => {
    const recipe = new Recipe([
      new Call(
        "f",
        new ValueList([]),
        new Style(undefined, [new StyleTagNode(["missingStyle"])]),
      ),
    ]);
    const { dag, errors } = await makeDag(recipe, dummyImporter);

    expect(errors).toHaveLength(1);
    expectReferenceError(errors[0], "Style tag 'missingStyle' not found");

    const dagNodeList = dag.getNodeList();
    expect(dagNodeList).toHaveLength(1);
    const dagNode = dagNodeList[0];
    expect(dagNode.name).toEqual("f");
    expect(dagNode.styleTags).toEqual([["missingStyle"]]);
  });
  test("namespace with missing style tag reports error", async () => {
    const recipe = new Recipe([
      new Namespace(
        "ns",
        [new Call("f", new ValueList([]))],
        new ValueList([]),
        new Style(undefined, [new StyleTagNode(["missingStyle"])]),
      ),
    ]);
    const { dag, errors } = await makeDag(recipe, dummyImporter);

    expect(errors).toHaveLength(1);
    expectReferenceError(errors[0], "Style tag 'missingStyle' not found");

    expect(dag.getChildDags()).toHaveLength(1);
    const childDag = dag.getChildDags()[0];
    expect(childDag.Name).toEqual("ns");
  });
  test("assignment with styled variable missing style tag reports error", async () => {
    const recipe = new Recipe([
      new Assignment(
        [
          new LocalVariable(
            "x",
            new Style(undefined, [new StyleTagNode(["missingStyle"])]),
          ),
        ],
        new Call("f", new ValueList([])),
      ),
    ]);
    const { dag, errors } = await makeDag(recipe, dummyImporter);

    expect(errors).toHaveLength(1);
    expectReferenceError(errors[0], "Style tag 'missingStyle' not found");

    const dagNodeList = dag.getNodeList();
    expect(dagNodeList).toHaveLength(1);
    const dagNode = dagNodeList[0];
    expect(dagNode.name).toEqual("f");
  });
  test("assignment with styled variable missing style tag reports error", async () => {
    const recipe = new Recipe([
      new Assignment(
        [new LocalVariable("a")],
        new Call("f", new ValueList([])),
      ),
      new Assignment(
        [
          new LocalVariable(
            "b",
            new Style(undefined, [new StyleTagNode(["missingStyle"])]),
          ),
        ],
        new QualifiedVariable(["a"]),
      ),
    ]);
    const { dag, errors } = await makeDag(recipe, dummyImporter);

    expect(errors).toHaveLength(1);
    expectReferenceError(errors[0], "Style tag 'missingStyle' not found");

    const dagNodeList = dag.getNodeList();
    expect(dagNodeList).toHaveLength(1);
    const dagNode = dagNodeList[0];
    expect(dagNode.name).toEqual("f");
  });
  test("named style with missing style tag reports error", async () => {
    const recipe = new Recipe([
      new NamedStyle(
        "t",
        new Style(undefined, [new StyleTagNode(["missingStyle"])]),
      ),
    ]);
    const { dag, errors } = await makeDag(recipe, dummyImporter);

    expect(errors).toHaveLength(1);
    expectReferenceError(errors[0], "Style tag 'missingStyle' not found");

    const styleMap = dag.getFlattenedStyles();
    expect(styleMap.get("t")).toEqual(new Map());
  });
  test("style binding with missing style tag reports error", async () => {
    const recipe = new Recipe([
      new StyleBinding(
        "x",
        new StyleTagList([new StyleTagNode(["missingStyle"])]),
      ),
    ]);
    const { dag, errors } = await makeDag(recipe, dummyImporter);

    expect(errors).toHaveLength(1);
    expectReferenceError(errors[0], "Style tag 'missingStyle' not found");

    const keywordToStyleTags = dag.getStyleBindings();
    expect(keywordToStyleTags.get("x")).toEqual([["missingStyle"]]);
  });
  test("multiple missing style tags in same statement reports multiple errors", async () => {
    const recipe = new Recipe([
      new Call(
        "f",
        new ValueList([]),
        new Style(undefined, [
          new StyleTagNode(["missingStyle1"]),
          new StyleTagNode(["missingStyle2"]),
        ]),
      ),
    ]);
    const { dag, errors } = await makeDag(recipe, dummyImporter);

    expect(errors).toHaveLength(2);
    expectReferenceError(errors[0], "Style tag 'missingStyle1' not found");
    expectReferenceError(errors[1], "Style tag 'missingStyle2' not found");

    const dagNodeList = dag.getNodeList();
    expect(dagNodeList).toHaveLength(1);
    const dagNode = dagNodeList[0];
    expect(dagNode.name).toEqual("f");
  });
  test("mixed valid and invalid style tags reports only missing ones", async () => {
    const recipe = new Recipe([
      new NamedStyle("validStyle", new Style(new Map([["color", "red"]]))),
      new Call(
        "f",
        new ValueList([]),
        new Style(undefined, [
          new StyleTagNode(["validStyle"]),
          new StyleTagNode(["missingStyle"]),
        ]),
      ),
    ]);
    const { dag, errors } = await makeDag(recipe, dummyImporter);

    expect(errors).toHaveLength(1);
    expectReferenceError(errors[0], "Style tag 'missingStyle' not found");

    const dagNodeList = dag.getNodeList();
    expect(dagNodeList).toHaveLength(1);
    const dagNode = dagNodeList[0];
    expect(dagNode.name).toEqual("f");
    expect(dagNode.styleTags).toEqual([["validStyle"], ["missingStyle"]]);
  });
  test("assignment with missing left hand side reports error", async () => {
    const recipe = new Recipe([
      new Assignment([], new Call("f", new ValueList([]))),
    ]);
    const { dag, errors } = await makeDag(recipe, dummyImporter);

    expect(errors).toHaveLength(1);
    expectSyntaxError(errors[0], "Left hand side is missing");

    const dagNodeList = dag.getNodeList();
    expect(dagNodeList).toHaveLength(0);
  });
  test("assignment with missing right hand side reports error", async () => {
    const recipe = new Recipe([new Assignment([new LocalVariable("x")], null)]);
    const { dag, errors } = await makeDag(recipe, dummyImporter);

    expect(errors).toHaveLength(1);
    expectSyntaxError(errors[0], "Right hand side is missing");

    expect(dag.getNodeList()).toHaveLength(0);
    expect(dag.getEdgeList()).toHaveLength(0);
  });
  test("assignment with missing both sides reports multiple errors", async () => {
    const recipe = new Recipe([new Assignment([], null)]);
    const { dag, errors } = await makeDag(recipe, dummyImporter);

    expect(errors).toHaveLength(2);
    expectSyntaxError(errors[0], "Left hand side is missing");
    expectSyntaxError(errors[1], "Right hand side is missing");

    expect(dag.getNodeList()).toHaveLength(0);
    expect(dag.getEdgeList()).toHaveLength(0);
  });
});
