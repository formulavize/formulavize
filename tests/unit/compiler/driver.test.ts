import { describe, test, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { fizLanguage } from "@formulavize/lang-fiz";
import { CallTreeNode, RecipeTreeNode } from "../../../src/compiler/ast";
import { Compiler } from "../../../src/compiler/driver";

describe("basic compiler driver", () => {
  test("compile from editor state", () => {
    const editorState = EditorState.create({
      doc: "f()",
      extensions: [fizLanguage],
    });

    const sourceGen = Compiler.sourceFromEditor;
    const parse = Compiler.parseFromEditor;
    const compiler = new Compiler.Driver();
    const compilation = compiler.compile(editorState, sourceGen, parse);

    expect(compilation.Source).toBe("f()");

    const expectedAst = new RecipeTreeNode([new CallTreeNode("f", [])]);
    expect(compilation.AST).toEqual(expectedAst);

    const nodeList = compilation.DAG.getNodeList();
    expect(nodeList).toHaveLength(1);
    expect(nodeList[0].name).toEqual("f");
  });

  test("compile from source string", () => {
    const sourceRecipe = "f()";

    const sourceGen = Compiler.sourceFromSource;
    const parse = Compiler.parseFromSource;
    const compiler = new Compiler.Driver();
    const compilation = compiler.compile(sourceRecipe, sourceGen, parse);

    expect(compilation.Source).toBe("f()");

    const expectedAst = new RecipeTreeNode([new CallTreeNode("f", [])]);
    expect(compilation.AST).toEqual(expectedAst);

    const nodeList = compilation.DAG.getNodeList();
    expect(nodeList).toHaveLength(1);
    expect(nodeList[0].name).toEqual("f");
  });
});
