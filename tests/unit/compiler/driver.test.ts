import { describe, test, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { fizLanguage } from "@formulavize/lang-fiz";
import { CallTreeNode, RecipeTreeNode } from "../../../src/compiler/ast";
import { Compiler } from "../../../src/compiler/driver";

describe("basic compiler driver", () => {
  test("compile from editor state", async () => {
    const editorState = EditorState.create({
      doc: "f()",
      extensions: [fizLanguage],
    });

    const compiler = new Compiler();
    const compilation = await compiler.compileFromEditor(editorState);

    expect(compilation.Source).toBe("f()");

    const expectedAst = new RecipeTreeNode([new CallTreeNode("f", [])]);
    expect(compilation.AST).toEqual(expectedAst);

    const nodeList = compilation.DAG.getNodeList();
    expect(nodeList).toHaveLength(1);
    expect(nodeList[0].name).toEqual("f");
  });

  test("compile from source string", async () => {
    const sourceRecipe = "f()";

    const compiler = new Compiler();
    const compilation = await compiler.compileFromSource(sourceRecipe);

    expect(compilation.Source).toBe("f()");

    const expectedAst = new RecipeTreeNode([new CallTreeNode("f", [])]);
    expect(compilation.AST).toEqual(expectedAst);

    const nodeList = compilation.DAG.getNodeList();
    expect(nodeList).toHaveLength(1);
    expect(nodeList[0].name).toEqual("f");
  });
});
