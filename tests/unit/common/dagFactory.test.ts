import { describe, test, expect } from 'vitest'
import { RecipeTreeNode as Recipe,
  CallTreeNode as Call,
  AssignmentTreeNode as Assignment,
  AliasTreeNode as Alias,
  VariableTreeNode as Variable} from '../../../src/common/ast'
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
})