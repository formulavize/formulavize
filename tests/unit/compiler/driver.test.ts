import { describe, test, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { fizLanguage } from "@formulavize/lang-fiz";
import {
  CallTreeNode,
  QualifiedVarTreeNode,
  RecipeTreeNode,
} from "src/compiler/ast";
import { Compiler } from "src/compiler/driver";

describe("basic compiler driver", () => {
  test("compile from editor state", async () => {
    const sourceRecipe = "f()";
    const editorState = EditorState.create({
      doc: sourceRecipe,
      extensions: [fizLanguage],
    });

    const compiler = new Compiler();
    const compilation = await compiler.compileFromEditor(editorState);

    expect(compilation.Source).toEqual(sourceRecipe);

    const expectedPosition = { from: 0, to: 3 };
    const expectedAst = new RecipeTreeNode(
      [new CallTreeNode("f", [], null, expectedPosition)],
      expectedPosition,
    );
    expect(compilation.AST).toEqual(expectedAst);

    const nodeList = compilation.DAG.getNodeList();
    expect(nodeList).toHaveLength(1);
    expect(nodeList[0].name).toEqual("f");

    expect(compilation.Errors).toHaveLength(0);
  });

  test("compile from source string", async () => {
    const sourceRecipe = "f()";

    const compiler = new Compiler();
    const compilation = await compiler.compileFromSource(sourceRecipe);

    expect(compilation.Source).toEqual(sourceRecipe);

    const expectedPosition = { from: 0, to: 3 };
    const expectedAst = new RecipeTreeNode(
      [new CallTreeNode("f", [], null, expectedPosition)],
      expectedPosition,
    );
    expect(compilation.AST).toEqual(expectedAst);

    const nodeList = compilation.DAG.getNodeList();
    expect(nodeList).toHaveLength(1);
    expect(nodeList[0].name).toEqual("f");

    expect(compilation.Errors).toHaveLength(0);
  });

  test("compile from source with error", async () => {
    const sourceRecipe = "f(x)";

    const compiler = new Compiler();
    const compilation = await compiler.compileFromSource(sourceRecipe);

    expect(compilation.Source).toEqual(sourceRecipe);

    const expectedAst = new RecipeTreeNode(
      [
        new CallTreeNode(
          "f",
          [new QualifiedVarTreeNode(["x"], { from: 2, to: 3 })],
          null,
          { from: 0, to: 4 },
        ),
      ],
      { from: 0, to: 4 },
    );
    expect(compilation.AST).toEqual(expectedAst);

    const nodeList = compilation.DAG.getNodeList();
    expect(nodeList).toHaveLength(1);
    expect(nodeList[0].name).toEqual("f");

    expect(compilation.Errors).toHaveLength(1);
    expect(compilation.Errors[0].message).toEqual("Variable 'x' not found");
  });
});
