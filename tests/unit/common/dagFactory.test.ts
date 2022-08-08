import { describe, test, expect } from 'vitest'
import { RecipeTreeNode as Recipe,
  CallTreeNode as Call,
  AssignmentTreeNode as Assignment,
  AliasTreeNode as Alias,
  VariableTreeNode as Variable,
  StyleTreeNode as Style,
  NamedStyleTreeNode as NamedStyle,
} from '../../../src/common/ast'
import { Dag } from "../../../src/common/dag"
import { makeDag } from "../../../src/common/dagFactory"


describe("node tests", () => {
  test("empty recipe", () => {
    const recipe = new Recipe()
    expect(makeDag(recipe)).toEqual(new Dag())
  })
  test("one node", () => {
    const recipe = new Recipe([
      new Call("a", [])
    ])
    const nodeList = ["a"]
    expect(makeDag(recipe).getNodeNameList())
      .toEqual(nodeList)
  })
  test("two nodes", () => {
    const recipe = new Recipe([
      new Call("b", []),
      new Call("a", [])
    ])
    const nodeList = ["a", "b"]
    expect(makeDag(recipe).getNodeNameList())
      .toEqual(nodeList)
  })
  test("duplicate name nodes", () => {
    const recipe = new Recipe([
      new Call("a", []),
      new Call("a", [])
    ])
    const nodeList = ["a", "a"]
    expect(makeDag(recipe).getNodeNameList())
      .toEqual(nodeList)
  })
  test("nested name nodes", () => {
    const recipe = new Recipe([
      new Call("f", [
        new Call("v", [])
      ]),
    ])
    const nodeList = ["f", "v"]
    expect(makeDag(recipe).getNodeNameList())
      .toEqual(nodeList)
  })
})

describe("edge tests", () => {
  test("no edge", () => {
    const recipe = new Recipe([
      new Call("b", []),
      new Call("a", [])
    ])
    expect(makeDag(recipe).getEdgeNamesList())
      .toEqual([])
  })
  test("one edge through call", () => {
    const recipe = new Recipe([
      new Call("f", [
        new Call("v", [])
      ]),
    ])
    const edgeList = [["v", "f"]]
    expect(makeDag(recipe).getEdgeNamesList())
      .toEqual(edgeList)
  })
  test("one edge through variable", () => {
    const recipe = new Recipe([
      new Assignment([new Variable("x")], new Call("y", [])),
      new Call("z", [new Variable("x")])
    ])
    const edgeList = [["y", "z"]]
    expect(makeDag(recipe).getEdgeNamesList())
      .toEqual(edgeList)
  })
  test("two separate edges", () => {
    const recipe = new Recipe([
      new Assignment([new Variable("a")], new Call("b", [])),
      new Assignment([new Variable("c")], new Call("d", [])),
      new Call("e", [new Variable("a")]),
      new Call("f", [new Variable("c")])
    ])
    const edgeList = [["b", "e"], ["d", "f"]]
    expect(makeDag(recipe).getEdgeNamesList())
      .toEqual(edgeList)
  })
  test("two dependency function", () => {
    const recipe = new Recipe([
      new Assignment([new Variable("a")], new Call("b", [])),
      new Assignment([new Variable("c")], new Call("d", [])),
      new Call("e", [new Variable("a"), new Variable("c")]),
    ])
    const edgeList = [["b", "e"], ["d", "e"]]
    expect(makeDag(recipe).getEdgeNamesList())
      .toEqual(edgeList)
  })
  test("function with one var multiple consumers", () => {
    const recipe = new Recipe([
      new Assignment([new Variable("a")], new Call("b", [])),
      new Call("y", [new Variable("a")]),
      new Call("x", [new Variable("a")]),
    ])
    const edgeList = [["b", "x"], ["b", "y"]]
    expect(makeDag(recipe).getEdgeNamesList())
      .toEqual(edgeList)
  })
  test("function with two vars different consumers", () => {
    const recipe = new Recipe([
      new Assignment([new Variable("a"), new Variable("b")], new Call("c", [])),
      new Call("y", [new Variable("a")]),
      new Call("x", [new Variable("b")]),
    ])
    const edgeList = [["c", "x"], ["c", "y"]]
    expect(makeDag(recipe).getEdgeNamesList())
      .toEqual(edgeList)
  })
  test("function with double edge", () => {
    const recipe = new Recipe([
      new Assignment([new Variable("a"), new Variable("b")], new Call("c", [])),
      new Call("y", [new Variable("a"), new Variable("b")])
    ])
    const edgeList = [["c", "y"], ["c", "y"]]
    expect(makeDag(recipe).getEdgeNamesList())
      .toEqual(edgeList)
  })
  test("function with re-used vars", () => {
    const recipe = new Recipe([
      new Assignment([new Variable("a")], new Call("c", [])),
      new Call("y", [new Variable("a"), new Variable("a"), new Variable("a")])
    ])
    const edgeList = [["c", "y"], ["c", "y"], ["c", "y"]]
    expect(makeDag(recipe).getEdgeNamesList())
      .toEqual(edgeList)
  })
  test("aliased variable", () => {
    const recipe = new Recipe([
      new Assignment([new Variable("a")], new Call("c", [])),
      new Alias(new Variable("b"), new Variable("a")),
      new Call("y", [new Variable("b")])
    ])
    const edgeList = [["c", "y"]]
    expect(makeDag(recipe).getEdgeNamesList())
      .toEqual(edgeList)
  })
  test("call with nested call and var", () => {
    const recipe = new Recipe([
      new Assignment([new Variable("a")], new Call("c", [])),
      new Call("y", [new Variable("a"), new Call("b", [])])
    ])
    const edgeList = [["b", "y"], ["c", "y"]]
    expect(makeDag(recipe).getEdgeNamesList())
      .toEqual(edgeList)
  })
  test("duplicate nested calls", () => {
    const recipe = new Recipe([
      new Call("y", [new Call("b", []), new Call("b", [])])
    ])
    const edgeList = [["b", "y"], ["b", "y"]]
    expect(makeDag(recipe).getEdgeNamesList())
      .toEqual(edgeList)
  })

  describe("style tests", () => {
    test("basic named style", () => {
      const sampleMap = new Map<string, string>([["a", "1"]])
      const recipe = new Recipe([
        new NamedStyle("s", new Style(sampleMap))
      ])
      const expectedMap = new Map<string, Map<string, string>>([
        ["s", sampleMap]
      ])
      expect(makeDag(recipe).getFlattenedStyles())
        .toEqual(expectedMap)
    })
  })
  test("named style referenced", () => {
    const sampleMap = new Map<string, string>([["a", "1"]])
    const recipe = new Recipe([
      new NamedStyle("s", new Style(sampleMap)),
      new NamedStyle("t", new Style(undefined, ["s"])),
    ])
    const expectedMap = new Map<string, Map<string, string>>([
      ["s", sampleMap],
      ["t", sampleMap],
    ])
    expect(makeDag(recipe).getFlattenedStyles())
        .toEqual(expectedMap)
  })
  test("named style local overwrite", () => {
    const sampleMap = new Map<string, string>([["a", "old"]])
    const localMap = new Map<string, string>([["a", "new"]])
    const recipe = new Recipe([
      new NamedStyle("s", new Style(sampleMap)),
      new NamedStyle("t", new Style(localMap, ["s"])),
    ])
    const expectedMap = new Map<string, Map<string, string>>([
      ["s", sampleMap],
      ["t", localMap],
    ])
    expect(makeDag(recipe).getFlattenedStyles())
        .toEqual(expectedMap)
  })
  test("named style undeclared tag", () => {
    const recipe = new Recipe([
      new NamedStyle("s", new Style(undefined, ["s"])),
    ])
    const expectedMap = new Map<string, Map<string, string>>([
      ["s", new Map<string, string>()],
    ])
    expect(makeDag(recipe).getFlattenedStyles())
        .toEqual(expectedMap)
  })
  test("call styled", () => {
    const sampleMap = new Map<string, string>([["a", "1"]])
    const recipe = new Recipe([
      new Call("f", [], new Style(sampleMap, ["s"])),
    ])
    const dagNodeList = makeDag(recipe).getNodeList()
    expect(dagNodeList).toHaveLength(1)
    const dagNode = dagNodeList[0]
    expect(dagNode.styleMap).toEqual(sampleMap)
    expect(dagNode.styleTags).toEqual(["s"])
  })
  test("variable styled", () => {
    const sampleMap = new Map<string, string>([["a", "1"]])
    const recipe = new Recipe([
      new Assignment(
        [new Variable("x", new Style(sampleMap, ["s"]))],
        new Call("f", [])
      ),
      new Call("g", [new Variable("x")])
    ])
    const dagEdgeList = makeDag(recipe).getEdgeList()
    expect(dagEdgeList).toHaveLength(1)
    const dagEdge = dagEdgeList[0]
    expect(dagEdge.styleMap).toEqual(sampleMap)
    expect(dagEdge.styleTags).toEqual(["s"])
  })
  test("multiple styled variables assigned", () => {
    const sampleMap = new Map<string, string>([["a", "1"]])
    const sampleMap2 = new Map<string, string>([["b", "2"]])
    const recipe = new Recipe([
      new NamedStyle("s", new Style(sampleMap)),
      new Assignment(
        [
          new Variable("x", new Style(undefined, ["s"])),
          new Variable("y", new Style(sampleMap2, []))
        ],
        new Call("f", [])
      ),
      new Call("g", [new Variable("x"), new Variable("y")])
    ])
    const dagEdgeList = makeDag(recipe).getEdgeList()
    expect(dagEdgeList).toHaveLength(2)
    let dagEdge1 = dagEdgeList[0]
    let dagEdge2 = dagEdgeList[1]
    if (dagEdge1.name === "y" && dagEdge2.name === "x") {
      [dagEdge1, dagEdge2] = [dagEdge2, dagEdge1]
    }
    expect(dagEdge1.styleMap).toEqual(new Map())
    expect(dagEdge1.styleTags).toEqual(["s"])
    expect(dagEdge2.styleMap).toEqual(sampleMap2)
    expect(dagEdge2.styleTags).toEqual([])
  })
})