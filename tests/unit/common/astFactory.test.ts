import { fillTree } from 'common/astFactory'
import { RecipeTreeNode as Recipe,
         CallTreeNode as Call,
         AssignmentTreeNode as Assignment,
         AliasTreeNode as Alias,
         VariableTreeNode as Variable,
         BaseTreeNode } from "common/ast"
import { EditorState } from "@codemirror/state"
import { fizLanguage } from 'lang-fiz'

function makeTree(input: string): BaseTreeNode {
  return fillTree(EditorState.create({
    doc: input,
    extensions: [ fizLanguage ]
  }))
}

describe("inactive elements", () => {
  test("with empty string", () => {
    const input = ""
    expect(makeTree(input)).toEqual(new Recipe())
  })
  test("with whitespaces", () => {
    const input = " \n\t"
    expect(makeTree(input)).toEqual(new Recipe())
  })
  test("line comment", () => {
    const input = "// line comment"
    expect(makeTree(input)).toEqual(new Recipe())
  })
  test("block comment", () => {
    const input = "/* block comment */"
    expect(makeTree(input)).toEqual(new Recipe())
  })
})

describe("single statements", () => {
  test("call statement", () => {
    const input = "f(v)"
    expect(makeTree(input)).toEqual(
      new Recipe([ new Call("f", [ new Variable("v") ]) ])
    )
  })
  test("alias statement", () => {
    const input = "y = x"
    expect(makeTree(input)).toEqual(
      new Recipe([ new Alias(new Variable("y"), new Variable("x")) ])
    )
  })
  test("assignment statement", () => {
    const input = "a, b = c()"
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Assignment(
          [ new Variable("a"), new Variable("b") ],
          new Call("c", [])
        )
      ])
    )
  })
})

describe("multiple statements", () => {
  test("newline separated", () => {
    const input = "y = f()\n x = y\n z(x)"
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Assignment([ new Variable("y") ], new Call("f", [])),
        new Alias(new Variable("x"), new Variable("y")),
        new Call("z", [ new Variable("x") ])
      ])
    )
  })
  test("semicolon seperated", () => {
    const input = "y=f();x=y;z(x)"
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Assignment([new Variable("y")], new Call("f", [])),
        new Alias(new Variable("x"), new Variable("y")),
        new Call("z", [new Variable("x")])
      ])
    )
  })
})

describe("incomplete statements", () => {
  test("incomplete assignment", () => {
    const input = "y=f("
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Assignment([new Variable("y")], new Call("f", []))
      ])
    )
  })
  test("incomplete nested call", () => {
    const input = "x=y //test \ny=f(\n\t z()"
    expect(makeTree(input)).toEqual(
      new Recipe([
        new Alias(new Variable("x"), new Variable("y")),
        new Assignment(
          [ new Variable("y") ], 
          new Call("f", [ new Call("z", []) ])),
      ])
    )
  })
})