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
  NamespaceTreeNode as Namespace,
} from "src/compiler/ast";

describe("debugDumpTree consistency", () => {
  test("dumping nodes with children has no side effects", () => {
    const callNode = new Call("f", []);
    const assignmentNode = new Assignment([new LocalVariable("x")], callNode);
    const aliasNode = new Alias(
      new LocalVariable("y"),
      new QualifiedVariable(["x"]),
    );
    const namedStyleNode = new NamedStyle("s", new Style(new Map()));
    const namespaceNode = new Namespace("n", [assignmentNode, aliasNode]);
    const recipeNode = new Recipe([namespaceNode, namedStyleNode]);

    const firstDump = recipeNode.debugDumpTree();
    const secondDump = recipeNode.debugDumpTree();
    expect(firstDump).toEqual(secondDump);
  });
});
